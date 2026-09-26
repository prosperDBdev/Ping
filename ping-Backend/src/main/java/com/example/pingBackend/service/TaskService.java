package com.example.pingBackend.service;

import com.example.pingBackend.dto.request.TaskRequest;
import com.example.pingBackend.dto.response.MessageResponse;
import com.example.pingBackend.dto.response.TaskResponse;
import com.example.pingBackend.exception.BadRequestException;
import com.example.pingBackend.exception.ForbiddenException;
import com.example.pingBackend.exception.NotFoundException;
import com.example.pingBackend.model.Conversation;
import com.example.pingBackend.model.Task;
import com.example.pingBackend.model.User;
import com.example.pingBackend.repository.ConversationRepository;
import com.example.pingBackend.repository.TaskRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Shared tasks and personal reminders (see Task for the difference).
 *
 * WHO MAY DO WHAT
 *   see     - shared: anyone in the chat. Personal reminder: its creator only;
 *             to anyone else it doesn't exist (404, same as a wrong id).
 *   create  - anyone who could send a message there (same checks: participant,
 *             not expired, not blocked).
 *   edit    - shared: anyone in the chat, so the group can tick things off
 *             together. Personal: its creator.
 *   delete  - the creator, or the group's admin.
 *
 * LIVE UPDATES go to /topic/conversation/{id}/tasks for shared tasks, and to
 * the creator's own /topic/user/{id}/tasks for personal reminders: a
 * conversation topic reaches everyone in the chat, which is exactly who must
 * not receive someone's private reminder.
 */
@Service
@RequiredArgsConstructor
public class TaskService {

    /** When reminders go out, relative to the due time. Order matters for pre-marking. */
    public enum Stage {
        DAY_BEFORE(Duration.ofHours(24)),
        HOUR_BEFORE(Duration.ofHours(1)),
        DUE(Duration.ZERO);

        public final Duration before;

        Stage(Duration before) {
            this.before = before;
        }
    }

    private static final int SNIPPET = 80;

    private final TaskRepository taskRepository;
    private final ConversationRepository conversationRepository;
    private final MessageService messageService;
    private final PushService pushService;
    private final SimpMessagingTemplate messagingTemplate;

    // ------------------------------------------------------------------ read

    public List<TaskResponse> list(String conversationId, String userId) {
        messageService.requireParticipant(conversationId, userId);
        return taskRepository.findVisible(conversationId, userId).stream().map(TaskResponse::of).toList();
    }

    /** Every task you can see, across your conversations: the Home page's list. */
    public List<TaskResponse> mine(String userId) {
        LocalDateTime now = LocalDateTime.now();
        List<String> ids = conversationRepository.findByParticipantsContainingOrderByUpdatedAtDesc(userId).stream()
                .filter(c -> !ConversationService.isExpired(c, now))
                .map(Conversation::getId)
                .toList();
        if (ids.isEmpty()) return List.of();
        return taskRepository.findVisibleIn(ids, userId).stream().map(TaskResponse::of).toList();
    }

    // ----------------------------------------------------------------- write

    public TaskResponse create(String conversationId, User me, TaskRequest request) {
        Conversation conversation = messageService.requireWritableConversation(conversationId, me.getId());
        boolean personal = request.isReminder();
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime dueAt = toUtc(request.getDueAt());

        Task task = taskRepository.save(Task.builder()
                .conversationId(conversationId)
                .title(request.getTitle().trim())
                .description(request.getDescription() == null ? "" : request.getDescription().trim())
                // A personal reminder is always for its creator.
                .assigneeId(personal ? me.getId() : validAssignee(conversation, request.getAssigneeId()))
                .dueAt(dueAt)
                .priority(request.getPriority() == null ? "MEDIUM" : request.getPriority())
                .status(request.getStatus() == null ? "TODO" : request.getStatus())
                .personalReminder(personal)
                .sourceMessageId(request.getSourceMessageId())
                .sourceMessageSnippet(request.getSourceMessageSnippet())
                .attachments(request.getAttachments().stream().map(TaskRequest.AttachmentRequest::toModel).toList())
                .createdBy(me.getId())
                .createdAt(now)
                .updatedAt(now)
                .remindersSent(stagesAlreadyPassed(dueAt, now))
                .build());

        broadcast(task, "upsert");

        if (!personal) {
            // Everyone in the chat sees it arrive: a note in the conversation,
            // and a notification for everyone but the person who added it.
            MessageResponse note = messageService.saveSystemMessage(conversationId,
                    me.getUsername() + " added a task: " + snippet(task.getTitle()));
            messagingTemplate.convertAndSend("/topic/conversation/" + conversationId, note);

            List<String> others = conversation.getParticipants().stream().filter(id -> !id.equals(me.getId())).toList();
            String where = "GROUP".equals(conversation.getType()) && conversation.getName() != null
                    ? " · " + conversation.getName() : "";
            pushService.notifyUsers(others, "New task" + where,
                    me.getUsername() + ": " + snippet(task.getTitle()),
                    conversationId, "task:" + task.getId());
        }
        return TaskResponse.of(task);
    }

