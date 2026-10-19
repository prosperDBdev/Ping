package com.example.pingBackend.security;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import java.time.Duration;

/**
 * Hands the login token to the browser as an HttpOnly cookie.
 *
 * WHY A COOKIE. The token used to come back in the sign-in response body and
 * live in browser storage, which any script on the page can read — one XSS
 * bug anywhere in the bundle (or in anything Next.js loads alongside it) and
 * an attacker holds everyone's login. As an HttpOnly cookie the token is set
 * by the server and never readable by JavaScript: requests carry it, but no
 * line of code can copy it out. The server keeps the real session state
 * (LoginSession), so revocation and expiry are enforced server-side exactly
 * as before; the cookie is only how the browser says who it is.
 *
 * The name matches what JwtAuthFilter already read as a fallback (header
 * first, then this cookie), and what WebSocketHandshakeAuth reads for the
 * live connection's handshake. The Authorization: Bearer header path stays
 * valid too, so tokens issued before this switch keep working until they
 * expire on their own.
 */
@Component
public class AuthCookie {

    /** Kept in sync with the fallback name JwtAuthFilter reads back. */
    public static final String NAME = "ping_token";

    /**
     * Secure keeps the cookie off plain HTTP. On by default: the deployed
     * site is all HTTPS behind nginx. Plain-HTTP local development turns it
     * off with COOKIE_SECURE=false — browsers refuse Secure cookies from an
     * http:// origin.
     */
    @Value("${app.cookie-secure:true}")
    private boolean secure;

    /** Attach the cookie the browser will use as its login from now on. */
    public void write(HttpServletResponse response, String token) {
        response.addHeader("Set-Cookie", ResponseCookie.from(NAME, token)
                .httpOnly(true)
                // Lax, not None: across every transport the app talks to this
                // backend same-SITE (prod is one origin behind nginx; dev is
                // localhost:3000 -> localhost:8080, and cookies ignore ports).
                // Lax also blocks the classic CSRF vector — a cross-site POST
                // never carries the cookie.
                .sameSite("Lax")
                .secure(secure)
                .path("/")
                // A year, on PURPOSE. The cookie is only the ignition key:
                // what it starts is a server-side session that expires after
                // 7 days of inactivity (SessionService) and can be revoked at
                // any moment. A short cookie expiry would just be a second,
                // unrelated clock signing people out; the real policy lives
                // with the session.
                .maxAge(Duration.ofDays(365))
                .build().toString());
    }

    /** Send a Max-Age=0 cookie, which makes the browser drop its copy now. */
    public void clear(HttpServletResponse response) {
        response.addHeader("Set-Cookie", ResponseCookie.from(NAME, "")
                .httpOnly(true)
                .sameSite("Lax")
                .secure(secure)
                .path("/")
                .maxAge(Duration.ZERO)
                .build().toString());
    }
}
