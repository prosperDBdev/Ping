package com.example.pingBackend.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserResponse {

    private String id;
    private String username;
    private String email;
    private String avatarUrl;
    private String status;
    private LocalDateTime lastSeen;
    private LocalDateTime createdAt;
    // ← Notice: NO password field! Never expose it.
}