package com.example.pingBackend.service;

import com.example.pingBackend.model.Conversation;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Who can do what to a group. Pure rules about the model, so no database is
 * needed: the queries that enforce them are exercised end to end instead.
 */
class GroupRulesTest {

    private static Conversation group(List<String> admins, String addMembersBy) {
        return Conversation.builder()
                .id("g").type("GROUP").name("Project")
                .admin("owner")
                .admins(admins)
                .addMembersBy(addMembersBy)
                .participants(List.of("owner", "ben", "cal"))
                .build();
    }

    @Test
    @DisplayName("a group created before the admins list existed still has its owner as admin")
    void oldGroupsStillHaveAnAdmin() {
        Conversation old = Conversation.builder().id("g").type("GROUP").admin("owner")
                .participants(List.of("owner", "ben")).build();
        assertTrue(old.isAdmin("owner"));
        assertFalse(old.isAdmin("ben"));
        assertEquals(List.of("owner"), old.adminIds());
    }

    @Test
    @DisplayName("the owner and the promoted admins can both manage the group")
    void promotedAdminsCount() {
        Conversation g = group(List.of("ben"), null);
        assertTrue(g.isAdmin("owner"));
        assertTrue(g.isAdmin("ben"));
        assertFalse(g.isAdmin("cal"));
        assertEquals(List.of("owner", "ben"), g.adminIds());
    }

    @Test
    @DisplayName("the owner appears once even if they're also in the admins list")
    void ownerNotListedTwice() {
        assertEquals(List.of("owner", "ben"), group(List.of("owner", "ben"), null).adminIds());
    }

    @Test
    @DisplayName("by default only admins can add people")
    void adminsOnlyByDefault() {
        Conversation g = group(List.of(), null);
        assertTrue(GroupService.canAddMembers(g, "owner"));
        assertFalse(GroupService.canAddMembers(g, "ben"));
    }

    @Test
    @DisplayName("the group can be opened up, WhatsApp-style, to everyone in it")
    void everyoneCanAdd() {
        Conversation g = group(List.of(), "EVERYONE");
        assertTrue(g.everyoneCanAddMembers());
        assertTrue(GroupService.canAddMembers(g, "ben"));
    }

    @Test
    @DisplayName("someone outside the group can't add themselves, whatever the setting")
    void outsidersNeverAdd() {
        assertFalse(GroupService.canAddMembers(group(List.of(), "EVERYONE"), "stranger"));
    }

    @Test
    @DisplayName("a private conversation has no admins and nobody to manage")
    void privateChatsHaveNoAdmins() {
        Conversation priv = Conversation.builder().id("p").type("PRIVATE")
                .participants(List.of("amy", "ben")).build();
        assertTrue(priv.adminIds().isEmpty());
        assertFalse(priv.isAdmin("amy"));
    }
}
