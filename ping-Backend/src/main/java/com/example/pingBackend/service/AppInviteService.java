package com.example.pingBackend.service;

import com.example.pingBackend.exception.NotFoundException;
import com.example.pingBackend.exception.TooManyRequestsException;
import com.example.pingBackend.model.AppInvite;
import com.example.pingBackend.model.User;
import com.example.pingBackend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.Optional;
import java.util.regex.Pattern;

import static org.springframework.data.mongodb.core.query.Criteria.where;
import static org.springframework.data.mongodb.core.query.Query.query;

/**
 * Personal invite links: making them, checking them, and crediting the inviter.
 *
 * The link IS the permission — whoever holds it can use it — so everything here
 * follows from treating the code like a key rather than like an ID.
 */
@Service
@RequiredArgsConstructor
public class AppInviteService {

    /** How long a link works after it's made. */
    static final Duration LIFETIME = Duration.ofDays(7);

    /**
     * 16 bytes = 128 random bits = 2^128 possible codes. Someone guessing a
     * billion codes a second would need longer than the age of the universe to
     * hit a particular one, and even hitting ANY live one is hopeless while
     * there are only thousands of them.
     */
    private static final int CODE_BYTES = 16;

    /**
     * SecureRandom, never java.util.Random. Random is predictable: see a few of
     * its outputs and you can compute every future one, which would let an
     * attacker who received one invite work out everyone else's.
     */
    private static final SecureRandom RANDOM = new SecureRandom();

    /** Exactly what newCode() produces: 22 URL-safe Base64 characters. */
    private static final Pattern CODE_SHAPE = Pattern.compile("^[A-Za-z0-9_-]{22}$");

    // Preview is public (no login), so it's rate limited per IP. Generous for a
    // person clicking links; useless for someone scanning for valid codes.
    private static final int PREVIEW_LIMIT = 30;
    private static final Duration PREVIEW_WINDOW = Duration.ofMinutes(10);

    private static final int NEW_LINK_LIMIT = 10;
    private static final Duration NEW_LINK_WINDOW = Duration.ofHours(1);

    /**
     * One message for "no such code", "expired" and "inviter deleted". Saying
     * which would tell a scanner that a code it guessed once existed.
     */
    private static final String NOT_FOUND = "This invite link is invalid or has expired";

    private final MongoTemplate mongoTemplate;
    private final UserRepository userRepository;
    private final RateLimiter rateLimiter;

    /**
     * This user's link, if they have one that still works.
     *
     * Deliberately does NOT create one when there isn't. This backs a GET
     * request, and a GET must never change anything: browsers prefetch links,
     * and chat apps fetch URLs automatically to draw link previews. If reading
     * your invite status also made a link, those robots would be making links.
     */
    public Optional<AppInvite> current(String userId) {
        return Optional.ofNullable(mongoTemplate.findOne(
                query(where("inviterId").is(userId).and("expiresAt").gt(LocalDateTime.now())),
                AppInvite.class));
    }

    /**
     * Make a fresh link for this user, replacing any previous one.
     *
     * Replacing is also revoking: the old code is overwritten, so anyone still
     * holding the old link finds nothing when they use it. No blocklist needed.
     *
     * ONE ATOMIC STEP. The obvious version — look for the user's invite, then
     * insert or update depending on what you found — is check-then-act again,
     * the same gap as two people registering one username at once. Here, two
     * "new link" taps in quick succession could both find nothing and both
     * insert. findAndModify with upsert asks the database to do "update it, or
     * create it if missing" as a single operation, and the unique index on
     * inviterId backs that up if two requests still manage to overlap.
     */
    public AppInvite newLink(String userId) {
        if (!rateLimiter.tryAcquire("invite-new:user:" + userId, NEW_LINK_LIMIT, NEW_LINK_WINDOW)) {
            throw new TooManyRequestsException("You've made a lot of new links recently. Please try again later.");
        }

        LocalDateTime now = LocalDateTime.now();
        return mongoTemplate.findAndModify(
                // On insert, Mongo copies the equality match (inviterId) into
                // the new document, so it doesn't need setting separately.
                query(where("inviterId").is(userId)),
                new Update()
                        .set("code", newCode())
                        .set("createdAt", now)
                        .set("expiresAt", now.plus(LIFETIME)),
                FindAndModifyOptions.options().upsert(true).returnNew(true),
                AppInvite.class);
    }

    /**
     * The inviter's username, for the public "Maya invited you" page.
     *
     * Public, so it gives away as little as possible: a username only — no id,
     * no email — and one identical 404 for every kind of failure.
     */
    public String inviterUsername(String code, String clientIp) {
        if (!rateLimiter.tryAcquire("invite-preview:ip:" + clientIp, PREVIEW_LIMIT, PREVIEW_WINDOW)) {
            throw new TooManyRequestsException("Too many invite lookups. Please try again in a few minutes.");
        }

        return resolveInviter(code)
                .flatMap(userRepository::findById)
                .map(User::getUsername)
                .orElseThrow(() -> new NotFoundException(NOT_FOUND));
    }

    /**
     * Who made this code, if it's a live code from a user who still exists.
     *
     * Used during registration, where it must NEVER throw: attribution is a
     * nice-to-have, and a stale link in someone's message history must not stop
     * them creating an account. An unusable code just means no attribution.
     *
     * The shape is checked before any database work — cheap checks first. A
     * value that can't possibly be a code (wrong length, stray characters) is
     * turned away here without costing a query.
     */
    public Optional<String> resolveInviter(String code) {
        if (code == null || !CODE_SHAPE.matcher(code).matches()) {
            return Optional.empty();
        }

        AppInvite invite = mongoTemplate.findOne(
                query(where("code").is(code).and("expiresAt").gt(LocalDateTime.now())),
                AppInvite.class);

        return Optional.ofNullable(invite)
                .map(AppInvite::getInviterId)
                .filter(userRepository::existsById);
    }

    /** How many accounts were created through this user's links. */
    public long invitedCount(String userId) {
        return userRepository.countByInvitedBy(userId);
    }

    /** 128 random bits as URL-safe Base64 with no padding: 22 characters. */
    static String newCode() {
        byte[] bytes = new byte[CODE_BYTES];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
