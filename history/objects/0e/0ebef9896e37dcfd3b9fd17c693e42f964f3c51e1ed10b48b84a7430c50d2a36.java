package edu.campus.v2.caseflow;

import edu.campus.v2.audit.AuditRepository;
import edu.campus.v2.device.DeviceRepository;
import edu.campus.v2.owner.DeviceNotFoundException;
import edu.campus.v2.owner.Owner;
import edu.campus.v2.owner.OwnerRepository;
import edu.campus.v2.user.AuthenticatedUser;
import edu.campus.v2.user.Role;
import edu.campus.v2.user.UserAccount;
import edu.campus.v2.user.UserRepository;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 演练事件业务规则：创建、列表，以及 assign / start / note / recover / verify / close 六个动作。
 * 端点级角色（浏览者不能调用动作）由 RoleInterceptor 先拦一次；
 * 动作内部还会按“动作 + 事件归属”再判断一次，不能只依赖前端隐藏按钮。
 * 服务端生成编号、创建时间、version=1、sourceState=ACTIVE、verified=false；
 * 客户端提交的处理人、状态、时间等字段一律不读，不能伪造。
 */
@Service
public class CaseService {

    /** 与 cases.message 列宽一致：VARCHAR(500)。 */
    static final int MAX_MESSAGE_LENGTH = 500;

    /** 与 cases.note / case_timeline.note 列宽一致。 */
    static final int MAX_NOTE_LENGTH = 500;

    /** 约定卡：只有处理人 manager 才会被自动分派。 */
    static final String HANDLER_USERNAME = "manager";

    /** 约定卡的六个事件动作：assign、start、note、recover、verify、close。 */
    static final Set<String> SUPPORTED_ACTIONS =
            Set.of("assign", "start", "note", "recover", "verify", "close");

    private final CaseRepository caseRepository;
    private final DeviceRepository deviceRepository;
    private final OwnerRepository ownerRepository;
    private final UserRepository userRepository;
    private final AuditRepository auditRepository;

    public CaseService(CaseRepository caseRepository,
                       DeviceRepository deviceRepository,
                       OwnerRepository ownerRepository,
                       UserRepository userRepository,
                       AuditRepository auditRepository) {
        this.caseRepository = caseRepository;
        this.deviceRepository = deviceRepository;
        this.ownerRepository = ownerRepository;
        this.userRepository = userRepository;
        this.auditRepository = auditRepository;
    }

    public List<Case> listCases() {
        return caseRepository.findAllOrderByCreatedAt();
    }

    /**
     * 创建设备演练事件：事件与创建时间线在同一次事务里写入 MySQL。
     * 已登记责任人为 manager 时自动分派并设 ASSIGNED，否则为 NEW；
     * 处理人只来自 owners 表，不来自请求体。
     */
    @Transactional
    public Case createCase(String deviceId, String message, String actor) {
        String targetDevice = requireText(deviceId, "设备编号", 16);
        String targetMessage = requireText(message, "事件内容", MAX_MESSAGE_LENGTH);
        String actingUser = requireText(actor, "当前登录账号", 32);

        if (!deviceRepository.existsById(targetDevice)) {
            throw new DeviceNotFoundException(targetDevice);
        }

        String assignee = null;
        String state = "NEW";
        String timelineNote = "创建教学模拟演练事件，等待管理员分派";

        Optional<Owner> owner = ownerRepository.findByDeviceId(targetDevice);
        if (owner.isPresent() && HANDLER_USERNAME.equals(owner.get().username())) {
            assignee = owner.get().username();
            state = "ASSIGNED";
            timelineNote = "创建教学模拟演练事件，按已登记责任人分派给 " + assignee;
        }

        long createdAt = System.currentTimeMillis();
        String id = newCaseId();

        Case created = new Case(
                id,
                targetDevice,
                targetMessage,
                state,
                assignee,
                "ACTIVE",
                false,
                "",
                "",
                1,
                List.of());

        CaseTimelineEntry creation = new CaseTimelineEntry(
                createdAt, "create", actingUser, timelineNote);

        caseRepository.insert(created, createdAt, List.of(creation));

        // 事件、创建时间线、审计同属一个事务：审计失败时事件也不会留下。
        auditRepository.insert(
                actingUser,
                "case.create",
                id,
                "设备 " + targetDevice,
                createdAt);

        // 返回从 MySQL 读回的事件，页面看到的是实际保存结果，不是请求体拼出来的对象。
        return caseRepository.findById(id)
                .orElseThrow(() -> new IllegalStateException("演练事件写入后未能读回"));
    }

