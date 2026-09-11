package com.example.pingBackend.dto.request;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TemporaryChatInviteRequest {
    private String toUserId;
    private long durationMs;
    private String durationLabel;
}
