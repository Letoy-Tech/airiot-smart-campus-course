package edu.campus.v2.web;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.nullValue;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import edu.campus.v2.device.Device;
import edu.campus.v2.device.DeviceService;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 设备接口测试：只启动 Web 层，服务层用替身，不连数据库、不占 8098 端口。
 */
@WebMvcTest(DeviceController.class)
class DeviceControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private DeviceService deviceService;

    @Test
    void returnsUnifiedEnvelopeAndKeepsOnlineTrueFalseNull() throws Exception {
        given(deviceService.listDevices()).willReturn(List.of(
                new Device("d01", "温湿度01", "environment", "s1", Boolean.TRUE, true),
                new Device("d04", "温湿度04", "environment", "s4", Boolean.FALSE, true),
                new Device("d03", "温湿度03", "environment", "s3", null, true)));

        mockMvc.perform(get("/api/devices"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.message").value("ok"))
                .andExpect(jsonPath("$.data.length()").value(3))
                // 未知必须是 null，不能变成 false
                .andExpect(jsonPath("$.data[0].online").value(true))
                .andExpect(jsonPath("$.data[1].online").value(false))
                .andExpect(jsonPath("$.data[2].online").value(nullValue()))
                .andExpect(content().string(containsString("\"online\":null")))
                .andExpect(content().string(containsString("\"online\":false")))
                // 字段名与约定卡一致，模拟标记保持 true
                .andExpect(jsonPath("$.data[2].id").value("d03"))
                .andExpect(jsonPath("$.data[2].spaceId").value("s3"))
                .andExpect(jsonPath("$.data[2].category").value("environment"))
                .andExpect(jsonPath("$.data[*].simulated").value(everyItem(is(true))));
    }
}
