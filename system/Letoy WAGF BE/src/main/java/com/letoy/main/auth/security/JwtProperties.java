package com.letoy.main.auth.security;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.validation.annotation.Validated;

import jakarta.annotation.PostConstruct;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

/**
 * JWT 配置属性类
 *
 * <p>从环境变量或 application.properties 读取 JWT 相关配置
 *
 * <p><strong>Phase 1: JWT 体系升级</strong> - 密钥外部化
 *
 * <p>配置项说明：
 * <ul>
 *   <li>jwt.secret: JWT 密钥（生产环境必须通过环境变量 JWT_SECRET 设置）</li>
 *   <li>jwt.issuer: Token 签发者</li>
 *   <li>jwt.access-token-expiration: Access Token 过期时间（毫秒）</li>
 *   <li>jwt.refresh-token-expiration: Refresh Token 过期时间（毫秒）</li>
 *   <li>jwt.revocation-strategy: 撤销策略（VERSION 或 BLACKLIST）</li>
 *   <li>jwt.legacy-mode: 向后兼容模式（true 保留 14 天单 token）</li>
 * </ul>
 *
 * <p>使用示例：
 * <pre>
 * &#64;Autowired
 * private JwtProperties jwtProperties;
 *
 * String secret = jwtProperties.getSecret();
 * long accessExpiration = jwtProperties.getAccessTokenExpiration();
 * </pre>
 *
 * @author Security Upgrade Team
 * @since 2026-01-04 (Phase 1)
 */
@ConfigurationProperties(prefix = "jwt")
@Validated
public class JwtProperties {

    private static final Logger logger = LoggerFactory.getLogger(JwtProperties.class);

    /**
     * JWT 密钥（必须设置，至少 32 字符）
     *
     * <p>生产环境通过环境变量设置：
     * <pre>export JWT_SECRET="your-secret-key-at-least-256-bits"</pre>
     */
    @NotBlank(message = "JWT 密钥不能为空")
    private String secret;

    /**
     * Token 签发者
     */
    private String issuer = "backend-template";

    /**
     * Access Token 过期时间（毫秒）
     * 默认：24 小时
     */
    @Min(value = 60000, message = "Access Token 过期时间至少 1 分钟")
    private Long accessTokenExpiration = 86400000L;  // 24 hours

    /**
     * Refresh Token 过期时间（毫秒）
     * 默认：180 天
     */
    @Min(value = 86400000, message = "Refresh Token 过期时间至少 1 天")
    private Long refreshTokenExpiration = 15552000000L;  // 180 days

    /**
     * Token 撤销策略
     * <ul>
     *   <li>VERSION: 基于 user.token_version 字段（推荐）</li>
     *   <li>BLACKLIST: 基于 Redis 黑名单</li>
     * </ul>
     */
    private RevocationStrategy revocationStrategy = RevocationStrategy.VERSION;

    /**
     * 向后兼容模式
     * <ul>
     *   <li>true: 保留旧版 14 天单 token 逻辑</li>
     *   <li>false: 启用新版 Access/Refresh Token</li>
     * </ul>
     */
    private Boolean legacyMode = false;

    /**
     * Redis 黑名单配置（仅当 revocationStrategy=BLACKLIST 时使用）
     */
    private BlacklistConfig blacklist = new BlacklistConfig();


