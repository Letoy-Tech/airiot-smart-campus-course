package edu.campus.v2.history;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 把扁平的历史样本行按"设备 + 点位"合并成 History。
 * 只做分组与排序，不改读数：null 仍是 null，0 仍是 0。
 */
public final class HistoryGrouping {

    private HistoryGrouping() {
    }

    /**
     * 分组并保证每个点位的样本按时间升序；点位顺序按首次出现的顺序保留。
     * 单位取自行里的 points.unit。
     */
    public static List<History> group(List<HistoryRow> rows) {
        Map<PointKey, List<HistorySample>> samplesByPoint = new LinkedHashMap<>();
        Map<PointKey, String> unitByPoint = new HashMap<>();

        for (HistoryRow row : rows) {
            PointKey key = new PointKey(row.deviceId(), row.tagId());
            unitByPoint.putIfAbsent(key, row.unit());
            samplesByPoint.computeIfAbsent(key, ignored -> new ArrayList<>())
                    .add(new HistorySample(row.time(), row.value()));
        }

        List<History> history = new ArrayList<>(samplesByPoint.size());
        samplesByPoint.forEach((key, samples) -> {
            samples.sort(Comparator.comparingLong(HistorySample::time));
            history.add(new History(key.deviceId(), key.tagId(), unitByPoint.get(key), List.copyOf(samples)));
        });
        return List.copyOf(history);
    }

    /** 点位的两个标识：设备编号与点位标识。 */
    private record PointKey(String deviceId, String tagId) {
    }
}
