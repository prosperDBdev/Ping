package com.example.pingBackend.controller;

import com.example.pingBackend.dto.request.FeedbackRequest;
import com.example.pingBackend.model.User;
import com.example.pingBackend.service.FeedbackService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/feedback")
@RequiredArgsConstructor
public class FeedbackController {

    private final FeedbackService feedbackService;

    /**
     * Send feedback to the developer.
     *
     * Authentication: nothing extra is configured here, and that's the point —
     * SecurityConfig denies by default and only whitelists /api/auth/**, /ws/**
     * and /api/health, so an anonymous POST to this address never reaches this
     * method.
     *
     * Identity: taken from @AuthenticationPrincipal, which Spring Security
     * populates from the verified JWT. FeedbackRequest has no user fields at
     * all, so a forged "userId" in the form body has nothing to bind to and is
     * ignored — the attack isn't defended against so much as made unspeakable.
     *
     * Multipart rather than JSON because of the optional screenshot. @Valid on
     * @ModelAttribute means a missing message or an unrecognised type fails
     * before the method body runs, and GlobalExceptionHandler turns that into a
     * 400 listing the offending fields.
     *
     * 204 No Content is the success case, and it is only reached if Brevo
     * actually accepted the email — FeedbackService throws otherwise.
     */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Void> submitFeedback(
            @Valid @ModelAttribute FeedbackRequest request,
            @RequestParam(value = "screenshot", required = false) MultipartFile screenshot,
            @AuthenticationPrincipal User currentUser
    ) {
        feedbackService.submit(request, screenshot, currentUser);
        return ResponseEntity.noContent().build();
    }
}
