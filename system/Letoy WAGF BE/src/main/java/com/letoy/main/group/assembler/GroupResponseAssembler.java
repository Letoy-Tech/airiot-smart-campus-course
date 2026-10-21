package com.letoy.main.group.assembler;

import com.letoy.main.group.dto.response.GroupResponse;
import com.letoy.main.group.entity.GroupsInfo;

public final class GroupResponseAssembler {

    private GroupResponseAssembler() {
    }

    public static GroupResponse toResponse(GroupsInfo group) {
        if (group == null) {
            return null;
        }
        return GroupResponse.builder()
                .id(group.getId())
                .groupId(group.getGroupId())
                .groupName(group.getGroupName())
                .groupDescription(group.getGroupDescription())
                .parentGroupId(group.getParentGroupId())
                .path(group.getPath())
                .level(group.getLevel())
                .sortOrder(group.getSortOrder())
                .status(group.getStatus())
                .createTime(group.getCreateTime())
                .updateTime(group.getUpdateTime())
                .build();
    }
}
