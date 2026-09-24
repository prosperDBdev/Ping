package com.example.pingBackend.dto.request;


import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RegisterRequest {

    @NotBlank(message = "Username is required")
    @Size(min = 3, max = 20, message = "Username must be 3-20 characters")
    private String username;

    @NotBlank(message = "Email is required")
    @Email(message = "Email must be valid")
    private String email;

    @NotBlank(message = "Password is required")
    @Size(min = 6, message = "Password must be at least 6 characters")
    private String password;

    /**
     * Optional code from an invite link (Stage 12).
     *
     * Only a size cap here, deliberately no format check. A format annotation
     * would turn a mangled or outdated link into a 400 and block the sign-up,
     * and attribution isn't worth losing a new user over. AppInviteService
     * checks the shape itself and simply ignores anything unusable. The cap
     * just stops someone sending an enormous string.
     */
    @Size(max = 100, message = "That invite code isn't valid")
    private String inviteCode;
}
