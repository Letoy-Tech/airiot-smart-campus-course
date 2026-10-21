package edu.campus.v2.web;

/**
 * POST /api/cases 的请求体：只接收 deviceId 与 message。
 * 编号、时间、版本、状态、处理人都不在这里，客户端无法通过请求体伪造。
 */
public record CaseCreateRequest(String deviceId, String message) {
}
