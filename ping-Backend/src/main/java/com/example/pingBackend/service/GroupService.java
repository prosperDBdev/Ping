package com.example.pingBackend.service;

import com.example.pingBackend.dto.response.ConversationResponse;
import com.example.pingBackend.dto.response.MessageResponse;
import com.example.pingBackend.exception.BadRequestException;
import com.example.pingBackend.exception.ForbiddenException;
import com.example.pingBackend.exception.NotFoundException;
import com.example.pingBackend.model.Conversation;
import com.example.pingBackend.model.User;
import com.example.pingBackend.repository.ConversationRepository;
import com.example.pingBackend.repository.UserRepository;
import com.example.pingBackend.security.SubscriptionRevoker;
import com.mongodb.client.result.UpdateResult;
import lombok.RequiredArgsConstructor;
import org.bson.Document;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.BasicQuery;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import static org.springframework.data.mongodb.core.query.Criteria.where;

/**
 * Everything you can do to a group's MEMBERSHIP: add, remove, promote, leave,
 * and who is allowed to add.
 *
 * Group creation lives in ConversationService (it is really a conversation
 * being created); this class owns the rules for a group that already exists.
 * The permission model, in one place:
 *
 *   add members       an admin, or anyone if the group allows it
 *   remove members    admins only
 *   promote / demote  admins only; the owner can be neither
 *   change who can    admins only
 *   leave             anyone, including the owner — but the owner must first
 *                     hand the group to another admin
 *
 * WHY ADMINS AND NOT JUST THE OWNER. A group of a hundred people whose single
 * admin drops out would be unmanageable for ever: the owner can't be removed,
 * so nobody could add anybody. Promotion fixes that, and matches WhatsApp.
 *
 * WHY THE RULES ARE IN THE DATABASE UPDATES. Adding, removing and promoting
 * are each one atomic $addToSet / $pull whose condition includes the permission
 * and the current state. Two admins acting in the same moment can't both win,
 * and nobody can slip between a check and the change it guards.
 */
@Service
@RequiredArgsConstructor
public class GroupService {

    /** Creator + 199 others, matching the limit CreateGroupRequest enforces. */
    public static final int MAX_MEMBERS = 200;

    /** Enough admins to run a class, few enough that promoting is a decision. */
    static final int MAX_ADMINS = 10;

    private final ConversationRepository conversationRepository;
    private final UserRepository userRepository;
    private final BlockService blockService;
    private final MessageService messageService;
    private final SimpMessagingTemplate messagingTemplate;
    private final SubscriptionRevoker subscriptionRevoker;
    private final MongoTemplate mongoTemplate;
    private final ConversationService conversationService;

    // ------------------------------------------------------------------ add

    /**
     * Add people to a group. Anyone already in it, and you, are dropped from
     * the list rather than refused: the caller sent "add these people", and
     * finding some are already here isn't a reason to fail the whole request.
     */
    public ConversationResponse addParticipants(String conversationId, String requesterId, List<String> requestedIds) {
        Conversation group = requireMember(conversationId, requesterId);
        if (!canAddMembers(group, requesterId)) {
            throw new ForbiddenException("Only a group admin can add people to this group");
        }

        Set<String> toAdd = new LinkedHashSet<>(requestedIds);
        toAdd.remove(requesterId);
        toAdd.removeAll(group.getParticipants());
        if (toAdd.isEmpty()) {
            throw new BadRequestException("They're already in this group");
        }

        List<User> found = userRepository.findAllById(toAdd);
        if (found.size() != toAdd.size()) {
            Set<String> foundIds = found.stream().map(User::getId).collect(Collectors.toSet());
            String missing = toAdd.stream().filter(id -> !foundIds.contains(id)).collect(Collectors.joining(", "));
            throw new BadRequestException("These users no longer exist: " + missing);
        }

        // Room for all of them, or none. Silently adding the first few would
        // leave the admin believing everyone had been added.
        if (group.getParticipants().size() + toAdd.size() > MAX_MEMBERS) {
            throw new BadRequestException("A group can have at most " + MAX_MEMBERS + " members");
        }

        // Block-check, requester-to-newcomer only, for the same reason as at
        // creation: checking every pair would leak other people's blocks, and
        // would let a bystander veto a group they don't even belong to.
        for (String id : toAdd) {
            blockService.assertNotBlocked(requesterId, id);
        }

        // One atomic update whose condition says: still a group, nobody in the
        // list has joined since we looked, and there's still room. $addToSet
        // means a duplicate can never be written even if that slipped.
        BasicQuery canAdd = new BasicQuery(new Document("_id", conversationId)
                .append("participants", new Document("$nin", toAdd))
                .append("$expr", new Document("$lt", List.of(
                        new Document("$size", "$participants"),
                        MAX_MEMBERS - toAdd.size()))));

        Update add = new Update().addToSet("participants").each(toAdd);
        toAdd.forEach(id -> add.set("unreadCount." + id, 0));

        UpdateResult result = mongoTemplate.updateFirst(canAdd, add, Conversation.class);
        if (result.getModifiedCount() == 0) {
            throw new BadRequestException("Couldn't add them: the group changed while you were typing. Try again.");
        }

        String names = found.stream().map(User::getUsername).collect(Collectors.joining(", "));
        announce(group, usernameOf(requesterId) + " added " + names, toAdd);
        return conversationService.mapToResponse(refreshed(conversationId), requesterId);
    }

