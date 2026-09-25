package com.example.pingBackend.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * The new text for a message you sent. Who may edit, and until when, is
 * enforced in MessageService.edit: this only checks the text itself.
 */
@Data
public class EditMessageRequest {

    @NotBlank(message = "A message can't be empty")
    @Size(max = 10000, message = "That message is too long")
    private String content;
}
