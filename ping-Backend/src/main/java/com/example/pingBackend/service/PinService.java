package com.example.pingBackend.service;

import com.example.pingBackend.dto.response.MessageResponse;
import com.example.pingBackend.exception.BadRequestException;
import com.example.pingBackend.model.Conversation;
import com.example.pingBackend.model.Message;
import com.example.pingBackend.model.User;
import com.example.pingBackend.repository.MessageRepository;
import com.example.pingBackend.repository.UserRepository;
import com.mongodb.client.result.UpdateResult;
import lombok.RequiredArgsConstructor;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

import static org.springframework.data.mongodb.core.query.Criteria.where;
import static org.springframework.data.mongodb.core.query.Query.query;

/**
 * Pinned messages, shared by everyone in the chat, like WhatsApp.
 *
 * Pins used to live in each person's own browser, so pinning something did
 * nothing for anyone else. Now a pin belongs to the conversation: everyone
 * sees it in a banner at the top of the chat, and pinning leaves a note in
 * the chat ("Eunice pinned a message").
 *
 * AT MOST THREE, like WhatsApp. Pinning a fourth drops the oldest. The limit
 * is part of the database update itself ($push with $slice), so two people
 * pinning at the same moment can't take a chat over three.
 *
 * Anyone in the chat can pin or unpin. A message deleted for everyone loses
 * its pin (MessageController). Each person's list leaves out messages they've
 * cleared or deleted for themselves.
 */
@Service
@RequiredArgsConstructor
public class PinService {

    static final int MAX_PINS = 3;

    private final MessageService messageService;
    private final MessageRepository messageRepository;
    private final UserRepository userRepository;
    private final MongoTemplate mongoTemplate;
    private final SimpMessagingTemplate messagingTemplate;

    /** A pinned message as the app shows it. */
    public record PinResponse(String messageId, String conversationId, String messageContent, String messageType,
                              String messageSenderUsername, String pinnedBy, String pinnedByUsername,
                              LocalDateTime pinnedAt) {
    }

    /** This chat's pins as this person sees them, newest first. */
    public List<PinResponse> list(String conversationId, String userId) {
        Conversation conversation = messageService.requireParticipant(conversationId, userId);
        LocalDateTime cleared = conversation.getClearedAt().get(userId);
        List<PinResponse> out = new ArrayList<>();
        List<Conversation.Pin> pins = conversation.getPins() == null ? List.of() : conversation.getPins();
        pins.stream()
                .sorted(Comparator.comparing(Conversation.Pin::getPinnedAt).reversed())
                .forEach(pin -> messageRepository.findById(pin.getMessageId())
                        .filter(m -> conversationId.equals(m.getConversationId()))
                        .filter(m -> m.getDeletedAt() == null)
                        .filter(m -> m.getHiddenFor() == null || !m.getHiddenFor().contains(userId))
                        .filter(m -> cleared == null || m.getCreatedAt().isAfter(cleared))
                        .ifPresent(m -> out.add(new PinResponse(m.getId(), conversationId, m.getContent(), m.getType(),
                                m.getSenderUsername(), pin.getPinnedBy(),
                                userRepository.findById(pin.getPinnedBy()).map(User::getUsername).orElse(null),
                                pin.getPinnedAt()))));
        return out;
    }

    public void pin(String conversationId, String messageId, User me) {
        messageService.requireWritableConversation(conversationId, me.getId());
        Message message = messageService.findInConversation(conversationId, messageId);
        if ("SYSTEM".equals(message.getType()) || message.getDeletedAt() != null) {
            throw new BadRequestException("That message can't be pinned");
        }

        Conversation.Pin pin = Conversation.Pin.builder()
                .messageId(messageId).pinnedBy(me.getId()).pinnedAt(LocalDateTime.now()).build();
        // Only if it isn't pinned already; keeps the newest three.
        UpdateResult result = mongoTemplate.updateFirst(
                query(where("_id").is(conversationId).and("pins.messageId").ne(messageId)),
                new Update().push("pins").slice(-MAX_PINS).each(pin),
                Conversation.class);
        if (result.getModifiedCount() == 0) return; // already pinned: nothing to announce

        MessageResponse note = messageService.saveSystemMessage(conversationId, me.getUsername() + " pinned a message");
        messagingTemplate.convertAndSend("/topic/conversation/" + conversationId, note);
        pinsChanged(conversationId);
    }

    public void unpin(String conversationId, String messageId, User me) {
        messageService.requireParticipant(conversationId, me.getId());
        UpdateResult result = mongoTemplate.updateFirst(
                query(where("_id").is(conversationId)),
                new Update().pull("pins", Map.of("messageId", messageId)),
                Conversation.class);
        if (result.getModifiedCount() > 0) pinsChanged(conversationId);
    }

    /** A message was deleted for everyone: it can't stay pinned. */
    public void dropPin(String conversationId, String messageId) {
        UpdateResult result = mongoTemplate.updateFirst(
                query(where("_id").is(conversationId)),
                new Update().pull("pins", Map.of("messageId", messageId)),
                Conversation.class);
        if (result.getModifiedCount() > 0) pinsChanged(conversationId);
    }

    /**
     * Tell everyone with the chat open to reload its pins. Just a signal: each
     * person's list is different (cleared chats, messages deleted for them),
     * so each client asks for its own.
     */
    private void pinsChanged(String conversationId) {
        messagingTemplate.convertAndSend("/topic/conversation/" + conversationId + "/pins",
                (Object) Map.of("conversationId", conversationId));
    }
}
