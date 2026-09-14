package com.example.pingBackend.config;

import com.example.pingBackend.security.StompAuthChannelInterceptor;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final StompAuthChannelInterceptor stompAuthChannelInterceptor;

    /** Same allow-list as REST CORS, so a deployed frontend can connect here too. */
    @Value("${app.cors.allowed-origins}")
    private String[] allowedOrigins;

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // Messages FROM server TO client go through these prefixes
        config.enableSimpleBroker("/topic", "/user");

        // Messages FROM client TO server must start with /app
        config.setApplicationDestinationPrefixes("/app");

        config.setUserDestinationPrefix("/user");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // The /ws endpoint itself stays open (SecurityConfig permits it). That's
        // unavoidable, not an oversight: browsers can't attach an Authorization
        // header to the WebSocket handshake. So authentication happens one step
        // later, on the first STOMP frame — see StompAuthChannelInterceptor.
        registry.addEndpoint("/ws")
                .setAllowedOrigins(allowedOrigins)
                .withSockJS();
    }

    /**
     * Every frame a client sends passes through this interceptor before any
     * controller sees it. That's the checkpoint: no valid token at CONNECT, no
     * connection; no permission for a topic, no subscription.
     */
    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(stompAuthChannelInterceptor);
    }
}
