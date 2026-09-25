package com.example.pingBackend.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

/**
 * One signed-in device (Stage 14).
 *
 * WHY THIS EXISTS. A login token used to be self-contained: the server checked
 * its signature and expiry and kept no record of it. That made it impossible
 * to sign a single device out. There was nothing on the server to delete, so a
 * stolen token kept working until it expired.
 *
 * Now every token names one of these documents (the "sid" claim), and a token
 * is accepted only while its document exists. Signing a device out is deleting
 * its document: the very next request from that device is refused.
 *
 * Holds no secret. The token itself is never stored, only which device it
 * belongs to, so reading this collection doesn't let anyone sign in.
 */
@Document(collection = "sessions")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LoginSession {

    @Id
    private String id;

    private String userId;

    /** "Chrome on Windows", worked out from the browser's User-Agent at sign-in. */
    private String deviceName;

    /** How this device signed in: PASSWORD, EMAIL_CODE, QR or REGISTER. */
    private String method;

    private LocalDateTime createdAt;

    /** Updated at most every few minutes, not on every request. */
    private LocalDateTime lastActiveAt;

    /** Same moment the token expires. A TTL index deletes the document after it. */
    private LocalDateTime expiresAt;
}
