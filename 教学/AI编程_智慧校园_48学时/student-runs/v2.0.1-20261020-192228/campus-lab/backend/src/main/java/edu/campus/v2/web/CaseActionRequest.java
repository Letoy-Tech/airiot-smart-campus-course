package edu.campus.v2.web;

import com.fasterxml.jackson.databind.annotation.JsonDeserialize;

/**
 * POST /api/cases/{id}/actions 的请求体。
 * action 只接受 assign / start / note；expectedVersion 必须是 JSON 非负整数字面量。
 * username 只用于 assign 的处理人；start / note 的操作人一律取自登录会话，不读这个字段。
 * 没有 role、state、createdAt 等字段：状态与时间由服务端决定，客户端不能伪造。
 */
public record CaseActionRequest(
        String action,
        @JsonDeserialize(using = StrictNonNegativeIntDeserializer.class)
        Integer expectedVersion,
        String note,
        String username) {
}
