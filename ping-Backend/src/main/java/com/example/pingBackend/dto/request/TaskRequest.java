package com.example.pingBackend.dto.request;

import com.example.pingBackend.model.Task;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Creating or editing a task. An edit sends the whole task again (every field
 * below), so there's no ambiguity between "leave the due time alone" and
 * "remove the due time": null always means none.
 *
 * dueAt is an Instant, so the browser sends an absolute moment ("…Z") worked
 * out from the date and time the person picked in THEIR time zone. The server
 * never has to guess where anyone is.
 */
@Data
public class TaskRequest {

    @NotBlank(message = "Give the task a title")
    @Size(max = 200, message = "Keep the title under 200 characters")
    private String title;

    @Size(max = 2000, message = "Keep the description under 2000 characters")
    private String description;

    @Size(max = 64)
    private String assigneeId;

    private Instant dueAt;

    @Pattern(regexp = "LOW|MEDIUM|HIGH", message = "Priority must be LOW, MEDIUM or HIGH")
    private String priority;

    @Pattern(regexp = "TODO|IN_PROGRESS|COMPLETED", message = "Status must be TODO, IN_PROGRESS or COMPLETED")
    private String status;

    /** Only used when creating: a personal reminder instead of a shared task. */
    @JsonProperty("isReminder")
    private boolean reminder;

    @Size(max = 64)
    private String sourceMessageId;

    @Size(max = 300)
    private String sourceMessageSnippet;

    @Valid
    @Size(max = 10, message = "At most 10 attachments")
    private List<AttachmentRequest> attachments = new ArrayList<>();

    @Data
    public static class AttachmentRequest {
        @Size(max = 64)
        private String id;
        @NotBlank
        @Size(max = 200)
        private String name;
        private long size;
        @Size(max = 100)
        private String type;

        public Task.Attachment toModel() {
            return Task.Attachment.builder().id(id).name(name).size(size).type(type).build();
        }
    }
}
