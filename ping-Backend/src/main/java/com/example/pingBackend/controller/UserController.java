package com.example.pingBackend.controller;

import com.example.pingBackend.dto.response.UserResponse;
import com.example.pingBackend.model.User;
import com.example.pingBackend.repository.UserRepository;
import com.example.pingBackend.service.BlockService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;
import com.example.pingBackend.exception.NotFoundException;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserRepository userRepository;
    private final BlockService blockService;

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