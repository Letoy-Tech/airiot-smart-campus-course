package edu.campus.v2.web;

/**
 * 登录入参：只在这一层出现明文口令，校验后立刻丢弃，不写日志、不回显。
 */
public record LoginRequest(String username, String password) {

    @Override
    public String toString() {
        return "LoginRequest[username=" + username + ", password=已隐藏]";
    }
}
