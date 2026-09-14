package com.example.pingBackend.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ResetPasswordRequest {

    @NotBlank(message = "This reset link is invalid or has expired.")
    @Size(max = 128, message = "This reset link is invalid or has expired.")
    private String token;

    /**
     * Minimum 6 matches registration, so a password allowed at sign-up is allowed
     * here too — one rule, not two that disagree.
     *
     * Maximum 72 because BCrypt only reads the first 72 bytes of a password and
     * silently ignores the rest. Without a cap, someone could set a 100-character
     * password and later discover that only the first 72 characters ever
     * mattered. Rejecting it up front is honest about the limit.
     */
    @NotBlank(message = "Choose a new password")
    @Size(min = 6, max = 72, message = "Password must be 6 to 72 characters")
    private String newPassword;
}
