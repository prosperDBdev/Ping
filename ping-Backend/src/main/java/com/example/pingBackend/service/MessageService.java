package com.example.pingBackend.service;

import lombok.extern.slf4j.Slf4j;
import java.util.HashMap;
import static org.springframework.data.mongodb.core.query.Query.query;
import static org.springframework.data.mongodb.core.query.Criteria.where;
import java.util.Set;
import java.util.Map;
import java.time.Duration;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.data.mongodb.core.MongoTemplate;
import com.mongodb.client.result.UpdateResult;
import com.example.pingBackend.exception.ForbiddenException;
import com.example.pingBackend.exception.BadRequestException;
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
import com.example.pingBackend.exception.NotFoundException;
import com.example.pingBackend.exception.GoneException;

@Slf4j
@Service
@RequiredArgsConstructor
public class MessageService {

    private final MessageRepository messageRepository;
    private final ConversationRepository conversationRepository;
    private final BlockService blockService;
    private final MongoTemplate mongoTemplate;
    private final MediaStorageService mediaStorageService;

    /** How long after sending you can still delete a message for everyone. */
    static final Duration DELETE_FOR_EVERYONE_WINDOW = Duration.ofHours(48);

    /** What the chat list shows in place of a message deleted for everyone. */
    static final String DELETED_PREVIEW = "This message was deleted";

    /**
     * The reactions the app offers, and the only ones accepted. A reaction is
     * a picture, not a free-text field: allowing any string here would be a
     * side channel for arbitrary text that bypasses everything messages go
     * through.
     */
    static final Set<String> ALLOWED_REACTIONS = Set.of("👍", "❤️", "😂", "🎉", "👀");

    /** How long after sending a message its text can still be changed. */
    static final Duration EDIT_WINDOW = Duration.ofMinutes(10);

    // Get message history for a conversation (paginated)
    public Page<MessageResponse> getMessages(String conversationId, String userId, int page, int size) {

        // Verify user is a participant
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new NotFoundException("Conversation not found"));

        if (!conversation.getParticipants().contains(userId)) {
            throw new NotFoundException("Conversation not found");
        }

        // An expired temporary conversation's history is gone as far as the
        // API is concerned, even in the window before the cleanup job has
        // physically deleted it.
        if (ConversationService.isExpired(conversation, LocalDateTime.now())) {
            throw new GoneException("This temporary conversation has expired");
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
                ? messageRepository.findByConversationIdAndHiddenForNotOrderByCreatedAtDesc(conversationId, userId, pageable)
                : messageRepository.findByConversationIdAndCreatedAtAfterAndHiddenForNotOrderByCreatedAtDesc(
                        conversationId, clearedAt, userId, pageable))
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
                .orElseThrow(() -> new NotFoundException("Conversation not found"));

