package com.example.pingBackend.service;

/** Mapped to HTTP 429 Too Many Requests by GlobalExceptionHandler. */
public class TooManyRequestsException extends RuntimeException {
    public TooManyRequestsException(String message) {
        super(message);
    }
}
