package com.letoy.main.auth.service.impl;

import com.letoy.main.auth.entity.RefreshToken;
import com.letoy.main.common.exception.MyAuthenticationException;
import com.letoy.main.auth.mapper.RefreshTokenMapper;
import com.letoy.main.auth.service.RefreshTokenService;
import com.letoy.main.auth.service.TokenRevocationService;
import com.letoy.main.auth.security.JwtTokenUtil;
import com.letoy.main.common.util.MyIpUtil;
import com.letoy.main.user.mapper.UserInfoMapper;
import com.letoy.main.user.entity.UserInfo;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Date;

/**
 * Refresh Token 服务实现
 *
 * <p><strong>Phase 1: JWT 体系升级</strong>
 *
 * @author Security Upgrade Team
 * @since 2026-01-04 (Phase 1)
 */
@Service
public class RefreshTokenServiceImpl implements RefreshTokenService {

    private static final Logger logger = LoggerFactory.getLogger(RefreshTokenServiceImpl.class);

    @Autowired
    private RefreshTokenMapper refreshTokenMapper;

    @Autowired
    private JwtTokenUtil jwtTokenUtil;

    @Autowired
    private TokenRevocationService tokenRevocationService;

    @Autowired
    private UserInfoMapper userInfoMapper;

    @Override
    @Transactional
    public RefreshToken createRefreshToken(String uid, String accessTokenJti, HttpServletRequest request) {
        try {
            // 1. 生成 Refresh Token
            String refreshTokenJti = java.util.UUID.randomUUID().toString().replace("-", "");
            UserInfo user = currentUser(uid);
            String refreshTokenString = jwtTokenUtil.generateEnhancedRefreshToken(user, refreshTokenJti);
            if (refreshTokenString == null) throw new MyAuthenticationException("Refresh Token 创建失败");

            // 2. 创建实体
            RefreshToken refreshToken = new RefreshToken();
            refreshToken.setUid(uid);
            refreshToken.setRefreshToken(refreshTokenString);
            refreshToken.setAccessTokenJti(accessTokenJti);

            // 3. 设置过期时间（从 Token 中提取）
            long remainingSeconds = jwtTokenUtil.getTokenRemainingSeconds(refreshTokenString);
            Date expiresAt = new Date(System.currentTimeMillis() + remainingSeconds * 1000);
            refreshToken.setExpiresAt(expiresAt);
            refreshToken.setCreatedAt(new Date());
            refreshToken.setRevoked(false);

            // 4. 提取设备信息和 IP
            if (request != null) {
                String userAgent = request.getHeader("User-Agent");
                refreshToken.setDeviceInfo(userAgent != null ? userAgent.substring(0, Math.min(255, userAgent.length())) : null);
                // 使用静态方法调用（MyIpUtil 是工具类，非 Spring Bean）
                refreshToken.setIpAddress(MyIpUtil.getIpAddr(request));
            }

            // 5. 保存到数据库
            if (refreshTokenMapper.insert(refreshToken) != 1) throw new MyAuthenticationException("Refresh Token 保存失败");

            logger.info("创建 Refresh Token 成功：uid={}, jti={}, expiresAt={}",
                        uid, refreshTokenJti, expiresAt);

            return refreshToken;

        } catch (MyAuthenticationException e) {
            throw e;
        } catch (Exception e) {
            logger.error("创建 Refresh Token 失败：uid={}, error={}", uid, e.getMessage());
            throw new MyAuthenticationException("创建 Refresh Token 失败");
        }
    }

