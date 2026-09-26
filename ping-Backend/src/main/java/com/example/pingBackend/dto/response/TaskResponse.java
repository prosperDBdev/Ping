package com.example.pingBackend.dto.response;

import com.example.pingBackend.model.Task;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.LocalDateTime;
import java.util.List;

/**
 * A task as the app shows it. Which reminders have gone out is server
 * bookkeeping and stays on the server.
 */
public record TaskResponse(
        String id,
        String conversationId,
        String title,
        String description,
        String assigneeId,
        LocalDateTime dueAt,
        String priority,
        String status,
        @JsonProperty("isReminder") boolean isReminder,
        String sourceMessageId,
        String sourceMessageSnippet,
        List<Task.Attachment> attachments,
        String createdBy,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public static TaskResponse of(Task t) {
        return new TaskResponse(t.getId(), t.getConversationId(), t.getTitle(),
                t.getDescription() == null ? "" : t.getDescription(), t.getAssigneeId(), t.getDueAt(),
                t.getPriority(), t.getStatus(), t.isPersonalReminder(), t.getSourceMessageId(),
                t.getSourceMessageSnippet(), t.getAttachments() == null ? List.of() : t.getAttachments(),
                t.getCreatedBy(), t.getCreatedAt(), t.getUpdatedAt());
    }
}
