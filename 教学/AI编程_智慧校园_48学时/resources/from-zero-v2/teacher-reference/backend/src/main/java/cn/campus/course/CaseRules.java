package cn.campus.course;

import java.util.Map;

/** 业务规则独立于数据库；成功后由 service 在同一个事务中保存事件和审计。 */
public final class CaseRules {
    private CaseRules() {}

    public static void apply(CaseRecord item, User user, String action, long expectedVersion,
                             String note, String username) {
        if ("assign".equals(action) || "recover".equals(action)) {
            user.requireAdmin();
        } else {
            user.requireHandler(item.assignee);
        }
        if (item.version != expectedVersion) {
            throw new ApiException(409, "记录已被更新，请刷新页面后重新决定；不要直接重复提交");
        }
        if ("CLOSED".equals(item.state)) {
            throw new ApiException(409, "事件已经关闭，不能继续修改");
        }
        switch (action) {
            case "assign" -> {
                if (!"manager".equals(username)) {
                    throw new ApiException(400, "本课请分派给 manager");
                }
                if (!"NEW".equals(item.state) && !"ASSIGNED".equals(item.state)) {
                    throw new ApiException(409, "开始处理后不能重新分派");
                }
                text(note, "请填写分派说明");
                item.assignee = username;
                item.state = "ASSIGNED";
            }
            case "start" -> {
                require("ASSIGNED".equals(item.state), "请先分派，再开始处理");
                item.state = "IN_PROGRESS";
            }
            case "note" -> {
                require("IN_PROGRESS".equals(item.state), "请先开始处理，再填写处置记录");
                item.note = text(note, "请填写处置记录");
                item.verified = false;
            }
            case "recover" -> {
                require("IN_PROGRESS".equals(item.state), "请先开始处理，再模拟来源恢复");
                item.sourceState = "RECOVERED";
                item.verified = false;
            }
            case "verify" -> {
                require("IN_PROGRESS".equals(item.state) && !blank(item.note)
                        && "RECOVERED".equals(item.sourceState), "先完成处置记录并由管理员模拟来源恢复，再单独核验");
                item.verified = true;
            }
            case "close" -> {
                require("IN_PROGRESS".equals(item.state) && !blank(item.note)
                        && "RECOVERED".equals(item.sourceState) && item.verified,
                        "关闭前需要处置记录、来源恢复和单独核验");
                item.conclusion = text(note, "请填写关闭结论");
                item.state = "CLOSED";
            }
            default -> throw new ApiException(400, "不支持这个事件动作");
        }
        item.version++;
        item.timeline.add(Map.of("time", System.currentTimeMillis(), "username", user.username(),
                "action", action, "note", note == null ? "" : note.trim(), "version", item.version));
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }

    private static String text(String value, String message) {
        if (blank(value)) {
            throw new ApiException(400, message);
        }
        return value.trim();
    }

    private static void require(boolean condition, String message) {
        if (!condition) {
            throw new ApiException(409, message);
        }
    }
}
