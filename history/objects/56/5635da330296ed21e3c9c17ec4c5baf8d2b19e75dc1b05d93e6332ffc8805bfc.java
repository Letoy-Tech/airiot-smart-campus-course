package edu.campus.v2.web;

import edu.campus.v2.device.Device;
import edu.campus.v2.device.DeviceService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 设备接口：只负责接收请求、交给服务层、按统一结构返回。
 */
@RestController
@RequestMapping("/api")
public class DeviceController {

    private final DeviceService deviceService;

    public DeviceController(DeviceService deviceService) {
        this.deviceService = deviceService;
    }

    /** 本课暂时允许未登录读取，第09课再加登录校验。 */
    @GetMapping("/devices")
    public ApiResponse<List<Device>> devices() {
        return ApiResponse.ok(deviceService.listDevices());
    }
}
