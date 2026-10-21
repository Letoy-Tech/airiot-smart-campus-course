package edu.campus.v2.history;

/**
 * 一行 history_samples 记录（连 points 取得单位后的扁平结果）。
 * unit 来自 points 表，这样历史与点位的单位天然一致，不会出现两份不同的单位。
 */
public record HistoryRow(
        String deviceId,
        String tagId,
        String unit,
        long time,
        Double value) {
}
