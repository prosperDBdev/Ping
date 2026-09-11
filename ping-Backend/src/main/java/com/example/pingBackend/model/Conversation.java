package com.example.pingBackend.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Document(collection = "conversations")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Conversation {

    @Id
    private String id;

    private String type; // "PRIVATE" or "GROUP"

    private List<String> participants; // List of user IDs

    // Group-only fields
    private String name;   // null for PRIVATE
    private String admin;  // null for PRIVATE

    // Last message preview (for conversation list)
    private LastMessage lastMessage;

    // Unread count per user: { "userId1": 0, "userId2": 3 }
    @Builder.Default
    private Map<String, Integer> unreadCount = new HashMap<>();

    // Temporary conversations — only ever set true via an accepted
    // TemporaryConversationInvite, never at plain creation time. expiresAt is
    // null for every ordinary conversation.
    @Builder.Default
    private boolean temporary = false;
    private LocalDateTime expiresAt;

    /**
     * Per-user "clear chat" markers: userId → the moment they cleared it.
     * Messages created before a user's marker are hidden from THAT user only.
     *
     * Deliberately per-user rather than a single field on the conversation.
     * A conversation belongs to two people, and one of them deciding to clear
     * their copy must not delete the other person's history — clearing your
     * side is a personal action, not a shared one.
     */
    @Builder.Default
    private Map<String, LocalDateTime> clearedAt = new HashMap<>();

    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    @Builder.Default
    private LocalDateTime updatedAt = LocalDateTime.now();

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LastMessage {
        private String content;
        private String senderId;
        private String senderUsername;
        private LocalDateTime timestamp;
    }
}