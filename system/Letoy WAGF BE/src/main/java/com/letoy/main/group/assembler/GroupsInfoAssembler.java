package com.letoy.main.group.assembler;

import com.letoy.main.group.dto.request.SaveChildGroupRequest;
import com.letoy.main.group.dto.request.SaveRootGroupRequest;
import com.letoy.main.group.dto.request.UpdateGroupRequest;
import com.letoy.main.group.entity.GroupsInfo;

public final class GroupsInfoAssembler {

    private GroupsInfoAssembler() {
    }

    public static GroupsInfo toRootGroup(SaveRootGroupRequest request) {
        return GroupsInfo.builder()
                .groupId(request.getGroupId())
                .groupName(request.getGroupName())
                .groupDescription(request.getGroupDescription())
                .sortOrder(request.getSortOrder())
                .status(request.getStatus())
                .build();
    }

    public static GroupsInfo toChildGroup(SaveChildGroupRequest request) {
        return GroupsInfo.builder()
                .groupId(request.getGroupId())
                .groupName(request.getGroupName())
                .groupDescription(request.getGroupDescription())
                .parentGroupId(request.getParentGroupId())
                .sortOrder(request.getSortOrder())
                .status(request.getStatus())
                .build();
    }

    public static GroupsInfo toUpdateGroup(String groupId, UpdateGroupRequest request) {
        GroupsInfo group = new GroupsInfo();
        group.setGroupId(groupId);
        group.setGroupName(request.getGroupName());
        group.setGroupDescription(request.getGroupDescription());
        group.setParentGroupId(request.getParentGroupId());
        group.setSortOrder(request.getSortOrder());
        group.setStatus(request.getStatus());
        return group;
    }
}
