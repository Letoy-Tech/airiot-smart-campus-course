package com.letoy.main.permission.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ApiRuleResponse {
    private Long id;
    private String name;
    private String pattern;
    private String methods;
    private String groupPolicy;
    private String allowedGroupIds;
    private String groupIdPathVar;
    private String userIdPathVar;
    private Integer priority;
    private Boolean enabled;
    private Date createdAt;
    private Date updatedAt;
}
