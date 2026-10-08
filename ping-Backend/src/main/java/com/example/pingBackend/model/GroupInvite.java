package com.example.pingBackend.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

/**
 * A shareable link that lets anyone join one group.
 *
 * At most one live link per group: making a new one replaces the old
 * immediately, so "reset the link" genuinely revokes a link someone posted
 * publicly.
 *
 * WHY THE CODE IS STORED AS ITSELF, unlike password-reset links (which are
 * hashed). A reset link is a key to one person's account, so it is hashed: a
 * stolen database can't be used to take accounts over. A group link is a
 * shared capability — everyone it has been sent to can already join — so
 * hashing it would only mean the admin could never re-share their own link
 * and would have to regenerate it every time they opened the panel. The
 * trade-off is that anyone who can read this collection can join the groups
 * that have a live link. That is recorded in SECURITY.md.
 */
@Document(collection = "group_invites")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GroupInvite {

    @Id
    private String id;

    private String conversationId;

    /** 128 random bits, 22 URL-safe characters (see AppInviteService). */
    private String code;

    private String createdBy;

    private LocalDateTime createdAt;

    /** A TTL index cleans the document up; the code checks this itself. */
    private LocalDateTime expiresAt;

    /** How many times it's been used, so the admin can see the link working. */
    private int uses;
}
