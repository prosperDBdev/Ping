package com.example.pingBackend.service;

import com.example.pingBackend.model.User;
import com.example.pingBackend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

class BroadcastServiceTest {

    private UserRepository userRepository;
    private EmailService emailService;
    private BroadcastService broadcastService;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        emailService = mock(EmailService.class);
        broadcastService = new BroadcastService(userRepository, emailService);
    }

    @Test
    @DisplayName("Sends broadcast to registered users with valid emails")
    void sendBroadcastToValidUsers() {
        User u1 = User.builder().id("1").email("user1@example.com").build();
        User u2 = User.builder().id("2").email("user2@example.com").build();
        User u3 = User.builder().id("3").email("").build();

        when(userRepository.findAll()).thenReturn(List.of(u1, u2, u3));

        BroadcastService.BroadcastResult result = broadcastService.sendBroadcast("Custom Subject", "Custom Message");

        assertNotNull(result);
        assertEquals(2, result.totalRecipients());
        verify(emailService, times(2)).sendNow(anyString(), anyString(), anyString(), Mockito.nullable(List.class));
    }

    @Test
    @DisplayName("Handles empty user list gracefully")
    void sendBroadcastNoUsers() {
        when(userRepository.findAll()).thenReturn(List.of());

        BroadcastService.BroadcastResult result = broadcastService.sendBroadcast(null, null);

        assertNotNull(result);
        assertEquals(0, result.totalRecipients());
        verify(emailService, never()).sendNow(anyString(), anyString(), anyString(), any());
    }
}
