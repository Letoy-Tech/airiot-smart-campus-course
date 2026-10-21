package com.letoy.main.auth.service;

/**
 * Token 撤销服务接口
 *
 * <p><strong>Phase 1: JWT 体系升级</strong> - Token 撤销机制
 *
 * <p>支持两种撤销策略：
 * <ul>
 *   <li>VERSION: 基于 user.token_version 字段</li>
 *   <li>BLACKLIST: 基于 Redis 黑名单</li>
 * </ul>
 *
 * @author Security Upgrade Team
 * @since 2026-01-04 (Phase 1)
 */
public interface TokenRevocationService {

    /**
     * 检查 Token 是否已被撤销
     *
     * @param token JWT Token
     * @param uid 用户 ID
     * @return true=已撤销，false=有效
     */
    boolean isTokenRevoked(String token, String uid);

    /**
     * 撤销用户的所有 Token
     *
     * @param uid 用户 ID
     * @param reason 撤销原因
     */
    void revokeAllTokens(String uid, String reason);

    /**
     * 撤销单个 Token
     *
     * @param token JWT Token
     * @param reason 撤销原因
     */
    void revokeToken(String token, String reason);
}
