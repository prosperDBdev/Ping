package com.example.pingBackend.exception;

import org.springframework.http.HttpStatus;

/** 429 — the caller is doing something too often. Retrying immediately won't help. */
public class TooManyRequestsException extends ApiException {
    public TooManyRequestsException(String message) {
        super(HttpStatus.TOO_MANY_REQUESTS, message);
    }
}
