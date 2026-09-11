package com.example.pingBackend.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TemporaryChatInviteResponse {
    private String id;
    private String fromUserId;
    private String fromUsername;
    private String toUserId;
    private long durationMs;
    private String durationLabel;
    private String status;
    private LocalDateTime createdAt;
}
