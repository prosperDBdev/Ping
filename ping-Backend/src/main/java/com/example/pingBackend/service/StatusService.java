package com.example.pingBackend.service;

import com.example.pingBackend.dto.request.CreateStatusRequest;
import com.example.pingBackend.dto.request.StatusPrivacyRequest;
import com.example.pingBackend.dto.response.StatusFeedEntryResponse;
import com.example.pingBackend.dto.response.StatusResponse;
import com.example.pingBackend.dto.response.UserResponse;
import com.example.pingBackend.model.Conversation;
import com.example.pingBackend.model.Status;
import com.example.pingBackend.model.User;
import com.example.pingBackend.repository.ConversationRepository;
import com.example.pingBackend.repository.StatusRepository;
import com.example.pingBackend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Everything to do with 24-hour statuses.
 *
 * THE ONE THING TO UNDERSTAND ABOUT THIS CLASS: it owns the answer to "may
 * this person see this status?", and it owns it exclusively. Every path that
 * can reveal a status — the feed, a single fetch, marking one viewed, serving
 * its image bytes, resharing it — routes through the same predicate below.
 *
 * That is not stylistic tidiness. Stage 9 shipped per-user chat clearing with
 * the rule enforced in the message list but not in the media list or the
 * direct download, so a cleared chat's files were still fetchable by anyone
 * holding a key. The bug wasn't that the rule was wrong; it was that the rule
 * existed in more than one place and only one of them got updated. Statuses
 * have strictly more ways to be revealed than messages do, so the rule lives
 * in exactly one method here and everything else asks it.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class StatusService {

    private final StatusRepository statusRepository;
    private final UserRepository userRepository;
    private final ConversationRepository conversationRepository;
    private final BlockService blockService;
    private final MediaStorageService mediaStorageService;

    @Value("${status.expiry-hours:24}")
    private long expiryHours;

    /**
     * Free-tier guard. Each sanitized image lands at roughly 200-500KB, so a
     * cap of 30 per user per day bounds the worst case at about 15MB per
     * active poster per day — a number that stays comfortably inside a free
     * object-storage tier even with the 24-hour retention overlapping.
     * Without a cap, a single account (or a single bug in a client retry loop)
     * could fill the bucket overnight.
     */
    @Value("${status.max-per-user-per-day:30}")
    private int maxPerUserPerDay;

    private static final int MAX_TEXT_LENGTH = 700;

    /**
     * Background colours are stored as a plain hex triple and nothing else.
     *
     * The client sends this and the client renders it, which is exactly the
     * shape of an injection bug: a value like "#fff; background-image:url(...)"
     * pasted into a style attribute stops being a colour and starts being CSS.
     * Validating the format on the way in means the stored value can only ever
     * be a colour, no matter what the rendering code later does with it.
     */
    private static final Pattern HEX_COLOUR = Pattern.compile("^#[0-9a-fA-F]{6}$");

    // ---------------------------------------------------------------------
    // THE VISIBILITY RULE
    // ---------------------------------------------------------------------

    /**
     * May {@code viewer} see the statuses posted by {@code author}?
     *
     * ===================================================================
     * THIS ONE IS YOURS TO WRITE. Everything else in Stage 10 is wiring;
     * this method is the stage.
     * ===================================================================
     *
     * Every other visibility question in this class is expressed in terms of
     * this method, so whatever you decide here is what "who can see my status"
     * means across the entire product. Get it right once and the feed, the
     * single fetch, the image bytes and the reshare flow are all correct for
     * free. Get it wrong and they are all wrong together — which, awkwardly,
     * is still better than the alternative where only three of the four are.
     *
     * WHAT TO IMPLEMENT, in the order the checks should run:
     *
     *   1. Fail closed on bad input. If either user is null, return false.
     *      "I don't know who this is" is never a reason to show someone's
     *      photos. Same reasoning as BlockService.isBlockedBetween returning
     *      true (= blocked) when it can't resolve an id.
     *
     *   2. You can always see your own. If viewer.getId() equals
     *      author.getId(), return true, before any other check. Without this
     *      an author who had hidden their status from someone, or who somehow
     *      isn't in their own contact set, would lose sight of their own post.
     *
     *   3. They must be a contact. Return false unless viewerContactIds
     *      contains author.getId(). This is what stops a status being public
     *      to every account on the platform: you see statuses from people you
     *      actually have a conversation with, and nobody else. The set is
     *      passed in rather than looked up here on purpose — the feed computes
     *      it once for a whole page of authors instead of once per author.
     *
     *   4. Blocking wins over everything. Return false if
     *      blockService.isBlockedBetween(viewer.getId(), author.getId()).
     *      That call is already symmetric and already fails closed, so don't
     *      re-derive either property here — just ask it. If you find yourself
     *      reading blockedUsers directly in this method, stop: that's a second
     *      copy of the blocking rule, and second copies are the bug.
     *
     *   5. The author's hidden-from list. Return false if
     *      author.getHiddenStatusFrom() contains viewer.getId().
     *
     *      Two traps here. First, that list can be NULL — every user document
     *      written before this stage has no such key, and @Builder.Default
     *      does nothing on deserialisation (the same thing that made
     *      BlockService.blocks() null-safe). Second, the direction matters:
     *      it is the AUTHOR's list that decides, checked against the VIEWER's
     *      id. Reading the viewer's list instead would mean hiding your
     *      status from someone caused THEIR statuses to vanish for YOU —
     *      backwards, and a privacy failure rather than merely a bug.
     *
     *   6. Otherwise return true.
     *
     * Deliberately NOT part of this method: expiry. Whether a status is still
     * live is a property of the status, not of the relationship between two
     * people, and it's already enforced in the repository query so that an
     * expired status is never even loaded. Mixing the two here would give you
     * a method that needs a Status to answer a question about two Users.
     */
    public boolean canSeeStatusesOf(User viewer, User author, Set<String> viewerContactIds) {
        // 1. Fail closed. An id that resolves to nobody is not permission to
        //    proceed — same stance as BlockService.isBlockedBetween returning
        //    "blocked" when it can't resolve a user.
        if (viewer == null || author == null) {
            return false;
        }

        // 2. Your own posts, before anything else can take them away from you.
        //    Ordering matters: an author who has hidden their status from
        //    someone is on their own hidden list in no sense, but they may well
        //    not be in their own contact set, and check 3 would refuse them.
        if (viewer.getId().equals(author.getId())) {
            return true;
        }

        // 3. Contacts only. This is what keeps a status from being public to
        //    every account on the platform — you see posts from people you
        //    actually have a conversation with. Null-guarded because a caller
        //    passing no set at all should mean "no contacts", not a crash.
        if (viewerContactIds == null || !viewerContactIds.contains(author.getId())) {
            return false;
        }

        // 4. Blocking outranks everything, and is asked rather than re-derived.
        //    isBlockedBetween is already symmetric and already fails closed;
        //    reading blockedUsers directly here would be a second copy of the
        //    blocking rule, free to drift from the first.
        if (blockService.isBlockedBetween(viewer.getId(), author.getId())) {
            return false;
        }

        // 5. The AUTHOR's hidden-from list, checked against the VIEWER's id.
        //    That direction is the whole content of this line: reading the
        //    viewer's list instead would mean hiding your status from someone
        //    made THEIR posts vanish for YOU.
        //
        //    Null is the normal case for any account created before this stage
        //    — the field simply isn't in the document, and @Builder.Default
        //    does nothing on deserialisation.
        List<String> hiddenFrom = author.getHiddenStatusFrom();
        return hiddenFrom == null || !hiddenFrom.contains(viewer.getId());
    }

    // ---------------------------------------------------------------------
    // Everything below is built on top of that one decision.
    // ---------------------------------------------------------------------

    /**
     * The ids of everyone this user shares any conversation with.
     *
     * "Contact" isn't a concept this app models explicitly — there's no friend
     * list — so it's derived: if you've got a conversation with someone,
     * private or group, they're a contact. That keeps the status audience
     * bounded by a relationship the user actually established, rather than
     * broadcasting to every registered account.
     */
    public Set<String> contactIdsOf(String userId) {
        List<Conversation> conversations =
                conversationRepository.findByParticipantsContainingOrderByUpdatedAtDesc(userId);

        Set<String> contacts = new HashSet<>();
        for (Conversation conversation : conversations) {
            if (conversation.getParticipants() == null) continue;
            contacts.addAll(conversation.getParticipants());
        }
        contacts.remove(userId);
        return contacts;
    }

    /**
     * Single-status visibility, for the paths that already hold one.
     *
     * Expiry is checked here because these callers fetched the status by id or
     * by media key rather than through the feed query, so nothing has filtered
     * it for them yet.
     */
    public boolean canView(Status status, User viewer) {
        if (status == null || viewer == null) {
            return false;
        }
        if (status.getAuthorId().equals(viewer.getId())) {
            return true;
        }
        if (status.getExpiresAt() == null || !status.getExpiresAt().isAfter(LocalDateTime.now())) {
            return false;
        }

        User author = userRepository.findById(status.getAuthorId()).orElse(null);
        return canSeeStatusesOf(viewer, author, contactIdsOf(viewer.getId()));
    }

    // ---------------------------------------------------------------------
    // Creating
    // ---------------------------------------------------------------------

    public StatusResponse createTextStatus(User author, CreateStatusRequest request) {
        String text = request.getText() == null ? "" : request.getText().trim();
        if (text.isEmpty()) {
            throw new InvalidMediaException("A text status needs some text");
        }
        if (text.length() > MAX_TEXT_LENGTH) {
            throw new InvalidMediaException("Status text is limited to " + MAX_TEXT_LENGTH + " characters");
        }

        String colour = request.getBackgroundColor();
        if (colour != null && !HEX_COLOUR.matcher(colour).matches()) {
            throw new InvalidMediaException("Background colour must be a hex value like #1F7A6C");
        }

        enforceDailyLimit(author.getId());

        Status status = baseStatus(author)
                .type(Status.Type.TEXT)
                .text(text)
                .backgroundColor(colour)
                .build();

        return toResponse(statusRepository.save(status), author, author.getId());
    }

    public StatusResponse createImageStatus(User author, MultipartFile file, String caption) {
        String text = caption == null ? null : caption.trim();
        if (text != null && text.length() > MAX_TEXT_LENGTH) {
            throw new InvalidMediaException("Caption is limited to " + MAX_TEXT_LENGTH + " characters");
        }

        // Checked BEFORE the upload, not after. Validating the quota only once
        // the bytes are already in R2 would mean a rejected status still cost
        // storage, which is precisely what the quota exists to prevent.
        enforceDailyLimit(author.getId());

        StoredMedia stored = mediaStorageService.uploadStatusImage(file, author.getId());

        Status status = baseStatus(author)
                .type(Status.Type.IMAGE)
                .text(text)
                .mediaKey(stored.key())
                .mediaMimeType(stored.mimeType())
                .mediaSizeBytes(stored.sizeBytes())
                .build();

        return toResponse(statusRepository.save(status), author, author.getId());
    }

    private Status.StatusBuilder baseStatus(User author) {
        LocalDateTime now = LocalDateTime.now();
        return Status.builder()
                .authorId(author.getId())
                .createdAt(now)
                .expiresAt(now.plusHours(expiryHours))
                .viewerIds(new ArrayList<>());
    }

    private void enforceDailyLimit(String authorId) {
        long recent = statusRepository.countByAuthorIdAndCreatedAtAfter(
                authorId, LocalDateTime.now().minusHours(24));
        if (recent >= maxPerUserPerDay) {
            throw new InvalidMediaException(
                    "You've reached the limit of " + maxPerUserPerDay + " statuses in 24 hours");
        }
    }

    // ---------------------------------------------------------------------
    // Reading
    // ---------------------------------------------------------------------

    /**
     * The feed: everyone whose statuses this user may see, grouped by author.
     *
     * The shape of this method is the point. Visibility is decided once, up
     * front, to produce a list of permitted author ids; the database query
     * then only ever loads statuses belonging to those authors. Nothing is
     * fetched and then filtered away afterwards — the same mistake as
     * filtering cleared messages after pagination, where the rows still left
     * the database and the page came back short.
     */
    public List<StatusFeedEntryResponse> getFeed(User viewer) {
        Set<String> contactIds = contactIdsOf(viewer.getId());
        if (contactIds.isEmpty()) {
            return List.of();
        }

        List<User> contacts = userRepository.findAllById(contactIds);
        Map<String, User> byId = contacts.stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));

        List<String> visibleAuthorIds = contacts.stream()
                .filter(author -> canSeeStatusesOf(viewer, author, contactIds))
                .map(User::getId)
                .toList();

        if (visibleAuthorIds.isEmpty()) {
            return List.of();
        }

        List<Status> statuses = statusRepository.findByAuthorIdInAndExpiresAtAfterOrderByCreatedAtAsc(
                visibleAuthorIds, LocalDateTime.now());

        Map<String, List<Status>> grouped = statuses.stream()
                .collect(Collectors.groupingBy(Status::getAuthorId));

        List<StatusFeedEntryResponse> feed = new ArrayList<>();
        for (Map.Entry<String, List<Status>> entry : grouped.entrySet()) {
            User author = byId.get(entry.getKey());
            if (author == null) continue;

            List<StatusResponse> responses = entry.getValue().stream()
                    .map(s -> toResponse(s, author, viewer.getId()))
                    .toList();

            feed.add(StatusFeedEntryResponse.builder()
                    .authorId(author.getId())
                    .authorUsername(author.getUsername())
                    .authorAvatarUrl(author.getAvatarUrl())
                    .statuses(responses)
                    .latestAt(entry.getValue().stream()
                            .map(Status::getCreatedAt)
                            .max(Comparator.naturalOrder())
                            .orElse(null))
                    .hasUnviewed(responses.stream().anyMatch(r -> !r.isViewed()))
                    .build());
        }

        // Rings with something new first, then most recent — the ordering a
        // reader actually wants, rather than whatever order Mongo returned.
        feed.sort(Comparator
                .comparing(StatusFeedEntryResponse::isHasUnviewed).reversed()
                .thenComparing(StatusFeedEntryResponse::getLatestAt, Comparator.reverseOrder()));

        return feed;
    }

    /** The author's own live statuses, with view counts attached. */
    public List<StatusResponse> getMyStatuses(User author) {
        return statusRepository
                .findByAuthorIdAndExpiresAtAfterOrderByCreatedAtAsc(author.getId(), LocalDateTime.now())
                .stream()
                .map(s -> toResponse(s, author, author.getId()))
                .toList();
    }

    /** Who has opened this status. Author only — it's their information. */
    public List<UserResponse> getViewers(String statusId, User requester) {
        Status status = requireStatus(statusId);
        if (!status.getAuthorId().equals(requester.getId())) {
            throw new ForbiddenMediaAccessException("Only the author can see who viewed a status");
        }

        List<String> viewerIds = status.getViewerIds();
        if (viewerIds == null || viewerIds.isEmpty()) {
            return List.of();
        }

        return userRepository.findAllById(viewerIds).stream()
                .map(u -> UserResponse.builder()
                        .id(u.getId())
                        .username(u.getUsername())
                        .avatarUrl(u.getAvatarUrl())
                        .status(u.getStatus())
                        .lastSeen(u.getLastSeen())
                        .build())
                .toList();
    }

    /**
     * Serve the bytes of a status image.
     *
     * The authorisation happens here rather than in MediaStorageService, so
     * that "who may see this status" has exactly one implementation. An object
     * key is not a permission — see the note on getObjectBytes.
     */
    public DownloadedMedia downloadStatusMedia(String key, User requester) {
        Status status = statusRepository.findByMediaKey(key)
                .orElseThrow(() -> new ForbiddenMediaAccessException("Status media not found"));

        if (!canView(status, requester)) {
            throw new ForbiddenMediaAccessException("You don't have access to this status");
        }

        return mediaStorageService.getObjectBytes(key);
    }

    // ---------------------------------------------------------------------
    // Acting on a status
    // ---------------------------------------------------------------------

    /** Record that someone opened a status. Idempotent. */
    public void markViewed(String statusId, User viewer) {
        Status status = requireStatus(statusId);

        if (!canView(status, viewer)) {
            throw new ForbiddenMediaAccessException("You don't have access to this status");
        }
        // An author browsing their own post isn't a viewer of it.
        if (status.getAuthorId().equals(viewer.getId())) {
            return;
        }

        if (status.getViewerIds() == null) {
            status.setViewerIds(new ArrayList<>());
        }
        if (!status.getViewerIds().contains(viewer.getId())) {
            status.getViewerIds().add(viewer.getId());
            statusRepository.save(status);
        }
    }

    /**
     * Post someone else's status to your own feed.
     *
     * Three gates, and the order matters: you must be allowed to SEE it before
     * anything else is considered, then the author must permit resharing at
     * all. Checking permission before visibility would leak the existence of
     * statuses you can't see, through the difference between "not allowed" and
     * "not found".
     */
    public StatusResponse reshare(String statusId, User resharer) {
        Status original = requireStatus(statusId);

        if (!canView(original, resharer)) {
            throw new ForbiddenMediaAccessException("You don't have access to this status");
        }

        User originalAuthor = userRepository.findById(original.getAuthorId())
                .orElseThrow(() -> new ForbiddenMediaAccessException("Original author not found"));

        if (!allowsResharing(originalAuthor)) {
            throw new ForbiddenMediaAccessException(
                    originalAuthor.getUsername() + " doesn't allow their statuses to be reshared");
        }

        enforceDailyLimit(resharer.getId());

        // Attribution follows the chain to its source. Resharing a reshare
        // credits the person who actually made the thing, not the middle of
        // the chain — and, importantly, it's the ORIGINAL author's resharing
        // setting that was just enforced, so passing content through one
        // permissive account can't launder it past a restrictive one.
        String sourceStatusId = original.getResharedFromStatusId() != null
                ? original.getResharedFromStatusId() : original.getId();
        String sourceAuthorId = original.getResharedFromAuthorId() != null
                ? original.getResharedFromAuthorId() : originalAuthor.getId();
        String sourceAuthorName = original.getResharedFromAuthorUsername() != null
                ? original.getResharedFromAuthorUsername() : originalAuthor.getUsername();

        // The R2 object is REUSED, not copied. The bytes are identical and
        // already sanitized, so a copy would double storage for nothing. The
        // price of that decision is paid in ExpiredStatusCleanupJob, which has
        // to check whether anyone else still references a key before deleting
        // it — see existsByMediaKeyAndIdNot.
        Status copy = baseStatus(resharer)
                .type(original.getType())
                .text(original.getText())
                .backgroundColor(original.getBackgroundColor())
                .mediaKey(original.getMediaKey())
                .mediaMimeType(original.getMediaMimeType())
                .mediaSizeBytes(original.getMediaSizeBytes())
                .resharedFromStatusId(sourceStatusId)
                .resharedFromAuthorId(sourceAuthorId)
                .resharedFromAuthorUsername(sourceAuthorName)
                .build();

        return toResponse(statusRepository.save(copy), resharer, resharer.getId());
    }

    /** Delete your own status early. */
    public void deleteStatus(String statusId, User requester) {
        Status status = requireStatus(statusId);

        if (!status.getAuthorId().equals(requester.getId())) {
            throw new ForbiddenMediaAccessException("You can only delete your own status");
        }

        deleteWithBlob(status);
    }

    /**
     * Remove a status and, if nothing else needs it, its stored object.
     *
     * Shared by the delete endpoint and the cleanup job so the reference check
     * can't be forgotten by one of them.
     */
    public void deleteWithBlob(Status status) {
        String key = status.getMediaKey();

        if (key != null && !statusRepository.existsByMediaKeyAndIdNot(key, status.getId())) {
            try {
                mediaStorageService.deleteObject(key);
            } catch (RuntimeException e) {
                // Same trade-off as the conversation cleanup job: removing the
                // record is the obligation, reclaiming bytes is the
                // optimization. Log loudly rather than leaving the status.
                log.error("Failed to delete status object key={} — the status row is still being "
                        + "removed, so this blob is now orphaned", key, e);
            }
        }

        statusRepository.delete(status);
    }

    // ---------------------------------------------------------------------
    // Privacy settings
    // ---------------------------------------------------------------------

    public User updatePrivacy(User user, StatusPrivacyRequest request) {
        if (request.getHiddenStatusFrom() != null) {
            // Copied into a fresh list rather than assigned directly: the
            // request object is deserialised from the wire and shouldn't end
            // up aliased inside a persisted entity.
            user.setHiddenStatusFrom(new ArrayList<>(new HashSet<>(request.getHiddenStatusFrom())));
        }
        if (request.getAllowResharing() != null) {
            user.setAllowResharing(request.getAllowResharing());
        }
        return userRepository.save(user);
    }

    /** Null means the user never expressed a preference, and the default is yes. */
    private boolean allowsResharing(User user) {
        return user.getAllowResharing() == null || user.getAllowResharing();
    }

    // ---------------------------------------------------------------------
    // Plumbing
    // ---------------------------------------------------------------------

    private Status requireStatus(String statusId) {
        Optional<Status> status = statusRepository.findById(statusId);
        // Deliberately the same exception as a permission failure. A distinct
        // "not found" would let anyone probe which status ids exist by
        // comparing the two responses.
        return status.orElseThrow(() -> new ForbiddenMediaAccessException("Status not found"));
    }

    private StatusResponse toResponse(Status status, User author, String viewerId) {
        boolean isAuthor = status.getAuthorId().equals(viewerId);
        List<String> viewers = status.getViewerIds();

        return StatusResponse.builder()
                .id(status.getId())
                .authorId(status.getAuthorId())
                .authorUsername(author != null ? author.getUsername() : null)
                .type(status.getType() != null ? status.getType().name() : null)
                .text(status.getText())
                .backgroundColor(status.getBackgroundColor())
                .mediaKey(status.getMediaKey())
                .mediaMimeType(status.getMediaMimeType())
                .createdAt(status.getCreatedAt())
                .expiresAt(status.getExpiresAt())
                .viewed(viewers != null && viewers.contains(viewerId))
                .viewerCount(isAuthor ? (viewers == null ? 0 : viewers.size()) : null)
                .resharedFromAuthorId(status.getResharedFromAuthorId())
                .resharedFromAuthorUsername(status.getResharedFromAuthorUsername())
                .reshareable(author != null && allowsResharing(author))
                .build();
    }
}