        if (!conversation.getParticipants().contains(userId)) {
            throw new NotFoundException("Conversation not found");
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
                .orElseThrow(() -> new NotFoundException("Conversation not found"));

        // Sending was previously unchecked — a conversation ID alone was
        // enough to post into any conversation, including one you were never
        // part of. Same rule as reading: participants only.
        if (!conversation.getParticipants().contains(senderId)) {
            throw new NotFoundException("Conversation not found");
        }

        // Nothing new lands in a temporary conversation past its expiry.
        if (ConversationService.isExpired(conversation, LocalDateTime.now())) {
            throw new GoneException("This temporary conversation has expired");
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
                .orElseThrow(() -> new NotFoundException("Conversation not found"));

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
                .orElseThrow(() -> new NotFoundException("Conversation not found"));

        if (!conversation.getParticipants().contains(userId)) {
            throw new NotFoundException("Conversation not found");
        }

        if (ConversationService.isExpired(conversation, LocalDateTime.now())) {
            throw new GoneException("This temporary conversation has expired");
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
                .filter(message -> message.getHiddenFor() == null || !message.getHiddenFor().contains(userId))
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

    /**
     * Add, change or remove your reaction to a message.
     *
     * Sending the reaction you already have removes it; anything else replaces
     * it. The update touches only reactions.<yourId>, so it can never disturb
     * anyone else's reaction, even if they react at the same moment.
     */
    public MessageResponse react(String conversationId, String messageId, String userId, String emoji) {
        // Cheapest check first: no database work for a reaction that can't exist.
        if (!ALLOWED_REACTIONS.contains(emoji)) {
            throw new BadRequestException("That reaction isn't available");
        }

        requireWritableConversation(conversationId, userId);
        Message message = findInConversation(conversationId, messageId);
        if ("SYSTEM".equals(message.getType())) {
            throw new BadRequestException("You can't react to that");
        }
        if (message.getDeletedAt() != null) {
            throw new BadRequestException("That message was deleted");
        }

        String current = message.getReactions() == null ? null : message.getReactions().get(userId);
        Update update = emoji.equals(current)
                ? new Update().unset("reactions." + userId)
                : new Update().set("reactions." + userId, emoji);

        mongoTemplate.updateFirst(
                query(where("_id").is(messageId).and("conversationId").is(conversationId)),
                update, Message.class);

        return mapToResponse(findInConversation(conversationId, messageId));
    }

    /**
     * Change the text of a message you sent, within 10 minutes of sending it.
     *
     * ALL THE RULES ARE IN THE QUERY. The update only matches a message that
     * is in this conversation, was sent by you, is plain text, and was sent
     * less than EDIT_WINDOW ago by the SERVER's clock. There is no "load it,
     * check it, then save it" sequence for a request to slip between, and
     * nothing the app sends can extend the window: a phone with its clock set
     * back, or a modified app, still hits the same query.
     *
     * Only when nothing matched does the code look closer, purely to give a
     * useful error message.
     */
    public MessageResponse edit(String conversationId, String messageId, String userId, String content) {
        requireWritableConversation(conversationId, userId);
        LocalDateTime now = LocalDateTime.now();

        UpdateResult result = mongoTemplate.updateFirst(
                query(where("_id").is(messageId)
                        .and("conversationId").is(conversationId)
                        .and("senderId").is(userId)
                        .and("type").is("TEXT")
                        .and("deletedAt").is(null)
                        .and("createdAt").gt(now.minus(EDIT_WINDOW))),
                new Update().set("content", content).set("editedAt", now),
                Message.class);

        if (result.getMatchedCount() == 0) {
            Message message = findInConversation(conversationId, messageId);
            if (!userId.equals(message.getSenderId())) {
                throw new ForbiddenException("You can only edit your own messages");
            }
            if (!"TEXT".equals(message.getType())) {
                throw new BadRequestException("Only text messages can be edited");
            }
            if (message.getDeletedAt() != null) {
                throw new BadRequestException("That message was deleted");
            }
            throw new ForbiddenException("Messages can only be edited within 10 minutes of sending");
        }

        Message edited = findInConversation(conversationId, messageId);

        // Keep the chat-list preview in step when this was the latest message.
        // Conditional and atomic again: it only changes the preview if it still
        // shows THIS message, so a newer message arriving meanwhile is safe.
        mongoTemplate.updateFirst(
                query(where("_id").is(conversationId)
                        .and("lastMessage.senderId").is(userId)
                        .and("lastMessage.timestamp").is(edited.getCreatedAt())),
                new Update().set("lastMessage.content", content),
                Conversation.class);

        return mapToResponse(edited);
    }

    /**
     * Delete a message you sent, for everyone in the chat.
     *
     * Like editing, every rule is part of the update itself: your message, not
     * already deleted, not a system note, sent less than 48 hours ago by the
     * server's clock. What's left is a marker with no text, file, reactions or
     * quoted status. Returned so the caller can broadcast it.
     *
     * Blocking isn't checked here on purpose: removing your own words from a
     * conversation should always be possible, even with someone you've blocked.
     */
    public MessageResponse deleteForEveryone(String conversationId, String messageId, String userId) {
        requireParticipant(conversationId, userId);
        Message before = findInConversation(conversationId, messageId);
        LocalDateTime now = LocalDateTime.now();

        UpdateResult result = mongoTemplate.updateFirst(
                query(where("_id").is(messageId)
                        .and("conversationId").is(conversationId)
                        .and("senderId").is(userId)
                        .and("deletedAt").is(null)
                        .and("type").ne("SYSTEM")
                        .and("createdAt").gt(now.minus(DELETE_FOR_EVERYONE_WINDOW))),
                new Update()
                        .set("deletedAt", now)
                        .set("content", "")
                        .set("reactions", new HashMap<String, String>())
                        .unset("attachment")
                        .unset("statusReply")
                        .unset("editedAt"),
                Message.class);

        if (result.getMatchedCount() == 0) {
            if (!userId.equals(before.getSenderId())) {
                throw new ForbiddenException("You can only delete your own messages for everyone");
            }
            if (before.getDeletedAt() != null) {
                return mapToResponse(before); // already deleted: nothing to do
            }
            throw new ForbiddenException("Messages can only be deleted for everyone within 48 hours");
        }

        // The file goes too. Clearing the attachment already stops the download
        // endpoint serving it (access is checked through the message), but a
        // "deleted" photo shouldn't sit in storage either. Best effort: the
        // message is deleted even if storage is briefly unreachable.
        if (before.getAttachment() != null && before.getAttachment().getKey() != null) {
            try {
                mediaStorageService.deleteObject(before.getAttachment().getKey());
            } catch (RuntimeException e) {
                log.warn("Couldn't remove a deleted message's file from storage: {}", e.getMessage());
            }
        }

        // Keep the chat-list preview honest if this was the latest message.
        mongoTemplate.updateFirst(
                query(where("_id").is(conversationId)
                        .and("lastMessage.senderId").is(userId)
                        .and("lastMessage.timestamp").is(before.getCreatedAt())),
                new Update().set("lastMessage.content", DELETED_PREVIEW),
                Conversation.class);

        return mapToResponse(findInConversation(conversationId, messageId));
    }

    /**
     * Hide a message from yourself only. Any message you can see, yours or
     * not; everyone else keeps it. $addToSet, so doing it twice is harmless.
     */
    public void deleteForMe(String conversationId, String messageId, String userId) {
        requireParticipant(conversationId, userId);
        findInConversation(conversationId, messageId);
        mongoTemplate.updateFirst(
                query(where("_id").is(messageId).and("conversationId").is(conversationId)),
                new Update().addToSet("hiddenFor", userId),
                Message.class);
    }

    /** You're in this conversation and it hasn't expired. */
    Conversation requireParticipant(String conversationId, String userId) {
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new NotFoundException("Conversation not found"));
        if (!conversation.getParticipants().contains(userId)) {
            throw new NotFoundException("Conversation not found");
        }
        if (ConversationService.isExpired(conversation, LocalDateTime.now())) {
            throw new GoneException("This temporary conversation has expired");
        }
        return conversation;
    }

    /**
     * The checks every change to a message needs: you're a participant, the
     * conversation hasn't expired, and in a one-to-one chat neither of you has
     * blocked the other. The same rules as sending a message, so reacting and
     * editing can't be used to reach someone sending couldn't.
     */
    Conversation requireWritableConversation(String conversationId, String userId) {
        Conversation conversation = requireParticipant(conversationId, userId);
        if ("PRIVATE".equals(conversation.getType())) {
            conversation.getParticipants().stream()
                    .filter(id -> !id.equals(userId))
                    .findFirst()
                    .ifPresent(otherId -> blockService.assertNotBlocked(userId, otherId));
        }
        return conversation;
    }

    /**
     * A message, but only if it belongs to the conversation named in the URL.
     *
     * Without this check, being a participant in ANY conversation would let
     * you react to or edit a message in any OTHER conversation just by putting
     * its id in the path: a classic insecure direct object reference. Unknown
     * and elsewhere look identical on purpose.
     */
    private Message findInConversation(String conversationId, String messageId) {
        return messageRepository.findById(messageId)
                .filter(m -> conversationId.equals(m.getConversationId()))
                .orElseThrow(() -> new NotFoundException("Message not found"));
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
                // Messages saved before reactions existed have no map at all.
                .reactions(message.getReactions() == null ? Map.of() : message.getReactions())
                .editedAt(message.getEditedAt())
                .deletedAt(message.getDeletedAt())
                .build();
    }
}