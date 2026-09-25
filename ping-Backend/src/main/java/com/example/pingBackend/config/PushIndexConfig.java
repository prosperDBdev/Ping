package com.example.pingBackend.config;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;

/**
 * Indexes for push_subscriptions (automatic index creation is off in this
 * project; see StatusIndexConfig).
 *
 *   endpoint (unique) — one record per device. Subscribing upserts on it, and
 *                       the unique index is what stops two simultaneous
 *                       subscribe calls from creating duplicates, so one
 *                       message can never buzz the same phone twice.
 *   userId            — "every device this user has", read on every message.
 */
@Configuration
@RequiredArgsConstructor
@Slf4j
public class PushIndexConfig {

    private final MongoTemplate mongoTemplate;

    @PostConstruct
    void createPushIndexes() {
        try {
            mongoTemplate.indexOps("push_subscriptions").createIndex(
                    new Index().on("endpoint", Sort.Direction.ASC).unique().named("push_subscriptions_endpoint_unique"));
            mongoTemplate.indexOps("push_subscriptions").createIndex(
                    new Index().on("userId", Sort.Direction.ASC).named("push_subscriptions_userId"));
        } catch (RuntimeException e) {
            log.error("Failed to create push_subscriptions indexes — push still works, "
                    + "but duplicate device records are no longer prevented by the database", e);
        }
    }
}