    // --------------------------------------------------------------- remove

    /** Remove a member. Admins only; the owner can't be removed. */
    public void removeParticipant(String conversationId, String requesterId, String targetUserId) {
        Conversation group = requireGroup(conversationId);
        requireAdmin(group, requesterId, "Only a group admin can remove members");

        if (targetUserId.equals(group.getAdmin())) {
            throw new BadRequestException("The group's owner can't be removed. Make someone else an admin first.");
        }
        if (!group.getParticipants().contains(targetUserId)) {
            throw new BadRequestException("That user isn't in this group");
        }

        mongoTemplate.updateFirst(
                Query.query(where("_id").is(conversationId).and("participants").is(targetUserId)),
                new Update().pull("participants", targetUserId).unset("unreadCount." + targetUserId),
                Conversation.class);

        // Their live subscription is cancelled too: leaving them on the
        // participant list stops new subscriptions but does nothing to the
        // ones already open, which would keep delivering every message.
        subscriptionRevoker.revokeConversation(targetUserId, conversationId);

        MessageResponse note = messageService.saveSystemMessage(conversationId,
                usernameOf(requesterId) + " removed " + usernameOf(targetUserId) + " from the group");
        // Everyone still in the group sees the note appear live.
        messagingTemplate.convertAndSend("/topic/conversation/" + conversationId, note);
        group.getParticipants().stream().filter(id -> !id.equals(targetUserId)).forEach(id ->
                messagingTemplate.convertAndSend("/topic/user/" + id + "/inbox", note));

        // And the removed user is told directly, on their own topic: they're
        // off the participant list now, so nothing sent to the conversation
        // reaches them. Without this their client keeps showing a group they
        // have silently lost access to.
        messagingTemplate.convertAndSend("/topic/user/" + targetUserId + "/removed-from-conversation",
                (Object) Map.of("conversationId", conversationId, "removedBy", usernameOf(requesterId)));
    }

    /** Leave a group yourself. The owner must hand the group on first. */
    public void leaveGroup(String conversationId, String userId) {
        Conversation group = requireMember(conversationId, userId);
        if (userId.equals(group.getAdmin())) {
            throw new BadRequestException(
                    "Make someone else an admin before you leave, so the group isn't left without one.");
        }
        removeParticipant(conversationId, group.getAdmin(), userId);
    }

    // -------------------------------------------------------------- promote

