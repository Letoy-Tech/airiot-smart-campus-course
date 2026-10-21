package edu.campus.v2.point;

/**
 * 点位读数（对外返回结构）：字段与约定卡一致。
 * value 用 Double 而不是 double：NULL 表示"没有读数"，必须一路保留为 null；
 * 0 是"有效读到 0"，两者不能互相替代。
 * time 用 Long：没有采样时间就返回 null，不用读取时刻冒充采样时间。
 * unit 与点位记录一致，读取时不改写、不推断。
 */
public record Point(
        String deviceId,
        String tagId,
        Double value,
        String unit,
        Long time,
        String quality) {
}
