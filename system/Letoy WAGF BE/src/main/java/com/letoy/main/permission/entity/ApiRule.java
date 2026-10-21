package com.letoy.main.permission.entity;

import lombok.Data;
import lombok.NoArgsConstructor;
import java.io.Serializable;
import java.util.Date;
import java.util.List;

@Data
@NoArgsConstructor
public class ApiRule implements Serializable {
    private Long id;
    private String name;
    private String pattern;           // /api/users/{userId}
    private String methods;           // 逗号分隔：GET,POST（为空=不限）
    private String groupPolicy;       // ANY / ALLOWLIST / DIRECT_PATH / BY_USER_GROUP
    private String allowedGroupIds;   // 逗号分隔
    private String groupIdPathVar;    // DIRECT_PATH
    private String userIdPathVar;     // BY_USER_GROUP
    private Integer priority;         // 越大越优先
    private Boolean enabled;
    private Date createdAt;
    private Date updatedAt;
}
