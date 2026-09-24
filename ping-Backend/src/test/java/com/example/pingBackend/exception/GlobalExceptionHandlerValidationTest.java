package com.example.pingBackend.exception;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.core.MethodParameter;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.validation.BeanPropertyBindingResult;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.context.request.ServletWebRequest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * What a failed @Valid check is allowed to say back to the client.
 *
 * THE BUG THIS PINS DOWN. The handler used to pass every field error's default
 * message straight through. For an annotation failure that's the sentence
 * written on the DTO, which is the intended behaviour. But for a CONVERSION
 * failure — a value that can't be turned into the field's type, such as an
 * unrecognised enum constant — the default message is Spring's own, and Spring's
 * own names the Java type:
 *
 *   "...to required type 'com.example.pingBackend.dto.request.FeedbackRequest$FeedbackType'"
 *
 * So sending one bad form value revealed the package structure, a DTO's class
 * name and the shape of the field behind it. It was found by sending
 * "type=NOT_A_REAL_TYPE" to the feedback endpoint and reading the response body.
 *
 * Both kinds are exercised here because the fix has to keep the useful half.
 */
class GlobalExceptionHandlerValidationTest {

    /** Stands in for any request DTO; only its property names matter here. */
    static class Form {
        private String type;
        private String message;

        public String getType() { return type; }
        public void setType(String type) { this.type = type; }
        public String getMessage() { return message; }
        public void setMessage(String message) { this.message = message; }
    }

    /** Exists only so a MethodParameter can be built from it. */
    @SuppressWarnings("unused")
    private void endpoint(Form form) {
    }

    private ApiErrorResponse handle(FieldError... errors) throws Exception {
        BeanPropertyBindingResult binding = new BeanPropertyBindingResult(new Form(), "form");
        for (FieldError error : errors) {
            binding.addError(error);
        }

        MethodParameter parameter = new MethodParameter(
                getClass().getDeclaredMethod("endpoint", Form.class), 0);

        ResponseEntity<Object> response = new GlobalExceptionHandler().handleMethodArgumentNotValid(
                new MethodArgumentNotValidException(parameter, binding),
                new HttpHeaders(),
                HttpStatus.BAD_REQUEST,
                new ServletWebRequest(new MockHttpServletRequest("POST", "/api/feedback")));

        return assertInstanceOf(ApiErrorResponse.class, response.getBody());
    }

    /** A value that couldn't be converted into the field's type. */
    private static FieldError conversionFailure() {
        return new FieldError("form", "type", "NOT_A_REAL_TYPE", true,
                new String[]{"typeMismatch"}, null,
                "Failed to convert property value of type 'java.lang.String' to required type "
                        + "'com.example.pingBackend.dto.request.FeedbackRequest$FeedbackType' for property 'type'");
    }

    /** A value that converted fine but failed an annotation. */
    private static FieldError annotationFailure() {
        return new FieldError("form", "message", "", false,
                null, null, "Please tell us a little about it");
    }

    @Test
    @DisplayName("a conversion failure never names the Java type behind the field")
    void conversionFailureHidesTheType() throws Exception {
        ApiErrorResponse body = handle(conversionFailure());

        String whole = body.message() + " " + body.fieldErrors();
        assertFalse(whole.contains("com.example"), whole);
        assertFalse(whole.contains("FeedbackRequest"), whole);
        assertFalse(whole.contains("java.lang"), whole);
        assertFalse(whole.contains("$"), whole);
    }

    @Test
    @DisplayName("...but still says which field the caller has to fix")
    void conversionFailureStillNamesTheField() throws Exception {
        ApiErrorResponse body = handle(conversionFailure());

        assertTrue(body.fieldErrors().containsKey("type"), String.valueOf(body.fieldErrors()));
        assertTrue(body.message().contains("type"), body.message());
    }

    @Test
    @DisplayName("an annotation failure keeps the message written on the DTO")
    void annotationFailureIsPassedThrough() throws Exception {
        ApiErrorResponse body = handle(annotationFailure());

        assertEquals("Please tell us a little about it", body.message());
        assertEquals("Please tell us a little about it", body.fieldErrors().get("message"));
    }

    @Test
    @DisplayName("a mix of both is handled per field, and the status stays 400")
    void mixedFailures() throws Exception {
        ApiErrorResponse body = handle(conversionFailure(), annotationFailure());

        assertEquals(400, body.status());
        assertEquals("Please tell us a little about it", body.fieldErrors().get("message"));
        assertFalse(body.fieldErrors().get("type").contains("com.example"),
                body.fieldErrors().get("type"));
    }
}
