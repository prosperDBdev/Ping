package com.example.pingBackend.service;

import com.example.pingBackend.dto.response.ConversationMediaResponse;
import com.example.pingBackend.dto.response.MessageResponse;
import com.example.pingBackend.model.Conversation;
import com.example.pingBackend.model.Message;
import com.example.pingBackend.repository.ConversationRepository;
import com.example.pingBackend.repository.MessageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class MessageService {

    private final MessageRepository messageRepository;
    private final ConversationRepository conversationRepository;
    private final BlockService blockService;

    // Get message history for a conversation (paginated)
    public Page<MessageResponse> getMessages(String conversationId, String userId, int page, int size) {

        // Verify user is a participant
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new RuntimeException("Conversation not found"));

        if (!conversation.getParticipants().contains(userId)) {
            throw new RuntimeException("You are not a participant in this conversation");
        }

        // An expired temporary conversation's history is gone as far as the
        // API is concerned, even in the window before the cleanup job has
        // physically deleted it.
        if (ConversationService.isExpired(conversation, LocalDateTime.now())) {
            throw new RuntimeException("This temporary conversation has expired");
        }

        Pageable pageable = PageRequest.of(page, size);
        LocalDateTime clearedAt = conversation.getClearedAt().get(userId);

        // "Clear chat" is per-user, so it's applied at read time against the
        // CALLER's marker rather than by deleting anything — the other
        // participant's history is untouched.
        //
        // The filter has to be part of the QUERY, not applied to the results:
        // dropping cleared messages after paging would return short pages (ask
        // for 50, get 12) and make "is there more?" wrong.
        return (clearedAt == null
                ? messageRepository.findByConversationIdOrderByCreatedAtDesc(conversationId, pageable)
                : messageRepository.findByConversationIdAndCreatedAtAfterOrderByCreatedAtDesc(
                        conversationId, clearedAt, pageable))
                .map(this::mapToResponse);
    }

    /**
     * Clear this conversation for one user.
     *
     * Records a marker rather than deleting messages: the conversation belongs
     * to two people, and one of them tidying their own view must not destroy
     * the other's copy.
     */
    public void clearConversation(String conversationId, String userId) {
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new RuntimeException("Conversation not found"));

        if (!conversation.getParticipants().contains(userId)) {
            throw new RuntimeException("You are not a participant in this conversation");
        }

        conversation.getClearedAt().put(userId, LocalDateTime.now());
        conversationRepository.save(conversation);
    }

    // Save a new message and update conversation
    public MessageResponse saveMessage(String conversationId, String senderId, String senderUsername, String content, String type, Message.Attachment attachment) {
        return saveMessage(conversationId, senderId, senderUsername, content, type, attachment, null);
    }

    /**
     * Same as above, optionally quoting a status.
     *
     * An overload rather than a new method so a status reply goes through
     * EXACTLY the same checks as any other message — participant, expiry, and
     * block-check 1 of 3. A separate "saveStatusReply" would be a second path
     * into the messages collection, and every guard above would have to be
     * remembered twice.
     */
    public MessageResponse saveMessage(String conversationId, String senderId, String senderUsername, String content, String type, Message.Attachment attachment, Message.StatusReply statusReply) {

        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new RuntimeException("Conversation not found"));

        // Sending was previously unchecked — a conversation ID alone was
        // enough to post into any conversation, including one you were never
        // part of. Same rule as reading: participants only.
        if (!conversation.getParticipants().contains(senderId)) {
            throw new RuntimeException("You are not a participant in this conversation");
        }

        // Nothing new lands in a temporary conversation past its expiry.
        if (ConversationService.isExpired(conversation, LocalDateTime.now())) {
            throw new RuntimeException("This temporary conversation has expired");
        }

        // BLOCK-CHECK (1 of 3) — the one that matters most.
        // Only meaningful for 1-on-1: a group has many recipients and blocking
        // one member shouldn't silence the whole room.
        if ("PRIVATE".equals(conversation.getType())) {
            conversation.getParticipants().stream()
                    .filter(participantId -> !participantId.equals(senderId))
                    .findFirst()
                    .ifPresent(otherUserId -> blockService.assertNotBlocked(senderId, otherUserId));
        }

        // Create and save message
        Message message = Message.builder()
                .conversationId(conversationId)
                .senderId(senderId)
                .senderUsername(senderUsername)
                .content(content)
                .type(type != null ? type : "TEXT")
                .attachment(attachment)
                .statusReply(statusReply)
                .seenBy(List.of(senderId)) // Sender has seen their own message
                .build();

        Message saved = messageRepository.save(message);

        // Update conversation's last message
        conversation.setLastMessage(Conversation.LastMessage.builder()
                .content(content)
                .senderId(senderId)
                .senderUsername(senderUsername)
                .timestamp(saved.getCreatedAt())
                .build());

        // Increment unread count for other participants
        conversation.getParticipants().forEach(participantId -> {
            if (!participantId.equals(senderId)) {
                conversation.getUnreadCount().merge(participantId, 1, Integer::sum);
            }
        });

        conversation.setUpdatedAt(LocalDateTime.now());
        conversationRepository.save(conversation);

        return mapToResponse(saved);
    }

    /**
     * Record a SYSTEM message — "X removed Y from the group" and similar.
     *
     * Separate from saveMessage because the participant and blocking checks
     * there are about a person sending something. A system message has no
     * human sender; it's the conversation narrating itself, so those guards
     * are meaningless here. It also deliberately does NOT bump unread counts:
     * an administrative note shouldn't make a chat look like it has new
     * messages waiting.
     */
    public MessageResponse saveSystemMessage(String conversationId, String content) {
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new RuntimeException("Conversation not found"));

        Message message = Message.builder()
                .conversationId(conversationId)
                .senderId(null)
                .senderUsername(null)
                .content(content)
                .type("SYSTEM")
                .build();

        Message saved = messageRepository.save(message);

        conversation.setLastMessage(Conversation.LastMessage.builder()
                .content(content)
                .senderId(null)
                .senderUsername(null)
                .timestamp(saved.getCreatedAt())
                .build());
        conversation.setUpdatedAt(LocalDateTime.now());
        conversationRepository.save(conversation);

        return mapToResponse(saved);
    }

    /**
     * Every file shared in a conversation, newest first.
     *
     * Separate from getMessages because the Files panel needs the whole
     * conversation's media, not just whichever page of messages happens to be
     * scrolled into view. Same access rules as reading the messages
     * themselves — participants only, and nothing from an expired temporary
     * conversation.
     */
    public List<ConversationMediaResponse> getConversationMedia(String conversationId, String userId) {
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new RuntimeException("Conversation not found"));

        if (!conversation.getParticipants().contains(userId)) {
            throw new RuntimeException("You are not a participant in this conversation");
        }

        if (ConversationService.isExpired(conversation, LocalDateTime.now())) {
            throw new RuntimeException("This temporary conversation has expired");
        }

        // Same per-user clear marker the message list honours. Missing it here
        // meant clearing a chat hid the messages but left every photo and
        // voice note still listed and downloadable from the Files panel —
        // the rule existed in one place and not the other.
        LocalDateTime clearedAt = conversation.getClearedAt().get(userId);

        return messageRepository
                .findByConversationIdAndAttachmentNotNullOrderByCreatedAtDesc(conversationId)
                .stream()
                .filter(message -> clearedAt == null || message.getCreatedAt().isAfter(clearedAt))
                .map(message -> {
                    Message.Attachment attachment = message.getAttachment();
                    return ConversationMediaResponse.builder()
                            .messageId(message.getId())
                            .key(attachment.getKey())
                            .mimeType(attachment.getMimeType())
                            .sizeBytes(attachment.getSizeBytes())
                            .fileName(attachment.getFileName())
                            .durationSeconds(attachment.getDurationSeconds())
                            .senderId(message.getSenderId())
                            .senderUsername(message.getSenderUsername())
                            .createdAt(message.getCreatedAt())
                            .build();
                })
                .collect(Collectors.toList());
    }

    // Mark messages as read
    public void markAsRead(String conversationId, String userId) {

        // Get unread messages
        List<Message> unreadMessages = messageRepository
                .findByConversationIdAndSeenByNotContaining(conversationId, userId);

        // Add userId to seenBy for each message
        unreadMessages.forEach(message -> {
            message.getSeenBy().add(userId);

            // Update status based on how many have seen it
            Conversation conversation = conversationRepository.findById(conversationId).orElse(null);
            if (conversation != null) {
                int totalParticipants = conversation.getParticipants().size();
                if (message.getSeenBy().size() >= totalParticipants) {
                    message.setStatus("SEEN");
                } else {
                    message.setStatus("DELIVERED");
                }
            }

            messageRepository.save(message);
        });

        // Reset unread count for this user
        Conversation conversation = conversationRepository.findById(conversationId).orElse(null);
        if (conversation != null) {
            conversation.getUnreadCount().put(userId, 0);
            conversationRepository.save(conversation);
        }
    }

    private MessageResponse mapToResponse(Message message) {
        return MessageResponse.builder()
                .id(message.getId())
                .conversationId(message.getConversationId())
                .senderId(message.getSenderId())
                .senderUsername(message.getSenderUsername())
                .content(message.getContent())
                .type(message.getType())
                .status(message.getStatus())
                .seenBy(message.getSeenBy())
                .attachment(message.getAttachment())
                .statusReply(message.getStatusReply())
                .createdAt(message.getCreatedAt())
                .build();
    }
}