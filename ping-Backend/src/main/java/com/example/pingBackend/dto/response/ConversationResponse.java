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
    /**
     * Everyone who can add and remove members, the owner first.
     *
     * This was the group's single `admin` field, which was never sent to the
     * browser at all — so the app couldn't tell who was an admin, and the
     * "remove member" button never appeared for anyone. A list also matches
     * WhatsApp, where a group can have more than one admin.
     */
    private List<String> admins;
    /** ADMINS_ONLY (the default) or EVERYONE. Group-only. */
    private String addMembersBy;
    private Conversation.LastMessage lastMessage;
    private int unreadCount;
    private boolean temporary;
    private LocalDateTime expiresAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}