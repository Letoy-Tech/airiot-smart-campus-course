package com.letoy.main.campus.service;

import com.letoy.main.auth.entity.AuthUser;
import com.letoy.main.campus.airiot.AiriotProperties;
import com.letoy.main.campus.dto.CampusAlarmDtos.*;
import com.letoy.main.campus.entity.*;
import com.letoy.main.campus.mapper.CampusAlarmMapper;
import com.letoy.main.role.entity.RoleInfo;
import com.letoy.main.role.mapper.RoleInfoMapper;
import com.letoy.main.user.entity.UserInfo;
import com.letoy.main.user.mapper.UserInfoMapper;
import org.junit.jupiter.api.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Service state/authorization tests only; actual database concurrency is verified separately. */
class CampusAlarmTests {
    private CampusAlarmMapper store;
    private CampusAlarmService service;
    private CampusAccess access;
    private UserInfoMapper users;
    private RoleInfoMapper roles;
    private final Map<String, UserInfo> people = new HashMap<>();
    private final Map<String, AlarmCase> cases = new HashMap<>();
    private final Map<String, List<AlarmCaseEvent>> timeline = new HashMap<>();
    private DeviceOwner owner;
    @BeforeEach void setup() {
        users = mock(UserInfoMapper.class); roles = mock(RoleInfoMapper.class); store = mock(CampusAlarmMapper.class);
        for (String role : List.of("ADMIN", "CAMPUS_MANAGER", "CAMPUS_VIEWER")) {
            people.put(role, UserInfo.builder().uid(role).username("TEST " + role).nickname("TEST " + role)
                    .active(true).accountLocked(false).roles(role).build());
        }
        when(users.getUserInfoByUid(anyString())).thenAnswer(call -> people.get(call.getArgument(0)));
        when(users.getAllUsers()).thenAnswer(call -> new ArrayList<>(people.values()));
        when(roles.selectAll(null, 1)).thenReturn(List.of("ADMIN", "CAMPUS_MANAGER", "CAMPUS_VIEWER").stream()
                .map(role -> RoleInfo.builder().roleCode(role).status(1).build()).toList());
        AiriotProperties properties = new AiriotProperties();
        properties.setControlEnabled(true);
        access = new CampusAccess(users, roles, properties);
        service = new CampusAlarmService(store, access, new CampusCatalog(), true);
        when(store.insertCase(any())).thenAnswer(call -> { AlarmCase item = call.getArgument(0); cases.put(item.getId(), item); return 1; });
        when(store.lockCase(anyString())).thenAnswer(call -> cases.get(call.getArgument(0)));
        when(store.alarmCase(anyString())).thenAnswer(call -> cases.get(call.getArgument(0)));
        when(store.updateCase(any())).thenReturn(1);
        when(store.insertCaseEvent(any())).thenAnswer(call -> {
            AlarmCaseEvent event = call.getArgument(0);
            timeline.computeIfAbsent(event.getCaseId(), key -> new ArrayList<>()).add(event); return 1;
        });
        when(store.caseEvents(anyString())).thenAnswer(call -> new ArrayList<>(timeline.getOrDefault(call.getArgument(0), List.of())));
        when(store.noteCount(anyString())).thenAnswer(call -> timeline.getOrDefault(call.getArgument(0), List.of()).stream()
                .filter(event -> "NOTE".equals(event.getAction())).count());
        owner = new DeviceOwner(); owner.setDeviceId("env_demo_01");
        when(store.lockOwner("env_demo_01")).thenReturn(owner); when(store.owner("env_demo_01")).thenReturn(owner);
        when(store.updateOwner(any())).thenReturn(1); when(store.insertOwnerEvent(any())).thenReturn(1);
        current("ADMIN");
    }
    @AfterEach void clear() { SecurityContextHolder.clearContext(); }
    private void current(String uid) {
        AuthUser principal = new AuthUser(); principal.setId(uid);
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(principal, null, List.of()));
    }
    private Action action(AlarmCase item, String note) { return new Action(null, note, item.getVersion()); }
    private AlarmCase created() { return service.trigger("temperature-patrol"); }
    private AlarmCase inProgress() {
        AlarmCase item = created();
        service.assign(item.getId(), new Action("CAMPUS_MANAGER", "TEST 指派", item.getVersion()));
        return service.start(item.getId(), action(item, "TEST 开始巡查"));
    }
    @Test void demoOffBlocksCreationAndStatusRemainsHonest() {
        CampusAlarmService disabled = new CampusAlarmService(store, access, new CampusCatalog(), false);
        assertFalse(disabled.demoStatus().enabled());
        assertEquals(503, assertThrows(CampusException.class, () -> disabled.trigger("temperature-patrol")).getStatus());
        verifyNoInteractions(store);
    }
    @Test void repeatedTriggerCreatesIndependentClearlyLabeledEvents() {
        AlarmCase first = created(), second = created();
        assertNotEquals(first.getId(), second.getId()); assertNotEquals(first.getSourceId(), second.getSourceId());
        assertEquals("DEMO", first.getSourceType()); assertEquals("LOCAL_DEMO", first.getSourceScope()); assertTrue(first.isSimulated());
        assertEquals("ACTIVE", first.getSourceState()); assertEquals("NEW", first.getState());
        assertTrue(first.getMessage().contains("不代表该设备实际发生异常"));
        assertEquals("DEMO_TRIGGER", first.getTimeline().get(0).getAction());
        assertEquals("ADMIN", first.getTimeline().get(0).getActorUid());
    }
    @Test void ownerAutoAssignsOnlyAnEligibleHandler() {
        owner.setOwnerUid("CAMPUS_MANAGER");
        AlarmCase first = created();
        assertEquals("ASSIGNED", first.getState()); assertEquals("CAMPUS_MANAGER", first.getAssigneeUid());
        people.get("CAMPUS_MANAGER").setAccountLocked(true);
        AlarmCase second = created();
        assertEquals("NEW", second.getState()); assertNull(second.getAssigneeUid());
        assertTrue(second.getTimeline().get(0).getNote().contains("责任人当前不可用"));
    }
    @Test void viewerCannotWriteAndManagerCannotCreateAssignOrRecover() {
        AlarmCase item = created();
        current("CAMPUS_VIEWER");
        assertEquals(403, assertThrows(CampusException.class, () -> service.start(item.getId(), action(item, "TEST"))).getStatus());
        current("CAMPUS_MANAGER");
        assertEquals(403, assertThrows(CampusException.class, () -> service.trigger("temperature-patrol")).getStatus());
        assertEquals(403, assertThrows(CampusException.class, () -> service.assign(item.getId(), new Action("CAMPUS_MANAGER", "TEST", item.getVersion()))).getStatus());
        assertEquals(403, assertThrows(CampusException.class, () -> service.recoverDemo(item.getId(), action(item, null))).getStatus());
    }
    @Test void managerHandlesOnlyOwnCaseAndLockOrRoleRevocationIsImmediate() {
        AlarmCase item = created();
        service.assign(item.getId(), new Action("ADMIN", "TEST", item.getVersion()));
        current("CAMPUS_MANAGER");
        assertEquals(403, assertThrows(CampusException.class, () -> service.start(item.getId(), action(item, "TEST"))).getStatus());
        current("ADMIN"); service.assign(item.getId(), new Action("CAMPUS_MANAGER", "TEST", item.getVersion()));
        current("CAMPUS_MANAGER"); service.start(item.getId(), action(item, "TEST"));
        assertEquals("IN_PROGRESS", item.getState());
        people.get("CAMPUS_MANAGER").setAccountLocked(true);
        assertThrows(CampusException.class, () -> service.note(item.getId(), action(item, "TEST")));
        people.get("CAMPUS_MANAGER").setAccountLocked(false);
        when(roles.selectAll(null, 1)).thenReturn(List.of(RoleInfo.builder().roleCode("ADMIN").status(1).build()));
        assertThrows(CampusException.class, () -> service.note(item.getId(), action(item, "TEST")));
    }
    @Test void staleVersionRejectsMutationWithoutReplacingTimeline() {
        AlarmCase item = created(); long old = item.getVersion();
        service.assign(item.getId(), new Action("CAMPUS_MANAGER", "TEST 指派", old));
        int count = item.getTimeline().size();
        assertEquals(409, assertThrows(CampusException.class, () -> service.assign(item.getId(), new Action("ADMIN", "TEST 冲突", old))).getStatus());
        assertEquals("CAMPUS_MANAGER", item.getAssigneeUid()); assertEquals(count, timeline.get(item.getId()).size());
    }
    @Test void sourceRecoveryDoesNotCloseAndVerificationAloneDoesNotMeanRecovered() {
        AlarmCase item = inProgress();
        service.verifyRecovery(item.getId(), action(item, null));
        assertEquals("UNKNOWN", item.getSourceCheckOutcome()); assertNull(item.getSourceVerifiedAt());
        service.recoverDemo(item.getId(), action(item, null));
        assertEquals("RECOVERED", item.getSourceState()); assertEquals("IN_PROGRESS", item.getState());
        assertEquals("PENDING", item.getSourceCheckOutcome()); assertNull(item.getClosedAt());
        int count = item.getTimeline().size(); long version = item.getVersion();
        service.recoverDemo(item.getId(), action(item, null));
        assertEquals(version, item.getVersion()); assertEquals(count, timeline.get(item.getId()).size());
    }
    @Test void closeRequiresDispositionNoteAndSeparateRecoveryVerification() {
        AlarmCase item = inProgress();
        assertThrows(CampusException.class, () -> service.close(item.getId(), action(item, "TEST 关闭")));
        service.note(item.getId(), action(item, "TEST 检查关联演示设备"));
        assertThrows(CampusException.class, () -> service.close(item.getId(), action(item, "TEST 关闭")));
        service.recoverDemo(item.getId(), action(item, null));
        assertThrows(CampusException.class, () -> service.close(item.getId(), action(item, "TEST 关闭")));
        service.verifyRecovery(item.getId(), action(item, null));
        current("CAMPUS_MANAGER"); service.close(item.getId(), action(item, "TEST 巡查完毕，演示来源恢复已核实"));
        assertEquals("CLOSED", item.getState()); assertNotNull(item.getClosedAt()); assertEquals("RECOVERED", item.getSourceState());
        List<String> actions = item.getTimeline().stream().map(AlarmCaseEvent::getAction).toList();
        assertEquals(List.of("DEMO_TRIGGER", "ASSIGN", "START", "NOTE", "DEMO_RECOVER", "VERIFY_RECOVERY", "CLOSE"), actions);
        assertEquals("CAMPUS_MANAGER", item.getTimeline().get(6).getActorUid());
        assertThrows(CampusException.class, () -> service.note(item.getId(), action(item, "TEST 不可修改历史")));
    }
    @Test void reassignRequiresNewHandlerToStartAgain() {
        AlarmCase item = inProgress();
        service.note(item.getId(), action(item, "TEST 原处置记录"));
        service.assign(item.getId(), new Action("ADMIN", "TEST 转派", item.getVersion()));
        assertEquals("ASSIGNED", item.getState());
        assertThrows(CampusException.class, () -> service.note(item.getId(), action(item, "TEST")));
        service.start(item.getId(), action(item, "TEST 新负责人接手"));
        assertEquals(1, store.noteCount(item.getId()));
    }
    @Test void cannotUseDemoRecoveryForAnUpstreamCaseOrUnprovenRecovery() {
        AlarmCase item = inProgress(); item.setSourceType("AIRIOT");
        assertThrows(CampusException.class, () -> service.recoverDemo(item.getId(), action(item, null)));
        assertThrows(CampusException.class, () -> service.verifyRecovery(item.getId(), action(item, null)));
        item.setSourceType("DEMO"); item.setSourceState("RECOVERED"); item.setSourceRawStatus("UNKNOWN_ENUM");
        service.verifyRecovery(item.getId(), action(item, null));
        assertEquals("UNKNOWN", item.getSourceCheckOutcome()); assertNull(item.getSourceVerifiedAt());
    }
    @Test void ownershipVersionAndResponsibleUserAreCheckedAndAuditCannotBeSkipped() {
        DeviceOwner changed = service.setOwner("env_demo_01", new Action("CAMPUS_MANAGER", "TEST 设为责任人", 0));
        assertEquals(1, changed.getVersion()); assertEquals("CAMPUS_MANAGER", changed.getOwnerUid());
        verify(store).insertOwnerEvent(argThat(event -> event.getVersion() == 1 && "ADMIN".equals(event.getActorUid()) && event.getPreviousOwnerUid() == null));
        assertEquals(409, assertThrows(CampusException.class, () -> service.setOwner("env_demo_01", new Action("ADMIN", "TEST", 0))).getStatus());
        assertEquals(400, assertThrows(CampusException.class, () -> service.setOwner("env_demo_01", new Action("CAMPUS_VIEWER", "TEST", 1))).getStatus());
        current("CAMPUS_MANAGER");
        assertEquals(403, assertThrows(CampusException.class, () -> service.setOwner("env_demo_01", new Action("CAMPUS_MANAGER", "TEST", 1))).getStatus());
    }
    @Test void timelineFailurePropagatesInsteadOfReturningSuccess() {
        AlarmCase item = inProgress(); doReturn(0).when(store).insertCaseEvent(any());
        assertEquals(503, assertThrows(CampusException.class, () -> service.note(item.getId(), action(item, "TEST"))).getStatus());
        // A transaction-backed integration test is needed to verify DB rollback, not this mapper mock.
    }
    @Test void handlersExposeOnlyEligibleIdentityFieldsAndCurrentUid() {
        people.get("CAMPUS_MANAGER").setActive(false);
        Handlers result = service.handlers();
        assertEquals("ADMIN", result.currentUid()); assertEquals(List.of(new Handler("ADMIN", "TEST ADMIN")), result.items());
        current("CAMPUS_VIEWER"); assertFalse(access.capabilities().canHandleAlarms());
        assertFalse(access.capabilities().canAssignAlarms()); assertFalse(access.capabilities().canRunDemoScenarios());
    }
}
