package com.example.pingBackend.service;

import com.example.pingBackend.dto.response.ConversationResponse;
import com.example.pingBackend.exception.BadRequestException;
import com.example.pingBackend.exception.ForbiddenException;
import com.example.pingBackend.exception.GoneException;
import com.example.pingBackend.exception.NotFoundException;
import com.example.pingBackend.exception.TooManyRequestsException;
import com.example.pingBackend.model.Conversation;
import com.example.pingBackend.model.GroupInvite;
import com.example.pingBackend.model.Message;
import com.example.pingBackend.model.User;
import com.example.pingBackend.repository.ConversationRepository;
import com.example.pingBackend.repository.GroupInviteRepository;
import com.example.pingBackend.repository.UserRepository;
import com.mongodb.client.result.UpdateResult;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;

import static org.springframework.data.mongodb.core.query.Criteria.where;
import static org.springframework.data.mongodb.core.query.Query.query;

/**
 * Shareable links that let anyone join a group.
 *
 * ONE LIVE LINK PER GROUP. Making a new one deletes the old, so "make a new
 * link" genuinely revokes a link that was posted somewhere public.
 *
 * TWO ENDPOINTS, DIFFERENT PERMISSIONS. The preview (which group is this?) is
 * public, because whoever followed the link may not have an account yet.
 * Joining needs a signed-in user, because a member has to be a real person.
 *
 * THE LINK ONLY ADDS YOU. It doesn't notify anyone, doesn't let you post, and
 * expires in a week. That's deliberate: a link forwarded to a wrong person
 * should cost the group a member and nothing else.
 */
@Service
@RequiredArgsConstructor
public class GroupInviteService {

    static final Duration LIFETIME = Duration.ofDays(7);

    /** 128 random bits, 22 URL-safe characters, same shape as personal invite links. */
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final Pattern CODE_SHAPE = Pattern.compile("^[A-Za-z0-9_-]{22}$");

    private static final int PREVIEW_LIMIT = 30;
    private static final Duration PREVIEW_WINDOW = Duration.ofMinutes(10);
    private static final int JOIN_LIMIT = 20;
    private static final Duration JOIN_WINDOW = Duration.ofHours(1);
    private static final int NEW_LINK_LIMIT = 10;
    private static final Duration NEW_LINK_WINDOW = Duration.ofHours(1);

    /** One message for "no such code", "expired" and "group deleted": telling them apart helps nobody but a scanner. */
    private static final String NOT_FOUND = "This group link is invalid or has expired";

    private final GroupInviteRepository inviteRepository;
    private final ConversationRepository conversationRepository;
    private final UserRepository userRepository;
    private final MessageService messageService;
    private final ConversationService conversationService;
    private final BlockService blockService;
    private final RateLimiter rateLimiter;
    private final MongoTemplate mongoTemplate;
    private final SimpMessagingTemplate messagingTemplate;

    @Value("${app.frontend-url}")
    private String frontendUrl;

    /** What the link page shows, and what the admin's panel shows. */
    public record InviteView(String conversationId, String groupName, String inviterUsername,
                             int memberCount, int uses, LocalDateTime expiresAt, String url) {
    }

    /**
     * The group's link status. Deliberately does NOT create one: this backs a
     * GET, and a GET must never change anything (browsers prefetch links, and
     * chat apps fetch URLs to draw link previews).
     */
    public Optional<InviteView> status(String conversationId, String userId) {
        Conversation group = requireAdminGroup(conversationId, userId);
        return liveInviteFor(conversationId).map(i -> view(i, group));
    }

    /** Make a link, replacing any previous one so that one stops working at once. */
    public InviteView create(String conversationId, String userId) {
        Conversation group = requireAdminGroup(conversationId, userId);
        if (!rateLimiter.tryAcquire("group-invite-new:" + userId, NEW_LINK_LIMIT, NEW_LINK_WINDOW)) {
            throw new TooManyRequestsException("Too many new links. Please try again in a while.");
        }

        inviteRepository.deleteByConversationId(conversationId);
        LocalDateTime now = LocalDateTime.now();
        GroupInvite invite = inviteRepository.save(GroupInvite.builder()
                .conversationId(conversationId)
                .code(newCode())
                .createdBy(userId)
                .createdAt(now)
                .expiresAt(now.plus(LIFETIME))
                .uses(0)
                .build());
        return view(invite, group);
    }

    /** Switch the link off. The code stops working at once, for everyone holding it. */
    public void revoke(String conversationId, String userId) {
        requireAdminGroup(conversationId, userId);
        inviteRepository.deleteByConversationId(conversationId);
    }

    /** The link page: which group is this? Public, so it's rate limited per IP. */
    public InviteView preview(String code, String clientIp) {
        if (!rateLimiter.tryAcquire("group-invite-preview:ip:" + clientIp, PREVIEW_LIMIT, PREVIEW_WINDOW)) {
            throw new TooManyRequestsException("Too many attempts. Please try again in a few minutes.");
        }
        GroupInvite invite = liveInvite(code);
        return view(invite, group(invite.getConversationId()));
    }

