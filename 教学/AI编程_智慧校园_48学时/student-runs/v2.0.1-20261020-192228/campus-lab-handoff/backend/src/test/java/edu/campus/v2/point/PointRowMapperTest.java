package edu.campus.v2.point;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;

import java.math.BigDecimal;
import java.sql.ResultSet;
import org.junit.jupiter.api.Test;

/**
 * 点位行映射测试：用替身 ResultSet 确认三件事不会被改义：
 * 1) NULL 读数仍是 null；2) 读数 0 仍是有效的 0；3) 单位按点位记录原样返回。
 */
class PointRowMapperTest {

    private final PointRowMapper mapper = new PointRowMapper();

    @Test
    void missingReadingStaysNullAndKeepsUnit() throws Exception {
        Point point = mapper.mapRow(resultSet("°C", null, null, "missing"), 0);

        assertNull(point.value(), "没有读数必须是 null，不能用 0 代替");
        assertNull(point.time(), "没有采样时间必须是 null，不能用读取时刻代替");
        assertEquals("°C", point.unit());
        assertEquals("missing", point.quality());
    }

    @Test
    void zeroReadingStaysZeroAndIsNotNull() throws Exception {
        Point point = mapper.mapRow(resultSet("kW", new BigDecimal("0.000"), 1792454400000L, "fresh"), 0);

        assertEquals(Double.valueOf(0.0), point.value(), "读到 0 就是 0，不能当成没有读数");
        assertNotNull(point.value());
        assertEquals(Long.valueOf(1792454400000L), point.time());
    }

    @Test
    void keepsUnitAsStoredPerPoint() throws Exception {
        assertEquals("kW", mapper.mapRow(resultSet("kW", 1.6, 1792454400000L, "fresh"), 0).unit());
        assertEquals("°C", mapper.mapRow(resultSet("°C", 24.0, 1792454400000L, "fresh"), 0).unit());
        assertEquals("", mapper.mapRow(resultSet("", 1, 1792454400000L, "fresh"), 0).unit(),
                "无单位的状态量保持空串，不自行补单位");
    }

    /** 造一个只填了本测试关心列的 ResultSet 替身。 */
    private static ResultSet resultSet(String unit, Object value, Object sampleTime, String quality)
            throws Exception {
        ResultSet rs = mock(ResultSet.class);
        given(rs.getString("device_id")).willReturn("d05");
        given(rs.getString("tag_id")).willReturn("power");
        given(rs.getString("unit")).willReturn(unit);
        given(rs.getString("quality")).willReturn(quality);
        given(rs.getObject("value")).willReturn(value);
        given(rs.getObject("sample_time")).willReturn(sampleTime);
        return rs;
    }
}
