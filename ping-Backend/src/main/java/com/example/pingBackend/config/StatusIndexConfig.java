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
 * Creates the indexes the statuses collection needs, explicitly.
 *
 * WHY THIS ISN'T JUST @Indexed ANNOTATIONS:
 *
 * Spring Boot sets spring.data.mongodb.auto-index-creation to FALSE by
 * default, and this project has never turned it on. Every @Indexed annotation
 * in the model classes is therefore documentation rather than behaviour —
 * including, uncomfortably, the @Indexed(unique = true) on User.username.
 *
 * The obvious fix is to flip that property on globally, but it isn't safe to
 * do blindly: enabling it makes Spring build every declared index at startup,
 * and if the users collection already contains two accounts with the same
 * username, building that unique index FAILS and the application refuses to
 * boot. That's a separate cleanup task with its own risk.
 *
 * So this class builds only what Stage 10 needs, on a collection that is brand
 * new and therefore cannot contain conflicting data. Narrow blast radius, no
 * effect on anything that already exists.
 */
@Configuration
@RequiredArgsConstructor
@Slf4j
public class StatusIndexConfig {

    /**
     * Seven days, not twenty-four hours, and the gap is the whole point.
     *
     * Mongo's TTL monitor deletes documents entirely inside the database — no
     * application code runs, nothing is logged, and no callback fires. A
     * status document is the only thing that records which R2 object belongs
     * to it. If this index fired at 24 hours it would race the cleanup job and
     * sometimes win, destroying that record and leaving the image orphaned in
     * the bucket: unreferenced, unfindable, and billable forever.
     *
     * Set well beyond the point where the job should have handled it, this
     * index stops being a deletion mechanism and becomes a safety net — the
     * thing that keeps the collection bounded if the job breaks, at the known
     * and accepted cost of leaking the blobs it was supposed to clean up.
     */
    private static final Duration TTL_BACKSTOP = Duration.ofDays(7);

    private final MongoTemplate mongoTemplate;

    @PostConstruct
    void createStatusIndexes() {
        try {
            mongoTemplate.indexOps("statuses").createIndex(
                    new Index().on("expiresAt", Sort.Direction.ASC)
                            .expire(TTL_BACKSTOP)
                            .named("statuses_expiresAt_ttl"));

            mongoTemplate.indexOps("statuses").createIndex(
                    new Index().on("authorId", Sort.Direction.ASC)
                            .named("statuses_authorId"));

            mongoTemplate.indexOps("statuses").createIndex(
                    new Index().on("mediaKey", Sort.Direction.ASC)
                            .named("statuses_mediaKey"));

            log.info("Status indexes ready — TTL backstop deletes documents {} days after expiry",
                    TTL_BACKSTOP.toDays());
        } catch (RuntimeException e) {
            // Index creation must not stop the app from starting. Missing
            // indexes make queries slower and let the collection grow; a
            // backend that won't boot takes the whole product down. Logged at
            // error so it can't pass unnoticed.
            log.error("Failed to create status indexes — statuses will still work, but the "
                    + "TTL backstop is NOT in place and the collection can grow unbounded", e);
        }
    }
}
