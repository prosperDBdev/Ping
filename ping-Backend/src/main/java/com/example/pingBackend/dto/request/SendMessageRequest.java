package com.example.pingBackend.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SendMessageRequest {

    @NotBlank(message = "Conversation ID is required")
    private String conversationId;

    @NotBlank(message = "Content is required")
    private String content;

    private String type = "TEXT";

    // Set only for VOICE (later IMAGE/FILE) messages — the reference returned by
    // POST /api/media/upload. All null for a plain TEXT message.
    private String attachmentKey;
    private String attachmentMimeType;
    private Long attachmentSizeBytes;
    private Integer attachmentDurationSeconds;
    private String attachmentFileName;
}