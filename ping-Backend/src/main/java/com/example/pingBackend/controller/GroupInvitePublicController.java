package com.example.pingBackend.controller;

import com.example.pingBackend.dto.request.JoinGroupRequest;
import com.example.pingBackend.dto.response.ConversationResponse;
import com.example.pingBackend.model.User;
import com.example.pingBackend.service.GroupInviteService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * The public side of a group invite link, for whoever was sent it.
 *
 * Public because the person following the link may not have an account yet;
 * both steps are rate limited per IP. Joining itself requires signing in, and
 * takes the code in the request BODY so it never lands in a URL or an access
 * log.
 */
@RestController
@RequestMapping("/api/group-invites")
@RequiredArgsConstructor
public class GroupInvitePublicController {

    private final GroupInviteService inviteService;

    @GetMapping("/{code}")
    public GroupInviteService.InviteView preview(@PathVariable String code, HttpServletRequest http) {
        return inviteService.preview(code, clientIp(http));
    }

    @PostMapping("/{code}/join")
    public ConversationResponse join(@PathVariable String code,
                                     @Valid @RequestBody JoinGroupRequest request,
                                     @AuthenticationPrincipal User me,
                                     HttpServletRequest http) {
        // The code comes from the path here because the browser has to name it
        // to reach this endpoint; the body is the caller's affirmation, so a
        // stray prefetch or a crawler that GETs the link can't join anyone to
        // anything. Joining still needs a valid signed-in user.
        return inviteService.join(code, me, clientIp(http));
    }

    /** Real client IP for the rate limit, trusting X-Forwarded-* only from our proxy. */
    private static String clientIp(HttpServletRequest request) {
        return request.getRemoteAddr();
    }
}
