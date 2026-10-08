package com.example.pingBackend.dto.request;

import lombok.Data;

/** Promote a member to admin, or take that away. */
@Data
public class MakeAdminRequest {

    private boolean makeAdmin = true;
}
