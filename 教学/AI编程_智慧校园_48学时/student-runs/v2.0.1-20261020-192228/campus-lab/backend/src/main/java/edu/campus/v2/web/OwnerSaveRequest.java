package edu.campus.v2.web;

import com.fasterxml.jackson.databind.annotation.JsonDeserialize;

/**
 * PUT /api/owners/{deviceId} 的请求体：负责人、备注、提交时看到的版本。
 * 没有 role 字段：权限与操作人一律取自后端会话，请求体里的角色不会被读取。
 * expectedVersion 必须是 JSON 非负整数字面量：小数、数字字符串、布尔、null、缺省
 * 或超出 int 范围都会被拒绝（400），不做隐式转换，也不进入写入。
 */
public record OwnerSaveRequest(
        String username,
        String note,
        @JsonDeserialize(using = StrictNonNegativeIntDeserializer.class)
        Integer expectedVersion) {
}
