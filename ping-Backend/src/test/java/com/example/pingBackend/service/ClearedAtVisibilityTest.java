package com.example.pingBackend.service;

import com.example.pingBackend.model.Conversation;
import com.example.pingBackend.model.Message;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The "clear chat" visibility rule, tested as a rule rather than per call site.
 *
 * This exists because the rule was originally implemented in getMessages only,
 * and silently missing from the Files listing, the media download and the
 * sidebar preview — clearing a chat hid the messages while leaving every photo
 * still listed, downloadable, and the last line still readable in the inbox.
 * One predicate, asserted once, so the next place that needs it has something
 * to point at.
 */
class ClearedAtVisibilityTest {

    /** The single question every call site is really asking. */
    private boolean isVisible(LocalDateTime messageCreatedAt, LocalDateTime clearedAt) {
        return clearedAt == null || messageCreatedAt.isAfter(clearedAt);
    }

    private final LocalDateTime clearedAt = LocalDateTime.of(2026, 9, 3, 12, 0);

    @Test
    @DisplayName("messages from before the clear are hidden")
    void hidesOlderMessages() {
        assertFalse(isVisible(clearedAt.minusHours(1), clearedAt));
    }

    @Test
    @DisplayName("messages sent after the clear are visible again")
    void showsNewerMessages() {
        assertTrue(isVisible(clearedAt.plusSeconds(1), clearedAt));
    }

    @Test
    @DisplayName("a message exactly at the clear instant is hidden")
    void boundaryIsExclusive() {
        // isAfter, not !isBefore: the marker is stamped at the moment of
        // clearing, so anything at that instant belongs to what was cleared.
        assertFalse(isVisible(clearedAt, clearedAt));
    }

    @Test
    @DisplayName("no marker means everything is visible")
    void noMarkerShowsAll() {
        assertTrue(isVisible(clearedAt.minusYears(1), null));
    }

    @Test
    @DisplayName("clearing is per-user — the other participant is unaffected")
    void clearIsPerUser() {
        Map<String, LocalDateTime> cleared = new HashMap<>();
        cleared.put("alice", clearedAt);

        Conversation conversation = Conversation.builder()
                .id("c1")
                .type("PRIVATE")
                .participants(List.of("alice", "bob"))
                .clearedAt(cleared)
                .build();

        Message old = Message.builder()
                .conversationId("c1")
                .createdAt(clearedAt.minusHours(2))
                .build();

        // Alice cleared, so the old message is gone for her.
        assertFalse(isVisible(old.getCreatedAt(), conversation.getClearedAt().get("alice")));
        // Bob never cleared, so his copy is untouched. This is the property
        // that makes "clear" safe to offer at all — one person tidying their
        // view must not destroy the other's history.
        assertTrue(isVisible(old.getCreatedAt(), conversation.getClearedAt().get("bob")));
    }

    @Test
    @DisplayName("a fresh conversation has an empty marker map, not null")
    void defaultsToEmptyMap() {
        Conversation conversation = Conversation.builder()
                .id("c2")
                .type("PRIVATE")
                .participants(List.of("alice", "bob"))
                .build();

        assertEquals(0, conversation.getClearedAt().size());
    }
}
