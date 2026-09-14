package com.example.pingBackend.exception;

import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.ServletWebRequest;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Turns every exception from a REST controller into a clean JSON error response.
 *
 * @RestControllerAdvice means "apply these handlers to every controller". When a
 * controller (or anything it calls) throws, Spring looks here for the handler
 * whose exception type matches most closely, and uses its return value as the
 * response.
 *
 * THREE KINDS OF ERROR, handled three ways:
 *
 *   1. OUR OWN (ApiException and its children). Thrown on purpose, each carrying
 *      its status. The message is written for users, so it's passed straight
 *      through.
 *
 *   2. SPRING'S OWN — wrong HTTP method (405), file too large (413), unreadable
 *      JSON (400), failed @Valid checks (400). This class EXTENDS
 *      ResponseEntityExceptionHandler, which already knows the correct status for
 *      every one of them. A plain "catch Exception" handler would have turned all
 *      of those into 500s. Extending it keeps Spring's correct statuses and just
 *      reshapes the body into ApiErrorResponse.
 *
 *   3. EVERYTHING ELSE — a bug, a null pointer, the database being down. The
 *      client gets a generic message and a short error id; the full stack trace
 *      is logged against that id. Two reasons it never sends the real details:
 *      they mean nothing to a user, and they're exactly what an attacker probes
 *      for — class names, library versions, query fragments, file paths. Security
 *      testers flag this as "information disclosure".
 *
 * The previous version of this class deliberately avoided a catch-all, worried it
 * would hide real bugs behind a friendly message. That worry is right about a
 * catch-all that stays SILENT. This one logs every unexpected error in full with
 * an id to find it by, so nothing is hidden from the people who need to see it —
 * only from the people who shouldn't.
 *
 * Scope: REST controllers only. Errors inside WebSocket message handlers and in
 * security filters (such as a missing token) happen outside this mechanism.
 */
@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

    // ------------------------------------------------------------------ 1. ours

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ApiErrorResponse> handleApiException(ApiException ex, HttpServletRequest request) {
        // 4xx errors are the client's to fix and happen constantly in normal use —
        // wrong passwords, taken usernames. Logging each at WARN or ERROR would bury
        // real problems, and would let anyone flood the logs just by sending bad
        // requests. Debug level keeps them available without the noise.
        log.debug("{} {} -> {} {}", request.getMethod(), request.getRequestURI(), ex.getStatus().value(), ex.getMessage());
        return respond(ex.getStatus(), ex.getMessage(), request.getRequestURI(), null, null);
    }

    /**
     * A unique index refused a write because the value already exists.
     *
     * This is the database catching a race the code couldn't: two people
     * registering the same username at the same instant both pass the "is it
     * taken?" check, and only the unique index stops the second. Services that can
     * say something more specific (AuthService does) catch this themselves; this is
     * the fallback for anywhere else.
     */
    @ExceptionHandler(DuplicateKeyException.class)
    public ResponseEntity<ApiErrorResponse> handleDuplicateKey(DuplicateKeyException ex, HttpServletRequest request) {
        return respond(HttpStatus.CONFLICT, "That already exists.", request.getRequestURI(), null, null);
    }

    // ------------------------------------------------------- 3. everything else

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiErrorResponse> handleUnexpected(Exception ex, HttpServletRequest request) {
        // A short id ties what the user sees to the full error in the log: someone
        // reports "error 3f9a1c2e" and you can find exactly what happened.
        String errorId = UUID.randomUUID().toString().substring(0, 8);
        log.error("Unexpected error [{}] on {} {}", errorId, request.getMethod(), request.getRequestURI(), ex);
        return respond(HttpStatus.INTERNAL_SERVER_ERROR,
                "Something went wrong on our side. If it keeps happening, quote error " + errorId + ".",
                request.getRequestURI(), null, errorId);
    }

    // ------------------------------------------------------- 2. Spring's own

    /**
     * A @Valid request body failed its checks, e.g. a password that's too short.
     *
     * The message is the first failure, using the text written on the DTO's
     * annotation ("Password must be at least 6 characters"), so a form can show it
     * as-is. fieldErrors lists every failing field, for forms that want to mark each
     * input.
     */
    @Override
    protected ResponseEntity<Object> handleMethodArgumentNotValid(
            MethodArgumentNotValidException ex, HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        Map<String, String> fieldErrors = new LinkedHashMap<>();
        ex.getBindingResult().getFieldErrors()
                .forEach(error -> fieldErrors.putIfAbsent(error.getField(), error.getDefaultMessage()));

        String message = fieldErrors.values().stream().findFirst()
                .orElse("Some of the details you sent aren't valid.");

        return asObject(respond(HttpStatus.BAD_REQUEST, message, pathOf(request), fieldErrors, null));
    }

    /**
     * Every other exception Spring handles comes through here, already assigned its
     * correct status. All that's left is putting it in our shape.
     */
    @Override
    protected ResponseEntity<Object> handleExceptionInternal(
            Exception ex, Object body, HttpHeaders headers, HttpStatusCode statusCode, WebRequest request) {

        String message;
        if (statusCode.is4xxClientError() && body instanceof ProblemDetail problem && problem.getDetail() != null) {
            // Spring's 4xx details are written to be client-safe ("Maximum upload size exceeded").
            message = problem.getDetail();
        } else {
            message = defaultMessageFor(statusCode);
        }

        if (statusCode.is5xxServerError()) {
            log.error("Server error on {}", pathOf(request), ex);
        }

        HttpStatus status = HttpStatus.resolve(statusCode.value());
        ApiErrorResponse response = new ApiErrorResponse(
                Instant.now().toString(), statusCode.value(),
                status != null ? status.getReasonPhrase() : "Error",
                message, pathOf(request), null, null);

        // Keep Spring's headers — a 405 carries an Allow header listing the methods
        // that WOULD work, which is genuinely useful to a client.
        return ResponseEntity.status(statusCode).headers(headers).body(response);
    }

    // ------------------------------------------------------------------ helpers

    private static ResponseEntity<ApiErrorResponse> respond(
            HttpStatus status, String message, String path, Map<String, String> fieldErrors, String errorId) {
        return ResponseEntity.status(status).body(new ApiErrorResponse(
                Instant.now().toString(), status.value(), status.getReasonPhrase(),
                message, path, fieldErrors, errorId));
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private static ResponseEntity<Object> asObject(ResponseEntity<ApiErrorResponse> entity) {
        return (ResponseEntity) entity;
    }

    private static String pathOf(WebRequest request) {
        return request instanceof ServletWebRequest servlet ? servlet.getRequest().getRequestURI() : null;
    }

    private static String defaultMessageFor(HttpStatusCode status) {
        return switch (status.value()) {
            case 404 -> "There's nothing at this address.";
            case 405 -> "That action isn't supported here.";
            case 413 -> "That file is too large.";
            case 415 -> "That type of content isn't supported.";
            default -> status.is5xxServerError()
                    ? "Something went wrong on our side. Please try again."
                    : "That request couldn't be completed.";
        };
    }
}
