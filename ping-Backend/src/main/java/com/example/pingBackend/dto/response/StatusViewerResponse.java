package com.example.pingBackend.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * One person who viewed a status, as the AUTHOR sees them.
 *
 * Its own type rather than UserResponse with a reaction bolted on. UserResponse
 * is used everywhere a user is shown, and a `reaction` field on it would be
 * null and meaningless in every one of those places except this one — a field
 * that only makes sense in one context belongs to that context's type.
 *
 * No email, no last-seen: the author needs to know who looked and how they
 * reacted, not anything else about them.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StatusViewerResponse {
    private String id;
    private String username;
    private String avatarUrl;
    /** Null when they viewed without reacting. */
    private String reaction;
}
