package com.example.pingBackend.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

/**
 * A proposal to start a temporary conversation, before either party has
 * agreed to it. Deliberately kept separate from Conversation — nothing about
 * how conversations are normally listed or fetched needs to know "pending"
 * states exist, because a pending invite is never a Conversation document
 * until it's accepted.
 */
@Document(collection = "temporary_conversation_invites")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TemporaryConversationInvite {

    @Id
    private String id;

    private String fromUserId;
    private String toUserId;

    private long durationMs;
    private String durationLabel;

    @Builder.Default
    private String status = "PENDING"; // PENDING, ACCEPTED, DECLINED

    // Set once accepted — lets the response payload point straight at the
    // real conversation without a second round trip.
    private String resultingConversationId;

    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
