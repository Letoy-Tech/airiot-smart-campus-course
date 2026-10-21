package edu.campus.v2.history;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

/**
 * 历史查询语句的针对性检查（不连数据库）：
 * 单位只能来自 points 表，历史样本表不另存一份单位，避免历史与点位单位不一致；
 * 排序必须按样本时间，读取时不重排成别的顺序。
 */
class HistoryRepositorySqlTest {

    @Test
    void unitIsReadFromPointsNotFromHistorySamples() {
        String sql = HistoryRepository.SELECT_ALL_ORDER_BY_POINT_AND_TIME;

        assertTrue(sql.contains("JOIN points"), "历史单位必须按点位表取得");
        assertTrue(sql.contains("p.unit"), "返回的单位列必须是 points.unit");
        assertFalse(sql.toLowerCase().contains("h.unit"), "历史样本表不得另存单位");
    }

    @Test
    void samplesAreOrderedByStoredTime() {
        String sql = HistoryRepository.SELECT_ALL_ORDER_BY_POINT_AND_TIME;

        assertTrue(sql.contains("ORDER BY h.device_id, h.tag_id, h.sample_time"),
                "历史必须按点位与样本时间排序，不生成新样本也不改时间");
    }
}
