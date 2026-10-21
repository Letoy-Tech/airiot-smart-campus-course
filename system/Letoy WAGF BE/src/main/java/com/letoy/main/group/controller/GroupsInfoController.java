package com.letoy.main.group.controller;

import com.github.pagehelper.PageInfo;
import com.letoy.main.common.assembler.PageResponseAssembler;
import com.letoy.main.common.dto.ApiResponse;
import com.letoy.main.common.dto.response.PageResponse;
import com.letoy.main.group.assembler.GroupsInfoAssembler;
import com.letoy.main.group.assembler.GroupResponseAssembler;
import com.letoy.main.group.dto.request.QueryGroupsRequest;
import com.letoy.main.group.dto.request.SaveChildGroupRequest;
import com.letoy.main.group.dto.request.SaveRootGroupRequest;
import com.letoy.main.group.dto.request.UpdateGroupRequest;
import com.letoy.main.group.dto.response.GroupResponse;
import com.letoy.main.group.entity.GroupsInfo;
import com.letoy.main.group.service.GroupsInfoService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/groups")
@RequiredArgsConstructor
@Validated
@Tag(name = "Group management")
public class GroupsInfoController {

    private final GroupsInfoService groupsInfoService;

    @PostMapping("/root")
    @Operation(summary = "Create a root group")
    public ApiResponse<GroupResponse> createRoot(@Valid @RequestBody SaveRootGroupRequest request) {
        var group = GroupsInfoAssembler.toRootGroup(request);
        groupsInfoService.createRoot(group);
        return ApiResponse.success(GroupResponseAssembler.toResponse(
                groupsInfoService.getByGroupId(request.getGroupId())
        ));
    }

    @PostMapping("/child")
    @Operation(summary = "Create a child group")
    public ApiResponse<GroupResponse> createChild(@Valid @RequestBody SaveChildGroupRequest request) {
        var group = GroupsInfoAssembler.toChildGroup(request);
        groupsInfoService.createChild(group);
        return ApiResponse.success(GroupResponseAssembler.toResponse(
                groupsInfoService.getByGroupId(request.getGroupId())
        ));
    }

    @PutMapping("/{groupId}")
    @Operation(summary = "Update a group")
    public ApiResponse<GroupResponse> update(@PathVariable String groupId,
                                             @Valid @RequestBody UpdateGroupRequest request) {
        var group = GroupsInfoAssembler.toUpdateGroup(groupId, request);
        groupsInfoService.updateByGroupIdWithAutoMove(group);
        return ApiResponse.success(GroupResponseAssembler.toResponse(groupsInfoService.getByGroupId(groupId)));
    }

    @GetMapping("/id/{id}")
    @Operation(summary = "Get a group by numeric id")
    public ApiResponse<GroupResponse> getById(@PathVariable Long id) {
        return ApiResponse.success(GroupResponseAssembler.toResponse(groupsInfoService.getById(id)));
    }

    @GetMapping("/{groupId}")
    @Operation(summary = "Get a group by group id")
    public ApiResponse<GroupResponse> getByGroupId(@PathVariable String groupId) {
        return ApiResponse.success(GroupResponseAssembler.toResponse(groupsInfoService.getByGroupId(groupId)));
    }

    @GetMapping("/{groupId}/children")
    @Operation(summary = "List direct child groups")
    public ApiResponse<List<GroupResponse>> children(@PathVariable String groupId) {
        return ApiResponse.success(groupsInfoService.listChildren(groupId).stream()
                .map(GroupResponseAssembler::toResponse)
                .toList());
    }

    @GetMapping("/{groupId}/subtree")
    @Operation(summary = "List the full subtree under a group")
    public ApiResponse<List<GroupResponse>> subtree(@PathVariable String groupId) {
        return ApiResponse.success(groupsInfoService.listSubtree(groupId).stream()
                .map(GroupResponseAssembler::toResponse)
                .toList());
    }

    @GetMapping("/all")
    @Operation(summary = "List all groups")
    public ApiResponse<List<GroupResponse>> all() {
        return ApiResponse.success(groupsInfoService.getAllGroups().stream()
                .map(GroupResponseAssembler::toResponse)
                .toList());
    }

    @PostMapping("/query")
    @Operation(summary = "Query groups with pagination")
    public ApiResponse<PageResponse<GroupResponse>> query(@Valid @RequestBody QueryGroupsRequest request) {
        PageInfo<GroupsInfo> pageInfo = groupsInfoService.pageByCondition(
                request.getCurrentPage(),
                request.getPageSize(),
                request.getGroupName(),
                request.getParentGroupId()
        );
        return ApiResponse.success(PageResponseAssembler.toPageResponse(
                pageInfo,
                GroupResponseAssembler::toResponse
        ));
    }

    @DeleteMapping("/{groupId}")
    @Operation(summary = "Delete a group")
    public ApiResponse<Void> delete(@PathVariable String groupId) {
        groupsInfoService.deleteByGroupId(groupId);
        return ApiResponse.success();
    }
}
