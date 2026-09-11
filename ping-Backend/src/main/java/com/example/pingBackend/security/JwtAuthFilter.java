package com.example.pingBackend.security;

import com.example.pingBackend.repository.UserRepository;
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

@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtTokenProvider jwtTokenProvider;
    private final UserRepository userRepository;

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {

        // 1. Get the Authorization header
        String authHeader = request.getHeader("Authorization");

        // 2. Check if it starts with "Bearer "
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            // No token? Let the request continue — SecurityConfig will decide if that's OK
            filterChain.doFilter(request, response);
            return;
        }

        // 3. Extract the token (remove "Bearer " prefix)
        String token = authHeader.substring(7);

        // 4. Validate the token
        if (jwtTokenProvider.validateToken(token)) {

            // 5. Extract username from token
            String username = jwtTokenProvider.getUsernameFromToken(token);

            // 6. Check the user exists in database
            userRepository.findByUsername(username).ifPresent(user -> {

                // 7. Create authentication object and set it in Spring Security context
                UsernamePasswordAuthenticationToken authToken =
                        new UsernamePasswordAuthenticationToken(
                                user,               // The authenticated user
                                null,               // No credentials needed (already verified)
                                Collections.emptyList()  // No roles for now
                        );

                authToken.setDetails(
                        new WebAuthenticationDetailsSource().buildDetails(request)
                );

                // 8. Tell Spring: "This user is authenticated!"
                SecurityContextHolder.getContext().setAuthentication(authToken);
            });
        }

        // 9. Continue to the next filter / controller
        filterChain.doFilter(request, response);
    }
}