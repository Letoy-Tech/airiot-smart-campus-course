package com.letoy.main.auth.service;

import com.letoy.main.auth.entity.RefreshToken;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Refresh Token 服务接口
 *
 * <p><strong>Phase 1: JWT 体系升级</strong> - Refresh Token 管理
 *
 * @author Security Upgrade Team
 * @since 2026-01-04 (Phase 1)
 */
public interface RefreshTokenService {

    /**
     * 创建 Refresh Token
     *
     * @param uid 用户 ID
     * @param accessTokenJti 关联的 Access Token JTI
     * @param request HTTP 请求（用于提取设备信息和 IP）
     * @return Refresh Token 实体
     */
    RefreshToken createRefreshToken(String uid, String accessTokenJti, HttpServletRequest request);

    /**
     * 验证 Refresh Token 是否有效
     *
     * @param refreshTokenString Refresh Token 字符串
     * @return Refresh Token 实体（如果有效）
     * @throws com.letoy.main.common.exception.MyAuthenticationException 如果无效
     */
    RefreshToken validateRefreshToken(String refreshTokenString);

    /**
     * 使用 Refresh Token 换取新的 Access Token
     *
     * @param refreshTokenString Refresh Token 字符串
     * @return 新的 Access Token
     */
    String refreshAccessToken(String refreshTokenString);

    /**
     * 撤销 Refresh Token
     *
     * @param refreshTokenString Refresh Token 字符串
     * @param reason 撤销原因
     */
    void revokeRefreshToken(String refreshTokenString, String reason);

    /**
     * 撤销用户的所有 Refresh Token
     *
     * @param uid 用户 ID
     * @param reason 撤销原因
     */
    void revokeAllRefreshTokens(String uid, String reason);

    /**
     * 清理过期的 Refresh Token
     *
     * @return 清理数量
     */
    int cleanExpiredTokens();
}
