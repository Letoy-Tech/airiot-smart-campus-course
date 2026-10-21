package com.letoy.main.permission.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Positive;
import lombok.Data;

@Data
@Schema(name = "ApiRuleQueryRequest", description = "API規則查詢請求參數")
public class ApiRuleQueryRequest {

    @Schema(description = "規則名稱（模糊搜索）", example = "用戶管理")
    private String name;

    @Schema(description = "路徑模式（模糊搜索）", example = "/api/users")
    private String pattern;

    @Schema(description = "HTTP方法（模糊搜索）", example = "GET")
    private String methods;

    @Schema(description = "組策略", example = "ANY")
    private String groupPolicy;

    @Schema(description = "啟用狀態", example = "true")
    private Boolean enabled;

    @Positive(message = "Current page must be greater than 0")
    @Schema(description = "當前頁碼", example = "1")
    private Integer currentPage;

    @Positive(message = "Page size must be greater than 0")
    @Schema(description = "每頁大小", example = "10")
    private Integer pageSize;
}
