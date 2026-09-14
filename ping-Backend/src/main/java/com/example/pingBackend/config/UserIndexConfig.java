package com.example.pingBackend.config;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.data.mongodb.core.query.Collation;

/**
 * Unique indexes on usernames and emails — the database's guarantee that no two
 * accounts can share one.
 *
 * WHY THE CODE'S CHECK ISN'T ENOUGH. Registration asks "is this username taken?"
 * and, if not, saves. Two people submitting the same username at the same instant
 * can BOTH get "not taken" before either has saved — and both accounts get
 * created. It's the check-then-act race again, and no amount of checking in Java
 * can close it, because the gap is between two separate trips to the database. A
 * unique index closes it inside the database itself: the second insert is refused
 * outright, and AuthService turns that refusal into a 409.
 *
 * WHY EXPLICIT. The User class used to carry @Indexed(unique = true), but this
 * project leaves Spring's automatic index creation switched off, so those
 * annotations never created anything — usernames were never actually unique.
 *
 * EMAIL IS CASE-INSENSITIVE. The email index uses a collation with strength 2,
 * which compares text ignoring upper/lower case, so "Maya@x.com" and "maya@x.com"
 * count as the same address — which, for email, they are. Usernames stay exact,
 * matching how sign-in already looks them up.
 *
 * If the collection already contains duplicates, creating an index fails. The app
 * still starts (a missing index shouldn't take the whole product down), but the
 * failure is logged loudly: registration's own checks then remain the only line
 * of defence until the duplicates are cleaned up.
 */
@Configuration
@RequiredArgsConstructor
@Slf4j
public class UserIndexConfig {

    private final MongoTemplate mongoTemplate;

    @PostConstruct
    void createUserIndexes() {
        create(new Index().on("username", Sort.Direction.ASC)
                .unique()
                .named("users_username_unique"));

        create(new Index().on("email", Sort.Direction.ASC)
                .unique()
                .collation(Collation.of("en").strength(Collation.ComparisonLevel.secondary()))
                .named("users_email_unique"));
    }

    private void create(Index index) {
        try {
            mongoTemplate.indexOps("users").createIndex(index);
        } catch (RuntimeException e) {
            log.error("Could not create unique index on users ({}). Usually this means duplicate values "
                    + "already exist — until they're removed, duplicates are only prevented by the "
                    + "application's own checks, not by the database.", e.getMessage());
        }
    }
}
