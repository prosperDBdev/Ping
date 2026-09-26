package com.example.pingBackend.service;

import com.example.pingBackend.model.Conversation;
import com.example.pingBackend.model.Task;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

/** Who gets reminded, and which reminders are skipped because their moment already passed. */
class TaskRulesTest {

    private static final LocalDateTime NOW = LocalDateTime.of(2026, 9, 26, 12, 0);

    private final Conversation group = Conversation.builder()
            .id("g").type("GROUP").name("Project")
            .participants(new ArrayList<>(List.of("amy", "ben", "cal")))
            .build();

    @Test
    @DisplayName("a deadline days away gets all three reminders")
    void farAway() {
        assertEquals(List.of(), TaskService.stagesAlreadyPassed(NOW.plusDays(3), NOW));
    }

    @Test
    @DisplayName("due in 5 hours: no 'due in a day' reminder, but 'in 1 hour' and 'now' still come")
    void sameDay() {
        assertEquals(List.of("DAY_BEFORE"), TaskService.stagesAlreadyPassed(NOW.plusHours(5), NOW));
    }

    @Test
    @DisplayName("due in 20 minutes: only 'due now'")
    void soon() {
        assertEquals(List.of("DAY_BEFORE", "HOUR_BEFORE"), TaskService.stagesAlreadyPassed(NOW.plusMinutes(20), NOW));
    }

    @Test
    @DisplayName("a deadline already in the past sends nothing")
    void past() {
        assertEquals(List.of("DAY_BEFORE", "HOUR_BEFORE", "DUE"), TaskService.stagesAlreadyPassed(NOW.minusHours(2), NOW));
    }

    @Test
    @DisplayName("no deadline, no reminders to skip")
    void noDeadline() {
        assertEquals(List.of(), TaskService.stagesAlreadyPassed(null, NOW));
    }

    @Test
    @DisplayName("an assigned task reminds the assignee")
    void assignee() {
        Task task = Task.builder().createdBy("amy").assigneeId("ben").build();
        assertEquals(List.of("ben"), TaskService.reminderRecipients(task, group));
    }

    @Test
    @DisplayName("an unassigned task reminds the whole group")
    void everyone() {
        Task task = Task.builder().createdBy("amy").build();
        assertEquals(List.of("amy", "ben", "cal"), TaskService.reminderRecipients(task, group));
    }

    @Test
    @DisplayName("an assignee who has left the group falls back to everyone")
    void assigneeLeft() {
        Task task = Task.builder().createdBy("amy").assigneeId("dan").build();
        assertEquals(List.of("amy", "ben", "cal"), TaskService.reminderRecipients(task, group));
    }

    @Test
    @DisplayName("a personal reminder only ever reaches its creator")
    void personal() {
        Task task = Task.builder().createdBy("cal").assigneeId("cal").personalReminder(true).build();
        assertEquals(List.of("cal"), TaskService.reminderRecipients(task, group));
    }
}
