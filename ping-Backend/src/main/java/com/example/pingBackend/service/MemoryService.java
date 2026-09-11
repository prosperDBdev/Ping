package com.example.pingBackend.service;

import com.example.pingBackend.dto.response.MemoryResponse;
import com.example.pingBackend.model.Conversation;
import com.example.pingBackend.model.Memory;
import com.example.pingBackend.model.Message;
import com.example.pingBackend.repository.ConversationRepository;
import com.example.pingBackend.repository.MemoryRepository;
import com.example.pingBackend.repository.MessageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class MemoryService {

    private final MemoryRepository memoryRepository;
    private final MessageRepository messageRepository;
    private final ConversationRepository conversationRepository;
    private final MongoTemplate mongoTemplate;

    // Save a message as a memory for the current user.
    public MemoryResponse createMemory(String userId, String messageId, String category) {
        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new RuntimeException("Message not found"));

        Conversation conversation = conversationRepository.findById(message.getConversationId())
                .orElseThrow(() -> new RuntimeException("Conversation not found"));

        // Same access-control shape as the media download endpoint: a message
        // ID isn't a permission, so confirm the requester is actually a
        // participant in the conversation it belongs to before letting them
        // save (or, in listMemories/deleteMemory, read or remove) anything
        // tied to it.
        if (!conversation.getParticipants().contains(userId)) {
            throw new RuntimeException("You don't have access to this message");
        }

        Memory memory = Memory.builder()
                .userId(userId)
                .conversationId(message.getConversationId())
                .messageId(messageId)
                .content(message.getContent())
                .category(category)
                .build();

        return mapToResponse(memoryRepository.save(memory));
    }

    // Delete a memory — only its owner may remove it.
    public void deleteMemory(String userId, String memoryId) {
        Memory memory = memoryRepository.findById(memoryId)
                .orElseThrow(() -> new RuntimeException("Memory not found"));

        if (!memory.getUserId().equals(userId)) {
            throw new RuntimeException("You don't have access to this memory");
        }

        memoryRepository.deleteById(memoryId);
    }

    /**
     * List the current user's memories, most recent first, with two
     * independent optional filters:
     *
     *   - category: exact match against Memory.category, when provided
     *   - searchQuery: case-insensitive substring match against
     *     Memory.content, when provided
     *
     * Either, both, or neither filter may be present on a given call — that's
     * exactly the shape a derived query method name can't express cleanly
     * (you'd need findByUserId, findByUserIdAndCategory,
     * findByUserIdAndContentContaining,
     * findByUserIdAndCategoryAndContentContaining... one method per
     * combination). Build the query with MongoTemplate/Criteria instead:
     *
     *   1. Start from Criteria.where("userId").is(userId) — this one is
     *      never optional; every query here is scoped to the requester.
     *   2. If category is non-null/non-blank, add
     *      .and("category").is(category) to that same Criteria.
     *   3. If searchQuery is non-null/non-blank, add
     *      .and("content").regex(searchQuery, "i") — the "i" flag makes it
     *      case-insensitive. (Criteria.regex(pattern, options) takes the raw
     *      pattern; you don't need to build a java.util.regex.Pattern
     *      yourself.)
     *   4. Wrap it: new Query(criteria).with(Sort.by(Sort.Direction.DESC,
     *      "createdAt"))
     *   5. mongoTemplate.find(query, Memory.class) runs it, returning
     *      List&lt;Memory&gt; — map each one through the existing
     *      mapToResponse() helper below before returning.
     *
     * @param userId      the requester — always required, never optional
     * @param category    optional exact-match filter, null/blank to skip
     * @param searchQuery optional case-insensitive substring filter on
     *                    content, null/blank to skip
     */
    public List<MemoryResponse> listMemories(String userId, String category, String searchQuery) {
        // TODO: implement per the steps above.
        throw new UnsupportedOperationException("listMemories not implemented yet");
    }

    private MemoryResponse mapToResponse(Memory memory) {
        return MemoryResponse.builder()
                .id(memory.getId())
                .conversationId(memory.getConversationId())
                .messageId(memory.getMessageId())
                .content(memory.getContent())
                .category(memory.getCategory())
                .createdAt(memory.getCreatedAt())
                .build();
    }
}
