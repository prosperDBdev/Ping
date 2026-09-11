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
public class MemoryResponse {
    private String id;
    private String conversationId;
    private String messageId;
    private String content;
    private String category;
    private LocalDateTime createdAt;
}
