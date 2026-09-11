package com.example.pingBackend.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * One status, as a viewer is allowed to see it.
 *
 * Note what is NOT here: the raw viewerIds list. Who has seen a status is the
 * author's information, not every viewer's — putting it in the feed payload
 * would tell everyone exactly which of their mutual contacts had looked at a
 * post. viewerCount is filled in only for the author's own statuses, and the
 * full list lives behind its own author-only endpoint.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StatusResponse {
    private String id;
    private String authorId;
    private String authorUsername;
    private String type;
    private String text;
    private String backgroundColor;
    /** Object key, not a URL — the bytes are served through an authorised endpoint. */
    private String mediaKey;
    private String mediaMimeType;
    private LocalDateTime createdAt;
    private LocalDateTime expiresAt;
    /** Has the requesting user already opened this one? Drives the unread ring. */
    private boolean viewed;
    /** Author-only; null when someone else is looking. */
    private Integer viewerCount;
    /** Set when this post is a reshare, so the UI can attribute it. */
    private String resharedFromAuthorId;
    private String resharedFromAuthorUsername;
    /** False when the author has resharing turned off — the UI hides the button. */
    private boolean reshareable;
}
