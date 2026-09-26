package com.example.pingBackend.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * A task in a conversation, stored on the server so everyone in the chat sees
 * the same list and the server can remind people when it's due.
 *
 * Tasks used to live only in each person's browser. That meant the rest of the
 * group never saw them, and nothing could remind anyone with the app closed:
 * the server didn't know the task existed.
 *
 * TWO KINDS:
 *   shared task       - visible to everyone in the conversation; reminders go
 *                       to the assignee, or to everyone if nobody is assigned.
 *   personal reminder - "Create reminder" on a message. Only its creator ever
 *                       sees it or is reminded. It used to be private because
 *                       it lived in one browser; moving it to the server mustn't
 *                       suddenly show "remind me to reply to Ben" to Ben.
 */
@Document(collection = "tasks")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Task {

    @Id
    private String id;

    private String conversationId;

    private String title;

    private String description;

    /** Must be a participant of the conversation, or null for "everyone". */
    private String assigneeId;

    /** When it's due, in UTC like every other time here. Null means no deadline. */
    private LocalDateTime dueAt;

    /** LOW, MEDIUM or HIGH. */
    private String priority;

    /** TODO, IN_PROGRESS or COMPLETED. Completed tasks are never reminded about. */
    private String status;

    /** True for a personal reminder: see the class comment. */
    private boolean personalReminder;

    private String sourceMessageId;

    private String sourceMessageSnippet;

    /** File names noted on the task (names and sizes only, no file contents). */
    @Builder.Default
    private List<Attachment> attachments = new ArrayList<>();

    private String createdBy;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    /**
     * Which reminders have gone out: DAY_BEFORE, HOUR_BEFORE, DUE. The reminder
     * job claims a stage by adding it here in the same atomic update that finds
     * the task, so a reminder can never be sent twice. Stages whose moment had
     * already passed when the due time was set are added up front, so a task
     * due in 20 minutes doesn't get a "due in a day" reminder.
     */
    @Builder.Default
    private List<String> remindersSent = new ArrayList<>();

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Attachment {
        private String id;
        private String name;
        private long size;
        private String type;
    }
}
