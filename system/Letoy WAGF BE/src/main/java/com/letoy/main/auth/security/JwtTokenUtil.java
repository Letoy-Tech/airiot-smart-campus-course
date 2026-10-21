package com.letoy.main.auth.security;

import com.letoy.main.auth.security.JwtProperties;
import com.letoy.main.auth.entity.AuthUser;
import com.letoy.main.user.entity.UserInfo;
import com.letoy.main.common.exception.MyAuthenticationException;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.util.Date;
import java.util.HashMap;
import java.util.UUID;

/**
 * JWT Token 工具类
 *
 * <p><strong>Phase 1: JWT 体系升级</strong>
 * - 支持 Access Token（24小时）和 Refresh Token（180天）
 * - 密钥外部化（使用 JwtProperties）
 * - 支持 Legacy Mode（向后兼容 14 天单 token）
 * - 添加 JTI（JWT ID）用于 token 追踪
 *
 * @author Security Upgrade Team
 * @since 2026-01-04 (Phase 1 升级)
 */
@Component
public class JwtTokenUtil {

    private static final Logger logger = LoggerFactory.getLogger(JwtTokenUtil.class);

    @Autowired
    private JwtProperties jwtProperties;

    /**
     * Phase 1: 启动后检查 JwtProperties 是否正确注入
     */
    @PostConstruct
    public void init() {
        if (jwtProperties == null) {
            logger.error("❌ JwtProperties 注入失败！jwtProperties 为 null");
            throw new IllegalStateException("JwtProperties 未被正确注入");
        } else {
            logger.debug("✅ JwtProperties 注入成功");
            logger.debug("   - Secret 长度: {} 字符", jwtProperties.getSecret() != null ? jwtProperties.getSecret().length() : 0);
            logger.debug("   - Legacy Mode: {}", jwtProperties.getLegacyMode());
            logger.debug("   - Issuer: {}", jwtProperties.getIssuer());
        }
    }

    // 常量定义
    private static final String ISSUED_AT = Claims.ISSUED_AT;
    private static final String SUBJECT = Claims.SUBJECT;
    private static final String JTI = Claims.ID;  // JWT ID

    // ==================== Phase 1: 新增方法 ====================

    /**
     * 生成 Access Token（24 小时）
     *
     * @param uid 用户 ID
     * @return Access Token
     */
    public String generateAccessToken(String uid) {
        return generateAccessToken(uid, null);
    }

    /**
     * 生成 Access Token（带 JTI）
     *
     * @param uid 用户 ID
     * @param jti JWT ID（用于追踪，如果为 null 则自动生成）
     * @return Access Token
     */
    public String generateAccessToken(String uid, String jti) {
        if (jti == null || jti.isEmpty()) {
            jti = UUID.randomUUID().toString().replace("-", "");
        }

        HashMap<String, Object> claims = new HashMap<>();
        claims.put(SUBJECT, uid);
        claims.put(ISSUED_AT, new Date());
        claims.put(JTI, jti);
        claims.put("type", "access");

        return generateTokenWithClaims(claims, jwtProperties.getAccessTokenExpiration());
    }

    /**
     * 生成 Access Token（增强版 - Phase 3）
     * <p>包含 groups, roles, tokenVersion 等扩展信息，减少数据库查询</p>
     *
     * @param userInfo 用户信息
     * @return Access Token
     */
    public String generateEnhancedAccessToken(UserInfo userInfo) {
        return generateEnhancedAccessToken(userInfo, null);
    }

