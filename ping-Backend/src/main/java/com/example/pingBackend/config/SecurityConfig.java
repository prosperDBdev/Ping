package com.example.pingBackend.config;

import com.example.pingBackend.security.JwtAuthFilter;
import jakarta.servlet.DispatcherType;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                // Wire in the CorsConfigurationSource bean from CorsConfig.
                // This is the missing piece: without it, Spring Security's
                // filter chain runs before CORS headers are ever attached,
                // so preflight (OPTIONS) requests get rejected by the
                // authorization rules below instead of reaching your API.
                .cors(Customizer.withDefaults()) 

                // Disable CSRF (we use JWT, not cookies)
                .csrf(csrf -> csrf.disable())

                // Set session management to stateless (no server-side sessions)
                .sessionManagement(session ->
                        session.sessionCreationPolicy(SessionCreationPolicy.STATELESS)
                )

                // Set authorization rules
                .authorizeHttpRequests(auth -> auth
                        // Always allow CORS preflight requests through, for ANY endpoint
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()

                        // Let Spring's error dispatch through.
                        //
                        // This is not a convenience. When a controller throws
                        // anything the global handler doesn't map, Spring
                        // FORWARDS the request internally to /error to build
                        // the response — and that forward re-enters this filter
                        // chain. The JWT filter doesn't run on an ERROR
                        // dispatch and the session is stateless, so there is no
                        // authentication on it, and `anyRequest().authenticated()`
                        // rejects it.
                        //
                        // The result was that EVERY genuine 500 in this
                        // application reached the browser as an empty 403.
                        // A server bug looked identical to a permissions
                        // problem, which is about the most misleading pair of
                        // things two failures could be confused for — it sent
                        // us looking at the blocking rules when the actual
                        // cause was an exception in the service layer.
                        //
                        // Matching on the dispatcher type rather than adding
                        // "/error" to the permit list is the narrow version:
                        // it allows Spring's internal forward and still leaves
                        // a direct request to /error requiring a token.
                        .dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()

                        // PUBLIC endpoints — no token needed
                        .requestMatchers("/api/auth/**").permitAll()     // Register, Login
                        .requestMatchers("/ws/**").permitAll()            // WebSocket
                        .requestMatchers("/api/health").permitAll()       // Health check

                        // EVERYTHING else — token required
                        .anyRequest().authenticated()
                )

                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint((request, response, authException) ->
                                response.setStatus(HttpServletResponse.SC_UNAUTHORIZED))
                )

                // Add our JWT filter BEFORE Spring's default auth filter
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    // BCrypt password encoder — used to hash passwords
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    // Authentication manager — needed for login
    @Bean
    public AuthenticationManager authenticationManager(
            AuthenticationConfiguration config
    ) throws Exception {
        return config.getAuthenticationManager();
    }
}