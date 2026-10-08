package com.example.pingBackend.repository;

import com.example.pingBackend.model.GroupInvite;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface GroupInviteRepository extends MongoRepository<GroupInvite, String> {

    /** The group's one live link, if it has one. */
    Optional<GroupInvite> findByConversationId(String conversationId);

    /**
     * Delete a group's link. Called when a new one is made, so the old code
     * stops working the instant the new one exists.
     */
    void deleteByConversationId(String conversationId);

    Optional<GroupInvite> findByCode(String code);
}
