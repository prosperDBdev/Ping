package com.example.pingBackend.exception;

import org.springframework.http.HttpStatus;

/**
 * The parent of every error this app throws ON PURPOSE.
 *
 * Every exception that means "the request can't be done, and here's why" extends
 * this and carries the HTTP status it should become. The handler then needs just
 * one method for all of them — it reads the status off the exception.
 *
 * WHY THIS EXISTS. The codebase used to throw plain RuntimeException for
 * everything: "User not found", "Username is already taken", "You are not a
 * participant". A plain RuntimeException carries no meaning, so every one of them
 * reached the browser as a 500 Internal Server Error — "the server broke" — when
 * really the user had asked for something that doesn't exist, or already exists.
 * The status code is part of the answer. A 404 tells the frontend "nothing here",
 * a 409 tells it "pick another name", and a 500 tells it nothing at all.
 *
 * The rule of thumb for choosing: if the CALLER could fix it by asking
 * differently, it's a 4xx and belongs in this family. If only a developer could
 * fix it (a bug, the database being down), it's a 500 — don't throw one of these,
 * let it fall through to the handler's catch-all.
 */
public abstract class ApiException extends RuntimeException {

    private final HttpStatus status;

    protected ApiException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public HttpStatus getStatus() {
        return status;
    }
}
