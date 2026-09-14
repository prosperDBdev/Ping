package com.example.pingBackend.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

/**
 * A pending password reset.
 *
 * Note what is NOT stored: the token itself. Only its SHA-256 hash. The token
 * in the emailed link is effectively a temporary password for the account, so
 * it gets the same treatment as a password — if this collection ever leaked,
 * the hashes can't be pasted into a reset link.
 *
 * Every document here is meant to expire, which is exactly the case where a
 * TTL index is the right tool (see AuthIndexConfig) — unlike conversations,
 * where most documents must live forever.
 */
@Document(collection = "password_reset_tokens")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PasswordResetToken {

    @Id
    private String id;

    private String userId;

    /** SHA-256 of the token, hex-encoded. Looked up directly, so it's indexed. */
    private String tokenHash;

    private LocalDateTime expiresAt;

    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
