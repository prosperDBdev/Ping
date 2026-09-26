package com.example.pingBackend.controller;

import com.example.pingBackend.dto.request.TaskRequest;
import com.example.pingBackend.dto.response.TaskResponse;
import com.example.pingBackend.model.User;
import com.example.pingBackend.service.TaskService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Tasks in a conversation, and your tasks across all of them.
 *
 *   GET    /api/conversations/{cid}/tasks
 *   POST   /api/conversations/{cid}/tasks
 *   PUT    /api/conversations/{cid}/tasks/{taskId}   (the whole task again)
 *   DELETE /api/conversations/{cid}/tasks/{taskId}
 *   GET    /api/tasks/mine                           (for the Home page)
 */
@RestController
@RequiredArgsConstructor
public class TaskController {

    private final TaskService taskService;

    @GetMapping("/api/conversations/{conversationId}/tasks")
    public List<TaskResponse> list(@PathVariable String conversationId, @AuthenticationPrincipal User me) {
        return taskService.list(conversationId, me.getId());
    }

    @PostMapping("/api/conversations/{conversationId}/tasks")
    public TaskResponse create(@PathVariable String conversationId, @AuthenticationPrincipal User me,
                               @Valid @RequestBody TaskRequest request) {
        return taskService.create(conversationId, me, request);
    }

    @PutMapping("/api/conversations/{conversationId}/tasks/{taskId}")
    public TaskResponse update(@PathVariable String conversationId, @PathVariable String taskId,
                               @AuthenticationPrincipal User me, @Valid @RequestBody TaskRequest request) {
        return taskService.update(conversationId, taskId, me, request);
    }

    @DeleteMapping("/api/conversations/{conversationId}/tasks/{taskId}")
    public ResponseEntity<Void> delete(@PathVariable String conversationId, @PathVariable String taskId,
                                       @AuthenticationPrincipal User me) {
        taskService.delete(conversationId, taskId, me);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/api/tasks/mine")
    public List<TaskResponse> mine(@AuthenticationPrincipal User me) {
        return taskService.mine(me.getId());
    }
}
