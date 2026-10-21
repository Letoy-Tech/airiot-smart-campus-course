package com.letoy.main.user.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.letoy.main.group.entity.GroupsInfo;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serial;
import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(name = "UserInfo", description = "Template user entity")
public class UserInfo implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

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
    @JsonIgnore
    private String password;
    private Boolean active;
    private String token;
    private String refreshToken;
    private LocalDateTime createTime;
    private Integer tokenVersion;
    private LocalDateTime lastPasswordChangeAt;
    private Boolean accountLocked;
    private List<GroupsInfo> groups;

    @JsonIgnore
    public List<String> getGroupIdList() {
        if (groupIds == null || groupIds.isBlank()) {
            return Collections.emptyList();
        }
        return Arrays.stream(groupIds.split(","))
                .map(String::trim)
                .filter(value -> !value.isEmpty())
                .collect(Collectors.toList());
    }

    @JsonIgnore
    public List<String> getRoleList() {
        if (roles == null || roles.isBlank()) {
            return Collections.emptyList();
        }
        return Arrays.stream(roles.split(","))
                .map(String::trim)
                .filter(value -> !value.isEmpty())
                .collect(Collectors.toList());
    }
}