    /** Join the group. Signed in, rate limited, and the usual group rules apply. */
    public ConversationResponse join(String code, User joiner, String clientIp) {
        if (!rateLimiter.tryAcquire("group-invite-join:ip:" + clientIp, JOIN_LIMIT, JOIN_WINDOW)
                || !rateLimiter.tryAcquire("group-invite-join:user:" + joiner.getId(), JOIN_LIMIT, JOIN_WINDOW)) {
            throw new TooManyRequestsException("Too many attempts. Please try again later.");
        }

        GroupInvite invite = liveInvite(code);
        Conversation group = group(invite.getConversationId());

        if (group.getParticipants().contains(joiner.getId())) {
            // Not an error worth a red screen: tapping a link you already used
            // means you wanted to be in the group, and you are.
            throw new BadRequestException("You're already in this group");
        }
        if (group.getParticipants().size() >= GroupService.MAX_MEMBERS) {
            throw new BadRequestException("This group is full");
        }
        // Owner-to-joiner only, for the same reason as at creation: a pairwise
        // check would leak other people's blocks.
        if (group.getAdmin() != null && !group.getAdmin().equals(joiner.getId())) {
            blockService.assertNotBlocked(group.getAdmin(), joiner.getId());
        }

        UpdateResult result = mongoTemplate.updateFirst(
                query(where("_id").is(group.getId())
                        .and("type").is("GROUP")
                        .and("participants").ne(joiner.getId())),
                new Update()
                        .addToSet("participants", joiner.getId())
                        .set("unreadCount." + joiner.getId(), 0),
                Conversation.class);
        if (result.getModifiedCount() == 0) {
            throw new BadRequestException("You're already in this group");
        }

        mongoTemplate.updateFirst(query(where("_id").is(invite.getId())),
                new Update().inc("uses", 1), GroupInvite.class);

        Conversation updated = group(group.getId());
        var note = messageService.saveSystemMessage(group.getId(), joiner.getUsername() + " joined the group");
        messagingTemplate.convertAndSend("/topic/conversation/" + group.getId(), note);
        updated.getParticipants().stream().filter(id -> !id.equals(joiner.getId())).forEach(id ->
                messagingTemplate.convertAndSend("/topic/user/" + id + "/inbox", note));

        // The newcomer has no subscription to this group's topics, so it's sent
        // to them directly: that is what puts it in their chat list.
        messagingTemplate.convertAndSend("/topic/user/" + joiner.getId() + "/conversation-created",
                conversationService.mapToResponse(updated, joiner.getId()));
        messagingTemplate.convertAndSend("/topic/conversation/" + group.getId() + "/members",
                (Object) Map.of("conversationId", group.getId()));

        return conversationService.mapToResponse(updated, joiner.getId());
    }

    // --------------------------------------------------------------- helpers

    private Optional<GroupInvite> liveInviteFor(String conversationId) {
        return inviteRepository.findByConversationId(conversationId)
                .filter(i -> i.getExpiresAt() != null && i.getExpiresAt().isAfter(LocalDateTime.now()));
    }

    private GroupInvite liveInvite(String code) {
        if (code == null || !CODE_SHAPE.matcher(code).matches()) {
            throw new GoneException(NOT_FOUND);
        }
        GroupInvite invite = inviteRepository.findByCode(code).orElseThrow(() -> new GoneException(NOT_FOUND));
        // Checked here as well as by the TTL index: the index is a janitor that
        // sweeps about once a minute, so a document can outlive its expiry.
        if (invite.getExpiresAt() == null || !invite.getExpiresAt().isAfter(LocalDateTime.now())) {
            throw new GoneException(NOT_FOUND);
        }
        return invite;
    }

    private Conversation group(String conversationId) {
        return conversationRepository.findById(conversationId)
                .filter(c -> "GROUP".equals(c.getType()))
                .orElseThrow(() -> new NotFoundException(NOT_FOUND));
    }

    private Conversation requireAdminGroup(String conversationId, String userId) {
        Conversation group = group(conversationId);
        if (!group.getParticipants().contains(userId)) {
            throw new NotFoundException("Conversation not found");
        }
        if (!group.isAdmin(userId)) {
            throw new ForbiddenException("Only a group admin can manage the invite link");
        }
        return group;
    }

    private InviteView view(GroupInvite invite, Conversation group) {
        String inviter = userRepository.findById(invite.getCreatedBy())
                .map(User::getUsername).orElse("Someone");
        return new InviteView(group.getId(), group.getName(), inviter,
                group.getParticipants().size(), invite.getUses(), invite.getExpiresAt(),
                frontendUrl + "/group-invite#" + invite.getCode());
    }

    private static String newCode() {
        byte[] bytes = new byte[16];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
