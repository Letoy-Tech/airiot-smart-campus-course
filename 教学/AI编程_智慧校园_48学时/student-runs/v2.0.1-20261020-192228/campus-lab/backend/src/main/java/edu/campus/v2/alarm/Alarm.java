package edu.campus.v2.alarm;

/**
 * 原始报警（对外返回结构）：字段与约定卡一致。
 * 只读：不提供确认、恢复、关闭等动作，也不触发任何外部通知。
 * time 为报警原始时间（epoch 毫秒），按库里记录返回，不用当前时间补齐。
 */
public record Alarm(
        String id,
        String deviceId,
        String message,
        String status,
        String level,
        long time,
        boolean simulated) {
}