    public TaskResponse update(String conversationId, String taskId, User me, TaskRequest request) {
        Conversation conversation = messageService.requireWritableConversation(conversationId, me.getId());
        Task task = findVisible(conversationId, taskId, me.getId());

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime dueAt = toUtc(request.getDueAt());
        boolean dueChanged = dueAt == null ? task.getDueAt() != null : !dueAt.equals(task.getDueAt());

        task.setTitle(request.getTitle().trim());
        task.setDescription(request.getDescription() == null ? "" : request.getDescription().trim());
        if (!task.isPersonalReminder()) {
            task.setAssigneeId(validAssignee(conversation, request.getAssigneeId()));
        }
        task.setDueAt(dueAt);
        if (request.getPriority() != null) task.setPriority(request.getPriority());
        if (request.getStatus() != null) task.setStatus(request.getStatus());
        task.setAttachments(request.getAttachments().stream().map(TaskRequest.AttachmentRequest::toModel).toList());
        task.setUpdatedAt(now);
        // A new deadline gets a fresh set of reminders.
        if (dueChanged) task.setRemindersSent(stagesAlreadyPassed(dueAt, now));

        task = taskRepository.save(task);
        broadcast(task, "upsert");
        return TaskResponse.of(task);
    }

    public void delete(String conversationId, String taskId, User me) {
        Conversation conversation = messageService.requireParticipant(conversationId, me.getId());
        Task task = findVisible(conversationId, taskId, me.getId());
        boolean allowed = me.getId().equals(task.getCreatedBy()) || me.getId().equals(conversation.getAdmin());
        if (!allowed) {
            throw new ForbiddenException("Only the person who added this task can delete it");
        }
        taskRepository.deleteById(task.getId());
        Map<String, Object> event = new LinkedHashMap<>();
        event.put("type", "delete");
        event.put("taskId", task.getId());
        event.put("conversationId", conversationId);
        messagingTemplate.convertAndSend(topicFor(task), (Object) event);
    }

    // ------------------------------------------------------------- reminders

    /** Who is reminded: the assignee, else everyone in the chat; a personal reminder, its creator. */
    public static List<String> reminderRecipients(Task task, Conversation conversation) {
        if (task.isPersonalReminder()) return List.of(task.getCreatedBy());
        if (task.getAssigneeId() != null && conversation.getParticipants().contains(task.getAssigneeId())) {
            return List.of(task.getAssigneeId());
        }
        return List.copyOf(conversation.getParticipants());
    }

    /**
     * Reminders whose moment has already passed when a due time is set. They're
     * marked as sent straight away so they never go out late: a task due in 20
     * minutes gets only its "due now" reminder, not "due in a day" as well.
     */
    public static List<String> stagesAlreadyPassed(LocalDateTime dueAt, LocalDateTime now) {
        List<String> passed = new ArrayList<>();
        if (dueAt == null) return passed;
        for (Stage stage : Stage.values()) {
            if (!dueAt.minus(stage.before).isAfter(now)) passed.add(stage.name());
        }
        return passed;
    }

    // --------------------------------------------------------------- helpers

    private Task findVisible(String conversationId, String taskId, String userId) {
        return taskRepository.findById(taskId)
                .filter(t -> conversationId.equals(t.getConversationId()))
                .filter(t -> !t.isPersonalReminder() || userId.equals(t.getCreatedBy()))
                .orElseThrow(() -> new NotFoundException("Task not found"));
    }

    private static String validAssignee(Conversation conversation, String assigneeId) {
        if (assigneeId == null || assigneeId.isBlank()) return null;
        if (!conversation.getParticipants().contains(assigneeId)) {
            throw new BadRequestException("You can only assign a task to someone in this chat");
        }
        return assigneeId;
    }

    private void broadcast(Task task, String type) {
        Map<String, Object> event = new LinkedHashMap<>();
        event.put("type", type);
        event.put("task", TaskResponse.of(task));
        messagingTemplate.convertAndSend(topicFor(task), (Object) event);
    }

    private static String topicFor(Task task) {
        return task.isPersonalReminder()
                ? "/topic/user/" + task.getCreatedBy() + "/tasks"
                : "/topic/conversation/" + task.getConversationId() + "/tasks";
    }

    private static LocalDateTime toUtc(Instant instant) {
        return instant == null ? null : LocalDateTime.ofInstant(instant, ZoneOffset.UTC);
    }

    public static String snippet(String text) {
        return text.length() <= SNIPPET ? text : text.substring(0, SNIPPET - 1) + "…";
    }
}
