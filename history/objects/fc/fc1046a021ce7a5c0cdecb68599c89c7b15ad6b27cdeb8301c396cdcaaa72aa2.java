package edu.campus.v2.caseflow;

import java.util.List;

/**
 * 演练事件（对外返回结构）：字段与约定卡一致。
 * 创建时 version=1、sourceState=ACTIVE、verified=false；
 * assignee 未分派时为 null，timeline 至少包含一条 create 记录。
 */
public record Case(
        String id,
        String deviceId,
        String message,
        String state,
        String assignee,
        String sourceState,
        boolean verified,
        String note,
        String conclusion,
        int version,
        List<CaseTimelineEntry> timeline) {

    public Case {
        timeline = timeline == null ? List.of() : List.copyOf(timeline);
    }

    /** 行映射先得到不含时间线的事件，再按 case_id 分组后补上时间线。 */
    public Case withTimeline(List<CaseTimelineEntry> entries) {
        return new Case(id, deviceId, message, state, assignee, sourceState,
                verified, note, conclusion, version, entries);
    }
}
