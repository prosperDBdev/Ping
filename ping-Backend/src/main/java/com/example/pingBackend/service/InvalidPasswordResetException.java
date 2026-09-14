package com.example.pingBackend.service;

/**
 * Mapped to HTTP 400. One exception for every way a reset link can be bad —
 * never existed, expired, already used — so the response can't be used to tell
 * those cases apart.
 */
public class InvalidPasswordResetException extends RuntimeException {
    public InvalidPasswordResetException(String message) {
        super(message);
    }
}
