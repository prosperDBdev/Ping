package com.example.pingBackend.dto.request;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TemporaryChatRespondRequest {
    private String inviteId;
    private boolean accept;
}
