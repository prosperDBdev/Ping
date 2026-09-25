package com.example.pingBackend.config;

import com.example.pingBackend.security.PairingWebSocketHandler;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.util.Map;

/**
 * Registers the QR sign-in socket at /ws-pair (Stage 14).
 *
 * Next to, not inside, the STOMP setup in WebSocketConfig: a plain WebSocket
 * handler and a STOMP endpoint are registered through different Spring
 * interfaces, and they coexist happily. The path starts with /ws so the
 * existing nginx "location /ws" block already forwards it as a WebSocket.
 */
@Configuration
@EnableWebSocket
@RequiredArgsConstructor
public class PairingSocketConfig implements WebSocketConfigurer {

    private final PairingWebSocketHandler pairingHandler;

    /** Same allow-list as REST CORS and STOMP: other websites can't open this socket. */
    @Value("${app.cors.allowed-origins}")
    private String[] allowedOrigins;

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(pairingHandler, "/ws-pair")
                .setAllowedOrigins(allowedOrigins)
                .addInterceptors(new HandshakeInterceptor() {
                    /**
                     * The handshake is an ordinary HTTP request, so this is the
                     * moment to note the client's IP (for the rate limit) and
                     * browser (to name the device). getRemoteAddr already
                     * accounts for nginx, the same way it does for the REST
                     * API's rate limits.
                     */
                    @Override
                    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                                   WebSocketHandler wsHandler, Map<String, Object> attributes) {
                        if (request instanceof ServletServerHttpRequest servlet) {
                            attributes.put(PairingWebSocketHandler.IP_ATTRIBUTE,
                                    servlet.getServletRequest().getRemoteAddr());
                        }
                        attributes.put(PairingWebSocketHandler.USER_AGENT_ATTRIBUTE,
                                request.getHeaders().getFirst("User-Agent"));
                        return true;
                    }

                    @Override
                    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                               WebSocketHandler wsHandler, Exception exception) {
                    }
                });
    }
}
