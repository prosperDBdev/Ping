package com.example.pingBackend.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.index.Indexed;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Document(collection = "users")  // ← This tells MongoDB: store in "users" collection
@Data                            // ← Lombok: auto-generates getters, setters, toString
@Builder                         // ← Lombok: lets us build User objects nicely
@NoArgsConstructor               // ← Lombok: empty constructor
@AllArgsConstructor              // ← Lombok: constructor with all fields
public class User {

    @Id                          // ← MongoDB will auto-generate this ID
    private String id;

    @Indexed(unique = true)      // ← No two users can have the same username
    private String username;

    @Indexed(unique = true)      // ← No two users can have the same email
    private String email;

    private String password;     // ← Stored as BCrypt hash, NEVER plain text

    private String avatarUrl;    // ← Profile picture URL (nullable for now)

    @Builder.Default
    private String status = "OFFLINE";  // ← ONLINE or OFFLINE

    private LocalDateTime lastSeen;

    /**
     * Users this account has blocked.
     *
     * Enforcement is deliberately symmetric: if EITHER party has blocked the
     * other, neither can message the other. Blocking someone you can still be
     * messaged by isn't blocking, and letting the blocker keep messaging the
     * person they blocked is a harassment vector rather than a feature.
     */
    @Builder.Default
    private List<String> blockedUsers = new ArrayList<>();

    /**
     * People who must not see this user's statuses.
     *
     * Distinct from blocking, and deliberately so. Blocking is mutual and
     * total — neither party can reach the other at all. Hiding a status is
     * one-directional and narrow: the two of you carry on chatting exactly as
     * before, and the only consequence is that YOUR statuses stop appearing in
     * THEIR feed. Collapsing the two would force people to block a friend just
     * to keep one photo away from them.
     */
    @Builder.Default
    private List<String> hiddenStatusFrom = new ArrayList<>();

    /**
     * Whether other people may reshare this user's statuses to their own feed.
     *
     * A reshare takes something you posted for an audience you chose and hands
     * it to one you didn't, so it's the author's call.
     *
     * Boxed Boolean rather than a primitive, on purpose. Every user document
     * written before this field existed has no such key, and Mongo would
     * deserialise a primitive as `false` — silently revoking resharing for
     * every existing account without anyone having asked for that. Null here
     * means "never expressed a preference", which the service reads as the
     * documented default of true.
     */
    @Builder.Default
    private Boolean allowResharing = Boolean.TRUE;

    /**
     * When the password last changed. Any login token issued before this moment
     * is refused (see TokenAuthenticator) — which is how a password reset logs a
     * thief out of every device they were signed in on. Null means never changed.
     */
    private LocalDateTime passwordChangedAt;

    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}