    /**
     * 启动后验证配置
     */
    @PostConstruct
    public void validateConfig() {
        String profile = System.getProperty("spring.profiles.active", "dev");
        int secretLength = secret != null ? secret.length() : 0;

        // 生产环境必须设置有效的 JWT_SECRET
        if ("publish".equals(profile)) {
            if (secret == null || secret.trim().isEmpty()) {
                throw new IllegalStateException(
                    "生产环境必须设置 JWT_SECRET 环境变量！\n" +
                    "请执行：export JWT_SECRET=\"<your-256-bit-secret>\"\n" +
                    "或在 application-publish.properties 中配置：jwt.secret=${JWT_SECRET}"
                );
            }

            if (secretLength < 32) {
                throw new IllegalStateException(
                    "JWT_SECRET 长度必须至少 32 字符（256 位）！\n" +
                    "当前长度：" + secretLength + " 字符\n" +
                    "生成方法：openssl rand -base64 32"
                );
            }

            // 警告：不要使用默认密钥
            if (secret.equals("l-s-dsa-0232-242") || secret.contains("dev") || secret.contains("test")) {
                throw new IllegalStateException(
                    "生产环境不能使用默认或测试密钥！\n" +
                    "检测到不安全的密钥；请使用独立随机生成的值。"
                );
            }
        }

        // HS512 需要至少 64 字符（512 位）密钥
        if (secretLength < 64) {
            throw new IllegalStateException(
                "JWT_SECRET 长度必须至少 64 字符（512 位）以支持 HS512！\n" +
                "当前长度：" + secretLength + " 字符\n" +
                "生成方法：openssl rand -base64 64"
            );
        }

        // 日志配置信息（不输出密钥）
        logger.debug("✅ JWT 配置加载完成：");
        logger.debug("   - Issuer: {}", issuer);
        logger.debug("   - Access Token Expiration: {} 分钟", accessTokenExpiration / 1000 / 60);
        logger.debug("   - Refresh Token Expiration: {} 天", refreshTokenExpiration / 1000 / 60 / 60 / 24);
        logger.debug("   - Revocation Strategy: {}", revocationStrategy);
        logger.debug("   - Legacy Mode: {}", legacyMode);
        logger.debug("   - Secret Length: {} 字符 (***隐藏***)", secretLength);
    }


    // ==================== Getters and Setters ====================

    public String getSecret() {
        return secret;
    }

    public void setSecret(String secret) {
        this.secret = secret;
    }

    public String getIssuer() {
        return issuer;
    }

    public void setIssuer(String issuer) {
        this.issuer = issuer;
    }

    public Long getAccessTokenExpiration() {
        return accessTokenExpiration;
    }

    public void setAccessTokenExpiration(Long accessTokenExpiration) {
        this.accessTokenExpiration = accessTokenExpiration;
    }

    public Long getRefreshTokenExpiration() {
        return refreshTokenExpiration;
    }

    public void setRefreshTokenExpiration(Long refreshTokenExpiration) {
        this.refreshTokenExpiration = refreshTokenExpiration;
    }

    public RevocationStrategy getRevocationStrategy() {
        return revocationStrategy;
    }

    public void setRevocationStrategy(RevocationStrategy revocationStrategy) {
        this.revocationStrategy = revocationStrategy;
    }

    public Boolean getLegacyMode() {
        return legacyMode;
    }

    public void setLegacyMode(Boolean legacyMode) {
        this.legacyMode = legacyMode;
    }

    public BlacklistConfig getBlacklist() {
        return blacklist;
    }

    public void setBlacklist(BlacklistConfig blacklist) {
        this.blacklist = blacklist;
    }


    // ==================== 内部类 ====================

    /**
     * Token 撤销策略枚举
     */
    public enum RevocationStrategy {
        /**
         * 基于版本号（user.token_version 字段）
         */
        VERSION,

        /**
         * 基于 Redis 黑名单
         */
        BLACKLIST
    }

    /**
     * Redis 黑名单配置
     */
    public static class BlacklistConfig {
        /**
         * Redis key 前缀
         */
        private String keyPrefix = "JWT:BLACKLIST:";

        /**
         * 是否启用黑名单检查
         */
        private Boolean checkEnabled = true;

        public String getKeyPrefix() {
            return keyPrefix;
        }

        public void setKeyPrefix(String keyPrefix) {
            this.keyPrefix = keyPrefix;
        }

        public Boolean getCheckEnabled() {
            return checkEnabled;
        }

        public void setCheckEnabled(Boolean checkEnabled) {
            this.checkEnabled = checkEnabled;
        }
    }
}
