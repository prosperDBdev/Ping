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
 * Reads the id straight off the User rather than relying on principal.getName().
 * The WebSocket principal is named by id (see StompAuthChannelInterceptor), but a
 * plain Spring token answers getName() with the User's toString() — which, with
 * Lombok's @Data, includes the password hash. Reading the id directly means this
 * helper is correct whichever kind of token it's handed.
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
