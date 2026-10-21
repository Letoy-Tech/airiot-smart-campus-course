package edu.campus.v2.space;

/**
 * 空间（对外返回结构）：字段与约定卡一致。
 * 楼栋、楼层只按库里记录返回，不在读取时改写。
 */
public record Space(
        String id,
        String name,
        String building,
        String floor) {
}
