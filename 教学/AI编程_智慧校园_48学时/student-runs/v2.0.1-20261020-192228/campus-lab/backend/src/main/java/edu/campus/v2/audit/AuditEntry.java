package edu.campus.v2.audit;

/**
 * 审计记录（对外返回结构）：谁、何时、对哪个对象做了哪个动作。
 * 只包含业务字段；不包含密码、令牌、请求头或完整请求体。
 */
public record AuditEntry(
        long time,
        String actor,
        String action,
        String targetId,
        String note) {
}
