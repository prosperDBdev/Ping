package com.example.pingBackend.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

/**
 * A 6-digit code emailed to someone, waiting to be typed in (Stage 13).
 *
 * Two parts, deliberately:
 *
 *   the CHALLENGE - a long random value the browser holds between "password
 *                   correct" and "code correct". It says WHICH pending sign-in
 *                   a code is for, without the browser holding anything that
 *                   works as a login on its own.
 *   the CODE      - the 6 digits in the email, proving access to the inbox.
 *
 * Neither is stored as itself. The challenge is stored as a SHA-256 hash (it's
 * long and random, so a fast hash is enough and can be looked up directly),
 * and the code as an HMAC keyed with a server secret. A 6-digit code has only
 * a million possibilities, so a plain hash would be reversed by trying them
 * all; without the server's key, a copy of this collection can't be.
 */
@Document(collection = "otp_codes")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LoginCode {

    @Id
    private String id;

    private String challengeHash;

    private String userId;

    /** LOGIN, or ENABLE_TWO_FACTOR when turning the feature on. */
    private String purpose;

    private String codeHash;

    /** Wrong guesses so far. The code is destroyed at the limit. */
    private int attempts;

    /** How many emails this challenge has sent (the first plus resends). */
    private int sends;

    private LocalDateTime lastSentAt;

    /** A TTL index deletes the document after this; the code also checks it. */
    private LocalDateTime expiresAt;
}
