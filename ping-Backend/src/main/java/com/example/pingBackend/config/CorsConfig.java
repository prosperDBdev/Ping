package com.example.pingBackend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
public class CorsConfig {

    /**
     * Origins allowed to call this API, from configuration rather than hardcoded.
     *
     * A deployed frontend lives on a different domain from a local one, and CORS
     * is decided by the server — so a hardcoded localhost here means the
     * production site is blocked by your own backend, with an error that appears
     * in the browser and nowhere in your server logs.
     *
     * Note this is a list and not a wildcard. `*` is not an option anyway once
     * allowCredentials is true (browsers reject that combination outright), but
     * the real reason is that an allow-list is the point: it names exactly which
     * sites may make authenticated calls on a visitor's behalf.
     */
    @Value("${app.cors.allowed-origins}")
    private List<String> allowedOrigins;

    // Expose a CorsConfigurationSource bean (NOT a raw CorsFilter bean).
    // SecurityConfig picks this up via .cors(Customizer.withDefaults())
    // and inserts CORS handling as the very first filter in the
    // Spring Security chain -- which is what actually fixes the
    // "blocked by CORS policy" error on preflight (OPTIONS) requests.
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(allowedOrigins);
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}