    /**
     * 生成 Access Token（增强版，带 JTI - Phase 3）
     *
     * @param userInfo 用户信息
     * @param jti JWT ID
     * @return Access Token
     */
    public String generateEnhancedAccessToken(UserInfo userInfo, String jti) {
        if (jti == null || jti.isEmpty()) {
            jti = UUID.randomUUID().toString().replace("-", "");
        }

        HashMap<String, Object> claims = new HashMap<>();
        claims.put(SUBJECT, userInfo.getUid());
        claims.put(ISSUED_AT, new Date());
        claims.put(JTI, jti);
        claims.put("type", "access");

        // Phase 3: 添加扩展信息
        if (userInfo.getGroupIds() != null && !userInfo.getGroupIds().trim().isEmpty()) {
            claims.put("groups", userInfo.getGroupIds());
        }
        if (userInfo.getRoles() != null && !userInfo.getRoles().trim().isEmpty()) {
            claims.put("roles", userInfo.getRoles());
        }

        // 添加 tokenVersion（用于撤销检查）
        Integer tokenVersion = userInfo.getTokenVersion();
        if (tokenVersion != null) {
            claims.put("tokenVersion", tokenVersion);
        }

        logger.debug("生成增强 Access Token: uid={}, groups={}, roles={}, tokenVersion={}",
                userInfo.getUid(), userInfo.getGroupIds(), userInfo.getRoles(), tokenVersion);

        return generateTokenWithClaims(claims, jwtProperties.getAccessTokenExpiration());
    }

    /**
     * 从 Token 中获取 Groups（Phase 3）
     *
     * @param token JWT Token
     * @return Groups（逗号分隔的字符串，如果不存在返回 null）
     */
    public String getGroupsFromToken(String token) {
        try {
            Claims claims = getClaimsFromToken(token);
            if (claims != null) {
                return (String) claims.get("groups");
            }
            return null;
        } catch (Exception e) {
            logger.debug("无法从 Token 中提取 Groups: {}", e.getMessage());
            return null;
        }
    }

    /**
     * 从 Token 中获取 Roles（Phase 3）
     *
     * @param token JWT Token
     * @return Roles（逗号分隔的字符串，如果不存在返回 null）
     */
    public String getRolesFromToken(String token) {
        try {
            Claims claims = getClaimsFromToken(token);
            if (claims != null) {
                return (String) claims.get("roles");
            }
            return null;
        } catch (Exception e) {
            logger.debug("无法从 Token 中提取 Roles: {}", e.getMessage());
            return null;
        }
    }

    /**
     * 从 Token 中获取 TokenVersion（Phase 3）
     *
     * @param token JWT Token
     * @return Token Version（如果不存在返回 null）
     */
    public Integer getTokenVersionFromToken(String token) {
        try {
            Claims claims = getClaimsFromToken(token);
            if (claims != null) {
                Object version = claims.get("tokenVersion");
                if (version instanceof Integer) {
                    return (Integer) version;
                } else if (version instanceof String) {
                    return Integer.parseInt((String) version);
                }
            }
            return null;
        } catch (Exception e) {
            logger.debug("无法从 Token 中提取 TokenVersion: {}", e.getMessage());
            return null;
        }
    }

    /**
     * 生成 Refresh Token（180 天）
     *
     * @param uid 用户 ID
     * @return Refresh Token
     */
    public String generateRefreshToken(String uid) {
        return generateRefreshToken(uid, null);
    }

    /**
     * 生成 Refresh Token（带 JTI）
     *
     * @param uid 用户 ID
     * @param jti JWT ID（用于追踪，如果为 null 则自动生成）
     * @return Refresh Token
     */
    public String generateRefreshToken(String uid, String jti) {
        if (jti == null || jti.isEmpty()) {
            jti = UUID.randomUUID().toString().replace("-", "");
        }

        HashMap<String, Object> claims = new HashMap<>();
        claims.put(SUBJECT, uid);
        claims.put(ISSUED_AT, new Date());
        claims.put(JTI, jti);
        claims.put("type", "refresh");

        return generateTokenWithClaims(claims, jwtProperties.getRefreshTokenExpiration());
    }

