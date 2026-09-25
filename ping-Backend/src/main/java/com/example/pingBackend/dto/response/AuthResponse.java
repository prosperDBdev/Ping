package com.example.pingBackend.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * The answer to signing in. Either a finished sign-in (token and who you are),
 * or, with two-step verification on, a request for the emailed code: then
 * twoFactorRequired is true, there is NO token, and only the challenge and a
 * masked email come back. Absent fields are left out of the JSON entirely.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AuthResponse {

    private String token;      // ← The JWT token
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