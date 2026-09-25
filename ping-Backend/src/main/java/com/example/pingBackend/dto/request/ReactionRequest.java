package com.example.pingBackend.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * React to a message. Sending the reaction you already have removes it, the
 * same toggle WhatsApp uses. Which emoji are allowed is decided in
 * MessageService, not here: this only rules out an empty request.
 */
@Data
public class ReactionRequest {

    @NotBlank(message = "Choose a reaction")
    private String emoji;
}
