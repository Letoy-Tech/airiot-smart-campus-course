package com.letoy.main.permission.entity;

public enum GroupPolicy {
    ANY,           // 无需 group 校验
    ALLOWLIST,     // 调用者 groupIds 与 allowedGroupIds 有交集即可
    DIRECT_PATH,   // 路径中携带 groupId，要求 groupId ∈ 调用者 groupIds
    BY_USER_GROUP  // 路径中携带 userId，要求 调用者 groupIds ∩ 目标用户 groupIds ≠ ∅
}