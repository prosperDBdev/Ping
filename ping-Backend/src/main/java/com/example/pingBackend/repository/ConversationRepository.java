package com.example.pingBackend.repository;

import com.example.pingBackend.model.Conversation;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface ConversationRepository extends MongoRepository<Conversation, String> {

    // Find all conversations where user is a participant, sorted by last update
    List<Conversation> findByParticipantsContainingOrderByUpdatedAtDesc(String userId);

    // Find the ONE permanent private conversation between exactly these two
    // users. Explicitly excludes temporary=true — a temporary chat is always
    // its own separate conversation, never a stand-in for (or a merge with)
    // an existing permanent thread with the same person, so this lookup must
    // never accidentally return one.
    @Query("{ 'type': 'PRIVATE', 'participants': { $all: [?0, ?1], $size: 2 }, 'temporary': { $ne: true } }")
    Optional<Conversation> findPrivateConversation(String userId1, String userId2);

    // Building block for the cleanup job — every temporary conversation whose
    // expiry is before the given cutoff. Scoped by `temporary = true` right
    // in the query itself, so it is structurally impossible for this method
    // to ever return a permanent conversation, no matter what cutoff is
    // passed in.
    List<Conversation> findByTemporaryTrueAndExpiresAtBefore(LocalDateTime cutoff);
}