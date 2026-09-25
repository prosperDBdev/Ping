package com.example.pingBackend.service;

import com.example.pingBackend.exception.BadRequestException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * The reaction and edit rules that can be checked without a database.
 *
 * The service is built with every dependency null, so any test that reached a
 * repository or the database would crash instead of passing: a pass here also
 * proves the check ran first. Who may edit what, and the 10-minute window, run
 * against a real MongoDB in the end-to-end test, because they live in the
 * update query itself.
 */
class MessageReactionRulesTest {

    private final MessageService service = new MessageService(null, null, null, null);

    @Test
    @DisplayName("only the five offered reactions are accepted, checked before any database work")
    void unknownReactionsRefused() {
        for (String emoji : new String[]{"💩", "hello", "<script>", "👍👍", "", " "}) {
            assertThrows(BadRequestException.class,
                    () -> service.react("conv", "msg", "user", emoji), "accepted: " + emoji);
        }
    }

    @Test
    @DisplayName("the offered reactions match what the app shows")
    void allowListMatchesTheApp() {
        assertEquals(java.util.Set.of("👍", "❤️", "😂", "🎉", "👀"), MessageService.ALLOWED_REACTIONS);
    }

    @Test
    @DisplayName("messages can be edited for 10 minutes")
    void editWindow() {
        assertEquals(Duration.ofMinutes(10), MessageService.EDIT_WINDOW);
    }
}
