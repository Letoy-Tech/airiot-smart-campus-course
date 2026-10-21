package edu.campus.v2.history;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * 历史分组测试：不连数据库，只验证合并规则。
 * 重点：null 与 0 各自保持原义；样本按时间升序；单位沿用同一点位在 points 里的值。
 */
class HistoryGroupingTest {

    @Test
    void groupsByDeviceAndTagAndSortsSamplesByTime() {
        List<History> history = HistoryGrouping.group(List.of(
                new HistoryRow("d01", "temperature", "°C", 1792453500000L, 24.0),
                new HistoryRow("d01", "temperature", "°C", 1792452900000L, 23.8),
                new HistoryRow("d01", "humidity", "%", 1792452900000L, 61.0)));

        assertEquals(2, history.size());
        assertEquals("d01", history.get(0).deviceId());
        assertEquals("temperature", history.get(0).tagId());
        assertEquals(
                List.of(1792452900000L, 1792453500000L),
                history.get(0).samples().stream().map(HistorySample::time).toList(),
                "样本必须按时间升序，缺的时刻不补点");
        assertEquals("humidity", history.get(1).tagId());
    }

    @Test
    void nullSampleStaysEmptyAndZeroSampleStaysValidReading() {
        List<History> history = HistoryGrouping.group(List.of(
                new HistoryRow("d01", "temperature", "°C", 1792453500000L, null),
                new HistoryRow("d01", "temperature", "°C", 1792453800000L, 0.0)));

        List<HistorySample> samples = history.get(0).samples();
        assertEquals(2, samples.size(), "缺口保留为空样本，不删除也不插值");
        assertNull(samples.get(0).value(), "缺失读数必须是 null");
        assertEquals(Double.valueOf(0.0), samples.get(1).value(), "0 是有效读数，不能变成 null");
    }

    @Test
    void unitComesFromPointAndStaysPerPoint() {
        List<History> history = HistoryGrouping.group(List.of(
                new HistoryRow("d01", "temperature", "°C", 1792452900000L, 24.0),
                new HistoryRow("d05", "power", "kW", 1792452900000L, 0.0),
                new HistoryRow("d09", "status", "", 1792452900000L, 1.0)));

        assertEquals("°C", history.get(0).unit());
        assertEquals("kW", history.get(1).unit());
        assertEquals("", history.get(2).unit(), "无单位的状态量保持空串");
    }
}
