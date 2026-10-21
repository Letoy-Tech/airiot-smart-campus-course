package com.letoy.main.permission.controller;

import com.alibaba.fastjson2.JSON;
import com.alibaba.fastjson2.TypeReference;
import com.github.pagehelper.PageInfo;
import com.letoy.main.common.assembler.PageResponseAssembler;
import com.letoy.main.common.dto.response.PageResponse;
import com.letoy.main.permission.assembler.ApiRuleAssembler;
import com.letoy.main.permission.assembler.ApiRuleResponseAssembler;
import com.letoy.main.permission.dto.request.ApiRuleCreateRequest;
import com.letoy.main.permission.dto.request.ApiRuleQueryRequest;
import com.letoy.main.permission.dto.request.ApiRuleUpdateRequest;
import com.letoy.main.permission.dto.response.ApiRuleResponse;
import com.letoy.main.permission.entity.ApiRule;
import com.letoy.main.permission.service.ApiRuleService;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.annotation.Resource;
import java.util.HashMap;

@Tag(name = "API規則管理接口")
@RestController
@RequestMapping("/security/api-rules")
public class ApiRuleController {

    @Resource
    private ApiRuleService apiRuleService;

    @PostMapping("/get-all")
    @Operation(summary = "獲取所有API規則（分頁）")
    public ResponseEntity<PageResponse<ApiRuleResponse>> list(@RequestBody String requestData) {
        HashMap<String, Object> data = JSON.parseObject(requestData, new TypeReference<>() {
        });
        PageInfo<ApiRule> pageInfo = apiRuleService.listAll((int) data.get("currentPage"), (int) data.get("pageSize"));
        return ResponseEntity.ok(PageResponseAssembler.toPageResponse(
                pageInfo,
                ApiRuleResponseAssembler::toResponse
        ));
    }

    @PostMapping("/query")
    @Operation(summary = "查詢API規則（支持篩選，按創建時間倒序）")
    public ResponseEntity<PageResponse<ApiRuleResponse>> query(@Valid @RequestBody ApiRuleQueryRequest dto) {
        PageInfo<ApiRule> pageInfo = apiRuleService.queryWithFilter(dto);
        return ResponseEntity.ok(PageResponseAssembler.toPageResponse(
                pageInfo,
                ApiRuleResponseAssembler::toResponse
        ));
    }

    @GetMapping("/{id}")
    @Operation(summary = "獲取API規則詳情")
    public ResponseEntity<ApiRuleResponse> get(
            @Parameter(description = "規則ID", example = "1", required = true) @PathVariable Long id) {
        var r = apiRuleService.getById(id);
        return (r == null) ? ResponseEntity.notFound().build() : ResponseEntity.ok(ApiRuleResponseAssembler.toResponse(r));
    }

    @PostMapping
    @Operation(summary = "創建API規則")
    public ResponseEntity<Long> create(@Valid @RequestBody ApiRuleCreateRequest req) {
        var r = ApiRuleAssembler.toEntity(req);
        Long id = apiRuleService.create(r);
        return ResponseEntity.ok(id);
    }

    @PutMapping("/{id}")
    @Operation(summary = "更新API規則")
    public ResponseEntity<Void> update(
            @Parameter(description = "規則ID", example = "1", required = true) @PathVariable Long id,
            @Valid @RequestBody ApiRuleUpdateRequest req) {
        var r = ApiRuleAssembler.toEntity(id, req);
        int n = apiRuleService.update(r);
        return (n > 0) ? ResponseEntity.ok().build() : ResponseEntity.notFound().build();
    }

    @PatchMapping("/{id}/enabled")
    public ResponseEntity<Void> enable(
            @Parameter(description = "規則ID", example = "1", required = true) @PathVariable Long id,
            @Parameter(description = "是否啟用", example = "true", required = true) @RequestParam boolean enabled) {
        int n = apiRuleService.enable(id, enabled);
        return (n > 0) ? ResponseEntity.ok().build() : ResponseEntity.notFound().build();
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "刪除API規則")
    public ResponseEntity<Void> delete(
            @Parameter(description = "規則ID", example = "1", required = true) @PathVariable Long id) {
        int n = apiRuleService.delete(id);
        return (n > 0) ? ResponseEntity.ok().build() : ResponseEntity.notFound().build();
    }

    @PostMapping("/rebuild-cache")
    public ResponseEntity<Void> rebuild() {
        apiRuleService.rebuildCacheNow();
        return ResponseEntity.ok().build();
    }
}
