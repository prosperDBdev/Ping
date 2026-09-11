package com.example.pingBackend.dto.request;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * The author's own status privacy settings.
 *
 * Both fields are nullable so the client can send a partial update — omitting
 * one leaves it alone rather than silently resetting it. A settings screen
 * that flips one switch shouldn't have to know, and resend, the value of every
 * other switch just to avoid clobbering it.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class StatusPrivacyRequest {
    private List<String> hiddenStatusFrom;
    private Boolean allowResharing;
}
