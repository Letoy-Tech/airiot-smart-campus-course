package com.letoy.main.user.dto.response;

import com.letoy.main.group.dto.response.GroupResponse;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserResponse {
    private String uid;
    private String username;
    private String phoneNumber;
    private String email;
    private String nickname;
    private String avatar;
    private String description;
    private Integer gender;
    private String groupIds;
    private String roles;
    private Boolean active;
    private String token;
    private String refreshToken;
    private LocalDateTime createTime;
    private Integer tokenVersion;
    private LocalDateTime lastPasswordChangeAt;
    private Boolean accountLocked;
    private List<GroupResponse> groups;
}
