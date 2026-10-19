package com.example.pingBackend.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * The answer to signing in. Either a finished sign-in (who you are), or, with
 * two-step verification on, a request for the emailed code: then
 * twoFactorRequired is true, there is no identity yet, and only the challenge
 * and a masked email come back. Absent fields are left out of the JSON entirely.
 *
 * The JWT itself never rides in this body: the controllers put it in an
 * HttpOnly cookie on the way out (AuthCookie) and blank the token field, so
 * no JavaScript ever holds it. The field survives only because the SERVICE
 * layer that builds this record is the one place that makes tokens — the
 * controllers read token() off it to fill the cookie.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AuthResponse {

    /**
     * Consumed by the controller for the login cookie, then nulled before the
     * body is written. Never present in a response the browser sees.
     */
    private String token;
    private String id;         // ← User's MongoDB ID
    private String username;
    private String email;

    /** True when a code was emailed and must be entered to finish signing in. */
    private Boolean twoFactorRequired;
    /** Identifies this pending sign-in when the code is sent back. Not a login by itself. */
    private String challenge;
    /** "m•••@gmail.com", so the person knows which inbox to check. */
    private String emailHint;
}