    /** Login/refresh sessions carry the current token version just like access tokens. */
    public String generateEnhancedRefreshToken(UserInfo user, String jti) {
        if (user.getTokenVersion() == null || user.getTokenVersion() < 1) {
            throw new MyAuthenticationException("用户 Token 版本无效");
        }
        HashMap<String, Object> claims = new HashMap<>();
        claims.put(SUBJECT, user.getUid());
        claims.put(ISSUED_AT, new Date());
        claims.put(JTI, jti == null || jti.isBlank() ? UUID.randomUUID().toString().replace("-", "") : jti);
        claims.put("type", "refresh");
        claims.put("tokenVersion", user.getTokenVersion());
        return generateTokenWithClaims(claims, jwtProperties.getRefreshTokenExpiration());
    }

    /**
     * 从 Token 中获取 JTI
     *
     * @param token JWT Token
     * @return JTI（如果不存在返回 null）
     */
    public String getJtiFromToken(String token) {
        try {
            Claims claims = getClaimsFromToken(token);
            if (claims != null) {
                return claims.getId();
            }
            return null;
        } catch (Exception e) {
            logger.warn("无法从 Token 中提取 JTI: {}", e.getMessage());
            return null;
        }
    }

    /**
     * 从 Token 中获取类型（access 或 refresh）
     *
     * @param token JWT Token
     * @return Token 类型
     */
    public String getTypeFromToken(String token) {
        try {
            Claims claims = getClaimsFromToken(token);
            if (claims != null) {
                return (String) claims.get("type");
            }
            return null;
        } catch (Exception e) {
            logger.warn("无法从 Token 中提取类型: {}", e.getMessage());
            return null;
        }
    }

    /**
     * 计算 Token 剩余有效期（秒）
     *
     * @param token JWT Token
     * @return 剩余秒数（如果已过期返回 0）
     */
    public long getTokenRemainingSeconds(String token) {
        try {
            Claims claims = getClaimsFromToken(token);
            if (claims != null && claims.getExpiration() != null) {
                long remaining = (claims.getExpiration().getTime() - System.currentTimeMillis()) / 1000;
                return Math.max(0, remaining);
            }
            return 0;
        } catch (Exception e) {
            return 0;
        }
    }


    // ==================== Legacy Mode 兼容方法 ====================

    /**
     * 生成令牌（根据用户信息）
     *
     * <p><strong>Legacy Mode</strong>: 保持向后兼容
     * <ul>
     *   <li>如果 jwt.legacy-mode=false: 生成 14 天单 token（旧版）</li>
     *   <li>如果 jwt.legacy-mode=false: 生成 12 小时 Access Token（新版）</li>
     * </ul>
     */
    public String generateToken(UserInfo userInfo) {
        return generateToken(userInfo.getUid());
    }

    /**
     * 生成令牌（根据 UID）
     *
     * <p><strong>Legacy Mode</strong>: 保持向后兼容
     */
    public String generateToken(String uid) {
        if (Boolean.TRUE.equals(jwtProperties.getLegacyMode())) {
            // Legacy Mode: 14 天单 token
            logger.debug("使用 Legacy Mode 生成 14 天单 token (uid={})", uid);
            HashMap<String, Object> claims = new HashMap<>();
            claims.put(SUBJECT, uid);
            claims.put(ISSUED_AT, new Date());
            return generateTokenWithClaims(claims, 3600000L * 24 * 14); // 14 天
        } else {
            // 新版: 12 小时 Access Token
            logger.debug("生成 Access Token (uid={})", uid);
            return generateAccessToken(uid);
        }
    }

    /**
     * 验证令牌是否有效（根据用户信息）
     */
    public Boolean validateToken(String token, UserInfo userInfo) {
        return validateToken(token, userInfo.getUid());
    }

    /**
     * 验证令牌是否有效（根据认证用户）
     */
    public Boolean validateToken(String token, AuthUser authUser) {
        return validateToken(token, authUser.getId());
    }

