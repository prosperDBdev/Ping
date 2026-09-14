package com.example.pingBackend.exception;

import org.springframework.http.HttpStatus;

/**
 * 401 — wrong username or password.
 *
 * One exception covers both an unknown username and a wrong password, on purpose:
 * telling them apart would reveal which usernames exist.
 */
public class InvalidCredentialsException extends ApiException {
    public InvalidCredentialsException(String message) {
        super(HttpStatus.UNAUTHORIZED, message);
    }
}
