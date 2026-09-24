package com.example.pingBackend.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserResponse {

    private String id;
    private String username;
    /**
     * Set ONLY when the response describes the caller themselves (GET /api/users/me).
     *
     * An email address is personal data, not a public profile field. It used to be
     * included for every user: in search results, in anyone's profile, and in
     * every conversation's participant list, so any signed-in account could
     * collect addresses in bulk just by searching single letters. Now it is left
     * null for everyone except the caller, and NON_NULL drops the key from the
     * JSON altogether rather than sending "email": null.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    private String email;
    private String avatarUrl;
    private String status;
    private LocalDateTime lastSeen;
    private LocalDateTime createdAt;
    // ← Notice: NO password field! Never expose it.
}