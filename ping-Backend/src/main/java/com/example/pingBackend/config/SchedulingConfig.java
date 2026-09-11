package com.example.pingBackend.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.SchedulingConfigurer;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.scheduling.config.ScheduledTaskRegistrar;

/**
 * Gives @Scheduled tasks their own thread pool.
 *
 * This isn't optional polish — without it the scheduled jobs silently never
 * run. @EnableWebSocketMessageBroker registers TaskScheduler beans of its own
 * (STOMP heartbeats, SockJS), so the context has several. With more than one
 * candidate and none designated, the scheduling infrastructure can't resolve
 * which to use, and @Scheduled methods are simply never invoked — no error,
 * no warning at INFO, nothing. Declaring the scheduler explicitly here removes
 * the ambiguity.
 *
 * Separating the pools is also correct on its own merits: a slow cleanup pass
 * should never be able to delay a WebSocket heartbeat, and vice versa.
 */
@Configuration
public class SchedulingConfig implements SchedulingConfigurer {

    @Bean(destroyMethod = "shutdown")
    public ThreadPoolTaskScheduler applicationTaskScheduler() {
        ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(2);
        scheduler.setThreadNamePrefix("ping-scheduled-");
        // Let an in-flight cleanup pass finish rather than being killed
        // mid-way through deleting a conversation's messages.
        scheduler.setWaitForTasksToCompleteOnShutdown(true);
        scheduler.setAwaitTerminationSeconds(30);
        scheduler.initialize();
        return scheduler;
    }

    @Override
    public void configureTasks(ScheduledTaskRegistrar registrar) {
        registrar.setTaskScheduler(applicationTaskScheduler());
    }
}
