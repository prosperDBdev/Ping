package com.example.pingBackend.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Document(collection = "conversations")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Conversation {

    @Id
    private String id;

    private String type; // "PRIVATE" or "GROUP"

    private List<String> participants; // List of user IDs

    // Group-only fields
    private String name;   // null for PRIVATE

    /**
     * The group's owner: the person who created it. Kept separately from
     * `admins` because they alone can't be removed, can't be demoted, and
     * can't leave without handing the group on. A group therefore always has
     * somebody who can manage it, however many admins come and go.
     */
    private String admin;  // null for PRIVATE

    /**
     * Extra admins, beyond the owner. The full set of people who can add and
     * remove members is {admin} plus this list.
     *
     * A list, not a second field, because WhatsApp lets you promote several
     * people: one class rep going away shouldn't freeze a group of 200.
     * Documents written before this existed have no such field and still work:
     * their only admin is the owner.
     */
    @Builder.Default
    private List<String> admins = new ArrayList<>();

    /**
     * Who may add people to this group: ADMINS_ONLY (the default) or EVERYONE,
     * as in WhatsApp's "Who can add participants" setting.
     *
     * Boxed, and read as ADMINS_ONLY whenever it's missing, so every group
     * created before this existed starts out admin-only rather than silently
     * becoming open to anyone.
     */
    private String addMembersBy;

    /** True when anyone in the group (not just admins) may add people. */
    public boolean everyoneCanAddMembers() {
        return "EVERYONE".equals(addMembersBy);
    }

    /** The owner plus the promoted admins. */
    public List<String> adminIds() {
        List<String> ids = new ArrayList<>();
        if (admin != null) ids.add(admin);
        if (admins != null) admins.stream().filter(id -> !ids.contains(id)).forEach(ids::add);
        return ids;
    }

    public boolean isAdmin(String userId) {
        return userId != null && adminIds().contains(userId);
    }

    // Last message preview (for conversation list)
    private LastMessage lastMessage;

    // Unread count per user: { "userId1": 0, "userId2": 3 }
    @Builder.Default
    private Map<String, Integer> unreadCount = new HashMap<>();

    // Temporary conversations — only ever set true via an accepted
    // TemporaryConversationInvite, never at plain creation time. expiresAt is
    // null for every ordinary conversation.
    @Builder.Default
    private boolean temporary = false;
    private LocalDateTime expiresAt;

    /**
     * Per-user "clear chat" markers: userId → the moment they cleared it.
     * Messages created before a user's marker are hidden from THAT user only.
     *
     * Deliberately per-user rather than a single field on the conversation.
     * A conversation belongs to two people, and one of them deciding to clear
     * their copy must not delete the other person's history — clearing your
     * side is a personal action, not a shared one.
     */
    @Builder.Default
    private Map<String, LocalDateTime> clearedAt = new HashMap<>();

    /**
     * When each person deleted this chat from their chat list, if they did.
     *
     * Per user, like clearedAt, and for the same reason: deleting a chat from
     * YOUR list must not touch the other person's. The chat stays hidden from
     * you until a message newer than this arrives, then comes back showing only
     * what was sent after you deleted it (clearedAt is set at the same moment).
     */
    @Builder.Default
    private Map<String, LocalDateTime> hiddenAt = new HashMap<>();

    /**
     * Pinned messages, shared by everyone in the chat (at most three, oldest
     * dropped first). See PinService.
     */
    @Builder.Default
    private java.util.List<Pin> pins = new java.util.ArrayList<>();

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Pin {
        private String messageId;
        private String pinnedBy;
        private LocalDateTime pinnedAt;
    }

    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    @Builder.Default
    private LocalDateTime updatedAt = LocalDateTime.now();

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LastMessage {
        private String content;
        private String senderId;
        private String senderUsername;
        private LocalDateTime timestamp;
    }
}