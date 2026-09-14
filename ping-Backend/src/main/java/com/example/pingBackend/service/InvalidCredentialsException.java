package com.example.pingBackend.service;

/**
 * Wrong username or password. Mapped to 401.
 *
 * It used to be a plain RuntimeException, which reached the browser as a 500 —
 * "the server broke" for what is really "those details are wrong". One
 * exception covers both an unknown username and a wrong password, on purpose:
 * telling them apart would reveal which usernames exist.
 */
public class InvalidCredentialsException extends RuntimeException {
    public InvalidCredentialsException(String message) {
        super(message);
    }
}