    /**
     * 执行 assign / start / note：主记录、时间线、审计在同一个事务里保存。
     * 版本先比较；条件更新仍以 version 为条件，两个请求同时提交时只有一个能成功，另一个 409。
     * 409 后不自动重试：由页面重新 GET 回读，学生按最新状态重新决定。
     */
    @Transactional
    public Case applyAction(String caseId, String action, Integer expectedVersion,
                            String note, String username, AuthenticatedUser actor) {
        String id = requireText(caseId, "事件编号", 32);
        String actionName = requireText(action, "动作", 16);

        if (!SUPPORTED_ACTIONS.contains(actionName)) {
            throw new CaseValidationException("不支持的事件动作");
        }
        if (expectedVersion == null || expectedVersion < 0) {
            throw new CaseValidationException("expectedVersion 必须是 JSON 非负整数");
        }
        if (actor == null || actor.role() == Role.VIEWER) {
            throw new CaseActionForbiddenException();
        }
        // assign、recover 只允许 ADMIN：在读取事件前就拒绝，不泄露事件是否存在。
        if (("assign".equals(actionName) || "recover".equals(actionName))
                && actor.role() != Role.ADMIN) {
            throw new CaseActionForbiddenException();
        }

        Case current = caseRepository.findById(id)
                .orElseThrow(() -> new CaseNotFoundException(id));

        // manager 只能处理已分派给自己的事件；先判断归属，再比较版本。
        if (actor.role() == Role.MANAGER
                && !actor.username().equals(current.assignee())) {
            throw new CaseActionForbiddenException();
        }

        if (current.version() != expectedVersion) {
            throw new CaseVersionConflictException();
        }

        // 关闭后拒绝任何后续动作，包括再次关闭；条件更新因此一行都不会发生。
        if ("CLOSED".equals(current.state())) {
            throw new CaseStateException("事件已关闭，不能再修改");
        }

        long now = System.currentTimeMillis();
        CaseTimelineEntry entry;
        String auditAction;
        String auditNote;

        if ("assign".equals(actionName)) {
            if (!"NEW".equals(current.state())) {
                throw new CaseStateException(assignStateMessage(current.state()));
            }

            String target = requireText(username, "处理人", 32);
            UserAccount account = userRepository.findByUsername(target)
                    .filter(UserAccount::enabled)
                    .filter(item -> item.role() == Role.MANAGER)
                    .orElseThrow(() -> new CaseValidationException("处理人必须是有效的 manager 账号"));

            String reason = requireText(note, "分派说明", MAX_NOTE_LENGTH);
            if (caseRepository.updateAssign(id, account.username(), expectedVersion, now) == 0) {
                throw new CaseVersionConflictException();
            }

            entry = new CaseTimelineEntry(now, "assign", actor.username(), reason);
            auditAction = "case.assign";
            auditNote = "分派给 " + account.username();
        } else if ("start".equals(actionName)) {
            if (!"ASSIGNED".equals(current.state())) {
                throw new CaseStateException(startStateMessage(current.state()));
            }
            if (caseRepository.updateStart(id, expectedVersion, now) == 0) {
                throw new CaseVersionConflictException();
            }

            entry = new CaseTimelineEntry(now, "start", actor.username(), "开始处理");
            auditAction = "case.start";
            auditNote = "开始处理";
        } else if ("note".equals(actionName)) {
            if (!"IN_PROGRESS".equals(current.state())) {
                throw new CaseStateException(noteStateMessage(current.state()));
            }

            String record = requireText(note, "处置记录", MAX_NOTE_LENGTH);
            if (caseRepository.updateNote(id, record, expectedVersion, now) == 0) {
                throw new CaseVersionConflictException();
            }

            entry = new CaseTimelineEntry(now, "note", actor.username(), record);
            auditAction = "case.note";
            auditNote = "填写处置记录";
        } else if ("recover".equals(actionName)) {
            if (!"IN_PROGRESS".equals(current.state())) {
                throw new CaseStateException(recoverStateMessage(current.state()));
            }
            if (!"ACTIVE".equals(current.sourceState())) {
                throw new CaseStateException("来源已恢复，不需要重复操作");
            }

            if (caseRepository.updateRecover(id, expectedVersion, now) == 0) {
                throw new CaseVersionConflictException();
            }

            // 只改本地演练的来源状态，不改变事件状态，也不声称真实设备已恢复。
            entry = new CaseTimelineEntry(now, "recover", actor.username(),
                    "本地演练来源标记为已恢复（教学模拟，不声称真实设备恢复）");
            auditAction = "case.recover";
            auditNote = "本地演练来源已恢复";
        } else if ("verify".equals(actionName)) {
            if (!"IN_PROGRESS".equals(current.state())) {
                throw new CaseStateException(verifyStateMessage(current.state()));
            }
            // 服务端重新读取数据库中的 source_state，不接受客户端提交的 verified=true。
            if (!"RECOVERED".equals(current.sourceState())) {
                throw new CaseStateException("来源尚未恢复，不能核实");
            }
            if (current.verified()) {
                throw new CaseStateException("来源恢复已核实，不需要重复核实");
            }

            if (caseRepository.updateVerify(id, expectedVersion, now) == 0) {
                throw new CaseVersionConflictException();
            }

            entry = new CaseTimelineEntry(now, "verify", actor.username(),
                    "已核实本地演练来源恢复（教学模拟）");
            auditAction = "case.verify";
            auditNote = "核实本地演练来源恢复";
        } else {
            // close：状态、处置记录、来源恢复、独立核实四项条件全部满足才能关闭。
            if (!"IN_PROGRESS".equals(current.state())) {
                throw new CaseStateException(closeStateMessage(current.state()));
            }
            if (current.note() == null || current.note().trim().isEmpty()) {
                throw new CaseStateException("请先填写处置记录，再关闭事件");
            }
            if (!"RECOVERED".equals(current.sourceState())) {
                throw new CaseStateException("来源尚未恢复，不能关闭事件");
            }
            if (!current.verified()) {
                throw new CaseStateException("来源恢复尚未核实，不能关闭事件");
            }

            String conclusion = requireText(note, "关闭结论", MAX_NOTE_LENGTH);
            if (caseRepository.updateClose(id, conclusion, expectedVersion, now) == 0) {
                throw new CaseVersionConflictException();
            }

            entry = new CaseTimelineEntry(now, "close", actor.username(), conclusion);
            auditAction = "case.close";
            auditNote = "关闭事件";
        }

        // 时间线与审计与上面的条件更新处于同一事务：任一步失败，主记录也会回滚。
        int seq = caseRepository.nextTimelineSeq(id);
        caseRepository.insertTimeline(id, seq, entry);
        auditRepository.insert(actor.username(), auditAction, id, auditNote, now);

        return caseRepository.findById(id)
                .orElseThrow(() -> new CaseNotFoundException(id));
    }

