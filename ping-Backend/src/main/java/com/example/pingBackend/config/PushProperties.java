package com.example.pingBackend.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * The push.* settings: this server's VAPID key pair and contact address.
 *
 * Blank keys mean push is switched off, not misconfigured: the app runs
 * normally and simply sends no push notifications. That keeps local
 * development and tests working with no keys at all.
 *
 * The private key is a secret on the same level as JWT_SECRET: anyone holding
 * it can send notifications to every subscribed device as if they were Ping.
 * It lives only in the server's .env.
 */
@ConfigurationProperties(prefix = "push")
public record PushProperties(String vapidPublicKey, String vapidPrivateKey, String vapidSubject) {

    public PushProperties(
            @DefaultValue("") String vapidPublicKey,
            @DefaultValue("") String vapidPrivateKey,
            @DefaultValue("mailto:security@ebitimi.dev") String vapidSubject
    ) {
        // Same reason as BrevoProperties: a stray space pasted into .env would
        // otherwise make every push fail with an error that looks like a bad key.
        this.vapidPublicKey = vapidPublicKey.strip();
        this.vapidPrivateKey = vapidPrivateKey.strip();
        this.vapidSubject = vapidSubject.strip();
    }

    public boolean enabled() {
        return !vapidPublicKey.isBlank() && !vapidPrivateKey.isBlank();
    }
}
