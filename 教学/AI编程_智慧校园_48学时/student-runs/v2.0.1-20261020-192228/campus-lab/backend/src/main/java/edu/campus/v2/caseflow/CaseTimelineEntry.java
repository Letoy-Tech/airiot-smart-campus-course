package edu.campus.v2.caseflow;

/**
 * 事件时间线的一条记录（对外返回结构）。
 * time 是服务端生成并保存的 epoch 毫秒；actor 取自登录会话，不接受客户端提交。
 */
public record CaseTimelineEntry(
        long time,
        String action,
        String actor,
        String note) {
}
