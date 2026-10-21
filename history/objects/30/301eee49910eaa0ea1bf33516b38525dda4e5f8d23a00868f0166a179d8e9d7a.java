package edu.campus.v2.history;

import java.util.List;

/**
 * 一个点位的历史（对外返回结构）：字段与约定卡一致。
 * unit 与同一点位在 points 表中的单位一致，读取时按点位给出，不从样本另存一份。
 * samples 按样本时间升序，缺口保持为空（不插值、不补点）。
 */
public record History(
        String deviceId,
        String tagId,
        String unit,
        List<HistorySample> samples) {
}
