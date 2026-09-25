package com.example.pingBackend.dto.response;

import java.util.Map;
import com.example.pingBackend.model.Message;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MessageResponse {

    private String id;
    private String conversationId;
    private String senderId;
    private String senderUsername;
    private String content;
    private String type;
    private String status;
    private List<String> seenBy;
    private Message.Attachment attachment;
    private Message.StatusReply statusReply;
    private LocalDateTime createdAt;
    /** userId -> emoji. Empty, never null. */
    private Map<String, String> reactions;
    /** Set once the message has been edited, so the app can say so. */
    private LocalDateTime editedAt;
    /** Set when deleted for everyone: show a "This message was deleted" marker. */
    private LocalDateTime deletedAt;
}