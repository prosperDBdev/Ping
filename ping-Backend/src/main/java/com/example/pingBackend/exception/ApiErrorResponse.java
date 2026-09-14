package com.example.pingBackend.exception;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.Map;

/**
 * The ONE shape every error response has, whatever went wrong.
 *
 *   {
 *     "timestamp": "2026-09-14T15:02:11Z",
 *     "status": 409,
 *     "error": "Conflict",
 *     "message": "That username is already taken",
 *     "path": "/api/auth/register"
 *   }
 *
 * WHY ONE SHAPE. Before this, a thrown exception, a validation failure and a
 * wrong HTTP method each came back looking different — sometimes with a
 * "message", sometimes without. The frontend had to guess, and usually fell back
 * to "Something went wrong". With one shape, the frontend reads `message` and
 * shows it, every time.
 *
 * `message` is always safe to show a user. `fieldErrors` appears only for form
 * validation, naming each field that failed. `errorId` appears only on 500s — see
 * GlobalExceptionHandler.handleUnexpected.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiErrorResponse(
        String timestamp,
        int status,
        String error,
        String message,
        String path,
        Map<String, String> fieldErrors,
        String errorId
) {
}
