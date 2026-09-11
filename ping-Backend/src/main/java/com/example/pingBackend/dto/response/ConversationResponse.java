package com.example.pingBackend.dto.response;

import com.example.pingBackend.model.Conversation;
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
public class ConversationResponse {

    private String id;
    private String type;
    private List<UserResponse> participants;
    private String name;
    private Conversation.LastMessage lastMessage;
    private int unreadCount;
    private boolean temporary;
    private LocalDateTime expiresAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}