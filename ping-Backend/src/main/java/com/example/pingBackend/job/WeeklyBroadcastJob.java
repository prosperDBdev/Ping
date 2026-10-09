package com.example.pingBackend.job;

import com.example.pingBackend.service.BroadcastService;
import com.example.pingBackend.service.BroadcastService.BroadcastResult;
import com.example.pingBackend.service.EmailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Sends a weekly engagement email to every registered Ping user.
 *
 * WHY ONCE A WEEK. A weekly cadence is frequent enough to keep Ping in users'
 * minds without crossing into territory that feels spammy.
 *
 * WHEN IT FIRES. Every Monday at 10:00 AM UTC.
 *
 * HOW IT WORKS. Delegates entirely to BroadcastService.
 *
 * SAFETY. If Brevo is not configured the job skips gracefully with a log warning.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class WeeklyBroadcastJob {

    private final BroadcastService broadcastService;
    private final EmailService emailService;

    /**
     * Fires every Monday at 10:00 AM UTC.
     * Cron: second minute hour day month weekday
     */
    @Scheduled(cron = "0 0 10 * * MON", zone = "UTC")
    public void sendWeeklyBroadcast() {
        if (!emailService.isConfigured()) {
            log.warn("[WeeklyBroadcastJob] Skipping weekly broadcast — email not configured " +
                     "(set BREVO_API_KEY and BREVO_SENDER_EMAIL to enable).");
            return;
        }

        log.info("[WeeklyBroadcastJob] Starting weekly broadcast email to all registered users...");

        try {
            BroadcastResult result = broadcastService.sendBroadcast(null, null);
            log.info("[WeeklyBroadcastJob] Weekly broadcast complete. Dispatched to {} recipient(s). Status: {}",
                    result.totalRecipients(), result.statusMessage());
        } catch (Exception e) {
            log.error("[WeeklyBroadcastJob] Weekly broadcast failed unexpectedly: {}", e.getMessage(), e);
        }
    }
}