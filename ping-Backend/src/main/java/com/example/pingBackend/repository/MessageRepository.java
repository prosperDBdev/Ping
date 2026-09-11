package com.example.pingBackend.repository;

import com.example.pingBackend.model.Message;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MessageRepository extends MongoRepository<Message, String> {

    // Every message in a conversation, unpaginated. Used by the expired
    // temporary conversation cleanup job, which needs the whole set at once
    // so it can hand it to deleteAll() before removing the conversation.
    List<Message> findByConversationId(String conversationId);

    // Every message in a conversation that carries a file, newest first. Backs
    // the Files panel, which needs the whole conversation rather than just the
    // page of messages currently scrolled into view.
    List<Message> findByConversationIdAndAttachmentNotNullOrderByCreatedAtDesc(String conversationId);

    // Find messages for a conversation, paginated, newest first
    Page<Message> findByConversationIdOrderByCreatedAtDesc(String conversationId, Pageable pageable);

    // Same, but only messages newer than the caller's "clear chat" marker.
    // Filtering in the query rather than on the results keeps pages full and
    // the hasMore flag honest.
    Page<Message> findByConversationIdAndCreatedAtAfterOrderByCreatedAtDesc(
            String conversationId, java.time.LocalDateTime after, Pageable pageable);

    // Find unread messages in a conversation (not seen by this user)
    List<Message> findByConversationIdAndSeenByNotContaining(String conversationId, String userId);

    // Find the message that owns a given attachment — this is how we figure out
    // which conversation a piece of media "belongs to" for the access check in
    // MediaStorageService.downloadVoiceNote(). The underscore tells Spring Data
    // to look inside the nested Attachment object's `key` field, rather than
    // searching for a flat property literally named "attachmentKey".
    Optional<Message> findByAttachment_Key(String key);
}
