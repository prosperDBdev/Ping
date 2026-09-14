package com.example.pingBackend.exception;

import com.example.pingBackend.service.BlockedUserException;
import com.example.pingBackend.service.ForbiddenMediaAccessException;
import com.example.pingBackend.service.InvalidCredentialsException;
import com.example.pingBackend.service.InvalidMediaException;
import com.example.pingBackend.service.InvalidPasswordResetException;
import com.example.pingBackend.service.TooManyRequestsException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

/**
 * Application-wide error mapping.
 *
 * Currently narrow on purpose — it handles the exceptions that have a
 * meaningful HTTP status, and deliberately does NOT catch RuntimeException
 * broadly. A blanket handler would flatten every distinct failure in the
 * codebase into one response shape and hide genuine 500s behind a friendly
 * message, which is how real bugs go unnoticed.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    /**
     * 403, not 404: the caller is authenticated and the resource exists, they
     * are simply not allowed to act on it.
     */
    @ExceptionHandler(BlockedUserException.class)
    public ResponseEntity<Map<String, String>> handleBlocked(BlockedUserException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("message", ex.getMessage()));
    }

    /**
     * Moved up here from MediaController when statuses started throwing the
     * same two exceptions.
     *
     * A @ExceptionHandler declared inside a controller only applies to that
     * controller, so leaving them there would have meant StatusController's
     * identical failures falling through to a generic 500 — the caller getting
     * "server error" for what is really "you may not see this". Handling both
     * centrally means any future endpoint that rejects a request for these
     * reasons gets the right status code without having to remember to.
     */
    @ExceptionHandler(ForbiddenMediaAccessException.class)
    public ResponseEntity<Map<String, String>> handleForbiddenMedia(ForbiddenMediaAccessException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("message", ex.getMessage()));
    }

    /**
     * 401 — the sign-in details were wrong. Not 403 (that means "we know who you
     * are and the answer is no") and not 500 (nothing broke).
     */
    @ExceptionHandler(InvalidCredentialsException.class)
    public ResponseEntity<Map<String, String>> handleInvalidCredentials(InvalidCredentialsException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("message", ex.getMessage()));
    }

    /** 429 — the caller is doing something too often. Retrying immediately won't help. */
    @ExceptionHandler(TooManyRequestsException.class)
    public ResponseEntity<Map<String, String>> handleTooManyRequests(TooManyRequestsException ex) {
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .body(Map.of("message", ex.getMessage()));
    }

    @ExceptionHandler(InvalidPasswordResetException.class)
    public ResponseEntity<Map<String, String>> handleInvalidPasswordReset(InvalidPasswordResetException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of("message", ex.getMessage()));
    }

    @ExceptionHandler(InvalidMediaException.class)
    public ResponseEntity<Map<String, String>> handleInvalidMedia(InvalidMediaException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of("message", ex.getMessage()));
    }
}
