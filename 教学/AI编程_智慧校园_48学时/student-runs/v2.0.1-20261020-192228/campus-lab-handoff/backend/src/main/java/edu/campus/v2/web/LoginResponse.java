package edu.campus.v2.web;

/**
 * 登录成功响应：{token, user:{username,role}}，不包含任何口令或摘要。
 */
public record LoginResponse(String token, UserView user) {
}
