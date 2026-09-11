package com.example.pingBackend.security;

import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Tracks which authenticated user owns each live STOMP session.
 *
 * Pulled out of ChatController so a second WebSocket controller
 * (TemporaryChatController) can resolve "who is this session" the same way,
 * off the same map, instead of each controller keeping its own — two
 * separate maps would drift the moment a connect/disconnect event only
 * updated one of them.
 */
@Component
public class WebSocketSessionRegistry {

    private final Map<String, String> sessionToUserId = new ConcurrentHashMap<>();

    public void register(String sessionId, String userId) {
        sessionToUserId.put(sessionId, userId);
    }

    public String unregister(String sessionId) {
        return sessionToUserId.remove(sessionId);
    }

    public String getUserId(String sessionId) {
        return sessionToUserId.get(sessionId);
    }
}
