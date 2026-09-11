package com.example.pingBackend.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

/**
 * A message a user chose to keep findable, independent of the conversation
 * it came from. Memories are strictly per-user: two participants in the same
 * conversation can each save the same message under different categories,
 * and neither one's saved memories are ever visible to the other. Every
 * query and mutation in MemoryService filters by the requester's own userId
 * for exactly that reason — this is not a shared, conversation-level object
 * the way a Task or Event is.
 */
@Document(collection = "memories")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Memory {

    @Id
    private String id;

    private String userId;
    private String conversationId;
    private String messageId;

    // A snapshot of the message content at save time, not a live reference —
    // if the original message is ever edited or removed, the memory the user
    // asked to keep should still read the way it did when they saved it.
    private String content;

    private String category; // IMPORTANT, EVENT, FINANCIAL, LOCATION, PERSON, NOTE

    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
