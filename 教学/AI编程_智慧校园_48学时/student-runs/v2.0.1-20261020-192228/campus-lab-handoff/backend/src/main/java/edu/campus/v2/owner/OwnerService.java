package edu.campus.v2.owner;

import edu.campus.v2.audit.AuditRepository;
import edu.campus.v2.device.DeviceRepository;
import edu.campus.v2.user.UserRepository;
import java.util.List;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 设备责任业务规则：读取全部责任记录、按版本号登记负责人。
 * 权限（仅 ADMIN）不在这里判断：角色一律由后端会话经 RoleInterceptor 校验。
 * 版本语义：没有记录时当前版本为 0；首次登记写入 1；之后每次成功修改 +1。
 * 成功写入与审计在同一事务中保存；冲突、校验失败不会产生审计。
 */
@Service
public class OwnerService {

    /** 与 owners.note 列宽一致：VARCHAR(255)。 */
    static final int MAX_NOTE_LENGTH = 255;

    /** 与 owners.username 列宽一致：VARCHAR(32)。 */
    static final int MAX_USERNAME_LENGTH = 32;

    private final OwnerRepository ownerRepository;
    private final DeviceRepository deviceRepository;
    private final UserRepository userRepository;
    private final AuditRepository auditRepository;

    public OwnerService(OwnerRepository ownerRepository,
                        DeviceRepository deviceRepository,
                        UserRepository userRepository,
                        AuditRepository auditRepository) {
        this.ownerRepository = ownerRepository;
        this.deviceRepository = deviceRepository;
        this.userRepository = userRepository;
        this.auditRepository = auditRepository;
    }

    public List<Owner> listOwners() {
        return ownerRepository.findAllOrderByDeviceId();
    }

    /**
     * 按提交的 expectedVersion 登记负责人。
     * 版本落后时抛 OwnerVersionConflictException（409），不覆盖库里更新的记录。
     * 成功时返回从库里读回的那一行（版本已 +1），并追加 owner.save 审计。
     */
    @Transactional
    public Owner saveOwner(String deviceId, String username, String note,
                           Integer expectedVersion, String actor) {
        String targetDevice = requireText(deviceId, "设备编号", 16);
        String targetUsername = requireText(username, "负责人", MAX_USERNAME_LENGTH);
        String targetNote = requireText(note, "备注", MAX_NOTE_LENGTH);
        String actingUser = requireText(actor, "操作人", 32);

        if (expectedVersion == null || expectedVersion < 0) {
            throw new OwnerValidationException("负责人版本无效，请重新读取后再登记");
        }

        if (!deviceRepository.existsById(targetDevice)) {
            throw new DeviceNotFoundException(targetDevice);
        }
        if (userRepository.findByUsername(targetUsername).isEmpty()) {
            throw new OwnerValidationException("负责人账号不存在：" + targetUsername);
        }

        int currentVersion = ownerRepository.findByDeviceId(targetDevice)
                .map(Owner::version)
                .orElse(0);

        if (currentVersion != expectedVersion) {
            throw new OwnerVersionConflictException();
        }

        if (expectedVersion == 0) {
            try {
                ownerRepository.insert(targetDevice, targetUsername, targetNote);
            } catch (DuplicateKeyException race) {
                // 两个请求同时以版本 0 插入：后到的那个必须按冲突处理，不能覆盖。
                throw new OwnerVersionConflictException();
            }
        } else if (ownerRepository.updateWithVersion(
                targetDevice, targetUsername, targetNote, expectedVersion) == 0) {
            // 读到之后被别的请求抢先更新：条件更新 0 行，同样按冲突处理。
            throw new OwnerVersionConflictException();
        }

        Owner saved = ownerRepository.findByDeviceId(targetDevice)
                .orElseThrow(OwnerVersionConflictException::new);

        auditRepository.insert(
                actingUser,
                "owner.save",
                targetDevice,
                "负责人 " + saved.username() + "，版本 " + saved.version(),
                System.currentTimeMillis());

        return saved;
    }

    private static String requireText(String value, String label, int maxLength) {
        String trimmed = value == null ? "" : value.trim();
        if (trimmed.isEmpty()) {
            throw new OwnerValidationException(label + "不能为空");
        }
        if (trimmed.length() > maxLength) {
            throw new OwnerValidationException(label + "不能超过 " + maxLength + " 个字符");
        }
        return trimmed;
    }
}
