package com.letoy.main.user.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
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
@Schema(name = "UpdateUserInfoRequest", description = "更新用戶信息請求參數")
public class UpdateUserInfoRequest implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @Schema(description = "暱稱", example = "張三")
    private String nickname;

    @Schema(description = "性別（0未知 / 1男 / 2女）", example = "1")
    private Integer gender;

    @Schema(description = "個人簡介", example = "這是我的個人簡介")
    private String description;

    @Schema(description = "頭像URL", example = "https://example.com/avatar.jpg")
    private String avatar;

    @Email(message = "Email format is invalid")
    @Schema(description = "郵箱", example = "user@example.com")
    private String email;

    @Schema(description = "群組ID列表（逗號分隔）", example = "G0001,G0002")
    private String groupIds;
}
