package edu.campus.v2.overview;

import edu.campus.v2.alarm.Alarm;
import edu.campus.v2.device.Device;
import edu.campus.v2.history.History;
import edu.campus.v2.point.Point;
import edu.campus.v2.space.Space;
import java.util.List;

/**
 * 概览读数集合（对外返回结构）：{spaces,devices,points,history,alarms}。
 * 五部分全部来自 MySQL 现有记录，字段名与前端已有练习数据一致；
 * 不在读取时补造实时读数，也不用当前时间冒充采样时间。
 */
public record Overview(
        List<Space> spaces,
        List<Device> devices,
        List<Point> points,
        List<History> history,
        List<Alarm> alarms) {
}
