package edu.campus.v2.web;

/**
 * 接入状态：只说明本课程使用教学模拟数据，未连接真实校园或 AIRIOT。
 * controlEnabled 与 notificationsEnabled 固定为 false：不控制设备、不发外部通知。
 */
public record IntegrationStatus(
        String source,
        boolean simulated,
        boolean controlEnabled,
        boolean notificationsEnabled) {
}
