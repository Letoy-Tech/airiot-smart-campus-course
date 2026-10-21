package com.letoy.main.role.controller;

import com.letoy.main.common.dto.ApiResponse;
import com.letoy.main.role.assembler.RoleInfoAssembler;
import com.letoy.main.role.assembler.RoleResponseAssembler;
import com.letoy.main.role.dto.request.AssignUserRolesRequest;
import com.letoy.main.role.dto.request.SaveRoleRequest;
import com.letoy.main.role.dto.response.RoleResponse;
import com.letoy.main.role.service.RoleInfoService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/roles")
@Tag(name = "Role management")
public class RoleInfoController {

    private final RoleInfoService roleInfoService;

    public RoleInfoController(RoleInfoService roleInfoService) {
        this.roleInfoService = roleInfoService;
    }

    @GetMapping
    @Operation(summary = "List roles")
    public ApiResponse<List<RoleResponse>> list(@RequestParam(required = false) String roleName,
                                                @RequestParam(required = false) Integer status) {
        return ApiResponse.success(roleInfoService.listRoles(roleName, status).stream()
                .map(RoleResponseAssembler::toResponse)
                .toList());
    }

    @GetMapping("/{roleCode}")
    @Operation(summary = "Get role by code")
    public ApiResponse<RoleResponse> get(@PathVariable String roleCode) {
        return ApiResponse.success(RoleResponseAssembler.toResponse(roleInfoService.getRole(roleCode)));
    }

    @PostMapping
    @Operation(summary = "Create role")
    public ApiResponse<RoleResponse> create(@Valid @RequestBody SaveRoleRequest request) {
        return ApiResponse.success(RoleResponseAssembler.toResponse(
                roleInfoService.createRole(RoleInfoAssembler.toRoleInfo(request))
        ));
    }

    @PutMapping("/{roleCode}")
    @Operation(summary = "Update role")
    public ApiResponse<RoleResponse> update(@PathVariable String roleCode,
                                            @Valid @RequestBody SaveRoleRequest request) {
        return ApiResponse.success(RoleResponseAssembler.toResponse(
                roleInfoService.updateRole(RoleInfoAssembler.toRoleInfo(roleCode, request))
        ));
    }

    @DeleteMapping("/{roleCode}")
    @Operation(summary = "Delete role")
    public ApiResponse<Void> delete(@PathVariable String roleCode) {
        roleInfoService.deleteRole(roleCode);
        return ApiResponse.success();
    }

    @GetMapping("/users/{uid}")
    @Operation(summary = "Get roles assigned to user")
    public ApiResponse<List<RoleResponse>> getUserRoles(@PathVariable String uid) {
        return ApiResponse.success(roleInfoService.getUserRoles(uid).stream()
                .map(RoleResponseAssembler::toResponse)
                .toList());
    }

    @PutMapping("/users/{uid}")
    @Operation(summary = "Assign roles to user")
    public ApiResponse<Void> assignRoles(@PathVariable String uid,
                                         @Valid @RequestBody AssignUserRolesRequest request) {
        roleInfoService.assignRoles(uid, request.getRoleCodes());
        return ApiResponse.success();
    }
}
