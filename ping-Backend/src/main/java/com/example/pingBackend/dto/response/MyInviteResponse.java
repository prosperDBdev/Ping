package com.example.pingBackend.dto.response;

import java.time.LocalDateTime;

/**
 * The caller's own invite link and how many people it has brought in.
 *
 * Just the code, not a full URL: the frontend knows the address it's being
 * served from, so it builds the link itself and the backend doesn't need to
 * know its own public domain.
 *
 * code and expiresAt are null when the user has no link that still works.
 */
public record MyInviteResponse(String code, LocalDateTime expiresAt, long invitedCount) {
}
