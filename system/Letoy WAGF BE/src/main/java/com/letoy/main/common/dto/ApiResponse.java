package com.letoy.main.common.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.letoy.main.common.enums.ErrorCode;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * 统一 API 响应包装器 - Phase 6: 响应格式统一
 *
 * <p><strong>设计目标</strong>：
 * <ul>
 *   <li>标准化响应格式：所有 API 返回相同结构</li>
 *   <li>包含追踪信息：timestamp、path、traceId</li>
 *   <li>支持成功和错误两种场景</li>
 *   <li>Builder 模式简化创建</li>
 * </ul>
 *
 * <p><strong>Before (Phase 6之前)</strong>：
 * <pre>
 * // 不同接口返回格式不一致
 * {"status": 0, "msg": "success", "data": {...}}
 * {"status": 10, "msg": "系统错误"}
 * </pre>
 *
 * <p><strong>After (Phase 6)</strong>：
 * <pre>
 * // 成功响应
 * {
 *   "timestamp": "2026-01-04 02:30:00",
 *   "status": 200,
 *   "code": 0,
 *   "message": "操作成功",
 *   "data": {...},
 *   "path": "/api/student/create"
 * }
 *
 * // 错误响应
 * {
 *   "timestamp": "2026-01-04 02:30:00",
 *   "status": 401,
 *   "code": 1001,
 *   "message": "Token 无效",
 *   "path": "/api/student/list",
 *   "traceId": "abc123"
 * }
 * </pre>
 *
 * @param <T> 响应数据类型
 * @author Security Upgrade Team
 * @since 2026-01-04 (Phase 6)
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ApiResponse<T> {

    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    /**
     * 时间戳（格式：yyyy-MM-dd HH:mm:ss）
     */
    private String timestamp;

    /**
     * HTTP 状态码（200, 400, 401, 500 等）
     */
    private int status;

    /**
     * 业务错误码（0=成功，1xxx=认证错误，2xxx=授权错误，3xxx=业务错误，5xxx=系统错误）
     */
    private int code;

    /**
     * 响应消息
     */
    private String message;

    /**
     * 响应数据（成功时返回）
     */
    private T data;

    /**
     * 请求路径
     */
    private String path;

    /**
     * 追踪 ID（用于日志关联）
     */
    private String traceId;

    // ==================== 构造方法 ====================

    public ApiResponse() {
        this.timestamp = LocalDateTime.now().format(FORMATTER);
    }

    public ApiResponse(int status, int code, String message) {
        this();
        this.status = status;
        this.code = code;
        this.message = message;
    }

    public ApiResponse(ErrorCode errorCode) {
        this();
        this.status = errorCode.getHttpStatusValue();
        this.code = errorCode.getCode();
        this.message = errorCode.getMessage();
    }

    // ==================== 静态工厂方法 ====================

    /**
     * 成功响应（无数据）
     */
    public static <T> ApiResponse<T> success() {
        return success(null);
    }

    /**
     * 成功响应（带数据）
     */
    public static <T> ApiResponse<T> success(T data) {
        ApiResponse<T> response = new ApiResponse<>(ErrorCode.SUCCESS);
        response.data = data;
        return response;
    }

    /**
     * 成功响应（带消息和数据）
     */
    public static <T> ApiResponse<T> success(String message, T data) {
        ApiResponse<T> response = new ApiResponse<>(ErrorCode.SUCCESS);
        response.message = message;
        response.data = data;
        return response;
    }

    /**
     * 错误响应（使用 ErrorCode）
     */
    public static <T> ApiResponse<T> error(ErrorCode errorCode) {
        return new ApiResponse<>(errorCode);
    }

    /**
     * 错误响应（使用 ErrorCode + 自定义消息）
     */
    public static <T> ApiResponse<T> error(ErrorCode errorCode, String message) {
        ApiResponse<T> response = new ApiResponse<>(errorCode);
        response.message = message;
        return response;
    }

    /**
     * 错误响应（自定义状态码和消息）
     */
    public static <T> ApiResponse<T> error(int status, int code, String message) {
        return new ApiResponse<>(status, code, message);
    }

    // ==================== Builder 方法 ====================

    public ApiResponse<T> path(String path) {
        this.path = path;
        return this;
    }

    public ApiResponse<T> traceId(String traceId) {
        this.traceId = traceId;
        return this;
    }

    public ApiResponse<T> data(T data) {
        this.data = data;
        return this;
    }

    public ApiResponse<T> message(String message) {
        this.message = message;
        return this;
    }

    // ==================== Getter/Setter ====================

    public String getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(String timestamp) {
        this.timestamp = timestamp;
    }

    public int getStatus() {
        return status;
    }

    public void setStatus(int status) {
        this.status = status;
    }

    public int getCode() {
        return code;
    }

    public void setCode(int code) {
        this.code = code;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public T getData() {
        return data;
    }

    public void setData(T data) {
        this.data = data;
    }

    public String getPath() {
        return path;
    }

    public void setPath(String path) {
        this.path = path;
    }

    public String getTraceId() {
        return traceId;
    }

    public void setTraceId(String traceId) {
        this.traceId = traceId;
    }

    // ==================== 便捷方法 ====================

    /**
     * 判断是否成功
     */
    public boolean isSuccess() {
        return code == ErrorCode.SUCCESS.getCode();
    }

    @Override
    public String toString() {
        return "ApiResponse{" +
                "timestamp='" + timestamp + '\'' +
                ", status=" + status +
                ", code=" + code +
                ", message='" + message + '\'' +
                ", data=" + data +
                ", path='" + path + '\'' +
                ", traceId='" + traceId + '\'' +
                '}';
    }
}
