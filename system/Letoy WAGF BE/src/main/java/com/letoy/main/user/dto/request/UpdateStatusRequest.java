package com.letoy.main.user.dto.request;

import lombok.Data;

@Data
public class UpdateStatusRequest {
    private boolean active;
    private boolean accountLocked;
}
