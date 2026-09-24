package com.example.pingBackend.config;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.validation.annotation.Validated;

/**
 * The brevo.* settings, bound once into one object instead of injected as three
 * separate @Value strings.
 *
 * WHY A RECORD. Spring Boot binds a value object through its canonical
 * constructor, so the fields are final and the object is complete the moment it
 * exists — there is no window where two of the three are set. It also puts the
 * whole shape of "what Brevo needs" in one place a reader can see at once,
 * rather than spread across the parameter list of whatever service happens to
 * use it.
 *
 * WHY @Validated. Without it these annotations are decoration: nothing runs
 * them. With it, the values are checked while the context is starting, so a
 * mistyped sender address fails the boot with a message naming the property
 * instead of failing much later, invisibly, inside a background email thread.
 *
 * WHY NOT @NotBlank ON THE KEY AND THE ADDRESS. Blank is a legal, meaningful
 * value here: it is how this app says "email is not configured", which is the
 * normal state in local development (see EmailService). @NotNull is the real
 * guard — it catches the property disappearing entirely, which would otherwise
 * surface as a NullPointerException on the first send rather than at startup.
 * @Email agrees with this on purpose: Jakarta's email constraint treats null
 * and empty as valid, so it only ever complains about an address that is set
 * and wrong.
 */
@ConfigurationProperties(prefix = "brevo")
@Validated
public record BrevoProperties(

        @NotNull String apiKey,

        @NotNull @Email String senderEmail,

        // Always present, and Brevo rejects a nameless sender — so here blank
        // really is a mistake rather than a state.
        @NotBlank String senderName
) {

    /**
     * The defaults that used to live in the @Value placeholders, moved to the
     * type itself so they hold wherever this binds — including the test
     * classpath, whose application.properties replaces the main one entirely.
     */
    public BrevoProperties(
            @DefaultValue("") String apiKey,
            @DefaultValue("") String senderEmail,
            @DefaultValue("Ping") String senderName
    ) {
        // Environment variables set through a hosting dashboard or an IDE's
        // "Environment variables" field pick up stray whitespace easily — a
        // space after the "=" becomes part of the value. A trailing space in an
        // API key turns every send into a 401 that looks like a bad key, so
        // strip it here rather than debug it later. StorageConfig does the same
        // for the R2 credentials.
        this.apiKey = strip(apiKey);
        this.senderEmail = strip(senderEmail);
        this.senderName = strip(senderName);
    }

    /** Null-safe, so a missing value is reported by @NotNull and not by an NPE in here. */
    private static String strip(String value) {
        return value == null ? null : value.strip();
    }

    /** True when there is enough here to actually send mail. */
    public boolean isConfigured() {
        return !apiKey.isBlank() && !senderEmail.isBlank();
    }
}
