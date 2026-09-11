package com.example.pingBackend.service;

/**
 * Thrown when an uploaded file fails validation (too large, wrong real
 * content type, etc). Mapped to a 400 in MediaController — the caller sent
 * something invalid, that's a client error, not a 500.
 */
public class InvalidMediaException extends RuntimeException {
    public InvalidMediaException(String message) {
        super(message);
    }
}
