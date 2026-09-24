package com.example.pingBackend.dto.response;

/**
 * What comes back after setting a profile photo: the address to fetch it from.
 *
 * Deliberately NOT the R2 object key. The key is a server-side storage detail,
 * and handing it to the browser would invite a client to build its own storage
 * URLs instead of going through the endpoint that does the looking-up.
 */
public record AvatarResponse(String avatarUrl) {
}
