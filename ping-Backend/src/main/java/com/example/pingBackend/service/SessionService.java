package com.example.pingBackend.service;

import com.example.pingBackend.exception.NotFoundException;
import com.example.pingBackend.model.LoginSession;
import com.example.pingBackend.model.User;
import com.example.pingBackend.repository.LoginSessionRepository;
import com.example.pingBackend.security.DeviceNames;
import com.example.pingBackend.security.JwtTokenProvider;
import com.example.pingBackend.security.LiveConnectionRegistry;
import com.mongodb.client.result.DeleteResult;
import lombok.RequiredArgsConstructor;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.springframework.data.mongodb.core.query.Criteria.where;
import static org.springframework.data.mongodb.core.query.Query.query;

/**
 * Signed-in devices: creating one at sign-in, checking one on every request,
 * listing them, and signing them out (Stage 14).
 *
 * This is the ONLY place a login token is made. Every way of signing in
 * (password, password plus email code, QR code, registering) ends here, so
 * every token that exists is tied to a device the user can see and revoke.
 */
@Service
@RequiredArgsConstructor
public class SessionService {

    /**
     * How stale "last active" may get before it's rewritten. Writing it on
     * every request would turn every read of the app into a database write;
     * nobody needs the device list accurate to the second.
     */
    static final Duration TOUCH_INTERVAL = Duration.ofMinutes(5);

    private final LoginSessionRepository repository;
    private final MongoTemplate mongoTemplate;
    private final JwtTokenProvider jwtTokenProvider;
    private final LiveConnectionRegistry liveConnections;

    /** Sign a device in: record it, and return a token that names it. */
    public String issue(User user, String userAgent, String method) {
        return issueForDevice(user, DeviceNames.describe(userAgent), method);
    }

    /**
     * Same, when the device isn't the one making this request. A QR sign-in is
     * approved by your phone, but the new session belongs to the computer that
     * showed the code, so it's named after the computer.
     */
    public String issueForDevice(User user, String deviceName, String method) {
        return issueSession(user, deviceName, method).token();
    }

    /** A new session and its token, for callers that may need to undo it. */
    public record IssuedSession(String sessionId, String token) {
    }

    public IssuedSession issueSession(User user, String deviceName, String method) {
        LocalDateTime now = LocalDateTime.now();
        LoginSession session = repository.save(LoginSession.builder()
                .userId(user.getId())
                .deviceName(deviceName)
                .method(method)
                .createdAt(now)
                .lastActiveAt(now)
                .expiresAt(now.plus(jwtTokenProvider.lifetime()))
                .build());
        return new IssuedSession(session.getId(), jwtTokenProvider.generateToken(user.getUsername(), session.getId()));
    }

    /**
     * The session a token names, if it still exists and hasn't expired.
     *
     * Expiry is checked here as well as by the TTL index, because the index is
     * a janitor rather than a lock: Mongo sweeps expired documents about once a
     * minute, so one can outlive its expiry briefly.
     */
    public Optional<LoginSession> findActive(String sessionId) {
        if (sessionId == null || sessionId.isBlank()) {
            return Optional.empty();
        }
        LocalDateTime now = LocalDateTime.now();
        return repository.findById(sessionId)
                .filter(s -> s.getExpiresAt() != null && s.getExpiresAt().isAfter(now));
    }

    /** Record activity, at most once per TOUCH_INTERVAL. The condition keeps it to one write. */
    public void touch(LoginSession session) {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime staleBefore = now.minus(TOUCH_INTERVAL);
        if (session.getLastActiveAt() == null || session.getLastActiveAt().isBefore(staleBefore)) {
            mongoTemplate.updateFirst(
                    query(where("_id").is(session.getId()).and("lastActiveAt").lt(staleBefore)),
                    new Update().set("lastActiveAt", now),
                    LoginSession.class);
        }
    }

    public List<LoginSession> list(String userId) {
        return repository.findByUserIdOrderByLastActiveAtDesc(userId);
    }

    /**
     * Sign one device out. The userId is part of the delete itself, so you can
     * only ever remove your own devices: someone else's session id finds
     * nothing, exactly like one that doesn't exist.
     */
    public void revoke(String userId, String sessionId) {
        DeleteResult result = mongoTemplate.remove(
                query(where("_id").is(sessionId).and("userId").is(userId)), LoginSession.class);
        if (result.getDeletedCount() == 0) {
            throw new NotFoundException("That device isn't signed in");
        }
        liveConnections.closeSession(sessionId);
    }

    /** Sign out every device except this one. Returns how many were signed out. */
    public int revokeOthers(String userId, String keepSessionId) {
        List<LoginSession> others = list(userId).stream()
                .filter(s -> !s.getId().equals(keepSessionId))
                .toList();
        others.forEach(s -> revokeQuietly(userId, s.getId()));
        return others.size();
    }

    /** Sign out everywhere: after a password reset, the account may have been stolen. */
    public void revokeAll(String userId) {
        list(userId).forEach(s -> revokeQuietly(userId, s.getId()));
    }

    private void revokeQuietly(String userId, String sessionId) {
        mongoTemplate.remove(query(where("_id").is(sessionId).and("userId").is(userId)), LoginSession.class);
        liveConnections.closeSession(sessionId);
    }
}
