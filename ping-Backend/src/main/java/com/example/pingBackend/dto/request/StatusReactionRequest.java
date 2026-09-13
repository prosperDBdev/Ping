package com.example.pingBackend.dto.request;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * React to a status.
 *
 * No validation annotation on emoji, on purpose — "is this one of the allowed
 * reactions" is a membership check against a fixed set, which @Pattern would
 * express badly and @NotBlank not at all. The service checks it against the
 * allow-list, where the list itself lives.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class StatusReactionRequest {
    private String emoji;
}
