package com.letoy.main.user.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Positive;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serial;
import java.io.Serializable;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(name = "UserQueryRequest", description = "用戶查詢請求參數")
public class UserQueryRequest implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @Schema(description = "用戶名（模糊查詢）", example = "macro")
    private String username;

    @Schema(description = "暱稱（模糊查詢）", example = "張三")
    private String nickname;

    @Schema(description = "群組ID（單個群組ID）", example = "G0001")
    private String groupId;

    @Schema(description = "性別（0未知 / 1男 / 2女）", example = "1")
    private Integer gender;

    @Schema(description = "帳號是否啟用", example = "true")
    private Boolean active;

    @Positive(message = "Current page must be greater than 0")
    @Schema(description = "當前頁碼", example = "1")
    private Integer currentPage;

    @Positive(message = "Page size must be greater than 0")
    @Schema(description = "每頁記錄數", example = "10")
    private Integer pageSize;
}
