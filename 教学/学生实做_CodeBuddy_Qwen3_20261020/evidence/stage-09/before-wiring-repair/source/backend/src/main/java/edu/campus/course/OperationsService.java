package edu.campus.course;

import static edu.campus.course.CourseModels.*;

import com.fasterxml.jackson.databind.JsonNode;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.*;

@Service
@Profile("teacher-db")
public class OperationsService {
    private final CampusMapper mapper;
    private final CampusProvider provider;
    private final AccountDirectory accounts;
    private final Clock clock;
    private final boolean demoEnabled;

    public OperationsService(
            CampusMapper mapper,
            CampusProvider provider,
            AccountDirectory accounts,
            Clock clock,
            @Value("${course.demo-enabled:false}") boolean enabled) {
        this.mapper = mapper;
        this.provider = provider;
        this.accounts = accounts;
        this.clock = clock;
        this.demoEnabled = enabled;
    }

    public record Scenario(String id, String name, String deviceId, String description) {}

    public List<Scenario> scenarios() {
        return List.of(
                new Scenario("temperature-patrol", "温度巡查", "teaching_env_01", "本地教学事件，不代表设备真实异常"),
                new Scenario(
                        "communication-patrol",
                        "设备通信巡查",
                        "teaching_facility_01",
                        "本地教学事件，不代表设备真实异常"),
                new Scenario("lighting-patrol", "照明巡查", "teaching_light_01", "本地教学事件，不代表设备真实异常"));
    }

    public boolean demoEnabled() {
        return demoEnabled;
    }

    public Map<String, Object> demoStatus() {
        return Map.of(
                "enabled",
                demoEnabled,
                "label",
                "本地场景演示 · 非实时设备报警",
                "scenarios",
                scenarios(),
                "limitations",
                List.of("仅本地模拟事件", "不写 AIRIOT、不控制设备、不发送外部通知"));
    }

    public Map<String, Object> handlers() {
        var items =
                List.of("admin", "manager-a", "manager-b", "viewer").stream()
                        .map(accounts::find)
                        .flatMap(Optional::stream)
                        .filter(this::eligible)
                        .map(a -> Map.of("uid", a.username(), "displayName", a.displayName()))
                        .toList();
        return Map.of("items", items, "currentUid", Access.uid());
    }

    private boolean eligible(AccountDirectory.Account a) {
        return a.enabled() && (a.roles().contains("ADMIN") || a.roles().contains("CAMPUS_MANAGER"));
    }

    private AccountDirectory.Account handler(String uid) {
        var a = accounts.find(uid).orElseThrow(ApiFailure::missing);
        if (!eligible(a)) throw ApiFailure.bad();
        return a;
    }

    private CatalogReader.Device device(String id) {
        return provider.devices().items().stream()
                .filter(d -> d.id().equals(id))
                .findFirst()
                .orElseThrow(ApiFailure::missing);
    }

    private String actorName() {
        return accounts.find(Access.uid())
                .orElseThrow(() -> new ApiFailure(401, "IDENTITY_DISABLED"))
                .displayName();
    }

    private String id() {
        return UUID.randomUUID().toString();
    }

    private void enabled() {
        if (!demoEnabled) throw new ApiFailure(503, "DEMO_DISABLED");
    }

