package edu.campus.v2.web;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.nullValue;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import edu.campus.v2.alarm.Alarm;
import edu.campus.v2.auth.LoginSessionStore;
import edu.campus.v2.device.Device;
import edu.campus.v2.history.History;
import edu.campus.v2.history.HistorySample;
import edu.campus.v2.overview.Overview;
import edu.campus.v2.overview.OverviewService;
import edu.campus.v2.point.Point;
import edu.campus.v2.space.Space;
import edu.campus.v2.user.AuthenticatedUser;
import edu.campus.v2.user.Role;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 概览接口测试：只启动 Web 层，服务层用替身，不连数据库、不占 8098 端口。
 * 重点检查三件事：没有令牌必须 401；data 的五个分节齐全；
 * null 读数、0 读数与单位原样输出，不被序列化改义。
 */
@WebMvcTest(OverviewController.class)
class OverviewControllerTest {

    private static final String TOKEN = "test-viewer-token";
    private static final long SAMPLE_TIME = 1792454400000L;

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private OverviewService overviewService;

    @MockitoBean
    private LoginSessionStore sessionStore;

    @Test
    void requiresLoginBeforeReturningOverview() throws Exception {
        mockMvc.perform(get("/api/overview"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(401))
                .andExpect(jsonPath("$.data").value(nullValue()));
    }

    @Test
    void returnsFiveSectionsKeepingNullZeroAndUnit() throws Exception {
        given(sessionStore.find(TOKEN))
                .willReturn(Optional.of(new AuthenticatedUser("viewer", Role.VIEWER)));
        given(overviewService.loadOverview()).willReturn(sampleOverview());

        mockMvc.perform(get("/api/overview").header("Authorization", "Bearer " + TOKEN))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.message").value("ok"))
                .andExpect(jsonPath("$.data.spaces[0].id").value("s1"))
                .andExpect(jsonPath("$.data.devices[0].online").value(true))
                // 缺失读数与缺失采样时间都保持 null
                .andExpect(jsonPath("$.data.points[0].tagId").value("temperature"))
                .andExpect(jsonPath("$.data.points[0].value").value(nullValue()))
                .andExpect(jsonPath("$.data.points[0].time").value(nullValue()))
                .andExpect(jsonPath("$.data.points[0].unit").value("°C"))
                .andExpect(content().string(containsString("\"value\":null")))
                // 0 是有效读数，不能被序列化成 null
                .andExpect(jsonPath("$.data.points[1].value").value(0.0))
                .andExpect(jsonPath("$.data.points[1].unit").value("kW"))
                .andExpect(content().string(containsString("\"value\":0.0")))
                // 历史单位与同一点位的单位一致，样本顺序与 null/0 原样保留
                .andExpect(jsonPath("$.data.history[0].deviceId").value("d01"))
                .andExpect(jsonPath("$.data.history[0].tagId").value("temperature"))
                .andExpect(jsonPath("$.data.history[0].unit").value("°C"))
                .andExpect(jsonPath("$.data.history[0].samples[0].value").value(nullValue()))
                .andExpect(jsonPath("$.data.history[0].samples[1].value").value(0.0))
                .andExpect(jsonPath("$.data.alarms[0].id").value("a01"))
                .andExpect(jsonPath("$.data.alarms[0].status").value("SAMPLE_ACTIVE"))
                .andExpect(jsonPath("$.data.alarms[0].time").value(SAMPLE_TIME));
    }

    /** 手工构造一份读数集合：包含 null 读数、0 读数与各自单位。 */
    private static Overview sampleOverview() {
        return new Overview(
                List.of(new Space("s1", "101教室", "教学楼", "1")),
                List.of(new Device("d01", "温湿度01", "environment", "s1", Boolean.TRUE, true)),
                List.of(
                        new Point("d01", "temperature", null, "°C", null, "missing"),
                        new Point("d05", "power", 0.0, "kW", SAMPLE_TIME, "fresh")),
                List.of(new History("d01", "temperature", "°C", List.of(
                        new HistorySample(1792453500000L, null),
                        new HistorySample(1792453800000L, 0.0)))),
                List.of(new Alarm("a01", "d01", "教学样本：温度提醒；不表示真实校园故障",
                        "SAMPLE_ACTIVE", "NOTICE", SAMPLE_TIME, true)));
    }
}
