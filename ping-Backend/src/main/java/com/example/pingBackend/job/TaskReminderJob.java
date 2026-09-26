package com.example.pingBackend.job;

import com.example.pingBackend.model.Conversation;
import com.example.pingBackend.model.Task;
import com.example.pingBackend.model.User;
import com.example.pingBackend.repository.ConversationRepository;
import com.example.pingBackend.repository.UserRepository;
import com.example.pingBackend.service.ConversationService;
import com.example.pingBackend.service.PushService;
import com.example.pingBackend.service.TaskService;
import com.example.pingBackend.service.TaskService.Stage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.springframework.data.mongodb.core.query.Criteria.where;
import static org.springframework.data.mongodb.core.query.Query.query;

/**
 * Sends task reminders: a day before, an hour before, and when a task is due.
 *
 * Every 30 seconds it asks the database for a task that has reached a stage
 * and hasn't had that reminder yet, and in the SAME atomic operation records
 * it as sent (findAndModify with $addToSet). A reminder is therefore claimed
 * exactly once, even if two copies of the server ever ran side by side or a
 * run overlapped the next.
 *
 * Each reminder goes out two ways: a Web Push (reaches a phone with Ping
 * closed) and a live message on the person's own topic (an in-app pop-up if
 * Ping is open; the phone skips the push then, so nobody gets both).
 *
 * If the server was down when something fell due, "due now" is still sent for
 * up to an hour afterwards. Later than that, a reminder is stale and skipped.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class TaskReminderJob {

    static final Duration LATE_GRACE = Duration.ofHours(1);
    /** A safety cap per run; anything left over is picked up 30 seconds later. */
    static final int MAX_PER_RUN = 200;

    private final MongoTemplate mongoTemplate;
    private final ConversationRepository conversationRepository;
    private final UserRepository userRepository;
    private final PushService pushService;
    private final SimpMessagingTemplate messagingTemplate;

    @Scheduled(fixedDelay = 30_000, initialDelay = 15_000)
    public void sendDueReminders() {
        int sent = 0;
        for (Stage stage : Stage.values()) {
            Task task;
            while (sent < MAX_PER_RUN && (task = claim(stage, LocalDateTime.now())) != null) {
                remind(task, stage);
                sent++;
            }
        }
        if (sent > 0) log.info("Sent {} task reminder(s)", sent);
    }

    /** Find one task that has reached this stage and mark the stage sent, atomically. */
    Task claim(Stage stage, LocalDateTime now) {
        // Early reminders only while the task is still in the future; "due now"
        // for up to LATE_GRACE after the deadline.
        LocalDateTime notBefore = stage == Stage.DUE ? now.minus(LATE_GRACE) : now;
        return mongoTemplate.findAndModify(
                query(where("status").ne("COMPLETED")
                        .and("dueAt").lte(now.plus(stage.before)).gt(notBefore)
                        .and("remindersSent").ne(stage.name())),
                new Update().addToSet("remindersSent", stage.name()),
                FindAndModifyOptions.options().returnNew(true),
                Task.class);
    }

    private void remind(Task task, Stage stage) {
        Conversation conversation = conversationRepository.findById(task.getConversationId()).orElse(null);
        if (conversation == null || ConversationService.isExpired(conversation, LocalDateTime.now())) return;

        String when = switch (stage) {
            case DAY_BEFORE -> "Due in 1 day";
            case HOUR_BEFORE -> "Due in 1 hour";
            case DUE -> "Due now";
        };
        String title = "⏰ " + when + ": " + TaskService.snippet(task.getTitle());

        for (String userId : TaskService.reminderRecipients(task, conversation)) {
            String body = describe(task, conversation, userId);
            pushService.notifyUsers(List.of(userId), title, body, conversation.getId(),
                    "task:" + task.getId());

            Map<String, Object> live = new LinkedHashMap<>();
            live.put("taskId", task.getId());
            live.put("conversationId", conversation.getId());
            live.put("title", title);
            live.put("body", body);
            messagingTemplate.convertAndSend("/topic/user/" + userId + "/reminders", (Object) live);
        }
    }

    /** The line under the reminder, written for the person receiving it. */
    private String describe(Task task, Conversation conversation, String userId) {
        if (task.isPersonalReminder()) return "Your reminder";
        String who = userId.equals(task.getAssigneeId()) ? "Assigned to you" : "For everyone";
        if ("GROUP".equals(conversation.getType()) && conversation.getName() != null) {
            return who + " · " + conversation.getName();
        }
        String other = conversation.getParticipants().stream()
                .filter(id -> !id.equals(userId))
                .findFirst()
                .flatMap(userRepository::findById)
                .map(User::getUsername)
                .orElse(null);
        return other == null ? who : who + " · chat with " + other;
    }
}
