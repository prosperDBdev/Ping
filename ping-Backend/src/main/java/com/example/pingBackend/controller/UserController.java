package com.example.pingBackend.controller;

import com.example.pingBackend.dto.response.AvatarResponse;
import com.example.pingBackend.dto.response.UserResponse;
import com.example.pingBackend.model.User;
import com.example.pingBackend.repository.UserRepository;
import com.example.pingBackend.service.AvatarService;
import com.example.pingBackend.service.BlockService;
import com.example.pingBackend.service.DownloadedMedia;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.Duration;
import java.util.List;
import java.util.stream.Collectors;
import com.example.pingBackend.exception.NotFoundException;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserRepository userRepository;
    private final BlockService blockService;
    private final AvatarService avatarService;

    // GET /api/users/me — Get the currently logged-in user
    @GetMapping("/me")
    public ResponseEntity<UserResponse> getCurrentUser(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(mapToResponse(user));
    }

    // GET /api/users/search?q=john — Search for users by username
    @GetMapping("/search")
    public ResponseEntity<List<UserResponse>> searchUsers(
            @RequestParam("q") String query,
            @AuthenticationPrincipal User currentUser
    ) {
        List<UserResponse> users = userRepository
                .findByUsernameContainingIgnoreCase(query)
                .stream()
                .filter(user -> !user.getId().equals(currentUser.getId()))  // Exclude self
                // BLOCK-CHECK (3 of 3) — blocked users don't appear in search
                // at all, in either direction. Showing someone you can't
                // actually message is a dead end, and showing the blocker in
                // the blocked user's results invites them to keep trying.
                .filter(user -> !blockService.isBlockedBetween(currentUser.getId(), user.getId()))
                .map(this::mapToResponse)
                .collect(Collectors.toList());

        return ResponseEntity.ok(users);
    }

    // POST /api/users/{id}/block
    @PostMapping("/{id}/block")
    public ResponseEntity<Void> blockUser(
            @PathVariable String id,
            @AuthenticationPrincipal User currentUser
    ) {
        blockService.block(currentUser.getId(), id);
        return ResponseEntity.noContent().build();
    }

    // DELETE /api/users/{id}/block
    @DeleteMapping("/{id}/block")
    public ResponseEntity<Void> unblockUser(
            @PathVariable String id,
            @AuthenticationPrincipal User currentUser
    ) {
        blockService.unblock(currentUser.getId(), id);
        return ResponseEntity.noContent().build();
    }

    // GET /api/users/me/blocked — the list, so the UI can show and undo it
    @GetMapping("/me/blocked")
    public ResponseEntity<List<UserResponse>> getBlockedUsers(@AuthenticationPrincipal User currentUser) {
        List<UserResponse> blocked = currentUser.getBlockedUsers().stream()
                .map(userRepository::findById)
                .filter(java.util.Optional::isPresent)
                .map(java.util.Optional::get)
                .map(this::mapToResponse)
                .collect(Collectors.toList());

        return ResponseEntity.ok(blocked);
    }

    // GET /api/users/{id} — Get a user by ID
    @GetMapping("/{id}")
    public ResponseEntity<UserResponse> getUserById(@PathVariable String id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("User not found"));

        return ResponseEntity.ok(mapToResponse(user));
    }

    /**
     * POST /api/users/me/avatar — set or replace YOUR OWN profile photo.
     *
     * "me", not "{id}". The address names the caller, so there is no parameter
     * saying whose photo to change and therefore no check needed that you own
     * it: the user is read from the verified JWT via @AuthenticationPrincipal.
     * An endpoint shaped "/api/users/{id}/avatar" would have needed that check,
     * and forgetting it would have let anyone overwrite anyone's picture.
     *
     * Validation (size, real file type, dimensions, re-encoding) happens inside
     * MediaStorageService, the same place every other image in Ping is checked.
     */
    @PostMapping(value = "/me/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<AvatarResponse> uploadAvatar(
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal User currentUser
    ) {
        return ResponseEntity.ok(new AvatarResponse(avatarService.upload(currentUser, file)));
    }

    // DELETE /api/users/me/avatar — remove your own photo. Idempotent: removing
    // a photo you don't have succeeds quietly rather than 404ing.
    @DeleteMapping("/me/avatar")
    public ResponseEntity<Void> removeAvatar(@AuthenticationPrincipal User currentUser) {
        avatarService.remove(currentUser);
        return ResponseEntity.noContent().build();
    }

    /**
     * GET /api/users/{id}/avatar — fetch anyone's photo.
     *
     * Reading is open to any SIGNED-IN user (SecurityConfig denies anonymous
     * requests), which is the rule an avatar needs: it appears beside its owner
     * in search results and group member lists, shown to people who may never
     * have messaged them. Writing stays restricted to the owner, above.
     *
     * The caller names a USER, never an object key — the key is looked up from
     * that user's document. An endpoint taking a key would be a way to read any
     * object in the bucket.
     *
     * The ?v= on the stored URL is not read here. It exists purely so the
     * address changes when the photo does, which is what stops a browser
     * serving the previous picture out of the cache below.
     */
    @GetMapping("/{id}/avatar")
    public ResponseEntity<byte[]> getAvatar(@PathVariable String id) {
        DownloadedMedia media = avatarService.load(id);

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(media.contentType()))
                // Same two headers the media endpoint sets: don't let the
                // browser re-guess the type, and render rather than download.
                // Inline is safe here because these bytes came out of our own
                // encoder — see MediaStorageService.sanitizeImage.
                .header("X-Content-Type-Options", "nosniff")
                .header("Content-Disposition", "inline")
                .cacheControl(CacheControl.maxAge(Duration.ofDays(1)).cachePrivate())
                .body(media.bytes());
    }

    // Helper: Convert User model → UserResponse DTO (no password!)
    private UserResponse mapToResponse(User user) {
        return UserResponse.builder()
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .avatarUrl(user.getAvatarUrl())
                .status(user.getStatus())
                .lastSeen(user.getLastSeen())
                .createdAt(user.getCreatedAt())
                .build();
    }
}