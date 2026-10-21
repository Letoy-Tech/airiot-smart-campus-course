package com.letoy.main.common.enums;

import org.springframework.http.HttpStatus;

/**
 * 统一错误码枚举 - Phase 6: 错误码统一
 *
 * <p><strong>设计原则</strong>：
 * <ul>
 *   <li>每个错误码包含：业务代码、HTTP 状态码、消息模板</li>
 *   <li>按类别组织：认证(1xxx)、授权(2xxx)、业务(3xxx)、系统(5xxx)</li>
 *   <li>与 HTTP 状态码对应，便于前端处理</li>
 *   <li>支持国际化（消息模板使用 i18n key）</li>
 * </ul>
 *
 * <p><strong>Before (Phase 6之前)</strong>：
 * <pre>
 * // Constants.java - 混乱的错误码
 * public static final int REQUEST_TOO_MANY_TIMES = 5;
 * public static final int PHONE_NUMBER_DUPLICATED = 5;  // ❌ 冲突
 * public static final int TOKEN_INVALID = 6;
 * public static final int AUTH_FAIL = 6;                // ❌ 重复
 * </pre>
 *
 * <p><strong>After (Phase 6)</strong>：
 * <pre>
 * // 使用统一枚举
 * ErrorCode.AUTH_TOKEN_INVALID      // code=1001, http=401
 * ErrorCode.AUTH_TOKEN_EXPIRED      // code=1002, http=401
 * ErrorCode.RATE_LIMIT_EXCEEDED     // code=2001, http=429
 * ErrorCode.BUSINESS_PHONE_DUPLICATED // code=3001, http=400
 * </pre>
 *
 * @author Security Upgrade Team
 * @since 2026-01-04 (Phase 6)
 */
public enum ErrorCode {

    // ==================== 成功 (0xxx) ====================
    SUCCESS(0, HttpStatus.OK, "操作成功"),

    // ==================== 认证错误 (1xxx) ====================
    AUTH_TOKEN_INVALID(1001, HttpStatus.UNAUTHORIZED, "auth_error.invalid_token"),
    AUTH_TOKEN_EXPIRED(1002, HttpStatus.UNAUTHORIZED, "auth_error.token_expired"),
    AUTH_TOKEN_REVOKED(1003, HttpStatus.UNAUTHORIZED, "auth_error.token_revoked"),
    AUTH_USER_NOT_EXIST(1004, HttpStatus.UNAUTHORIZED, "auth_error.user_not_exist"),
    AUTH_PASSWORD_INCORRECT(1005, HttpStatus.UNAUTHORIZED, "auth_error.password_incorrect"),
    AUTH_USER_NOT_ACTIVATED(1006, HttpStatus.UNAUTHORIZED, "auth_error.user_not_activated"),
    AUTH_LOGIN_FAILED(1007, HttpStatus.UNAUTHORIZED, "auth_error.login_failed"),
    AUTH_NO_AUTHENTICATION(1008, HttpStatus.UNAUTHORIZED, "auth_error.no_authentication"),

    // ==================== 授权错误 (2xxx) ====================
    AUTHZ_ACCESS_DENIED(2001, HttpStatus.FORBIDDEN, "authz_error.access_denied"),
    AUTHZ_INSUFFICIENT_PERMISSIONS(2002, HttpStatus.FORBIDDEN, "authz_error.insufficient_permissions"),
    AUTHZ_RATE_LIMIT_EXCEEDED(2003, HttpStatus.TOO_MANY_REQUESTS, "authz_error.rate_limit_exceeded"),

    // ==================== 业务错误 (3xxx) ====================
    BUSINESS_PHONE_DUPLICATED(3001, HttpStatus.BAD_REQUEST, "business_error.phone_duplicated"),
    BUSINESS_VALIDATION_FAILED(3002, HttpStatus.BAD_REQUEST, "business_error.validation_failed"),
    BUSINESS_RESOURCE_NOT_FOUND(3003, HttpStatus.NOT_FOUND, "business_error.resource_not_found"),
    BUSINESS_OPERATION_FAILED(3004, HttpStatus.BAD_REQUEST, "business_error.operation_failed"),
    BUSINESS_ACTIVE_CODE_INVALID(3005, HttpStatus.BAD_REQUEST, "business_error.active_code_invalid"),
    BUSINESS_ACTIVE_CODE_EXPIRED(3006, HttpStatus.BAD_REQUEST, "business_error.active_code_expired"),

