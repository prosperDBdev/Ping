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
 * Indexes for group_invites (automatic index creation is off in this project;
 * see StatusIndexConfig).
 *
 *   conversationId (unique) — one live link per group. Making a new link
 *                            deletes the old one, and this index is what makes
 *                            "one per group" a database guarantee rather than
 *                            something the code is trusted to remember.
 *   code (unique)            — the lookup on every preview and join.
 *   expiresAt (TTL)          — cleans up links nobody switched off.
 */
@Configuration
@RequiredArgsConstructor
@Slf4j
public class GroupIndexConfig {

    private final MongoTemplate mongoTemplate;

    @PostConstruct
    void createGroupInviteIndexes() {
        try {
            mongoTemplate.indexOps("group_invites").createIndex(
                    new Index().on("conversationId", Sort.Direction.ASC).unique()
                            .named("group_invites_conversationId_unique"));
            mongoTemplate.indexOps("group_invites").createIndex(
                    new Index().on("code", Sort.Direction.ASC).unique().named("group_invites_code_unique"));
            mongoTemplate.indexOps("group_invites").createIndex(
                    new Index().on("expiresAt", Sort.Direction.ASC).expire(Duration.ZERO)
                            .named("group_invites_expiresAt_ttl"));
            log.info("Group invite indexes ready");
        } catch (RuntimeException e) {
            log.error("Failed to create group invite indexes — links still work, but "
                    + "expired ones won't be cleaned up automatically", e);
        }
    }
}
