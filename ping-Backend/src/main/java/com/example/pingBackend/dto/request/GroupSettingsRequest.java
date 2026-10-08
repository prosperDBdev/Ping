package com.example.pingBackend.dto.request;

import jakarta.validation.constraints.Pattern;
import lombok.Data;

/** Who may add people to this group. */
@Data
public class GroupSettingsRequest {

    @Pattern(regexp = "ADMINS_ONLY|EVERYONE", message = "Must be ADMINS_ONLY or EVERYONE")
    private String addMembersBy;
}