    // ==================== 请求错误 (4xxx) ====================
    REQUEST_PARAMETER_MISSING(4001, HttpStatus.BAD_REQUEST, "request_error.parameter_missing"),
    REQUEST_PARAMETER_INVALID(4002, HttpStatus.BAD_REQUEST, "request_error.parameter_invalid"),
    REQUEST_HEADER_MISSING(4003, HttpStatus.BAD_REQUEST, "request_error.header_missing"),

    // ==================== 系统错误 (5xxx) ====================
    SYSTEM_INTERNAL_ERROR(5001, HttpStatus.INTERNAL_SERVER_ERROR, "server_error.internal_error"),
    SYSTEM_DATABASE_ERROR(5002, HttpStatus.INTERNAL_SERVER_ERROR, "server_error.data_error"),
    SYSTEM_NETWORK_ERROR(5003, HttpStatus.INTERNAL_SERVER_ERROR, "server_error.network_error"),
    SYSTEM_UNEXPECTED_ERROR(5004, HttpStatus.INTERNAL_SERVER_ERROR, "server_error.unexpected_error"),

    // ==================== 向后兼容（Deprecated，Phase 7 移除） ====================
    @Deprecated
    LEGACY_REQUEST_TOO_MANY_TIMES(5, HttpStatus.TOO_MANY_REQUESTS, "请求过于频繁"),
    @Deprecated
    LEGACY_AUTH_FAIL(6, HttpStatus.UNAUTHORIZED, "认证失败"),
    @Deprecated
    LEGACY_EXPECTED_ERROR(9, HttpStatus.BAD_REQUEST, "业务错误"),
    @Deprecated
    LEGACY_SYSTEM_ERROR(10, HttpStatus.INTERNAL_SERVER_ERROR, "系统错误");

    private final int code;
    private final HttpStatus httpStatus;
    private final String message;

    ErrorCode(int code, HttpStatus httpStatus, String message) {
        this.code = code;
        this.httpStatus = httpStatus;
        this.message = message;
    }

    /**
     * 获取业务错误码
     */
    public int getCode() {
        return code;
    }

    /**
     * 获取 HTTP 状态码
     */
    public HttpStatus getHttpStatus() {
        return httpStatus;
    }

    /**
     * 获取 HTTP 状态码值
     */
    public int getHttpStatusValue() {
        return httpStatus.value();
    }

    /**
     * 获取错误消息（i18n key 或默认消息）
     */
    public String getMessage() {
        return message;
    }

    /**
     * 获取错误消息（支持参数替换）
     *
     * @param args 消息参数
     * @return 格式化后的错误消息
     */
    public String getMessage(Object... args) {
        if (args == null || args.length == 0) {
            return message;
        }
        return String.format(message, args);
    }

    /**
     * 根据业务代码查找 ErrorCode
     *
     * @param code 业务代码
     * @return ErrorCode（找不到则返回 SYSTEM_UNEXPECTED_ERROR）
     */
    public static ErrorCode fromCode(int code) {
        for (ErrorCode errorCode : values()) {
            if (errorCode.code == code) {
                return errorCode;
            }
        }
        return SYSTEM_UNEXPECTED_ERROR;
    }

    /**
     * 判断是否为成功
     */
    public boolean isSuccess() {
        return this == SUCCESS;
    }

    /**
     * 判断是否为认证错误
     */
    public boolean isAuthError() {
        return code >= 1000 && code < 2000;
    }

    /**
     * 判断是否为授权错误
     */
    public boolean isAuthzError() {
        return code >= 2000 && code < 3000;
    }

    /**
     * 判断是否为业务错误
     */
    public boolean isBusinessError() {
        return code >= 3000 && code < 4000;
    }

    /**
     * 判断是否为系统错误
     */
    public boolean isSystemError() {
        return code >= 5000 && code < 6000;
    }
}
