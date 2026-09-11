package com.example.pingBackend.repository;

import com.example.pingBackend.model.TemporaryConversationInvite;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface TemporaryConversationInviteRepository extends MongoRepository<TemporaryConversationInvite, String> {

    /**
     * Pending invites addressed to this user, newest first, excluding stale
     * ones. The createdAt cutoff matters: an invite proposing a 1-hour chat
     * shouldn't still be sitting there waiting to be accepted three weeks
     * later — by then the moment it was for has long passed, and silently
     * starting the conversation would be surprising to both people.
     */
    List<TemporaryConversationInvite> findByToUserIdAndStatusAndCreatedAtAfterOrderByCreatedAtDesc(
            String toUserId, String status, LocalDateTime createdAfter);
}
