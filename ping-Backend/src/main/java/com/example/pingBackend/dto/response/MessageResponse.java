package com.example.pingBackend.dto.response;

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
    private LocalDateTime createdAt;
}