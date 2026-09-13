package com.example.pingBackend.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Reply to a status — delivered as a private message to its author. */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class StatusReplyRequest {

    @NotBlank(message = "Write something to reply")
    @Size(max = 2000, message = "Replies can be at most 2000 characters")
    private String text;
}
