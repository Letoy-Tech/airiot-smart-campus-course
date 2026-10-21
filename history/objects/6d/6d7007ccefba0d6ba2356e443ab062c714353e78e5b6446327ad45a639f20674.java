package edu.campus.v2.device;

import java.util.List;
import org.springframework.stereotype.Service;

/**
 * 设备服务：目前只把查询结果按约定顺序返回，后续课的过滤、权限等规则放这里。
 */
@Service
public class DeviceService {

    private final DeviceRepository deviceRepository;

    public DeviceService(DeviceRepository deviceRepository) {
        this.deviceRepository = deviceRepository;
    }

    public List<Device> listDevices() {
        return deviceRepository.findAllOrderById();
    }
}
