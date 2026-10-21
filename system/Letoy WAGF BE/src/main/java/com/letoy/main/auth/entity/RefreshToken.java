package com.letoy.main.auth.entity;

import com.fasterxml.jackson.annotation.JsonFormat;

import java.util.Date;

/**
 * Refresh Token 实体类
 *
 * <p>对应数据库表：refresh_token
 *
 * <p><strong>Phase 1: JWT 体系升级</strong> - Refresh Token 管理
 *
 * <p>用途：
 * <ul>
 *   <li>存储用户的 Refresh Token</li>
 *   <li>记录设备信息和 IP 地址</li>
 *   <li>支持 Token 撤销</li>
 *   <li>用于 Access Token 刷新</li>
 * </ul>
 *
 * @author Security Upgrade Team
 * @since 2026-01-04 (Phase 1)
 */
public class RefreshToken {

    /**
     * 主键ID
     */
    private Long id;

    /**
     * 用户ID（关联 user_info.uid）
     */
    private String uid;

    /**
     * Refresh Token 字符串
     */
    private String refreshToken;

    /**
     * 关联的 Access Token JTI（JWT ID）
     */
    private String accessTokenJti;

    /**
     * Refresh Token 过期时间
     */
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss", timezone = "GMT+8")
    private Date expiresAt;

    /**
     * 创建时间
     */
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss", timezone = "GMT+8")
    private Date createdAt;

    /**
     * 最后使用时间（刷新 Access Token 时更新）
     */
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss", timezone = "GMT+8")
    private Date lastUsedAt;

    /**
     * 设备信息（User-Agent）
     */
    private String deviceInfo;

    /**
     * 签发时的 IP 地址
     */
    private String ipAddress;

    /**
     * 是否已撤销（0-有效 1-已撤销）
     */
    private Boolean revoked;

    /**
     * 撤销时间
     */
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss", timezone = "GMT+8")
    private Date revokedAt;

    /**
     * 撤销原因
     * <ul>
     *   <li>PASSWORD_CHANGE: 用户修改密码</li>
     *   <li>LOGOUT: 用户主动登出</li>
     *   <li>ADMIN_ACTION: 管理员操作</li>
     *   <li>ACCOUNT_LOCKED: 账户锁定</li>
     *   <li>SECURITY_BREACH: 安全事件</li>
     * </ul>
     */
    private String revokeReason;


    // ==================== 构造方法 ====================

    public RefreshToken() {
    }

    public RefreshToken(String uid, String refreshToken, Date expiresAt) {
        this.uid = uid;
        this.refreshToken = refreshToken;
        this.expiresAt = expiresAt;
        this.createdAt = new Date();
        this.revoked = false;
    }


    // ==================== 业务方法 ====================

    /**
     * 是否已过期
     */
    public boolean isExpired() {
        return expiresAt != null && expiresAt.before(new Date());
    }

    /**
     * 是否有效（未撤销且未过期）
     */
    public boolean isValid() {
        return !Boolean.TRUE.equals(revoked) && !isExpired();
    }

    /**
     * 撤销 Token
     *
     * @param reason 撤销原因
     */
    public void revoke(String reason) {
        this.revoked = true;
        this.revokedAt = new Date();
        this.revokeReason = reason;
    }

    /**
     * 更新最后使用时间
     */
    public void updateLastUsedAt() {
        this.lastUsedAt = new Date();
    }


    // ==================== Getters and Setters ====================

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getUid() {
        return uid;
    }

    public void setUid(String uid) {
        this.uid = uid;
    }

    public String getRefreshToken() {
        return refreshToken;
    }

    public void setRefreshToken(String refreshToken) {
        this.refreshToken = refreshToken;
    }

    public String getAccessTokenJti() {
        return accessTokenJti;
    }

    public void setAccessTokenJti(String accessTokenJti) {
        this.accessTokenJti = accessTokenJti;
    }

    public Date getExpiresAt() {
        return expiresAt;
    }

    public void setExpiresAt(Date expiresAt) {
        this.expiresAt = expiresAt;
    }

    public Date getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Date createdAt) {
        this.createdAt = createdAt;
    }

    public Date getLastUsedAt() {
        return lastUsedAt;
    }

    public void setLastUsedAt(Date lastUsedAt) {
        this.lastUsedAt = lastUsedAt;
    }

    public String getDeviceInfo() {
        return deviceInfo;
    }

    public void setDeviceInfo(String deviceInfo) {
        this.deviceInfo = deviceInfo;
    }

    public String getIpAddress() {
        return ipAddress;
    }

    public void setIpAddress(String ipAddress) {
        this.ipAddress = ipAddress;
    }

    public Boolean getRevoked() {
        return revoked;
    }

    public void setRevoked(Boolean revoked) {
        this.revoked = revoked;
    }

    public Date getRevokedAt() {
        return revokedAt;
    }

    public void setRevokedAt(Date revokedAt) {
        this.revokedAt = revokedAt;
    }

    public String getRevokeReason() {
        return revokeReason;
    }

    public void setRevokeReason(String revokeReason) {
        this.revokeReason = revokeReason;
    }


    @Override
    public String toString() {
        return "RefreshToken{" +
                "id=" + id +
                ", uid='" + uid + '\'' +
                ", refreshToken='***" + (refreshToken != null ? refreshToken.substring(Math.max(0, refreshToken.length() - 10)) : "") + "'" +
                ", expiresAt=" + expiresAt +
                ", revoked=" + revoked +
                ", deviceInfo='" + deviceInfo + '\'' +
                ", ipAddress='" + ipAddress + '\'' +
                '}';
    }
}
