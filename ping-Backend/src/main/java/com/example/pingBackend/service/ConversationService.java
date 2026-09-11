package com.example.pingBackend.service;

import com.example.pingBackend.dto.response.ConversationResponse;
import com.example.pingBackend.dto.response.MessageResponse;
import com.example.pingBackend.dto.response.UserResponse;
import com.example.pingBackend.model.Conversation;
import com.example.pingBackend.model.User;
import com.example.pingBackend.repository.ConversationRepository;
import com.example.pingBackend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ConversationService {

    private final ConversationRepository conversationRepository;
    private final UserRepository userRepository;
    private final BlockService blockService;
    private final MessageService messageService;
    private final SimpMessagingTemplate messagingTemplate;

    // Create or get existing private conversation
    public ConversationResponse createPrivateConversation(String currentUserId, String participantId) {
        // BLOCK-CHECK (2 of 3) — stop the conversation existing at all, rather
        // than letting it be created and only failing at the first message.
        blockService.assertNotBlocked(currentUserId, participantId);

        Conversation conversation = getOrCreatePrivateConversationEntity(currentUserId, participantId);
        return mapToResponse(conversation, currentUserId);
    }

    /**
     * Remove a participant from a group. Admin only.
     */
    public void removeParticipant(String conversationId, String requesterId, String targetUserId) {
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new RuntimeException("Conversation not found"));

        if (!"GROUP".equals(conversation.getType())) {
            throw new RuntimeException("Only group conversations have members to remove");
        }
        // Authorisation, not just membership: being in the group is not the
        // same as being allowed to remove people from it.
        if (!requesterId.equals(conversation.getAdmin())) {
            throw new RuntimeException("Only the group admin can remove members");
        }
        if (targetUserId.equals(conversation.getAdmin())) {
            throw new RuntimeException("The admin can't be removed from their own group");
        }
        if (!conversation.getParticipants().contains(targetUserId)) {
            throw new RuntimeException("That user isn't in this group");
        }

        // The list from Mongo may be immutable depending on how it was
        // deserialised, so rebuild rather than mutating in place.
        List<String> remaining = conversation.getParticipants().stream()
                .filter(id -> !id.equals(targetUserId))
                .collect(Collectors.toList());

        conversation.setParticipants(remaining);
        // Leaving a stale unread count for someone no longer in the group would
        // keep them in the document forever for no reason.
        conversation.getUnreadCount().remove(targetUserId);
        conversation.setUpdatedAt(LocalDateTime.now());

        conversationRepository.save(conversation);

        String adminName = userRepository.findById(requesterId)
                .map(User::getUsername).orElse("An admin");
        String removedName = userRepository.findById(targetUserId)
                .map(User::getUsername).orElse("A member");

        MessageResponse systemMessage = messageService.saveSystemMessage(
                conversationId, adminName + " removed " + removedName + " from the group");

        // Everyone still in the group sees the note appear live.
        messagingTemplate.convertAndSend("/topic/conversation/" + conversationId, systemMessage);
        remaining.forEach(participantId ->
                messagingTemplate.convertAndSend("/topic/user/" + participantId + "/inbox", systemMessage));

        // And the removed user is told directly, on their own topic — they're
        // off the participant list now, so nothing sent to the conversation
        // reaches them. Without this their client would keep showing a group
        // they've silently lost access to until the next refresh.
        Object payload = java.util.Map.of("conversationId", conversationId, "removedBy", adminName);
        messagingTemplate.convertAndSend(
                "/topic/user/" + targetUserId + "/removed-from-conversation",
                payload);
    }

    /**
     * The entity-returning core of "get or create a 1-on-1 conversation,"
     * shared by the plain REST path above and TemporaryConversationService's
     * invite-acceptance flow — the latter needs the raw Conversation back so
     * it can additionally set temporary=true/expiresAt before saving.
     */
    Conversation getOrCreatePrivateConversationEntity(String userId1, String userId2) {
        userRepository.findById(userId2)
                .orElseThrow(() -> new RuntimeException("User not found"));

        return conversationRepository.findPrivateConversation(userId1, userId2)
                .orElseGet(() -> {
                    Map<String, Integer> unreadCount = new HashMap<>();
                    unreadCount.put(userId1, 0);
                    unreadCount.put(userId2, 0);

                    Conversation conversation = Conversation.builder()
                            .type("PRIVATE")
                            .participants(List.of(userId1, userId2))
                            .unreadCount(unreadCount)
                            .build();

                    return conversationRepository.save(conversation);
                });
    }

    /**
     * Always creates a brand-new conversation — never reuses an existing one,
     * even a permanent thread already open between these same two users.
     * A temporary conversation is deliberately its own separate object; if
     * this fell back to getOrCreatePrivateConversationEntity's find-existing
     * behavior instead, accepting a temp-chat invite with someone you already
     * talk to would silently convert your real, permanent conversation with
     * them into one that expires and gets deleted.
     */
    Conversation createTemporaryConversationEntity(String userId1, String userId2, LocalDateTime expiresAt) {
        userRepository.findById(userId2)
                .orElseThrow(() -> new RuntimeException("User not found"));

        Map<String, Integer> unreadCount = new HashMap<>();
        unreadCount.put(userId1, 0);
        unreadCount.put(userId2, 0);

        Conversation conversation = Conversation.builder()
                .type("PRIVATE")
                .participants(List.of(userId1, userId2))
                .unreadCount(unreadCount)
                .temporary(true)
                .expiresAt(expiresAt)
                .build();

        return conversationRepository.save(conversation);
    }

    // Get all conversations for a user — expired temporary conversations are
    // excluded here, not just hidden client-side, so there's no window where
    // a stale client could still be shown one.
    public List<ConversationResponse> getUserConversations(String userId) {
        LocalDateTime now = LocalDateTime.now();
        return conversationRepository
                .findByParticipantsContainingOrderByUpdatedAtDesc(userId)
                .stream()
                .filter(conv -> !isExpired(conv, now))
                .map(conv -> mapToResponse(conv, userId))
                .collect(Collectors.toList());
    }

    // Get a specific conversation
    public ConversationResponse getConversation(String conversationId, String userId) {
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new RuntimeException("Conversation not found"));

        if (!conversation.getParticipants().contains(userId)) {
            throw new RuntimeException("You are not a participant in this conversation");
        }

        if (isExpired(conversation, LocalDateTime.now())) {
            throw new RuntimeException("This temporary conversation has expired");
        }

        return mapToResponse(conversation, userId);
    }

    static boolean isExpired(Conversation conversation, LocalDateTime now) {
        return conversation.isTemporary()
                && conversation.getExpiresAt() != null
                && conversation.getExpiresAt().isBefore(now);
    }

    // Map Conversation to ConversationResponse — public so TemporaryChatController
    // can turn the entity from an accepted invite into the payload it broadcasts.
    public ConversationResponse mapToResponse(Conversation conversation, String currentUserId) {
        List<UserResponse> participantDetails = conversation.getParticipants().stream()
                .map(participantId -> userRepository.findById(participantId)
                        .map(user -> UserResponse.builder()
                                .id(user.getId())
                                .username(user.getUsername())
                                .email(user.getEmail())
                                .avatarUrl(user.getAvatarUrl())
                                .status(user.getStatus())
                                .lastSeen(user.getLastSeen())
                                .createdAt(user.getCreatedAt())
                                .build())
                        .orElse(null))
                .collect(Collectors.toList());

        int unread = conversation.getUnreadCount() != null
                ? conversation.getUnreadCount().getOrDefault(currentUserId, 0)
                : 0;

        // The sidebar preview is conversation content too. Without this, clearing
        // a chat emptied the thread but left the last message still legible in
        // the conversation list — the one line you were most likely trying to
        // get rid of.
        Conversation.LastMessage lastMessage = conversation.getLastMessage();
        LocalDateTime cleared = conversation.getClearedAt().get(currentUserId);
        if (lastMessage != null && cleared != null
                && lastMessage.getTimestamp() != null
                && !lastMessage.getTimestamp().isAfter(cleared)) {
            lastMessage = null;
        }

        return ConversationResponse.builder()
                .id(conversation.getId())
                .type(conversation.getType())
                .participants(participantDetails)
                .name(conversation.getName())
                .lastMessage(lastMessage)
                .unreadCount(unread)
                .temporary(conversation.isTemporary())
                .expiresAt(conversation.getExpiresAt())
                .createdAt(conversation.getCreatedAt())
                .updatedAt(conversation.getUpdatedAt())
                .build();
    }
}
