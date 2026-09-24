package com.example.pingBackend.config;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;

import java.time.Duration;

/**
 * Indexes for app_invites, created explicitly because automatic index creation
 * is off in this project (see StatusIndexConfig for the full story).
 *
 * Each index here does a job the application code relies on:
 *
 *   code (unique)      — how an invite is found from a link, and a guarantee
 *                        that two users can never end up sharing one code.
 *
 *   inviterId (unique) — "one active link per user" enforced by the database
 *                        rather than by hoping two requests never overlap.
 *                        AppInviteService.newLink upserts on this field; if
 *                        two "new link" requests race, the index is what stops
 *                        them creating two documents.
 *
 *   expiresAt (TTL)    — housekeeping. Mongo deletes a document once its
 *                        expiresAt has passed, so dead links don't pile up
 *                        forever. It is NOT what makes a link stop working —
 *                        every lookup filters on expiresAt itself, because
 *                        Mongo's TTL sweep only runs about once a minute.
 */
@Configuration
@RequiredArgsConstructor
@Slf4j
public class AppInviteIndexConfig {

    private final MongoTemplate mongoTemplate;

    @PostConstruct
    void createAppInviteIndexes() {
        try {
            mongoTemplate.indexOps("app_invites").createIndex(
                    new Index().on("code", Sort.Direction.ASC)
                            .unique()
                            .named("app_invites_code_unique"));

            mongoTemplate.indexOps("app_invites").createIndex(
                    new Index().on("inviterId", Sort.Direction.ASC)
                            .unique()
                            .named("app_invites_inviterId_unique"));

            // expireAfterSeconds = 0 means "delete once expiresAt has passed".
            mongoTemplate.indexOps("app_invites").createIndex(
                    new Index().on("expiresAt", Sort.Direction.ASC)
                            .expire(Duration.ZERO)
                            .named("app_invites_expiresAt_ttl"));

            log.info("App invite indexes ready");
        } catch (RuntimeException e) {
            // Same rule as the other index configs: never stop the app from
            // booting over an index. Invites keep working without these —
            // slower lookups, and no database-level guarantee of one link
            // per user — and the log says so.
            log.error("Failed to create app_invites indexes — invite links still work, "
                    + "but uniqueness and cleanup are no longer guaranteed by the database", e);
        }
    }
}
