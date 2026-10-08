package com.example.pingBackend.dto.request;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

/** "Add these people to the group". Up to 199 at once, which is the whole cap. */
@Data
public class AddParticipantsRequest {

    @NotEmpty(message = "Choose at least one person to add")
    @Size(max = 199, message = "That's too many people at once")
    private List<String> userIds;
}
