package com.example.pingBackend.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/** A 6-digit emailed code, and which pending sign-in (or enable) it's for. */
@Data
public class LoginCodeRequest {

    @NotBlank(message = "Start again to get a new code")
    @Size(max = 100, message = "Start again to get a new code")
    private String challenge;

    @NotBlank(message = "Enter the 6-digit code from the email")
    @Size(max = 10, message = "Enter the 6-digit code from the email")
    private String code;

    /** "Send a new code": only the challenge. */
    @Data
    public static class Resend {
        @NotBlank(message = "Start again to get a new code")
        @Size(max = 100, message = "Start again to get a new code")
        private String challenge;
    }
}
