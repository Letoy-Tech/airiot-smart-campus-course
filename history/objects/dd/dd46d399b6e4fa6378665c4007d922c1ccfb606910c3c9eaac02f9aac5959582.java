package edu.campus.v2.web;

import edu.campus.v2.user.Role;

/**
 * 对外返回的用户：username 取自数据库账号记录，不含口令摘要。
 */
public record UserView(String username, Role role) {
}
