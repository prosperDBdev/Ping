package com.example.pingBackend.security;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.WebSocketHandlerDecorator;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Every open live (STOMP) connection, so a signed-out device can be cut off
 * straight away.
 *
 * THE GAP THIS CLOSES. Tokens are checked when a live connection OPENS. A
 * connection that is already open doesn't present its token again, so
 * deleting a device's session would stop its REST requests but leave its
 * socket delivering new messages until it happened to reconnect. Revoking has
 * to close the socket too.
 *
 * HOW. Spring lets you wrap the handler behind every WebSocket connection (a
 * "decorator"). The wrapper here only notes each connection as it opens and
 * forgets it when it closes. StompAuthChannelInterceptor tags each connection
 * with the session id from its token at CONNECT, so "close every connection
 * belonging to session X" is a scan of this map.
 */
@Component
@Slf4j
public class LiveConnectionRegistry {

    /** Attribute holding the login session id, set at CONNECT. */
    public static final String SESSION_ATTRIBUTE = "ping.sessionId";

    private final Map<String, WebSocketSession> open = new ConcurrentHashMap<>();

    /** Registered in WebSocketConfig; wraps the handler every connection goes through. */
    public WebSocketHandler decorate(WebSocketHandler handler) {
        return new WebSocketHandlerDecorator(handler) {
            @Override
            public void afterConnectionEstablished(WebSocketSession session) throws Exception {
                open.put(session.getId(), session);
                super.afterConnectionEstablished(session);
            }

            @Override
            public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
                open.remove(session.getId());
                super.afterConnectionClosed(session, status);
            }
        };
    }

    /** Close every live connection opened with this login session's token. */
    public void closeSession(String loginSessionId) {
        open.values().stream()
                .filter(s -> loginSessionId.equals(s.getAttributes().get(SESSION_ATTRIBUTE)))
                .forEach(this::close);
    }

    private void close(WebSocketSession session) {
        try {
            session.close(CloseStatus.POLICY_VIOLATION.withReason("Signed out"));
        } catch (IOException e) {
            log.debug("Live connection was already closing: {}", e.getMessage());
        }
    }
}