    @Override
    public RefreshToken validateRefreshToken(String refreshTokenString) {
        try {
            // 1. 从数据库查询
            RefreshToken refreshToken = refreshTokenMapper.findByToken(refreshTokenString);
            if (refreshToken == null) {
                logger.warn("Refresh Token 不存在");
                throw new MyAuthenticationException("Refresh Token 无效");
            }

            // 2. 检查是否已撤销
            if (Boolean.TRUE.equals(refreshToken.getRevoked())) {
                logger.warn("Refresh Token 已撤销：uid={}, reason={}",
                           refreshToken.getUid(), refreshToken.getRevokeReason());
                throw new MyAuthenticationException("Refresh Token 已撤销");
            }

            // 3. 检查是否过期
            if (refreshToken.isExpired()) {
                logger.warn("Refresh Token 已过期：uid={}, expiresAt={}",
                           refreshToken.getUid(), refreshToken.getExpiresAt());
                throw new MyAuthenticationException("Refresh Token 已过期");
            }

            // 4. 验证 JWT 签名和有效性
            String uid = jwtTokenUtil.getUidFromToken(refreshTokenString);
            if (!uid.equals(refreshToken.getUid()) || !"refresh".equals(jwtTokenUtil.getTypeFromToken(refreshTokenString))) {
                logger.error("Refresh Token UID 不匹配");
                throw new MyAuthenticationException("Refresh Token 无效");
            }

            currentUser(uid);

            // 5. 检查 Token 是否被撤销（VERSION 策略）
            if (tokenRevocationService.isTokenRevoked(refreshTokenString, uid)) {
                logger.warn("Refresh Token 已被撤销（版本号不匹配）：uid={}", uid);
                throw new MyAuthenticationException("Refresh Token 已撤销");
            }

            return refreshToken;

        } catch (MyAuthenticationException e) {
            throw e;
        } catch (Exception e) {
            logger.error("验证 Refresh Token 失败: {}", e.getMessage());
            throw new MyAuthenticationException("Refresh Token 验证失败");
        }
    }

    @Override
    @Transactional
    public String refreshAccessToken(String refreshTokenString) {
        try {
            // 1. 验证 Refresh Token
            RefreshToken refreshToken = validateRefreshToken(refreshTokenString);

            // 2. 生成新的 Access Token
            UserInfo user = currentUser(refreshToken.getUid());
            if (!user.getTokenVersion().equals(jwtTokenUtil.getTokenVersionFromToken(refreshTokenString))) {
                throw new MyAuthenticationException("Refresh Token 已撤销");
            }
            String newAccessToken = jwtTokenUtil.generateEnhancedAccessToken(user);
            if (newAccessToken == null) throw new MyAuthenticationException("Access Token 创建失败");

            // 3. 更新最后使用时间
            refreshTokenMapper.updateLastUsedAt(refreshToken.getId(), new Date());

            logger.info("Refresh Token 使用成功：uid={}, token_id={}",
                       refreshToken.getUid(), refreshToken.getId());

            return newAccessToken;

        } catch (MyAuthenticationException e) {
            throw e;
        } catch (Exception e) {
            logger.error("刷新 Access Token 失败: {}", e.getMessage());
            throw new MyAuthenticationException("刷新 Token 失败");
        }
    }

    @Override
    @Transactional
    public void revokeRefreshToken(String refreshTokenString, String reason) {
        try {
            RefreshToken refreshToken = refreshTokenMapper.findByToken(refreshTokenString);
            if (refreshToken != null) {
                refreshTokenMapper.revokeById(refreshToken.getId(), reason);
                logger.info("撤销 Refresh Token 成功：uid={}, token_id={}, reason={}",
                           refreshToken.getUid(), refreshToken.getId(), reason);
            }
        } catch (Exception e) {
            logger.error("撤销 Refresh Token 失败: {}", e.getMessage());
            throw new RuntimeException("撤销 Refresh Token 失败", e);
        }
    }

    @Override
    @Transactional
    public void revokeAllRefreshTokens(String uid, String reason) {
        try {
            int count = refreshTokenMapper.revokeAllByUid(uid, reason);
            logger.info("撤销用户所有 Refresh Token 成功：uid={}, count={}, reason={}", uid, count, reason);
        } catch (Exception e) {
            logger.error("撤销用户所有 Refresh Token 失败：uid={}, error={}", uid, e.getMessage());
            throw new RuntimeException("撤销 Refresh Token 失败", e);
        }
    }

    @Override
    @Transactional
    public int cleanExpiredTokens() {
        try {
            int count = refreshTokenMapper.deleteExpired();
            logger.info("清理过期 Refresh Token 完成：count={}", count);
            return count;
        } catch (Exception e) {
            logger.error("清理过期 Refresh Token 失败: {}", e.getMessage());
            return 0;
        }
    }

    private UserInfo currentUser(String uid) {
        UserInfo user = userInfoMapper.getUserInfoByUid(uid);
        if (user == null || !Boolean.TRUE.equals(user.getActive()) || Boolean.TRUE.equals(user.getAccountLocked())
                || user.getTokenVersion() == null || user.getTokenVersion() < 1) {
            throw new MyAuthenticationException("用户已停用、锁定或 Token 版本无效");
        }
        return user;
    }
}
