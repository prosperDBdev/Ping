package com.example.pingBackend.dto.request;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;
import java.util.stream.IntStream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The group size cap: 200 members, meaning the creator plus 199 others.
 *
 * Tested at the DTO because that's where the cap lives. It has to run before
 * the service looks the ids up, so an enormous list is refused before it can
 * cost a database query.
 */
class CreateGroupRequestValidationTest {

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    private static CreateGroupRequest withOthers(int count) {
        List<String> ids = IntStream.range(0, count).mapToObj(i -> "user-" + i).toList();
        return new CreateGroupRequest("Study group", ids);
    }

    @Test
    @DisplayName("199 other members (200 in total) is allowed")
    void twoHundredAllowed() {
        assertTrue(validator.validate(withOthers(199)).isEmpty());
    }

    @Test
    @DisplayName("200 other members (201 in total) is refused, with a message naming the limit")
    void twoHundredAndOneRefused() {
        Set<ConstraintViolation<CreateGroupRequest>> violations = validator.validate(withOthers(200));

        assertEquals(1, violations.size());
        ConstraintViolation<CreateGroupRequest> v = violations.iterator().next();
        assertEquals("participantIds", v.getPropertyPath().toString());
        assertEquals("A group can have at most 200 members including you", v.getMessage());
    }
}
