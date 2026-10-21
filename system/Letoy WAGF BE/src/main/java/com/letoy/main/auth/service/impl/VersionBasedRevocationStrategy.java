package com.letoy.main.auth.service.impl;

import com.letoy.main.auth.security.JwtProperties;
import com.letoy.main.user.mapper.UserInfoMapper;
import com.letoy.main.auth.service.TokenRevocationService;
import com.letoy.main.auth.security.JwtTokenUtil;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.Key;

/**
 * 基于版本号的 Token 撤销策略
 *
 * <p><strong>原理</strong>：
 * <ul>
 *   <li>user_info.token_version 字段记录当前有效版本号</li>
 *   <li>JWT Claims 中包含 tokenVersion</li>
 *   <li>验证时比对：token.version < user.tokenVersion → 撤销</li>
 * </ul>
 *
 * <p><strong>触发场景</strong>：
 * <ul>
 *   <li>用户修改密码 → tokenVersion +1</li>
 *   <li>用户主动登出所有设备 → tokenVersion +1</li>
 *   <li>管理员封号 → tokenVersion +1</li>
 * </ul>
 *
 * <p><strong>优势</strong>：
 * <ul>
 *   <li>无需 Redis，降低依赖</li>
 *   <li>撤销操作简单（UPDATE user_info SET token_version = token_version + 1）</li>
 *   <li>性能好（仅一次 DB 查询）</li>
 * </ul>
 *
 * @author Security Upgrade Team
 * @since 2026-01-04 (Phase 1)
 */
@Service
@ConditionalOnProperty(name = "jwt.revocation-strategy", havingValue = "VERSION", matchIfMissing = true)
public class VersionBasedRevocationStrategy implements TokenRevocationService {

    private static final Logger logger = LoggerFactory.getLogger(VersionBasedRevocationStrategy.class);

    @Autowired
    private UserInfoMapper userInfoMapper;

    @Autowired
    private JwtTokenUtil jwtTokenUtil;

    @Autowired
    private JwtProperties jwtProperties;

    @Override
    public boolean isTokenRevoked(String token, String uid) {
        try {
            // 1. 从 Token 中提取版本号（如果存在）
            Integer tokenVersion = getTokenVersion(token);
            if (tokenVersion == null) {
                // Normal access tokens always carry the version. Missing/malformed values fail closed.
                return !Boolean.TRUE.equals(jwtProperties.getLegacyMode());
            }

            // 2. 从数据库获取用户当前有效版本号
            Integer currentVersion = userInfoMapper.getTokenVersionByUid(uid);
            if (currentVersion == null) {
                logger.warn("用户 {} 的 token_version 为 null，拒绝访问", uid);
                return true;
            }

            // 3. 比对版本号
            if (tokenVersion < currentVersion) {
                logger.info("Token 已撤销：uid={}, token.version={}, current.version={}",
                        uid, tokenVersion, currentVersion);
                return true;
            }

            return false;

        } catch (Exception e) {
            logger.error("检查 Token 撤销状态失败: {}", e.getMessage());
            // 异常情况下拒绝访问（安全优先）
            return true;
        }
    }

    @Override
    public void revokeAllTokens(String uid, String reason) {
        try {
            logger.info("撤销用户所有 Token：uid={}, reason={}", uid, reason);

            // 将 token_version 递增
            int updated = userInfoMapper.incrementTokenVersion(uid);

            if (updated > 0) {
                logger.info("成功撤销用户所有 Token：uid={}, 新版本号={}", uid, updated);
            } else {
                logger.warn("撤销失败，用户不存在：uid={}", uid);
            }

        } catch (Exception e) {
            logger.error("撤销用户 Token 失败：uid={}, error={}", uid, e.getMessage());
            throw e;
        }
    }

    @Override
    public void revokeToken(String token, String reason) {
        // VERSION 策略不支持单个 Token 撤销，只能撤销用户的所有 Token
        String uid = jwtTokenUtil.getUidFromToken(token);
        if (uid != null) {
            logger.warn("VERSION 策略不支持单个 Token 撤销，将撤销用户所有 Token：uid={}", uid);
            revokeAllTokens(uid, reason);
        }
    }

    /**
     * 从 Token 中提取版本号
     */
    private Integer getTokenVersion(String token) {
        return jwtTokenUtil.getTokenVersionFromToken(token);
    }

    private Key getSigningKey() {
        return Keys.hmacShaKeyFor(jwtProperties.getSecret().getBytes(StandardCharsets.UTF_8));
    }
}
