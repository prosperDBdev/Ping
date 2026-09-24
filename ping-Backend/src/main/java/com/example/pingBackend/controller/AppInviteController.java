package com.example.pingBackend.controller;

import com.example.pingBackend.dto.response.MyInviteResponse;
import com.example.pingBackend.model.AppInvite;
import com.example.pingBackend.model.User;
import com.example.pingBackend.service.AppInviteService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Your own invite link.
 *
 * "mine", never "{userId}" — the same shape as /api/users/me/avatar. The path
 * can only mean the signed-in caller, so there's no way to ask for, or replace,
 * somebody else's link, and no ownership check to forget.
 *
 * The public side — "who invited me?" for someone without an account — lives
 * in AuthController at /api/auth/invites/{code}, because /api/auth/** is the
 * part of the API that works without logging in.
 */
@RestController
@RequestMapping("/api/invites")
@RequiredArgsConstructor
public class AppInviteController {

    private final AppInviteService appInviteService;

    /** GET only reads. It never creates a link — see AppInviteService.current. */
    @GetMapping("/mine")
    public MyInviteResponse mine(@AuthenticationPrincipal User currentUser) {
        return toResponse(appInviteService.current(currentUser.getId()).orElse(null), currentUser);
    }

    /** Make a new link. Any previous link stops working immediately. */
    @PostMapping("/mine")
    public MyInviteResponse newLink(@AuthenticationPrincipal User currentUser) {
        return toResponse(appInviteService.newLink(currentUser.getId()), currentUser);
    }

    private MyInviteResponse toResponse(AppInvite invite, User currentUser) {
        return new MyInviteResponse(
                invite != null ? invite.getCode() : null,
                invite != null ? invite.getExpiresAt() : null,
                appInviteService.invitedCount(currentUser.getId()));
    }
}
