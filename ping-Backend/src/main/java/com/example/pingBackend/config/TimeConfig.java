package com.example.pingBackend.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import tools.jackson.core.JsonGenerator;
import tools.jackson.databind.SerializationContext;
import tools.jackson.databind.ValueSerializer;
import tools.jackson.databind.module.SimpleModule;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;

/**
 * Every timestamp leaves the server as an absolute moment: "...T18:55:32.354Z".
 *
 * THE BUG THIS FIXES. The model uses LocalDateTime, which has no time zone, so
 * Jackson wrote "2026-09-25T18:55:32" with nothing saying which zone that is.
 * Browsers read a zoneless date-time as LOCAL time. The server runs on UTC,
 * so a phone in Lagos (UTC+1) showed every message an hour early, and phones
 * elsewhere were off by their own offsets.
 *
 * The server's clock is pinned to UTC (see PingBackendApplication), so every
 * LocalDateTime it holds IS a UTC time. This serializer just says so with the
 * trailing Z, and each phone converts to its own local time.
 *
 * Spring Boot registers any Jackson module bean with the application's JSON
 * mapper, and the WebSocket message converter uses that same mapper, so this
 * one bean covers both REST responses and live messages.
 *
 * Truncated to milliseconds: JavaScript dates have millisecond precision, and
 * some browsers refuse to parse more fractional digits than that.
 */
@Configuration
public class TimeConfig {

    @Bean
    public SimpleModule utcTimestamps() {
        return new SimpleModule("ping-utc-timestamps").addSerializer(LocalDateTime.class, new ValueSerializer<>() {
            @Override
            public void serialize(LocalDateTime value, JsonGenerator gen, SerializationContext context) {
                gen.writeString(value.truncatedTo(ChronoUnit.MILLIS).toInstant(ZoneOffset.UTC).toString());
            }
        });
    }
}
