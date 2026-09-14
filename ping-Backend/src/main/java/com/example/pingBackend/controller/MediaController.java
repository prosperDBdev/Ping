package com.example.pingBackend.controller;

import com.example.pingBackend.dto.response.MediaUploadResponse;
import com.example.pingBackend.model.User;
import com.example.pingBackend.service.DownloadedMedia;
import com.example.pingBackend.service.MediaStorageService;
import com.example.pingBackend.service.StoredMedia;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@RequestMapping("/api/media")
@RequiredArgsConstructor
public class MediaController {

    private final MediaStorageService mediaStorageService;

    // Requires auth already — SecurityConfig only whitelists /api/auth/**, /ws/** and
    // /api/health, so this endpoint is protected by default with no extra config.
    @PostMapping("/upload")
    public ResponseEntity<MediaUploadResponse> uploadVoiceNote(
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal User currentUser
    ) {
        StoredMedia stored = mediaStorageService.uploadVoiceNote(file, currentUser.getId());

        return ResponseEntity.ok(MediaUploadResponse.builder()
                .key(stored.key())
                .mimeType(stored.mimeType())
                .sizeBytes(stored.sizeBytes())
                .build());
    }

    @PostMapping("/upload/image")
    public ResponseEntity<MediaUploadResponse> uploadImage(
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal User currentUser
    ) {
        StoredMedia stored = mediaStorageService.uploadImage(file, currentUser.getId());

        return ResponseEntity.ok(MediaUploadResponse.builder()
                .key(stored.key())
                .mimeType(stored.mimeType())
                .sizeBytes(stored.sizeBytes())
                .build());
    }

    // Streams the file straight through this server rather than handing back a
    // signed R2 URL — simpler for now (no extra presigning dependency), at the
    // cost of the bytes flowing through Spring Boot instead of straight from R2.
    // Fine at this scale; worth revisiting if voice notes get heavy traffic.
    @GetMapping("/download")
    public ResponseEntity<byte[]> downloadVoiceNote(
            @RequestParam("key") String key,
            @AuthenticationPrincipal User currentUser
    ) {
        DownloadedMedia media = mediaStorageService.downloadVoiceNote(key, currentUser.getId());

        // Only types we can safely let the browser render are served inline.
        // Anything else is forced to download, because serving an arbitrary
        // user-uploaded file inline on our own origin is how you get stored
        // XSS: an uploaded SVG or HTML document served as-is executes with the
        // viewing user's session in scope. Images are safe here specifically
        // because they were re-encoded on the way in — the bytes we're serving
        // were produced by our own encoder, not by the uploader.
        boolean inlineSafe = INLINE_SAFE_TYPES.contains(media.contentType());

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(media.contentType()))
                // Stops the browser from second-guessing our Content-Type and
                // "helpfully" executing a file it decides looks like HTML.
                .header("X-Content-Type-Options", "nosniff")
                .header("Content-Disposition", inlineSafe ? "inline" : "attachment")
                .body(media.bytes());
    }

    /**
     * Types allowed to render inline. Deliberately excludes SVG — it is an
     * XML document that can carry script, so it is an executable format
     * wearing an image's name, and it is not re-encodable the way a raster
     * image is.
     */
    private static final java.util.Set<String> INLINE_SAFE_TYPES = java.util.Set.of(
            "image/jpeg", "image/png", "image/webp",
            "audio/webm", "audio/ogg", "audio/mpeg", "audio/mp4", "audio/wav", "audio/x-wav",
            "application/x-matroska", "video/webm"
    );

    // The handlers for InvalidMediaException and ForbiddenMediaAccessException
    // used to live here. They moved to GlobalExceptionHandler when statuses
    // began throwing the same two — a controller-local handler only covers its
    // own controller, so keeping them here would have left the identical
    // failure returning 500 from a different endpoint.
}
