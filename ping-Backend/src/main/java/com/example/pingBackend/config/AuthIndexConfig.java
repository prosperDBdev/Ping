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
 * Indexes for authentication collections, created explicitly.
 *
 * Same reason as StatusIndexConfig: this project leaves Spring's automatic
 * index creation off, so @Indexed annotations do nothing on their own.
 *
 * THE TTL INDEX IS A JANITOR, NOT A LOCK. Mongo deletes expired documents in a
 * background sweep that runs about once a minute, so an expired reset token can
 * sit in the collection for up to a minute or so after it expired. That's why
 * PasswordResetService still checks expiresAt itself. If the code trusted the
 * index to have removed it, a link could keep working after its 15 minutes were
 * up. The index keeps the collection clean; the code enforces the rule.
 */
@Configuration
@RequiredArgsConstructor
@Slf4j
public class AuthIndexConfig {

    private final MongoTemplate mongoTemplate;

    @PostConstruct
    void createAuthIndexes() {
        try {
            // expireAfterSeconds = 0 means "delete once expiresAt has passed".
            mongoTemplate.indexOps("password_reset_tokens").createIndex(
                    new Index().on("expiresAt", Sort.Direction.ASC)
                            .expire(Duration.ZERO)
                            .named("password_reset_tokens_expiresAt_ttl"));

            mongoTemplate.indexOps("password_reset_tokens").createIndex(
                    new Index().on("tokenHash", Sort.Direction.ASC)
                            .unique()
                            .named("password_reset_tokens_tokenHash"));

            log.info("Password reset token indexes ready");
        } catch (RuntimeException e) {
            log.error("Failed to create password reset indexes — resets still work, "
                    + "but expired tokens will not be cleaned up automatically", e);
        }
    }
}
