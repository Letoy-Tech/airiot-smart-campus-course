package edu.campus.v2.web;

/**
 * PUT /api/spaces/{id} 的请求体：只接受楼栋与楼层两项。
 * 这里没有 role / username 字段：权限与身份一律取自后端会话，
 * 请求体里即使多传 role 也不会被读取，更不会当成权限。
 */
public record SpaceLocationRequest(String building, String floor) {
}
