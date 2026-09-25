package com.example.pingBackend.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Date;
import java.util.Optional;

@Component
public class JwtTokenProvider {

    private final SecretKey key;
    private final long expiration;

    public JwtTokenProvider(
            @Value("${jwt.secret}") String secret,
            @Value("${jwt.expiration}") long expiration
    ) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expiration = expiration;
    }

    /** The claim naming the signed-in device (a LoginSession id). */
    public static final String SESSION_CLAIM = "sid";

    // CREATE a token for a user, on one particular signed-in device.
    // Only SessionService calls this, so every token names a session that
    // exists, and signing that device out makes the token useless.
    public String generateToken(String username, String sessionId) {
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + expiration);

        return Jwts.builder()
                .subject(username)          // Who this token is for
                .claim(SESSION_CLAIM, sessionId) // Which device it belongs to
                .issuedAt(now)              // When it was created
                .expiration(expiryDate)     // When it expires
                .signWith(key)              // Sign with our secret key
                .compact();                 // Build the string
    }

    /** How long a token (and so a signed-in session) lasts. */
    public Duration lifetime() {
        return Duration.ofMillis(expiration);
    }

    // EXTRACT username from a token
    // Input: "eyJhbGciOiJIUzI1NiJ9..." → Output: "john"
    public String getUsernameFromToken(String token) {
        Claims claims = Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();

        return claims.getSubject();
    }

    /**
     * Verify the signature and expiry, and return everything inside the token in
     * one go — or empty if it's forged, tampered with, or expired.
     *
     * Parsing once and reading several claims from the result avoids verifying
     * the same signature twice (once to validate, again to read the subject).
     */
    public Optional<Claims> parseClaims(String token) {
        try {
            return Optional.of(Jwts.parser()
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload());
        } catch (JwtException | IllegalArgumentException e) {
            return Optional.empty();
        }
    }

    // VALIDATE a token — is it real and not expired?
    public boolean validateToken(String token) {
        try {
            Jwts.parser()
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(token);
            return true;    // ✅ Valid
        } catch (Exception e) {
            return false;   // ❌ Invalid or expired
        }
    }
}