package com.example.pingBackend.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Pushed back to whoever sent the invite, once the recipient has responded. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TemporaryChatResponseNotification {
    private String inviteId;
    private boolean accepted;
    private String byUsername;
    private ConversationResponse conversation; // null if declined
}
