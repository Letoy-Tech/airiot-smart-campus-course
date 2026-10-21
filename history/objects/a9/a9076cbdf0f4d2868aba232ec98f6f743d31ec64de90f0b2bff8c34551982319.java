package edu.campus.v2.space;

import java.util.List;
import org.springframework.stereotype.Service;

/**
 * 空间业务规则：读取全部空间、校验并修改楼栋与楼层。
 * 是否存在、字段是否合法都在这里判断，控制器只负责收发。
 * 权限（仅 ADMIN）不在这里判断：角色一律由后端会话经 RoleInterceptor 校验。
 */
@Service
public class SpaceService {

    /** 与 spaces.building 列宽一致：VARCHAR(64)。 */
    static final int MAX_BUILDING_LENGTH = 64;

    /** 与 spaces.floor 列宽一致：VARCHAR(16)。 */
    static final int MAX_FLOOR_LENGTH = 16;

    private final SpaceRepository spaceRepository;

    public SpaceService(SpaceRepository spaceRepository) {
        this.spaceRepository = spaceRepository;
    }

    public List<Space> listSpaces() {
        return spaceRepository.findAllOrderById();
    }

    /**
     * 修改一个空间的楼栋与楼层，返回更新后从库里读回的那一行。
     * 先按列宽校验，再确认空间存在；不存在时抛 SpaceNotFoundException（404）。
     */
    public Space updateLocation(String id, String building, String floor) {
        if (id == null || id.isBlank()) {
            throw new SpaceNotFoundException(id);
        }

        String nextBuilding = requireText(building, "楼栋", MAX_BUILDING_LENGTH);
        String nextFloor = requireText(floor, "楼层", MAX_FLOOR_LENGTH);

        if (spaceRepository.findById(id).isEmpty()) {
            throw new SpaceNotFoundException(id);
        }

        int updated = spaceRepository.updateLocation(id, nextBuilding, nextFloor);
        if (updated == 0) {
            // 查到之后又被删除：仍然按“不存在”回答，不谎报成功。
            throw new SpaceNotFoundException(id);
        }

        return spaceRepository.findById(id).orElseThrow(() -> new SpaceNotFoundException(id));
    }

    private static String requireText(String value, String label, int maxLength) {
        String trimmed = value == null ? "" : value.trim();
        if (trimmed.isEmpty()) {
            throw new SpaceValidationException(label + "不能为空");
        }
        if (trimmed.length() > maxLength) {
            throw new SpaceValidationException(label + "不能超过 " + maxLength + " 个字符");
        }
        return trimmed;
    }
}
