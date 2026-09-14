package com.example.pingBackend.service;

import com.example.pingBackend.model.User;
import com.example.pingBackend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Who is online — counted by CONNECTIONS, not by events.
 *
 * THE BUG THIS REPLACES. The old code flipped a user to ONLINE on every
 * connect and OFFLINE on every disconnect. But one person can have several
 * connections: two tabs, a phone and a laptop. Close one tab and they went
 * OFFLINE while the other tab was still open and chatting.
 *
 * THE FIX. Keep the set of open connections for each user. Only the FIRST
 * connection makes them ONLINE; only the LAST one closing makes them OFFLINE.
 * Everything in between changes the count and nothing else.
 *
 * WHAT THIS CAN'T SEE. This map lives in the server's memory. If the server
 * stops, it's gone — and no disconnect events fire on the way down, so the
 * database is left saying ONLINE for everyone who was connected. That's why
 * resetStaleOnlineFlags runs on startup. (It also means this only works with
 * ONE backend instance; with several, each would only know its own
 * connections, and presence would need a shared store like Redis.)
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PresenceService {

    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final MongoTemplate mongoTemplate;

    private final Map<String, Set<String>> connectionsByUser = new ConcurrentHashMap<>();

    /**
     * A connection opened. Marks the user ONLINE only if it's their first.
     *
     * The status write happens INSIDE compute(), deliberately. compute() locks
     * this user's entry while it runs, so a connect and a disconnect for the
     * same person can't interleave — without that, a disconnect's OFFLINE write
     * could land after a reconnect's ONLINE write and leave them showing offline
     * while connected. The trade-off is holding that lock during a database
     * write, which is fine at this scale.
     */
    public void connected(String userId, String sessionId) {
        connectionsByUser.compute(userId, (id, sessions) -> {
            Set<String> open = sessions != null ? sessions : ConcurrentHashMap.newKeySet();
            boolean wasOffline = open.isEmpty();
            open.add(sessionId);
            if (wasOffline) {
                setStatus(userId, "ONLINE");
            }
            return open;
        });
    }

    /**
     * A connection closed. Marks the user OFFLINE only if it was their last.
     *
     * Safe to call twice for the same session — Spring can publish more than one
     * disconnect event for a connection, and removing an already-removed session
     * changes nothing.
     */
    public void disconnected(String userId, String sessionId) {
        connectionsByUser.computeIfPresent(userId, (id, open) -> {
            open.remove(sessionId);
            if (open.isEmpty()) {
                setStatus(userId, "OFFLINE");
                return null; // drop the entry — nobody's connected
            }
            return open;
        });
    }

    /** How many live connections a user has. Used by tests and diagnostics. */
    public int connectionCount(String userId) {
        Set<String> open = connectionsByUser.get(userId);
        return open == null ? 0 : open.size();
    }

    /**
     * On startup, nobody is connected yet — so nobody is online.
     *
     * Any ONLINE left in the database is left over from before this server
     * started, usually a crash or a restart where no disconnect events fired.
     * One bulk update rather than loading every user: this runs every boot and
     * shouldn't get slower as the user count grows. Anyone genuinely online
     * reconnects within seconds and flips back to ONLINE through connected().
     */
    @EventListener(ApplicationReadyEvent.class)
    public void resetStaleOnlineFlags() {
        long reset = mongoTemplate.updateMulti(
                Query.query(Criteria.where("status").is("ONLINE")),
                Update.update("status", "OFFLINE"),
                User.class
        ).getModifiedCount();
        if (reset > 0) {
            log.info("Presence reset on startup: {} user(s) were still marked ONLINE from before", reset);
        }
    }

    private void setStatus(String userId, String status) {
        userRepository.findById(userId).ifPresent(user -> {
            user.setStatus(status);
            LocalDateTime now = LocalDateTime.now();
            if ("OFFLINE".equals(status)) {
                user.setLastSeen(now);
            }
            userRepository.save(user);

            Map<String, Object> event = new HashMap<>();
            event.put("userId", userId);
            event.put("status", status);
            if ("OFFLINE".equals(status)) {
                event.put("lastSeen", now.toString());
            }
            messagingTemplate.convertAndSend("/topic/user/" + userId + "/status", (Object) event);
        });
    }
}
