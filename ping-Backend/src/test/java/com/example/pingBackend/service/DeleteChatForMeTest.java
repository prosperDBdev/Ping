package com.example.pingBackend.service;

import com.example.pingBackend.model.Conversation;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** "Delete chat" hides a chat from one person's list until something new arrives. */
class DeleteChatForMeTest {

    private static final LocalDateTime DELETED = LocalDateTime.of(2026, 9, 25, 12, 0);

    private static Conversation chat(LocalDateTime lastMessageAt, Map<String, LocalDateTime> hiddenAt) {
        return Conversation.builder()
                .id("c1")
                .hiddenAt(hiddenAt)
                .lastMessage(lastMessageAt == null ? null
                        : Conversation.LastMessage.builder().content("hi").timestamp(lastMessageAt).build())
                .build();
    }

    @Test
    @DisplayName("a chat you never deleted is always listed")
    void notDeleted() {
        assertFalse(ConversationService.hiddenFrom(chat(DELETED, new HashMap<>()), "amy"));
    }

    @Test
    @DisplayName("after deleting, the chat stays off your list while nothing new arrives")
    void hiddenUntilNewMessage() {
        assertTrue(ConversationService.hiddenFrom(chat(DELETED.minusMinutes(5), Map.of("amy", DELETED)), "amy"));
        assertTrue(ConversationService.hiddenFrom(chat(null, Map.of("amy", DELETED)), "amy"));
    }

    @Test
    @DisplayName("a message sent after you deleted it brings the chat back")
    void newMessageBringsItBack() {
        assertFalse(ConversationService.hiddenFrom(chat(DELETED.plusSeconds(1), Map.of("amy", DELETED)), "amy"));
    }

    @Test
    @DisplayName("deleting only affects your own list, never the other person's")
    void onlyYourList() {
        assertFalse(ConversationService.hiddenFrom(chat(DELETED.minusMinutes(5), Map.of("amy", DELETED)), "ben"));
    }

    @Test
    @DisplayName("conversations saved before this feature existed (no map at all) are listed")
    void oldDocuments() {
        assertFalse(ConversationService.hiddenFrom(chat(DELETED, null), "amy"));
    }
}
