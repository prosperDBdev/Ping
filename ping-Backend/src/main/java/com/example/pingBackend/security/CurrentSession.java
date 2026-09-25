package com.example.pingBackend.security;

/**
 * Where JwtAuthFilter leaves the id of the device a request came from.
 *
 * Controllers read it with {@code @RequestAttribute(CurrentSession.ATTRIBUTE)}.
 * It's a request attribute, set by the server after checking the token, never
 * a header or parameter: a client can't choose which session it claims to be.
 */
public final class CurrentSession {

    public static final String ATTRIBUTE = "ping.currentSessionId";

    private CurrentSession() {
    }
}
