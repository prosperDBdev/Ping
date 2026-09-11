package com.example.pingBackend.dto.request;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Body for creating a TEXT status.
 *
 * Image statuses don't use this — they arrive as multipart on their own
 * endpoint, because the file has to go through the Stage 8 sanitizer before
 * anything is persisted.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreateStatusRequest {
    private String text;
    private String backgroundColor;
}
