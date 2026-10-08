package com.example.pingBackend.controller;

import com.example.pingBackend.dto.request.AddParticipantsRequest;
import com.example.pingBackend.dto.request.GroupSettingsRequest;
import com.example.pingBackend.dto.request.MakeAdminRequest;
import com.example.pingBackend.dto.response.ConversationResponse;
import com.example.pingBackend.model.User;
import com.example.pingBackend.service.GroupInviteService;
import com.example.pingBackend.service.GroupService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Managing a group's members, and its invite link.
 *
 *   POST   /api/groups/{id}/participants            add people
 *   DELETE /api/groups/{id}/participants/{userId}   remove (admins only)
 *   PUT    /api/groups/{id}/participants/{userId}/admin
 *   POST   /api/groups/{id}/leave
 *   PUT    /api/groups/{id}/settings                who may add people
 *   GET    /api/groups/{id}/invite                  the link, if there is one
 *   POST   /api/groups/{id}/invite                  make a new one
 *   DELETE /api/groups/{id}/invite                  switch it off
 *
 * Under /api/groups rather than /api/conversations because none of these apply
 * to a one-to-one chat; the path says so, and the service refuses a private
 * conversation anyway.
 */
@RestController
@RequestMapping("/api/groups/{conversationId}")
@RequiredArgsConstructor
public class GroupController {

    private final GroupService groupService;
    private final GroupInviteService inviteService;

    @PostMapping("/participants")
    public ConversationResponse addParticipants(@PathVariable String conversationId,
                                                @AuthenticationPrincipal User me,
                                                @Valid @RequestBody AddParticipantsRequest request) {
        return groupService.addParticipants(conversationId, me.getId(), request.getUserIds());
    }

    /** Remove a member. Admins only — enforced in the service. */
    @DeleteMapping("/participants/{userId}")
    public ResponseEntity<Void> removeParticipant(@PathVariable String conversationId,
                                                  @PathVariable String userId,
                                                  @AuthenticationPrincipal User me) {
        groupService.removeParticipant(conversationId, me.getId(), userId);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/participants/{userId}/admin")
    public ConversationResponse makeAdmin(@PathVariable String conversationId,
                                          @PathVariable String userId,
                                          @AuthenticationPrincipal User me,
                                          @Valid @RequestBody MakeAdminRequest request) {
        return groupService.setAdmin(conversationId, me.getId(), userId, request.isMakeAdmin());
    }

    @PostMapping("/leave")
    public ResponseEntity<Void> leave(@PathVariable String conversationId, @AuthenticationPrincipal User me) {
        groupService.leaveGroup(conversationId, me.getId());
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/settings")
    public ConversationResponse settings(@PathVariable String conversationId,
                                         @AuthenticationPrincipal User me,
                                         @Valid @RequestBody GroupSettingsRequest request) {
        return groupService.setAddMembersBy(conversationId, me.getId(), request.getAddMembersBy());
    }

    /** The link, if the group has a live one. 404 when it doesn't, never creates one. */
    @GetMapping("/invite")
    public ResponseEntity<GroupInviteService.InviteView> invite(@PathVariable String conversationId,
                                                                @AuthenticationPrincipal User me) {
        return inviteService.status(conversationId, me.getId())
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @PostMapping("/invite")
    public GroupInviteService.InviteView createInvite(@PathVariable String conversationId,
                                                      @AuthenticationPrincipal User me) {
        return inviteService.create(conversationId, me.getId());
    }

    @DeleteMapping("/invite")
    public ResponseEntity<Void> revokeInvite(@PathVariable String conversationId,
                                             @AuthenticationPrincipal User me) {
        inviteService.revoke(conversationId, me.getId());
        return ResponseEntity.noContent().build();
    }
}
