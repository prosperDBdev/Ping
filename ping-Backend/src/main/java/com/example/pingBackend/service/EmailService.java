package com.example.pingBackend.service;

import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

/**
 * Sends email through Brevo's HTTP API.
 *
 * WHY HTTP AND NOT SMTP. Brevo offers both. The HTTP API is one POST with a JSON
 * body and an API key header — no mail library, no SMTP connection to manage,
 * and free hosts often block outbound SMTP ports anyway.
 *
 * WHY IN THE BACKGROUND. Sending takes a network round-trip to Brevo, often a
 * few hundred milliseconds. If the forgot-password request waited for it, the
 * response would come back noticeably slower when the email EXISTS (an email is
 * sent) than when it doesn't (nothing to send) — and an attacker timing the
 * responses could learn which emails have accounts. Queuing the send and
 * answering immediately removes most of that difference.
 *
 * The small thread pool is private to this class on purpose. Declaring it as a
 * Spring Executor bean would silently switch off Spring Boot's own default task
 * executor — the same kind of invisible bean conflict that once stopped every
 * @Scheduled job in this app from running.
 *
 * WITHOUT AN API KEY (local development) nothing is sent. On localhost the reset
 * link is written to the log so you can still test the flow. Anywhere else it is
 * NOT logged: a reset link is a key to someone's account, and server logs are
 * read by far more people and tools than a user's inbox.
 */
@Service
@Slf4j
public class EmailService {

    private final RestClient restClient = RestClient.builder()
            .baseUrl("https://api.brevo.com/v3")
            .build();

    // One sender thread, at most 100 waiting emails. If the queue is ever full,
    // the email is dropped and logged rather than letting a flood of requests
    // pile up unbounded work in memory.
    private final ThreadPoolExecutor sender = new ThreadPoolExecutor(
            1, 1, 0L, TimeUnit.MILLISECONDS,
            new ArrayBlockingQueue<>(100),
            runnable -> {
                Thread thread = new Thread(runnable, "ping-email");
                thread.setDaemon(true);
                return thread;
            },
            (runnable, executor) -> log.error("Email queue full — an email was dropped"));

    private final String apiKey;
    private final String senderEmail;
    private final String senderName;
    private final String frontendUrl;

    public EmailService(
            @Value("${brevo.api-key:}") String apiKey,
            @Value("${brevo.sender-email:}") String senderEmail,
            @Value("${brevo.sender-name:Ping}") String senderName,
            @Value("${app.frontend-url}") String frontendUrl
    ) {
        this.apiKey = apiKey;
        this.senderEmail = senderEmail;
        this.senderName = senderName;
        this.frontendUrl = frontendUrl;
    }

    public boolean isConfigured() {
        return !apiKey.isBlank() && !senderEmail.isBlank();
    }

    /** Queues a password reset email and returns immediately. */
    public void sendPasswordReset(String toEmail, String resetLink) {
        sender.execute(() -> deliverPasswordReset(toEmail, resetLink));
    }

    private void deliverPasswordReset(String toEmail, String resetLink) {
        if (!isConfigured()) {
            if (frontendUrl.startsWith("http://localhost")) {
                log.warn("EMAIL NOT CONFIGURED (local development) — password reset link for {}: {}",
                        toEmail, resetLink);
            } else {
                log.error("Email is not configured: set BREVO_API_KEY and BREVO_SENDER_EMAIL. "
                        + "A password reset was requested and no email was sent.");
            }
            return;
        }

        try {
            restClient.post()
                    .uri("/smtp/email")
                    .header("api-key", apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of(
                            "sender", Map.of("name", senderName, "email", senderEmail),
                            "to", List.of(Map.of("email", toEmail)),
                            "subject", "Reset your Ping password",
                            "htmlContent", resetEmailHtml(resetLink)))
                    .retrieve()
                    .toBodilessEntity();
            log.info("Password reset email handed to Brevo");
        } catch (RestClientException e) {
            // Logged without the link or the token — only that it failed and why.
            log.error("Brevo rejected the password reset email: {}", e.getMessage());
        }
    }

    /**
     * Built only from values the server controls — the configured frontend URL
     * and a server-generated token. No user-supplied text goes into this HTML,
     * so there's nothing in it that could inject markup into someone's inbox.
     */
    private static String resetEmailHtml(String resetLink) {
        return """
                <div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;color:#1b2f35">
                  <h2 style="margin:0 0 12px">Reset your Ping password</h2>
                  <p>Someone asked to reset the password for this account. If it was you, use the button below.
                     It works once and expires in 15 minutes.</p>
                  <p style="margin:24px 0">
                    <a href="%s" style="background:#e0684b;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:700">
                      Choose a new password
                    </a>
                  </p>
                  <p style="color:#738086;font-size:13px">If you didn't ask for this, you can ignore this email — your password won't change.</p>
                </div>
                """.formatted(resetLink);
    }

    @PreDestroy
    void shutdown() {
        sender.shutdown();
    }
}
