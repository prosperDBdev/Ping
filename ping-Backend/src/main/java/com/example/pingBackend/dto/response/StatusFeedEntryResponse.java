package com.example.pingBackend.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * All of one author's live statuses, grouped.
 *
 * The feed is a list of people, not a flat list of posts — that's how the UI
 * presents it (one ring per contact, tap to page through theirs), so grouping
 * server-side saves the client from reassembling it.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StatusFeedEntryResponse {
    private String authorId;
    private String authorUsername;
    private String authorAvatarUrl;
    private List<StatusResponse> statuses;
    /** Newest post time, so the client can order rings by recency. */
    private LocalDateTime latestAt;
    /** True when at least one of these is unseen — the "new" ring. */
    private boolean hasUnviewed;
}
