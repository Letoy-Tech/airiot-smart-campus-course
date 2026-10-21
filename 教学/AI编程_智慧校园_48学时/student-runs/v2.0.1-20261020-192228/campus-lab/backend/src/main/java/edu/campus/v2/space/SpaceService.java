package edu.campus.v2.space;

import edu.campus.v2.audit.AuditRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 空间业务规则：读取全部空间、校验并修改楼栋与楼层。
 * 是否存在、字段是否合法都在这里判断，控制器只负责收发。
 * 权限（仅 ADMIN）不在这里判断：角色一律由后端会话经 RoleInterceptor 校验。
 * 成功修改与审计在同一事务中写入；校验失败或更新失败不会产生审计。
 */
@Service
public class SpaceService {

    /** 与 spaces.building 列宽一致：VARCHAR(64)。 */
    static final int MAX_BUILDING_LENGTH = 64;

    /** 与 spaces.floor 列宽一致：VARCHAR(16)。 */
    static final int MAX_FLOOR_LENGTH = 16;

    private final SpaceRepository spaceRepository;
    private final AuditRepository auditRepository;

    public SpaceService(SpaceRepository spaceRepository, AuditRepository auditRepository) {
        this.spaceRepository = spaceRepository;
        this.auditRepository = auditRepository;
    }

    public List<Space> listSpaces() {
        return spaceRepository.findAllOrderById();
    }

    /**
     * 修改一个空间的楼栋与楼层，返回更新后从库里读回的那一行。
     * 先按列宽校验，再确认空间存在；不存在时抛 SpaceNotFoundException（404）。
     * 成功写入后追加 space.update 审计，审计失败会让本次修改一起回滚。
     */
    @Transactional
    public Space updateLocation(String id, String building, String floor, String actor) {
        if (id == null || id.isBlank()) {
            throw new SpaceNotFoundException(id);
        }

        String nextBuilding = requireText(building, "楼栋", MAX_BUILDING_LENGTH);
        String nextFloor = requireText(floor, "楼层", MAX_FLOOR_LENGTH);
        String actingUser = requireText(actor, "操作人", 32);

        if (spaceRepository.findById(id).isEmpty()) {
            throw new SpaceNotFoundException(id);
        }

        int updated = spaceRepository.updateLocation(id, nextBuilding, nextFloor);
        if (updated == 0) {
            // 查到之后又被删除：仍然按“不存在”回答，不谎报成功。
            throw new SpaceNotFoundException(id);
        }

        Space saved = spaceRepository.findById(id)
                .orElseThrow(() -> new SpaceNotFoundException(id));

        auditRepository.insert(
                actingUser,
                "space.update",
                id,
                "楼栋 " + nextBuilding + "，楼层 " + nextFloor,
                System.currentTimeMillis());

        return saved;
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
