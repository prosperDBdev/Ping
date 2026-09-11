package com.example.pingBackend.controller;

import com.example.pingBackend.dto.request.SaveMemoryRequest;
import com.example.pingBackend.dto.response.MemoryResponse;
import com.example.pingBackend.model.User;
import com.example.pingBackend.service.MemoryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/memories")
@RequiredArgsConstructor
public class MemoryController {

    private final MemoryService memoryService;

    @PostMapping
    public ResponseEntity<MemoryResponse> saveMemory(
            @Valid @RequestBody SaveMemoryRequest request,
            @AuthenticationPrincipal User currentUser
    ) {
        MemoryResponse response = memoryService.createMemory(
                currentUser.getId(), request.getMessageId(), request.getCategory());
        return ResponseEntity.ok(response);
    }

    @GetMapping
    public ResponseEntity<List<MemoryResponse>> listMemories(
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String q,
            @AuthenticationPrincipal User currentUser
    ) {
        List<MemoryResponse> memories = memoryService.listMemories(currentUser.getId(), category, q);
        return ResponseEntity.ok(memories);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteMemory(
            @PathVariable String id,
            @AuthenticationPrincipal User currentUser
    ) {
        memoryService.deleteMemory(currentUser.getId(), id);
        return ResponseEntity.ok().build();
    }
}