    private static String assignStateMessage(String state) {
        return switch (state) {
            case "ASSIGNED" -> "事件已分派，不需要重复分派";
            case "IN_PROGRESS" -> "事件已在处理中，不能再分派";
            case "CLOSED" -> "事件已关闭，不能再分派";
            default -> "当前状态不能分派";
        };
    }

    private static String startStateMessage(String state) {
        return switch (state) {
            case "NEW" -> "事件尚未分派，不能开始处理";
            case "IN_PROGRESS" -> "事件已在处理中，不能重复开始";
            case "CLOSED" -> "事件已关闭，不能再修改";
            default -> "当前状态不能开始处理";
        };
    }

    private static String noteStateMessage(String state) {
        return switch (state) {
            case "NEW" -> "事件尚未分派，不能填写处置记录";
            case "ASSIGNED" -> "请先开始处理，再填写处置记录";
            case "CLOSED" -> "事件已关闭，不能再修改";
            default -> "当前状态不能填写处置记录";
        };
    }

    private static String recoverStateMessage(String state) {
        return switch (state) {
            case "NEW" -> "事件尚未分派，不能恢复来源";
            case "ASSIGNED" -> "请先开始处理，再恢复来源";
            case "CLOSED" -> "事件已关闭，不能再修改";
            default -> "当前状态不能恢复来源";
        };
    }

    private static String verifyStateMessage(String state) {
        return switch (state) {
            case "NEW" -> "事件尚未分派，不能核实来源";
            case "ASSIGNED" -> "请先开始处理，再核实来源";
            case "CLOSED" -> "事件已关闭，不能再修改";
            default -> "当前状态不能核实来源";
        };
    }

    private static String closeStateMessage(String state) {
        return switch (state) {
            case "NEW" -> "事件尚未分派，不能关闭";
            case "ASSIGNED" -> "请先开始处理，再关闭事件";
            case "CLOSED" -> "事件已关闭，不能再修改";
            default -> "当前状态不能关闭事件";
        };
    }

    /** 服务端编号：case- 加 12 位十六进制随机串，避免使用客户端提交的编号。 */
    private static String newCaseId() {
        return "case-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
    }

    private static String requireText(String value, String label, int maxLength) {
        String trimmed = value == null ? "" : value.trim();
        if (trimmed.isEmpty()) {
            throw new CaseValidationException(label + "不能为空");
        }
        if (trimmed.length() > maxLength) {
            throw new CaseValidationException(label + "不能超过 " + maxLength + " 个字符");
        }
        return trimmed;
    }
}
