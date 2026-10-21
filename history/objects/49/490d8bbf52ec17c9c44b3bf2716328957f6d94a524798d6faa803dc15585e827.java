package edu.campus.v2.device;

/**
 * 设备（对外返回结构）：字段与约定卡一致。
 * online 用 Boolean 而不是 boolean：NULL 表示"未知"，必须一路保留为 null。
 */
public record Device(
        String id,
        String name,
        String category,
        String spaceId,
        Boolean online,
        boolean simulated) {
}
