package com.letoy.main.campus.service;

import com.letoy.main.campus.dto.CampusAlarmDtos.*;
import com.letoy.main.campus.entity.*;
import com.letoy.main.campus.mapper.CampusAlarmMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.UUID;

/** All writes are local. There is deliberately no AIRIOT client or notification dependency. */
@Service
public class CampusAlarmService {
    private static final String DEMO_LABEL = "本地场景演示 · 非实时设备报警";
    private static final List<Scenario> SCENARIOS = List.of(
            new Scenario("temperature-patrol", "温度巡查", "env_demo_01", "本地生成温度异常演示事件，与设备实时读数独立"),
            new Scenario("communication-patrol", "设备通信巡查", "facility_demo_01", "本地生成通信巡查演示事件，不代表设备实际离线"),
            new Scenario("lighting-patrol", "照明巡查", "light_demo_01", "本地生成照明巡查演示事件，不改变灯具或模拟开关"));
    private final CampusAlarmMapper store;
    private final CampusAccess access;
    private final CampusCatalog catalog;
    private final boolean demoEnabled;

    public CampusAlarmService(CampusAlarmMapper store, CampusAccess access, CampusCatalog catalog,
                              @Value("${campus.demo.enabled:false}") boolean demoEnabled) {
        this.store = store;
        this.access = access;
        this.catalog = catalog;
        this.demoEnabled = demoEnabled;
    }
    public DemoStatus demoStatus() {
        access.requireRead();
        return new DemoStatus(demoEnabled, DEMO_LABEL, SCENARIOS, List.of(
                "事件为本地 DEMO 场景，不是 AIRIOT 实时报警", "恢复核实仅针对本地演示来源，不代表真实硬件恢复",
                "演示不修改上游报警、设备读数或开关，不发送外部通知", "全部设备仍为模拟设备；真实校园接入与运营未验收"));
    }
    @Transactional(readOnly = true)
    public CasePage cases(String sourceType, String state, String assigneeUid, int limit, int skip) {
        access.requireRead();
        CampusMonitoringService.validatePage(limit, skip);
        sourceType = optional(sourceType, 16);
        state = optional(state, 16);
        assigneeUid = optional(assigneeUid, 64);
        if (sourceType != null && !Set.of("DEMO", "AIRIOT").contains(sourceType)) throw CampusException.badRequest("来源筛选无效");
        if (state != null && !Set.of("NEW", "ASSIGNED", "IN_PROGRESS", "CLOSED").contains(state)) throw CampusException.badRequest("处置状态筛选无效");
        return new CasePage(store.cases(sourceType, state, assigneeUid, limit, skip), store.caseCount(sourceType, state, assigneeUid), now());
    }
    @Transactional(readOnly = true)
    public AlarmCase detail(String id) {
        access.requireRead();
        AlarmCase item = store.alarmCase(identifier(id));
        if (item == null) throw notFound();
        return withTimeline(item);
    }
    public Handlers handlers() { return new Handlers(access.alarmHandlers(), access.actor().id()); }
    @Transactional(readOnly = true)
    public OwnerPage owners() {
        access.requireRead();
        return new OwnerPage(store.owners().stream().filter(owner -> catalog.find(owner.getDeviceId()) != null).toList(), now());
    }
    @Transactional(readOnly = true)
    public DeviceOwner owner(String deviceId) {
        access.requireRead();
        catalog.require(identifier(deviceId));
        DeviceOwner owner = store.owner(deviceId);
        if (owner == null) throw unavailable();
        owner.setTimeline(store.ownerEvents(deviceId));
        return owner;
    }
    @Transactional
    public DeviceOwner setOwner(String deviceId, Action request) {
        CampusAccess.Actor actor = admin();
        catalog.require(identifier(deviceId));
        Handler handler = access.alarmHandler(request.uid());
        DeviceOwner owner = store.lockOwner(deviceId);
        if (owner == null) throw unavailable();
        version(owner.getVersion(), request.expectedVersion());
        String previous = owner.getOwnerUid();
        owner.setOwnerUid(handler.uid());
        owner.setOwnerName(handler.displayName());
        owner.setUpdatedAt(now());
        owner.setVersion(owner.getVersion() + 1);
        if (store.updateOwner(owner) != 1) throw conflict();
        DeviceOwnerEvent event = new DeviceOwnerEvent();
        event.setId(id()); event.setDeviceId(deviceId); event.setActorUid(actor.id()); event.setActorName(actor.name());
        event.setNote(request.note()); event.setPreviousOwnerUid(previous); event.setOwnerUid(handler.uid());
        event.setCreatedAt(owner.getUpdatedAt()); event.setVersion(owner.getVersion());
        if (store.insertOwnerEvent(event) != 1) throw unavailable();
        owner.setTimeline(store.ownerEvents(deviceId));
        return owner;
    }
    @Transactional
    public AlarmCase trigger(String scenarioId) {
        CampusAccess.Actor actor = admin();
        requireDemo();
        Scenario scenario = SCENARIOS.stream().filter(item -> item.id().equals(scenarioId)).findFirst()
                .orElseThrow(() -> CampusException.badRequest("演示场景不存在"));
        catalog.require(scenario.deviceId());
        long time = now();
        AlarmCase item = new AlarmCase();
        item.setId(id()); item.setSourceType("DEMO"); item.setSourceScope("LOCAL_DEMO"); item.setSourceId("DEMO_" + id());
        item.setScenario(scenario.id()); item.setSimulated(true); item.setDeviceId(scenario.deviceId());
        item.setDeviceName("DEMO 关联设备 " + scenario.deviceId());
        item.setMessage("【本地 DEMO】" + scenario.name() + "场景；关联模拟设备，不代表该设备实际发生异常");
        item.setLevel("DEMO_NOTICE"); item.setOccurredAt(time); item.setSourceState("ACTIVE"); item.setSourceRawStatus("DEMO_ACTIVE");
        item.setSourceObservedAt(time); item.setSourceCheckOutcome("PENDING"); item.setState("NEW");
        item.setCreatedAt(time); item.setUpdatedAt(time); item.setVersion(1);
        String note = "创建独立本地演示事件；未调用上游报警或设备写接口";
        DeviceOwner owner = store.lockOwner(scenario.deviceId());
        if (owner != null && owner.getOwnerUid() != null) {
            Handler handler = null;
            try { handler = access.alarmHandler(owner.getOwnerUid()); }
            catch (CampusException exception) {
                if (exception.getStatus() != 400) throw exception;
                note += "；设备责任人当前不可用，未自动指派";
            }
            if (handler != null) {
                item.setAssigneeUid(handler.uid()); item.setAssigneeName(handler.displayName()); item.setState("ASSIGNED");
                note += "；已按设备责任人自动指派";
            }
        }
        if (store.insertCase(item) != 1) throw unavailable();
        append(item, actor, "DEMO_TRIGGER", note, null, null);
        return withTimeline(item);
    }
    @Transactional
    public AlarmCase assign(String id, Action request) {
        CampusAccess.Actor actor = admin();
        Handler handler = access.alarmHandler(request.uid());
        AlarmCase item = locked(id, request.expectedVersion());
        String from = item.getState(), previous = item.getAssigneeUid();
        item.setAssigneeUid(handler.uid()); item.setAssigneeName(handler.displayName()); item.setState("ASSIGNED");
        return save(item, actor, "ASSIGN", request.note(), from, previous);
    }
    @Transactional
    public AlarmCase start(String id, Action request) {
        CampusAccess.Actor actor = access.actor();
        access.requireHandleAlarms(actor);
        AlarmCase item = locked(id, request.expectedVersion());
        mayHandle(actor, item);
        if (!"ASSIGNED".equals(item.getState()) || item.getAssigneeUid() == null) throw transition("请先指派负责人，再开始处理");
        String from = item.getState(); item.setState("IN_PROGRESS");
        return save(item, actor, "START", request.note(), from, item.getAssigneeUid());
    }
    @Transactional
    public AlarmCase note(String id, Action request) {
        CampusAccess.Actor actor = access.actor();
        access.requireHandleAlarms(actor);
        AlarmCase item = locked(id, request.expectedVersion());
        mayHandle(actor, item);
        if (!"IN_PROGRESS".equals(item.getState())) throw transition("开始处理后才能填写处置记录");
        return save(item, actor, "NOTE", request.note(), item.getState(), item.getAssigneeUid());
    }
    @Transactional
    public AlarmCase recoverDemo(String id, Action request) {
        CampusAccess.Actor actor = admin();
        requireDemo();
        AlarmCase item = locked(id, request.expectedVersion());
        requireLocalDemo(item);
        if ("RECOVERED".equals(item.getSourceState())) return withTimeline(item);
        if (!"ACTIVE".equals(item.getSourceState())) throw transition("此演示来源状态不能恢复");
        long time = now();
        item.setSourceState("RECOVERED"); item.setSourceRawStatus("DEMO_RECOVERED"); item.setSourceRecoveredAt(time);
        item.setSourceObservedAt(time); item.setSourceVerifiedAt(null); item.setSourceCheckOutcome("PENDING");
        return save(item, actor, "DEMO_RECOVER", "演示来源已恢复；仍需核实与本地处置，不代表真实硬件恢复", item.getState(), item.getAssigneeUid());
    }
    @Transactional
    public AlarmCase verifyRecovery(String id, Action request) {
        CampusAccess.Actor actor = access.actor();
        access.requireHandleAlarms(actor);
        AlarmCase item = locked(id, request.expectedVersion());
        mayHandle(actor, item);
        requireLocalDemo(item);
        boolean recovered = recovered(item);
        item.setSourceObservedAt(now()); item.setSourceVerifiedAt(recovered ? now() : null);
        item.setSourceCheckOutcome(recovered ? "PASS" : "UNKNOWN");
        return save(item, actor, "VERIFY_RECOVERY", recovered ? "已核实本地 DEMO 来源恢复；不是 AIRIOT 或真实硬件恢复证明"
                : "本地演示来源尚未恢复，不能关闭", item.getState(), item.getAssigneeUid());
    }
    @Transactional
    public AlarmCase close(String id, Action request) {
        CampusAccess.Actor actor = access.actor();
        access.requireHandleAlarms(actor);
        AlarmCase item = locked(id, request.expectedVersion());
        mayHandle(actor, item);
        requireLocalDemo(item);
        if (!"IN_PROGRESS".equals(item.getState()) || store.noteCount(item.getId()) < 1) throw transition("需先开始处理并保存处置记录");
        if (!recovered(item) || !"PASS".equals(item.getSourceCheckOutcome()) || item.getSourceVerifiedAt() == null
                || item.getSourceVerifiedAt() < item.getSourceRecoveredAt()) throw transition("来源尚未核实恢复，不能关闭");
        String from = item.getState();
        item.setDisposition(request.note()); item.setClosedAt(now()); item.setState("CLOSED");
        return save(item, actor, "CLOSE", request.note(), from, item.getAssigneeUid());
    }
    private AlarmCase locked(String id, long expectedVersion) {
        AlarmCase item = store.lockCase(identifier(id));
        if (item == null) throw notFound();
        version(item.getVersion(), expectedVersion);
        if ("CLOSED".equals(item.getState())) throw transition("事件已关闭，历史记录不可修改");
        return item;
    }
    private void mayHandle(CampusAccess.Actor actor, AlarmCase item) {
        if (!access.capabilities(actor).canAssignAlarms() && !actor.id().equals(item.getAssigneeUid())) throw CampusException.denied();
    }
    private CampusAccess.Actor admin() {
        CampusAccess.Actor actor = access.actor();
        if (!access.capabilities(actor).canAssignAlarms()) throw CampusException.denied();
        return actor;
    }
    private AlarmCase save(AlarmCase item, CampusAccess.Actor actor, String action, String note, String from, String previous) {
        item.setVersion(item.getVersion() + 1); item.setUpdatedAt(now());
        if (store.updateCase(item) != 1) throw conflict();
        append(item, actor, action, note, from, previous);
        return withTimeline(item);
    }
    private void append(AlarmCase item, CampusAccess.Actor actor, String action, String note, String from, String previous) {
        AlarmCaseEvent event = new AlarmCaseEvent();
        event.setId(id()); event.setCaseId(item.getId()); event.setAction(action); event.setActorUid(actor.id());
        event.setActorName(actor.name()); event.setNote(note); event.setFromState(from); event.setToState(item.getState());
        event.setPreviousAssigneeUid(previous); event.setAssigneeUid(item.getAssigneeUid()); event.setSourceState(item.getSourceState());
        event.setCreatedAt(item.getUpdatedAt()); event.setCaseVersion(item.getVersion());
        if (store.insertCaseEvent(event) != 1) throw unavailable();
    }
    private AlarmCase withTimeline(AlarmCase item) { item.setTimeline(store.caseEvents(item.getId())); return item; }
    private boolean recovered(AlarmCase item) {
        return "RECOVERED".equals(item.getSourceState()) && "DEMO_RECOVERED".equals(item.getSourceRawStatus())
                && item.getSourceRecoveredAt() != null && item.getSourceRecoveredAt() >= item.getOccurredAt();
    }
    private void requireLocalDemo(AlarmCase item) {
        if (!"DEMO".equals(item.getSourceType()) || !"LOCAL_DEMO".equals(item.getSourceScope()) || !item.isSimulated()) {
            throw transition("本轮只支持独立本地 DEMO 来源，不能修改或代替上游报警恢复");
        }
    }
    private void requireDemo() { if (!demoEnabled) throw new CampusException(503, "DEMO_DISABLED", "本地演示场景未启用"); }
    private void version(long actual, long expected) { if (actual != expected) throw conflict(); }
    private String identifier(String value) {
        if (value == null || value.isBlank() || value.length() > 64) throw CampusException.badRequest("标识格式无效");
        return value;
    }
    private String optional(String value, int max) {
        if (value == null || value.isBlank()) return null;
        if (value.length() > max) throw CampusException.badRequest("筛选条件过长");
        return value.trim();
    }
    private static String id() { return UUID.randomUUID().toString(); }
    private static long now() { return System.currentTimeMillis(); }
    private static CampusException conflict() { return new CampusException(409, "VERSION_CONFLICT", "事件或责任人已被更新，请刷新后重试"); }
    private static CampusException transition(String message) { return new CampusException(409, "STATE_CONFLICT", message); }
    private static CampusException notFound() { return new CampusException(404, "CASE_NOT_FOUND", "事件不存在"); }
    private static CampusException unavailable() { return new CampusException(503, "LOCAL_STORE_UNAVAILABLE", "本地记录或时间线未保存，操作已回滚"); }
}
