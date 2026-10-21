package edu.campus.v2.device;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;

import java.sql.ResultSet;
import org.junit.jupiter.api.Test;

/**
 * 行映射测试：用替身 ResultSet 验证 online 列的 true / false / NULL 不会被改义。
 */
class DeviceRowMapperTest {

    private final DeviceRowMapper mapper = new DeviceRowMapper();

    @Test
    void onlineTrueStaysTrue() throws Exception {
        Device device = mapper.mapRow(resultSet(Boolean.TRUE), 0);

        assertEquals(Boolean.TRUE, device.online());
        assertTrue(device.simulated());
        assertEquals("s1", device.spaceId());
    }

    @Test
    void onlineFalseStaysFalseWhenDriverReturnsNumber() throws Exception {
        // 驱动把 TINYINT(1) 当数字返回时，0 也要认成 false
        Device device = mapper.mapRow(resultSet(0), 0);

        assertEquals(Boolean.FALSE, device.online());
    }

    @Test
    void onlineNullStaysNull() throws Exception {
        Device device = mapper.mapRow(resultSet(null), 0);

        assertNull(device.online());
    }

    /** 造一个只填了本测试关心列的 ResultSet 替身。 */
    private static ResultSet resultSet(Object online) throws Exception {
        ResultSet rs = mock(ResultSet.class);
        given(rs.getString("id")).willReturn("d01");
        given(rs.getString("name")).willReturn("温湿度01");
        given(rs.getString("category")).willReturn("environment");
        given(rs.getString("space_id")).willReturn("s1");
        given(rs.getObject("online")).willReturn(online);
        given(rs.getObject("simulated")).willReturn(Boolean.TRUE);
        return rs;
    }
}
