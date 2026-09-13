package com.example.pingBackend.controller;

import com.example.pingBackend.dto.request.CreateStatusRequest;
import com.example.pingBackend.dto.request.StatusReactionRequest;
import com.example.pingBackend.dto.request.StatusReplyRequest;
import com.example.pingBackend.dto.response.MessageResponse;
import com.example.pingBackend.dto.response.StatusViewerResponse;
import jakarta.validation.Valid;
import com.example.pingBackend.dto.request.StatusPrivacyRequest;
import com.example.pingBackend.dto.response.StatusFeedEntryResponse;
import com.example.pingBackend.dto.response.StatusResponse;
import com.example.pingBackend.dto.response.UserResponse;
import com.example.pingBackend.model.User;
import com.example.pingBackend.service.DownloadedMedia;
import com.example.pingBackend.service.StatusService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Status endpoints.
 *
 * Thin on purpose — every authorisation decision belongs to StatusService, so
 * there is nothing here but request shape and response shape. A controller
 * that starts making its own visibility judgements is the beginning of a
 * second copy of the rule.
 */
@RestController
@RequestMapping("/api/statuses")
@RequiredArgsConstructor
public class StatusController {

    private final StatusService statusService;

    /** The feed: live statuses from contacts, grouped by author. */
    @GetMapping
    public ResponseEntity<List<StatusFeedEntryResponse>> getFeed(
            @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(statusService.getFeed(currentUser));
    }

    /** Your own live statuses, with view counts. */
    @GetMapping("/mine")
    public ResponseEntity<List<StatusResponse>> getMine(@AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(statusService.getMyStatuses(currentUser));
    }

    @PostMapping("/text")
    public ResponseEntity<StatusResponse> createText(
            @RequestBody CreateStatusRequest request,
            @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(statusService.createTextStatus(currentUser, request));
    }

    @PostMapping("/image")
    public ResponseEntity<StatusResponse> createImage(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "caption", required = false) String caption,
            @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(statusService.createImageStatus(currentUser, file, caption));
    }

    /**
     * Serve a status image.
     *
     * Same defensive headers as the chat media endpoint, for the same reason:
     * these bytes came from a user, and the browser must not be allowed to
     * decide for itself what they are. The allow-list is narrower here than in
     * MediaController because statuses are images only — there is no audio,
     * and nothing that would ever need to be served as an attachment.
     */
    @GetMapping("/media")
    public ResponseEntity<byte[]> getMedia(
            @RequestParam("key") String key,
            @AuthenticationPrincipal User currentUser) {
        DownloadedMedia media = statusService.downloadStatusMedia(key, currentUser);

        boolean inlineSafe = INLINE_SAFE_TYPES.contains(media.contentType());

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(media.contentType()))
                .header("X-Content-Type-Options", "nosniff")
                .header("Content-Disposition", inlineSafe ? "inline" : "attachment")
                // Private: a status is per-viewer authorised, so no shared
                // cache should ever hold a copy that a different user could
                // be served. no-store keeps it out of the disk cache after
                // the 24 hours are up, too.
                .header("Cache-Control", "private, no-store")
                .body(media.bytes());
    }

    private static final Set<String> INLINE_SAFE_TYPES =
            Set.of("image/jpeg", "image/png", "image/webp");

    @PostMapping("/{id}/view")
    public ResponseEntity<Void> markViewed(
            @PathVariable String id,
            @AuthenticationPrincipal User currentUser) {
        statusService.markViewed(id, currentUser);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/{id}/viewers")
    public ResponseEntity<List<StatusViewerResponse>> getViewers(
            @PathVariable String id,
            @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(statusService.getViewers(id, currentUser));
    }

    /** React to a status. Sending the same emoji again removes it. */
    @PostMapping("/{id}/react")
    public ResponseEntity<StatusResponse> react(
            @PathVariable String id,
            @RequestBody StatusReactionRequest request,
            @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(statusService.react(id, currentUser, request.getEmoji()));
    }

    /** Reply to a status. Lands as a private message in your chat with the author. */
    @PostMapping("/{id}/reply")
    public ResponseEntity<MessageResponse> reply(
            @PathVariable String id,
            @Valid @RequestBody StatusReplyRequest request,
            @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(statusService.reply(id, currentUser, request.getText()));
    }

    @PostMapping("/{id}/reshare")
    public ResponseEntity<StatusResponse> reshare(
            @PathVariable String id,
            @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(statusService.reshare(id, currentUser));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @PathVariable String id,
            @AuthenticationPrincipal User currentUser) {
        statusService.deleteStatus(id, currentUser);
        return ResponseEntity.noContent().build();
    }

    /** Read the caller's own status privacy settings. */
    @GetMapping("/privacy")
    public ResponseEntity<Map<String, Object>> getPrivacy(@AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(Map.of(
                "hiddenStatusFrom", currentUser.getHiddenStatusFrom() == null
                        ? List.of() : currentUser.getHiddenStatusFrom(),
                "allowResharing", currentUser.getAllowResharing() == null
                        || currentUser.getAllowResharing()));
    }

    @PutMapping("/privacy")
    public ResponseEntity<Map<String, Object>> updatePrivacy(
            @RequestBody StatusPrivacyRequest request,
            @AuthenticationPrincipal User currentUser) {
        User updated = statusService.updatePrivacy(currentUser, request);
        return ResponseEntity.ok(Map.of(
                "hiddenStatusFrom", updated.getHiddenStatusFrom() == null
                        ? List.of() : updated.getHiddenStatusFrom(),
                "allowResharing", updated.getAllowResharing() == null
                        || updated.getAllowResharing()));
    }
}
