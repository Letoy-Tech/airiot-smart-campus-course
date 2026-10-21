package edu.campus.v2.web;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 接入说明接口：需登录，三种角色都可读。
 * 原样返回教学模拟标记，不把 AIRIOT 或真实设备说成已连接。
 */
@RestController
@RequestMapping("/api")
public class IntegrationController {

    private static final IntegrationStatus TEACHING_MOCK =
            new IntegrationStatus("TEACHING_MOCK", true, false, false);

    @GetMapping("/integration")
    public ApiResponse<IntegrationStatus> integration() {
        return ApiResponse.ok(TEACHING_MOCK);
    }
}
