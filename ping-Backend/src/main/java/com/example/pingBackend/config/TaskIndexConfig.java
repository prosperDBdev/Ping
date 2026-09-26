package com.example.pingBackend.config;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;

/**
 * Indexes for tasks (automatic index creation is off in this project; see
 * StatusIndexConfig).
 *
 *   conversationId + createdAt — a chat's task list, newest first.
 *   dueAt + status             — the reminder job, every 30 seconds, looks for
 *                                tasks falling due; without this it would read
 *                                every task ever made on every run.
 */
@Configuration
@RequiredArgsConstructor
@Slf4j
public class TaskIndexConfig {

    private final MongoTemplate mongoTemplate;

    @PostConstruct
    void createTaskIndexes() {
        try {
            mongoTemplate.indexOps("tasks").createIndex(new Index()
                    .on("conversationId", Sort.Direction.ASC).on("createdAt", Sort.Direction.DESC)
                    .named("tasks_conversationId_createdAt"));
            mongoTemplate.indexOps("tasks").createIndex(new Index()
                    .on("dueAt", Sort.Direction.ASC).on("status", Sort.Direction.ASC)
                    .named("tasks_dueAt_status"));
            log.info("Task indexes ready");
        } catch (RuntimeException e) {
            log.error("Failed to create task indexes — tasks still work, but reminders scan more slowly", e);
        }
    }
}
