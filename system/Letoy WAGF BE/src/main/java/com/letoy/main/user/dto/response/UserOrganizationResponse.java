package com.letoy.main.user.dto.response;

import com.letoy.main.group.dto.response.GroupResponse;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserOrganizationResponse {
    private String uid;
    private String username;
    private String nickname;
    private String groupIds;
    private String roles;
    private Boolean active;
    private Boolean accountLocked;
    private List<GroupResponse> groups;
}
