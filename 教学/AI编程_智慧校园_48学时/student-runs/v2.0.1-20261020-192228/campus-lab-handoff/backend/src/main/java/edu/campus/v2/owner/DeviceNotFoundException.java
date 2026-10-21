package edu.campus.v2.owner;

/**
 * 责任登记指向的设备不存在。调用方必须返回 404，
 * 不能凭空创建一条关联到不存在设备的责任记录。
 */
public class DeviceNotFoundException extends RuntimeException {

    private final String deviceId;

    public DeviceNotFoundException(String deviceId) {
        super("找不到该设备");
        this.deviceId = deviceId;
    }

    /** 仅用于日志排查，不进入响应体。 */
    public String deviceId() {
        return deviceId;
    }
}
