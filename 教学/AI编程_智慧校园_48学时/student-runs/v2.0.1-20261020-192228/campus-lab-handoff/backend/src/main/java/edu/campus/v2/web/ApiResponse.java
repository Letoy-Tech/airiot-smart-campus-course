package edu.campus.v2.web;

/**
 * 统一响应结构：{code,message,data}。成功时 code=0、message="ok"。
 */
public record ApiResponse<T>(int code, String message, T data) {

    public static <T> ApiResponse<T> ok(T data) {
        return new ApiResponse<>(0, "ok", data);
    }
}
