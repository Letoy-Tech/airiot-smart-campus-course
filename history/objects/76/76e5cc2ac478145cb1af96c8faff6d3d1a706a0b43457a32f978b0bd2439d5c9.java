package edu.campus.v2.owner;

/**
 * 设备责任（对外返回结构）：字段与约定卡一致。
 * 没有记录时版本按 0 处理；首次登记写入 version=1，之后每次成功修改 +1。
 */
public record Owner(
        String deviceId,
        String username,
        String note,
        int version) {
}
