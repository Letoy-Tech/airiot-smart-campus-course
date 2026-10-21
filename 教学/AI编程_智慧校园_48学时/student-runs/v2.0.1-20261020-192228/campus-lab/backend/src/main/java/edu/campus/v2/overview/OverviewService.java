package edu.campus.v2.overview;

import edu.campus.v2.alarm.AlarmRepository;
import edu.campus.v2.device.DeviceService;
import edu.campus.v2.history.HistoryRepository;
import edu.campus.v2.point.PointRepository;
import edu.campus.v2.space.SpaceRepository;
import org.springframework.stereotype.Service;

/**
 * 概览服务：把五张表的读取结果合成一份读数集合。
 * 只读，不写库、不生成新样本、不做设备控制。
 */
@Service
public class OverviewService {

    private final SpaceRepository spaceRepository;
    private final DeviceService deviceService;
    private final PointRepository pointRepository;
    private final HistoryRepository historyRepository;
    private final AlarmRepository alarmRepository;

    public OverviewService(
            SpaceRepository spaceRepository,
            DeviceService deviceService,
            PointRepository pointRepository,
            HistoryRepository historyRepository,
            AlarmRepository alarmRepository) {
        this.spaceRepository = spaceRepository;
        this.deviceService = deviceService;
        this.pointRepository = pointRepository;
        this.historyRepository = historyRepository;
        this.alarmRepository = alarmRepository;
    }

    public Overview loadOverview() {
        return new Overview(
                spaceRepository.findAllOrderById(),
                deviceService.listDevices(),
                pointRepository.findAllOrderByDeviceAndTag(),
                historyRepository.findAllGroupedByPoint(),
                alarmRepository.findAllOrderByTime());
    }
}
