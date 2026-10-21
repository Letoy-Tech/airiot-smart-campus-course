package com.letoy.main.auth.entity;

import com.letoy.main.user.entity.UserInfo;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serial;
import java.io.Serializable;

/**
 * 缓存的用户主体信息 - 仅包含权限检查必需字段
 *
 * <p><strong>设计原则</strong>：
 * <ul>
 *   <li>只缓存权限检查必需的字段，减少 Redis 存储空间</li>
 *   <li>避免缓存敏感信息（密码、详细个人信息等）</li>
 *   <li>避免缓存大字段（头像URL、长描述等）</li>
 * </ul>
 *
 * @author Security Upgrade Team
 * @since 2026-01-04 (Phase 3)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CachedPrincipal implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * 用户唯一ID
     * 用途: 识别用户身份
     */
    private String uid;

    /**
     * 所属群组ID (逗号分隔)
     * 用途: ALLOWLIST, BY_USER_GROUP 等策略的权限检查
     * 示例: "G0001,G0002"
     */
    private String groupIds;

    /**
     * 角色编号列表 (逗号分隔)
     * 用途: 角色级别的权限检查
     * 示例: "11,22,55"
     */
    private String roles;

    /**
     * 账户是否启用
     * 用途: 检查账户状态
     */
    private Boolean active;

    /**
     * 账户是否锁定
     * 用途: 检查账户是否被锁定
     */
    private Boolean accountLocked;

    /**
     * Token版本号
     * 用途: Token撤销机制
     */
    private Integer tokenVersion;

    /**
     * 从完整 UserInfo 创建缓存对象
     */
    public static CachedPrincipal fromUserInfo(UserInfo userInfo) {
        if (userInfo == null) {
            return null;
        }

        return CachedPrincipal.builder()
                .uid(userInfo.getUid())
                .groupIds(userInfo.getGroupIds())
                .roles(userInfo.getRoles())
                .active(userInfo.getActive())
                .accountLocked(userInfo.getAccountLocked())
                .tokenVersion(userInfo.getTokenVersion())
                .build();
    }

    /**
     * 转换为 UserInfo (仅包含权限相关字段)
     * 注意: 这不是完整的 UserInfo,只用于权限检查
     */
    public UserInfo toUserInfo() {
        return UserInfo.builder()
                .uid(this.uid)
                .groupIds(this.groupIds)
                .roles(this.roles)
                .active(this.active)
                .accountLocked(this.accountLocked)
                .tokenVersion(this.tokenVersion)
                .build();
    }
}
