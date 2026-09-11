package com.example.pingBackend.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/** One shared file in a conversation, as the Files panel needs to show it. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ConversationMediaResponse {
    private String messageId;
    private String key;
    private String mimeType;
    private long sizeBytes;
    private String fileName;
    private Integer durationSeconds;
    private String senderId;
    private String senderUsername;
    private LocalDateTime createdAt;
}
