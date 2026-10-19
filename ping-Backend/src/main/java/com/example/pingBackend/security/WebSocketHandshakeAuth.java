package com.example.pingBackend.security;

import com.example.pingBackend.model.User;
import jakarta.servlet.http.Cookie;
import lombok.RequiredArgsConstructor;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.util.Map;

/**
 * The live connection's checkpoint, moved to the moment the socket opens.
 *
 * WHY HERE. The STOMP CONNECT carrier used to be an Authorization header,
 * which meant the browser had to hold its login token in JavaScript to put
 * it there — exactly what the cookie switch removed. This interceptor reads
 * the same HttpOnly login cookie the REST API uses straight off the SockJS
 * or WebSocket handshake request (browsers send cookies automatically; that
 * is a channel JavaScript cannot forge contents for), verifies it the ONE
 * shared way (TokenAuthenticator), and stashes the identity for the STOMP
 * layer — see StompAuthChannelInterceptor, which now reads from here when
 * no header arrives.
 *
 * A bad or missing cookie deliberately does NOT fail the handshake here:
 * refusing it would close the socket before STOMP's ERROR frame could tell
 * the client WHY. Letting the handshake through and failing at CONNECT keeps
 * the behaviour identical to the header world (client retries or signs in).
 */
@Component
@RequiredArgsConstructor
public class WebSocketHandshakeAuth implements HandshakeInterceptor {

    /** Where the verified identity waits for the STOMP CONNECT frame. */
    public static final String ATTRIBUTE = "pingWsHandshakeAuth";

    /** What the handshake verified: the token, and what it resolved to. */
    public record Identity(String token, User user, String sessionId) {
    }

    private final TokenAuthenticator tokenAuthenticator;

    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                   WebSocketHandler wsHandler, Map<String, Object> attributes) {
        for (String header : request.getHeaders().getOrEmpty("Cookie")) {
            // java.net's parser handles the quoting/semicolon rules of the
            // Cookie header, which is not something to hand-roll.
            for (java.net.HttpCookie cookie : java.net.HttpCookie.parse(header)) {
                if (!AuthCookie.NAME.equals(cookie.getName())) {
                    continue;
                }
                String token = cookie.getValue();
                tokenAuthenticator.authenticateSession(token).ifPresent(signedIn -> {
                    attributes.put(ATTRIBUTE, new Identity(token, signedIn.user(), signedIn.sessionId()));
                });
            }
        }
        return true;
    }

    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response,
                               WebSocketHandler wsHandler, Exception exception) {
        // Nothing: the handshake either succeeded with an attached identity
        // or succeeded anonymous, and STOMP's CONNECT decides.
    }
}
