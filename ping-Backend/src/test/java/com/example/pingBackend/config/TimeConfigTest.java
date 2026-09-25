package com.example.pingBackend.config;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Timestamps must leave the server as absolute moments ("...Z"). Without the
 * zone, browsers read them as local time and every message showed at the
 * wrong hour for anyone outside UTC.
 */
class TimeConfigTest {

    private final JsonMapper mapper = JsonMapper.builder()
            .addModule(new TimeConfig().utcTimestamps())
            .build();

    @Test
    void writesUtcWithZoneAndMillisecondPrecision() {
        LocalDateTime sent = LocalDateTime.of(2026, 9, 25, 18, 55, 32, 354_194_018);

        assertThat(mapper.writeValueAsString(Map.of("createdAt", sent)))
                .isEqualTo("{\"createdAt\":\"2026-09-25T18:55:32.354Z\"}");
    }

    @Test
    void wholeSecondsStillParseAsTheSameInstant() {
        String json = mapper.writeValueAsString(LocalDateTime.of(2026, 1, 1, 0, 0));

        // Instant.toString drops a zero fraction; still a valid ISO instant.
        assertThat(json).isEqualTo("\"2026-01-01T00:00:00Z\"");
        assertThat(Instant.parse(json.replace("\"", ""))).isEqualTo(Instant.parse("2026-01-01T00:00:00Z"));
    }

    @Test
    void nullStaysNull() {
        Map<String, LocalDateTime> body = new java.util.HashMap<>();
        body.put("editedAt", null);
        assertThat(mapper.writeValueAsString(body)).isEqualTo("{\"editedAt\":null}");
    }
}