    /**
     * 验证令牌是否有效（通用）
     */
    private Boolean validateToken(String token, String uid) {
        try {
            Claims claims = getClaimsFromToken(token);
            return claims.getSubject() != null && claims.getSubject().equals(uid)
                    && "access".equals(claims.get("type", String.class))
                    && claims.getExpiration() != null && !claims.getExpiration().before(new Date());
        } catch (ExpiredJwtException e) {
            logger.warn("令牌失效");
            throw new MyAuthenticationException("認證失敗");
        } catch (Exception e) {
            logger.error("验证令牌失败: {}", e.getMessage());
            throw new MyAuthenticationException("認證失敗");
        }
    }

    /**
     * 判断令牌是否过期
     */
    public Boolean isTokenExpired(String token) {
        try {
            Claims claims = getClaimsFromToken(token);
            return claims.getExpiration().before(new Date());
        } catch (ExpiredJwtException e) {
            logger.warn("令牌已过期");
            throw new MyAuthenticationException("認證失敗");
        } catch (Exception e) {
            logger.error("无法判断令牌是否过期: {}", e.getMessage());
            throw new MyAuthenticationException("認證失敗");
        }
    }

    /**
     * 从令牌中获取 UID
     */
    public String getUidFromToken(String token) {
        try {
            Claims claims = getClaimsFromToken(token);
            if (claims != null) {
                return claims.getSubject();
            }
            throw new MyAuthenticationException("令牌為空");
        } catch (ExpiredJwtException e) {
            logger.error("令牌已过期，无法提取 UID");
            throw new MyAuthenticationException("認證失敗");
        } catch (Exception e) {
            logger.error("无法从令牌中提取 UID");
            throw new MyAuthenticationException("認證失敗");
        }
    }


    // ==================== 私有核心方法 ====================

    /**
     * 生成令牌（核心方法 - Phase 1 升级）
     *
     * @param claims 声明
     * @param expirationMs 过期时间（毫秒）
     * @return JWT Token
     */
    private String generateTokenWithClaims(HashMap<String, Object> claims, Long expirationMs) {
        try {
            Date expirationDate = new Date(System.currentTimeMillis() + expirationMs);
            Key key = getSigningKey();
            return Jwts.builder()
                    .setClaims(claims)
                    .setIssuer(jwtProperties.getIssuer())  // Phase 1: 添加 issuer
                    .setExpiration(expirationDate)
                    .signWith(key, SignatureAlgorithm.HS512)  // Phase 1: 使用配置的密钥
                    .compact();
        } catch (Exception e) {
            logger.error("生成令牌失败: {}", e.getMessage());
            return null;
        }
    }

    /**
     * 标准化 Token 输入：移除 Bearer 前缀（忽略大小写）
     *
     * @param token 原始 token（可能包含 "Bearer " 或 "bearer " 前缀）
     * @return 清理后的纯 JWT token
     */
    private String normalizeToken(String token) {
        if (token == null) {
            return null;
        }
        // 移除 "Bearer " 或 "bearer " 前缀（忽略大小写）
        token = token.trim();
        if (token.toLowerCase().startsWith("bearer ")) {
            return token.substring(7).trim();
        }
        return token;
    }

    /**
     * 从令牌中解析声明
     */
    private Claims getClaimsFromToken(String token) {
        try {
            // 统一标准化 token 输入
            token = normalizeToken(token);
            if (token == null || token.isEmpty()) {
                throw new MyAuthenticationException("Token 为空");
            }

            return Jwts.parserBuilder()
                    .setSigningKey(getSigningKey())  // Phase 1: 使用配置的密钥
                    .requireIssuer(jwtProperties.getIssuer())
                    .build()
                    .parseClaimsJws(token)
                    .getBody();
        } catch (ExpiredJwtException e) {
            logger.warn("令牌解析失败（已过期）");
            throw new MyAuthenticationException("認證失敗");
        } catch (Exception e) {
            logger.error("解析令牌失败: {}", e.getMessage());
            throw new MyAuthenticationException("認證失敗");
        }
    }

    private Key getSigningKey() {
        return Keys.hmacShaKeyFor(jwtProperties.getSecret().getBytes(StandardCharsets.UTF_8));
    }
}
