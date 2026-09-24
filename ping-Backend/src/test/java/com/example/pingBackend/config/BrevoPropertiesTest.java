package com.example.pingBackend.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.boot.test.context.assertj.AssertableApplicationContext;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.boot.validation.autoconfigure.ValidationAutoConfiguration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Binding and validation of the brevo.* settings.
 *
 * WHY THIS NEEDS A SPRING CONTEXT AT ALL. Constructing the record directly with
 * `new` would prove nothing: the constraints on it are only annotations until
 * something runs them, and the defaults only apply when Spring's binder is what
 * builds the object. Both of the things worth testing here — that a missing
 * property falls back instead of arriving null, and that a bad one stops the
 * application from starting — exist only in the binding step. So the tests
 * drive the binding step.
 *
 * ApplicationContextRunner is a miniature application context: it starts, binds
 * these properties, and hands back either the bean or the failure, in
 * milliseconds and with no database, no web server and nothing else from the
 * real application in it. That matters because the real context needs MongoDB
 * running, which would make this test about the developer's machine rather than
 * about the configuration.
 *
 * The scan below is deliberately the same annotation, rooted at the same
 * package, as the one on PingBackendApplication — so this also checks that the
 * record is found the way the running application finds it, not just that it
 * binds when pointed at directly.
 */
class BrevoPropertiesTest {

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            // Without the validation auto-configuration there is no Validator
            // bean, and @Validated is quietly skipped — the "fails startup"
            // tests below would then pass for the wrong reason.
            .withConfiguration(AutoConfigurations.of(ValidationAutoConfiguration.class))
            .withUserConfiguration(ScanForProperties.class);

    @ConfigurationPropertiesScan("com.example.pingBackend")
    static class ScanForProperties {
    }

    // ------------------------------------------------------------------ binding

    @Test
    @DisplayName("with no brevo.* properties set, the defaults apply and email is simply off")
    void defaultsApplyWhenNothingIsSet() {
        runner.run(context -> {
            assertNull(context.getStartupFailure(), "an unconfigured Brevo must not stop the application");

            BrevoProperties brevo = context.getBean(BrevoProperties.class);
            assertEquals("", brevo.apiKey());
            assertEquals("", brevo.senderEmail());
            assertEquals("Ping", brevo.senderName());
            assertFalse(brevo.isConfigured());
        });
    }

    @Test
    @DisplayName("configured values bind, and surrounding whitespace is stripped")
    void valuesBindAndAreStripped() {
        runner.withPropertyValues(
                        "brevo.api-key= xkeysib-not-a-real-key ",
                        "brevo.sender-email=ping@example.test",
                        "brevo.sender-name= Ping ")
                .run(context -> {
                    BrevoProperties brevo = context.getBean(BrevoProperties.class);

                    // A trailing space in the API key would otherwise be sent in
                    // the api-key header and come back as a 401 that looks
                    // exactly like a wrong key.
                    assertEquals("xkeysib-not-a-real-key", brevo.apiKey());
                    assertEquals("Ping", brevo.senderName());
                    assertTrue(brevo.isConfigured());
                });
    }

    @Test
    @DisplayName("an API key on its own is not enough to count as configured")
    void anApiKeyWithoutASenderIsNotConfigured() {
        runner.withPropertyValues("brevo.api-key=xkeysib-not-a-real-key")
                .run(context -> assertFalse(context.getBean(BrevoProperties.class).isConfigured()));
    }

    // --------------------------------------------------------------- validation

    @Test
    @DisplayName("a malformed sender address stops the application starting, naming the field")
    void badSenderAddressFailsStartup() {
        runner.withPropertyValues("brevo.sender-email=ping-at-example.test")
                .run(context -> {
                    // The naming matters as much as the failure: this is the
                    // difference between a boot error a developer can act on and
                    // emails that silently never arrive in production.
                    String text = failureText(context);
                    assertTrue(text.contains("senderEmail"), text);
                });
    }

    @Test
    @DisplayName("a blank sender name stops the application starting")
    void blankSenderNameFailsStartup() {
        // Whitespace only: stripped to empty, which is what @NotBlank rejects.
        runner.withPropertyValues("brevo.sender-name=   ")
                .run(context -> assertTrue(failureText(context).contains("senderName")));
    }

    /**
     * The whole cause chain as text. A binding failure arrives wrapped several
     * layers deep, and the field name lives on the innermost one.
     */
    private static String failureText(AssertableApplicationContext context) {
        Throwable failure = context.getStartupFailure();
        assertNotNull(failure, "this configuration should have stopped the application starting");

        StringBuilder text = new StringBuilder();
        for (Throwable cause = failure; cause != null; cause = cause.getCause() == cause ? null : cause.getCause()) {
            text.append(cause.getMessage()).append(System.lineSeparator());
        }
        return text.toString();
    }
}
