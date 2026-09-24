package com.example.pingBackend.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

/**
 * A user's personal link for inviting people to Ping.
 *
 * Named AppInvite, not Invite, because TemporaryConversationInvite already
 * exists and means something different: an invitation into one temporary
 * chat. This is an invitation to create an account.
 *
 * ONE PER USER. Each user has at most one document here (a unique index on
 * inviterId enforces it — see AppInviteIndexConfig). Making a new link
 * overwrites the code on that same document, which is also how the old link
 * gets revoked: nothing can find it any more.
 *
 * THE CODE IS STORED AS-IS, NOT HASHED. Password reset tokens are hashed
 * because nobody ever needs to see one again after it's emailed. An invite
 * link is different: its owner opens Settings next week and expects to copy
 * the same link again, so the server has to be able to show it. Hashing is
 * only possible for secrets the server never has to reproduce.
 */
@Document(collection = "app_invites")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AppInvite {

    @Id
    private String id;

    /** 22 URL-safe characters from 128 random bits. Unique. */
    private String code;

    /** Whose link this is. Unique: one active link per user. */
    private String inviterId;

    private LocalDateTime createdAt;

    /**
     * After this moment the link stops working. Every lookup checks it
     * directly, and a TTL index also deletes the document some time after —
     * but the query check is what users actually experience, because Mongo's
     * TTL sweep only runs about once a minute and can lag behind.
     */
    private LocalDateTime expiresAt;
}
