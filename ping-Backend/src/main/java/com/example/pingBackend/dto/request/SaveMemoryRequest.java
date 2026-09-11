package com.example.pingBackend.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SaveMemoryRequest {

    @NotBlank(message = "Message ID is required")
    private String messageId;

    @NotBlank(message = "Category is required")
    private String category; // IMPORTANT, EVENT, FINANCIAL, LOCATION, PERSON, NOTE
}
