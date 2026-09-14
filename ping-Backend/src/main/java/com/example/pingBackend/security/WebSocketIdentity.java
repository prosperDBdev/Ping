package com.example.pingBackend.security;

import com.example.pingBackend.model.User;
import org.springframework.security.core.Authentication;

import java.security.Principal;

/**
 * Reads the verified user off a WebSocket message.
 *
 * The Principal here was attached by StompAuthChannelInterceptor at CONNECT,
 * after checking the login token — so it's the server's own conclusion about
 * who this connection belongs to, not something the browser asserted.
 *
 * Deliberately NOT principal.getName(). For this token type getName() falls back
 * to calling toString() on the User object, and Lombok's @Data toString includes
 * every field — the password hash among them. Reading the id directly avoids
 * that ever leaking into a log line or a topic name.
 */
public final class WebSocketIdentity {

    private WebSocketIdentity() {
    }

    /** The authenticated user's id, or null if this connection never authenticated. */
    public static String userIdOf(Principal principal) {
        if (principal instanceof Authentication auth && auth.getPrincipal() instanceof User user) {
            return user.getId();
        }
        return null;
    }
}
