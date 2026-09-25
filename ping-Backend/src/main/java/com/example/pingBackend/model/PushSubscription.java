package com.example.pingBackend.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

/**
 * One device that has agreed to receive push notifications for one user.
 *
 * The endpoint is a URL on a browser vendor's push service (Google, Mozilla,
 * Apple, Microsoft), unique to this device. It works like a key: anyone holding
 * it and the two keys below could send notifications to the device. So it is
 * never returned by any API and never written to the logs.
 *
 * p256dh and auth are the browser's public key and secret for encrypting
 * payloads (see WebPushCrypto). Only the browser holds the matching private
 * key, so the push service in the middle can't read what we send.
 */
@Document(collection = "push_subscriptions")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PushSubscription {

    @Id
    private String id;

    private String userId;

    /** Unique: a device belongs to whoever is signed in on it now. */
    private String endpoint;

    private String p256dh;

    private String auth;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
