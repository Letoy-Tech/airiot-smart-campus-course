package com.letoy.main.group.entity;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.*;

import java.io.Serial;
import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * Generic organizational group entity.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(name = "GroupsInfo", description = "部门 / 群组信息")
public class GroupsInfo implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 状态常量 */
    public static final int STATUS_DISABLED = 0;
    public static final int STATUS_ENABLED  = 1;

    @Schema(description = "自增主键（内部用）", example = "1")
    private Long id;

    @Schema(description = "Unique group identifier", example = "ROOT")
    private String groupId;

    @Schema(description = "Display name", example = "Root Group")
    private String groupName;

    @Schema(description = "Description", example = "Top-level administration group")
    private String groupDescription;

    @Schema(description = "上级部门的 groupId（可为空）", example = "G0001")
    private String parentGroupId;

    @Schema(description = "物化路径，如 /G0001/G0002/", example = "/G0001/G0002/")
    private String path;

    @Schema(description = "层级深度：根 = 0", example = "1")
    @Builder.Default
    private Integer level = 0;

    @Schema(description = "同级排序：越小越靠前", example = "10")
    @Builder.Default
    private Integer sortOrder = 0;

    @Schema(description = "状态：1 = 启用，0 = 停用", example = "1")
    @Builder.Default
    private Integer status = STATUS_ENABLED;

    @Schema(description = "创建时间")
    private LocalDateTime createTime;

    @Schema(description = "更新时间")
    private LocalDateTime updateTime;

    /* ================== 实用方法 ================== */

    /** 是否根节点 */
    public boolean isRoot() {
        return parentGroupId == null || parentGroupId.isBlank();
    }

    /** 是否启用 */
    public boolean isEnabled() {
        return Integer.valueOf(STATUS_ENABLED).equals(status);
    }

    /** 生成规范化路径：parentPath + /groupId/ */
    public static String buildPath(String parentPath, String groupId) {
        String p = normalizePath(parentPath);
        return p + groupId + "/";
    }

    /** 规范化任意路径（确保以 / 开头、/ 结尾；空时返回 "/"） */
    public static String normalizePath(String raw) {
        if (raw == null || raw.isBlank()) return "/";
        String s = raw.trim();
        if (!s.startsWith("/")) s = "/" + s;
        if (!s.endsWith("/"))   s = s + "/";
        while (s.contains("//")) s = s.replace("//", "/");
        return s;
    }

    /** 当父级变化时，更新 level 与 path */
    public void applyParent(String newParentGroupId, String newParentPath, Integer newParentLevel) {
        this.parentGroupId = newParentGroupId;
        this.level = (newParentLevel == null ? 0 : newParentLevel + 1);
        this.path  = buildPath(newParentPath, this.groupId);
    }
}
