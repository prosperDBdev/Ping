package com.example.pingBackend.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;

/**
 * Authenticates REST requests from the "Authorization: Bearer ..." header.
 *
 * The actual decision — is this token good, and whose is it — lives in
 * TokenAuthenticator, shared with the WebSocket interceptor. This filter only
 * reads the header and records the result. Keeping the rule out of here is what
 * guarantees REST and WebSocket can never disagree about a token again.
 *
 * A missing or bad token doesn't stop the request here. It simply isn't
 * authenticated, and SecurityConfig then decides: public endpoints carry on,
 * everything else gets a 401 from the authentication entry point.
 */
@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {

    private final TokenAuthenticator tokenAuthenticator;

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        String authHeader = request.getHeader("Authorization");

        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            tokenAuthenticator.authenticate(authHeader.substring(7)).ifPresent(user -> {
                UsernamePasswordAuthenticationToken authentication =
                        new UsernamePasswordAuthenticationToken(user, null, Collections.emptyList());
                authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(authentication);
            });
        }

        filterChain.doFilter(request, response);
    }
}
