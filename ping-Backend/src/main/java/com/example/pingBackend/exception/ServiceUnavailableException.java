package com.example.pingBackend.exception;

import org.springframework.http.HttpStatus;

/**
 * 503 — something OUTSIDE this app that we depend on wouldn't answer.
 *
 * This is the one member of the family with a 5xx status, which deserves an
 * explanation given what {@link ApiException} says about 4xx.
 *
 * The rule in ApiException is really about who can fix it, and a downstream
 * outage is a third case: neither the caller's request nor our code is wrong,
 * the email provider is simply refusing right now. Letting it fall through to
 * the handler's catch-all would report it as an unexpected 500 with an error id
 * — telling the user "we have a bug, quote this reference" when the honest
 * answer is "try again in a minute". So it's thrown on purpose, with a message
 * written for a user, exactly like the rest of this family.
 *
 * NOTE ON LOGGING. GlobalExceptionHandler logs ApiException at debug, which is
 * right for the 4xx members (they happen constantly in normal use) but too quiet
 * for this one. Whoever throws it is therefore expected to log the real technical
 * reason at error level FIRST — see EmailService.sendNow. That split is
 * deliberate: the detail that explains the failure is exactly the detail that
 * must not travel back to the client.
 */
public class ServiceUnavailableException extends ApiException {
    public ServiceUnavailableException(String message) {
        super(HttpStatus.SERVICE_UNAVAILABLE, message);
    }
}