    /** Make a member an admin, or take that away. Admins only. */
    public ConversationResponse setAdmin(String conversationId, String requesterId,
                                         String targetUserId, boolean makeAdmin) {
        Conversation group = requireGroup(conversationId);
        requireAdmin(group, requesterId, "Only a group admin can change who else is one");

        if (targetUserId.equals(group.getAdmin())) {
            throw new BadRequestException("The group's owner is always an admin");
        }
        if (!group.getParticipants().contains(targetUserId)) {
            throw new BadRequestException("That user isn't in this group");
        }

        if (makeAdmin) {
            if (group.getAdmins() != null && group.getAdmins().contains(targetUserId)) {
                return conversationService.mapToResponse(group, requesterId);
            }
            if (group.adminIds().size() >= MAX_ADMINS) {
                throw new BadRequestException("A group can have at most " + MAX_ADMINS + " admins");
            }
            mongoTemplate.updateFirst(Query.query(where("_id").is(conversationId)),
                    new Update().addToSet("admins", targetUserId), Conversation.class);
            announce(refreshed(conversationId), usernameOf(requesterId) + " made "
                    + usernameOf(targetUserId) + " an admin", Set.of());
        } else {
            mongoTemplate.updateFirst(Query.query(where("_id").is(conversationId)),
                    new Update().pull("admins", targetUserId), Conversation.class);
            announce(refreshed(conversationId), usernameOf(requesterId) + " removed "
                    + usernameOf(targetUserId) + " as admin", Set.of());
        }
        return conversationService.mapToResponse(refreshed(conversationId), requesterId);
    }

    // -------------------------------------------------------------- settings

    /** Who may add people: ADMINS_ONLY or EVERYONE. Admins only. */
    public ConversationResponse setAddMembersBy(String conversationId, String requesterId, String mode) {
        Conversation group = requireGroup(conversationId);
        requireAdmin(group, requesterId, "Only a group admin can change this");
        if (!"ADMINS_ONLY".equals(mode) && !"EVERYONE".equals(mode)) {
            throw new BadRequestException("addMembersBy must be ADMINS_ONLY or EVERYONE");
        }
        mongoTemplate.updateFirst(Query.query(where("_id").is(conversationId)),
                new Update().set("addMembersBy", mode), Conversation.class);
        return conversationService.mapToResponse(refreshed(conversationId), requesterId);
    }

    /** True when this user may add people to this group. */
    public static boolean canAddMembers(Conversation group, String userId) {
        return group.getParticipants().contains(userId)
                && (group.isAdmin(userId) || group.everyoneCanAddMembers());
    }

    // --------------------------------------------------------------- helpers

    private Conversation requireGroup(String conversationId) {
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new NotFoundException("Conversation not found"));
        if (!"GROUP".equals(conversation.getType())) {
            throw new BadRequestException("Only group conversations have members to manage");
        }
        return conversation;
    }

    /**
     * A group you're in. Someone outside it gets the same 404 as for a group
     * that doesn't exist, so membership can't be probed by id.
     */
    private Conversation requireMember(String conversationId, String userId) {
        Conversation group = requireGroup(conversationId);
        if (!group.getParticipants().contains(userId)) {
            throw new NotFoundException("Conversation not found");
        }
        return group;
    }

    private void requireAdmin(Conversation group, String requesterId, String message) {
        if (!group.getParticipants().contains(requesterId)) {
            throw new NotFoundException("Conversation not found");
        }
        if (!group.isAdmin(requesterId)) {
            throw new ForbiddenException(message);
        }
    }

    /** A note in the chat, to everyone in it — and to anyone just added. */
    private void announce(Conversation group, String text, Set<String> newcomers) {
        MessageResponse note = messageService.saveSystemMessage(group.getId(), text);
        messagingTemplate.convertAndSend("/topic/conversation/" + group.getId(), note);
        group.getParticipants().stream().filter(id -> !newcomers.contains(id)).forEach(id ->
                messagingTemplate.convertAndSend("/topic/user/" + id + "/inbox", note));

        if (newcomers.isEmpty()) {
            return;
        }
        // Someone just added has no subscription to the conversation topic, so
        // they wouldn't see the note above. Each gets the group itself, which
        // is what puts it in their chat list.
        newcomers.forEach(id -> messagingTemplate.convertAndSend(
                "/topic/user/" + id + "/conversation-created",
                conversationService.mapToResponse(group, id)));
        // And the people already in it should see the group change.
        messagingTemplate.convertAndSend("/topic/conversation/" + group.getId() + "/members",
                (Object) Map.of("conversationId", group.getId()));
    }

    private String usernameOf(String userId) {
        return userRepository.findById(userId).map(User::getUsername).orElse("Someone");
    }

    private Conversation refreshed(String conversationId) {
        return conversationRepository.findById(conversationId).orElseThrow();
    }
}