    private long next(long version) {
        if (version == Long.MAX_VALUE) throw ApiFailure.state();
        return version + 1;
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public AlarmCase detail(String id) {
        AlarmCase c = mapper.alarmCase(id);
        if (c == null) throw ApiFailure.missing();
        c.timeline = mapper.caseEvents(id);
        return c;
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Map<String, Object> list(
            String sourceType, String state, String uid, int limit, int skip) {
        if (sourceType != null && !Set.of("DEMO", "AIRIOT").contains(sourceType))
            throw ApiFailure.bad();
        if (state != null && !Set.of("NEW", "ASSIGNED", "IN_PROGRESS", "CLOSED").contains(state))
            throw ApiFailure.bad();
        if (uid != null && (uid.isBlank() || uid.length() > 64)) throw ApiFailure.bad();
        return Map.of(
                "items",
                mapper.cases(sourceType, state, uid, limit, skip),
                "total",
                mapper.countCases(sourceType, state, uid),
                "observedAt",
                clock.millis());
    }

    private void event(AlarmCase c, String action, String note, String from, String previous) {
        CaseEvent e = new CaseEvent();
        e.id = id();
        e.caseId = c.id;
        e.action = action;
        e.actorUid = Access.uid();
        e.actorName = actorName();
        e.note = note;
        e.fromState = from;
        e.toState = c.state;
        e.previousAssigneeUid = previous;
        e.assigneeUid = c.assigneeUid;
        e.sourceState = c.sourceState;
        e.createdAt = c.updatedAt;
        e.caseVersion = c.version;
        mapper.insertCaseEvent(e);
    }

    @Transactional
    public AlarmCase trigger(String scenario, JsonNode body) {
        Access.admin();
        enabled();
        if (body != null) Inputs.fields(body);
        Scenario spec =
                scenarios().stream()
                        .filter(s -> s.id().equals(scenario))
                        .findFirst()
                        .orElseThrow(ApiFailure::missing);
        var device = device(spec.deviceId());
        long now = clock.millis();
        // Lock the existing owner row: concurrent reassignment has a definite before/after order.
        Owner owner = mapper.lockOwner(device.id());
        AlarmCase c = new AlarmCase();
        c.id = id();
        c.sourceType = "DEMO";
        c.sourceScope = "LOCAL_DEMO";
        c.sourceId = id();
        c.scenario = scenario;
        c.deviceId = device.id();
        c.deviceName = device.name();
        c.message = spec.name() + "（本地演练，非设备真实异常）";
        c.level = "DEMO_NOTICE";
        c.occurredAt = now;
        c.sourceState = "ACTIVE";
        c.sourceRawStatus = "DEMO_ACTIVE";
        c.sourceObservedAt = now;
        c.sourceCheckOutcome = "PENDING";
        c.state = "NEW";
        c.createdAt = now;
        c.updatedAt = now;
        c.version = 1;
        String note = "独立本地模拟事件";
        if (owner != null && owner.ownerUid != null) {
            var account = accounts.find(owner.ownerUid);
            if (account.isPresent() && eligible(account.get())) {
                c.assigneeUid = account.get().username();
                c.assigneeName = account.get().displayName();
                c.state = "ASSIGNED";
            } else note += "；原责任人当前无有效处理资格，未自动指派";
        }
        mapper.insertCase(c);
        event(c, "DEMO_TRIGGER", note, null, null);
        return detail(c.id);
    }

    @Transactional
    public AlarmCase update(String id, String action, JsonNode body) {
        switch (action) {
            case "assign" -> {
                Access.admin();
                Inputs.fields(body, "assigneeUid", "note", "expectedVersion");
            }
            case "start", "notes" -> Inputs.fields(body, "note", "expectedVersion");
            case "verify-recovery", "recover" -> {
                Inputs.fields(body, "expectedVersion");
                if (action.equals("recover")) {
                    Access.admin();
                    enabled();
                }
            }
            case "close" -> Inputs.fields(body, "disposition", "expectedVersion");
            default -> throw ApiFailure.missing();
        }
        long expected = Inputs.version(body);
        AlarmCase c = mapper.lockCase(id);
        if (c == null) throw ApiFailure.missing();
        if (!action.equals("assign") && !action.equals("recover")) Access.handler(c.assigneeUid);
        ApiFailure.version(expected, c.version);
        if (c.state.equals("CLOSED")) throw ApiFailure.state();
        String from = c.state, previous = c.assigneeUid, note, eventAction;
        long now = clock.millis();
        switch (action) {
            case "assign" -> {
                var person = handler(Inputs.text(body, "assigneeUid", 64));
                note = Inputs.text(body, "note", 500);
                c.assigneeUid = person.username();
                c.assigneeName = person.displayName();
                c.state = "ASSIGNED";
                c.sourceVerifiedAt = null;
                c.sourceCheckOutcome = "PENDING";
                eventAction = "ASSIGN";
            }
            case "start" -> {
                note = Inputs.text(body, "note", 500);
                if (!c.state.equals("ASSIGNED") || c.assigneeUid == null) throw ApiFailure.state();
                handler(c.assigneeUid);
                c.state = "IN_PROGRESS";
                eventAction = "START";
            }
            case "notes" -> {
                note = Inputs.text(body, "note", 500);
                if (!c.state.equals("IN_PROGRESS")) throw ApiFailure.state();
                eventAction = "NOTE";
            }
            case "recover" -> {
                if (!c.sourceType.equals("DEMO") || !c.sourceScope.equals("LOCAL_DEMO"))
                    throw ApiFailure.state();
                if (c.sourceState.equals("RECOVERED")) return detail(id);
                c.sourceState = "RECOVERED";
                c.sourceRawStatus = "DEMO_RECOVERED";
                c.sourceRecoveredAt = now;
                c.sourceObservedAt = now;
                c.sourceVerifiedAt = null;
                c.sourceCheckOutcome = "PENDING";
                note = "服务端模拟来源恢复，不代表真实设备恢复";
                eventAction = "DEMO_RECOVER";
            }
            case "verify-recovery" -> {
                boolean recovered =
                        c.sourceType.equals("DEMO")
                                && c.sourceScope.equals("LOCAL_DEMO")
                                && c.sourceState.equals("RECOVERED")
                                && c.sourceRawStatus.equals("DEMO_RECOVERED")
                                && c.sourceRecoveredAt != null
                                && c.sourceRecoveredAt >= c.occurredAt;
                c.sourceObservedAt = now;
                c.sourceVerifiedAt = recovered ? now : null;
                c.sourceCheckOutcome = recovered ? "PASS" : "UNKNOWN";
                note = "服务端独立核实本地演练来源：" + c.sourceCheckOutcome;
                eventAction = "VERIFY_RECOVERY";
            }
            case "close" -> {
                note = Inputs.text(body, "disposition", 2000);
                requireClosable(c, mapper.caseEvents(id));
                c.disposition = note;
                c.state = "CLOSED";
                c.closedAt = now;
                eventAction = "CLOSE";
            }
            default -> throw ApiFailure.missing();
        }
        c.version = next(c.version);
        c.updatedAt = now;
        mapper.updateCase(c);
        event(c, eventAction, note, from, previous);
        return detail(id);
    }

    public void requireClosable(AlarmCase c, List<CaseEvent> timeline) {
        // STUDENT_TODO_C09_BEGIN
        if (!"IN_PROGRESS".equals(c.state)
                || timeline.stream().noneMatch(e -> "NOTE".equals(e.action))
                || !"DEMO".equals(c.sourceType)
                || !"LOCAL_DEMO".equals(c.sourceScope)
                || !"RECOVERED".equals(c.sourceState)
                || !"DEMO_RECOVERED".equals(c.sourceRawStatus)
                || c.sourceRecoveredAt == null
                || c.sourceRecoveredAt < c.occurredAt
                || !"PASS".equals(c.sourceCheckOutcome)
                || c.sourceVerifiedAt == null
                || c.sourceVerifiedAt < c.sourceRecoveredAt) throw ApiFailure.state();
        // STUDENT_TODO_C09_END
    }

    public Map<String, Object> owners() {
        return Map.of("items", mapper.owners(), "observedAt", clock.millis());
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Owner owner(String deviceId) {
        device(deviceId);
        Owner owner = mapper.owner(deviceId);
        if (owner == null) throw ApiFailure.missing();
        owner.timeline = mapper.ownerEvents(deviceId);
        return owner;
    }

    @Transactional
    public Owner changeOwner(String deviceId, JsonNode body) {
        Access.admin();
        Inputs.fields(body, "ownerUid", "note", "expectedVersion");
        device(deviceId);
        long expected = Inputs.version(body);
        String note = Inputs.text(body, "note", 500);
        var person = handler(Inputs.text(body, "ownerUid", 64));
        Owner owner = mapper.lockOwner(deviceId);
        if (owner == null) throw ApiFailure.missing();
        checkOwnerVersion(expected, owner.version);
        String previous = owner.ownerUid;
        owner.ownerUid = person.username();
        owner.ownerName = person.displayName();
        owner.updatedAt = clock.millis();
        owner.version = next(owner.version);
        mapper.updateOwner(owner);
        OwnerEvent e = new OwnerEvent();
        e.id = id();
        e.deviceId = deviceId;
        e.actorUid = Access.uid();
        e.actorName = actorName();
        e.note = note;
        e.previousOwnerUid = previous;
        e.ownerUid = owner.ownerUid;
        e.createdAt = owner.updatedAt;
        e.version = owner.version;
        mapper.insertOwnerEvent(e);
        return owner(deviceId);
    }

    public void checkOwnerVersion(long expected, long actual) {
        // STUDENT_TODO_C10_BEGIN
        ApiFailure.version(expected, actual);
        // STUDENT_TODO_C10_END
    }
}
