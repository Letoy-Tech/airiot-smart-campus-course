package edu.campus.v2.caseflow;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.mockito.Mockito.never;

import edu.campus.v2.audit.AuditRepository;
import edu.campus.v2.device.DeviceRepository;
import edu.campus.v2.owner.OwnerRepository;
import edu.campus.v2.user.AuthenticatedUser;
import edu.campus.v2.user.Role;
import edu.campus.v2.user.UserAccount;
import edu.campus.v2.user.UserRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * 事件动作测试：只验证服务层规则，不连数据库。
 * 版本冲突、角色拒绝、错误状态、关闭条件都在这里覆盖；事务边界由 @Transactional 声明。
 */
@ExtendWith(MockitoExtension.class)
class CaseActionServiceTest {

    private static final String CASE_ID = "case-1";

    @Mock
    private CaseRepository caseRepository;

    @Mock
    private DeviceRepository deviceRepository;

    @Mock
    private OwnerRepository ownerRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private AuditRepository auditRepository;

    @InjectMocks
    private CaseService caseService;

    @Test
    void adminAssignsValidManagerAndWritesTimelineAndAudit() {
        given(caseRepository.findById(CASE_ID))
                .willReturn(Optional.of(caseWith("NEW", null, 1)),
                        Optional.of(caseWith("ASSIGNED", "manager", 2)));
        given(userRepository.findByUsername("manager"))
                .willReturn(Optional.of(account("manager", Role.MANAGER)));
        given(caseRepository.updateAssign(eq(CASE_ID), eq("manager"), eq(1), anyLong()))
                .willReturn(1);
        given(caseRepository.nextTimelineSeq(CASE_ID)).willReturn(2);

        Case result = caseService.applyAction(
                CASE_ID, "assign", 1, "请到现场复核", "manager", user("admin", Role.ADMIN));

        assertThat(result.state()).isEqualTo("ASSIGNED");
        assertThat(result.assignee()).isEqualTo("manager");
        assertThat(result.version()).isEqualTo(2);

        ArgumentCaptor<CaseTimelineEntry> entry = ArgumentCaptor.forClass(CaseTimelineEntry.class);
        then(caseRepository).should().insertTimeline(eq(CASE_ID), eq(2), entry.capture());
        assertThat(entry.getValue().action()).isEqualTo("assign");
        assertThat(entry.getValue().actor()).isEqualTo("admin");
        assertThat(entry.getValue().note()).isEqualTo("请到现场复核");

        then(auditRepository).should().insert(
                eq("admin"), eq("case.assign"), eq(CASE_ID), eq("分派给 manager"), anyLong());
    }

    @Test
    void managerCannotAssign() {
        assertThatThrownBy(() -> caseService.applyAction(
                CASE_ID, "assign", 1, "越权分派", "manager", user("manager", Role.MANAGER)))
                .isInstanceOf(CaseActionForbiddenException.class);

        then(caseRepository).should(never()).findById(anyString());
        then(caseRepository).should(never()).updateAssign(anyString(), anyString(), eq(1), anyLong());
    }

    @Test
    void viewerCannotPerformAnyAction() {
        assertThatThrownBy(() -> caseService.applyAction(
                CASE_ID, "start", 1, null, null, user("viewer", Role.VIEWER)))
                .isInstanceOf(CaseActionForbiddenException.class);

        then(caseRepository).should(never()).findById(anyString());
    }

    @Test
    void assignToNonManagerIsRejected() {
        given(caseRepository.findById(CASE_ID)).willReturn(Optional.of(caseWith("NEW", null, 1)));
        given(userRepository.findByUsername("viewer"))
                .willReturn(Optional.of(account("viewer", Role.VIEWER)));

        assertThatThrownBy(() -> caseService.applyAction(
                CASE_ID, "assign", 1, "分派给查看者", "viewer", user("admin", Role.ADMIN)))
                .isInstanceOf(CaseValidationException.class)
                .hasMessage("处理人必须是有效的 manager 账号");

        then(caseRepository).should(never()).updateAssign(anyString(), anyString(), eq(1), anyLong());
        then(auditRepository).should(never()).insert(anyString(), anyString(), anyString(), anyString(), anyLong());
    }

    @Test
    void assignToDisabledManagerIsRejected() {
        given(caseRepository.findById(CASE_ID)).willReturn(Optional.of(caseWith("NEW", null, 1)));
        given(userRepository.findByUsername("manager"))
                .willReturn(Optional.of(new UserAccount("manager", Role.MANAGER, false, "hash")));

        assertThatThrownBy(() -> caseService.applyAction(
                CASE_ID, "assign", 1, "停用账号", "manager", user("admin", Role.ADMIN)))
                .isInstanceOf(CaseValidationException.class)
                .hasMessage("处理人必须是有效的 manager 账号");

        then(caseRepository).should(never()).updateAssign(anyString(), anyString(), eq(1), anyLong());
    }

    @Test
    void assignRequiresNonEmptyReason() {
        given(caseRepository.findById(CASE_ID)).willReturn(Optional.of(caseWith("NEW", null, 1)));
        given(userRepository.findByUsername("manager"))
                .willReturn(Optional.of(account("manager", Role.MANAGER)));

        assertThatThrownBy(() -> caseService.applyAction(
                CASE_ID, "assign", 1, "   ", "manager", user("admin", Role.ADMIN)))
                .isInstanceOf(CaseValidationException.class)
                .hasMessage("分派说明不能为空");

        then(caseRepository).should(never()).updateAssign(anyString(), anyString(), eq(1), anyLong());
    }

    @Test
    void assignRequiresNewState() {
        given(caseRepository.findById(CASE_ID))
                .willReturn(Optional.of(caseWith("ASSIGNED", "manager", 2)));

        assertThatThrownBy(() -> caseService.applyAction(
                CASE_ID, "assign", 2, "重复分派", "manager", user("admin", Role.ADMIN)))
                .isInstanceOf(CaseStateException.class)
                .hasMessage("事件已分派，不需要重复分派");

        then(caseRepository).should(never()).updateAssign(anyString(), anyString(), eq(2), anyLong());
    }

    @Test
    void assignedManagerCanStart() {
        given(caseRepository.findById(CASE_ID))
                .willReturn(Optional.of(caseWith("ASSIGNED", "manager", 2)),
                        Optional.of(caseWith("IN_PROGRESS", "manager", 3)));
        given(caseRepository.updateStart(eq(CASE_ID), eq(2), anyLong())).willReturn(1);
        given(caseRepository.nextTimelineSeq(CASE_ID)).willReturn(3);

        Case result = caseService.applyAction(
                CASE_ID, "start", 2, null, null, user("manager", Role.MANAGER));

        assertThat(result.state()).isEqualTo("IN_PROGRESS");
        assertThat(result.version()).isEqualTo(3);

        ArgumentCaptor<CaseTimelineEntry> entry = ArgumentCaptor.forClass(CaseTimelineEntry.class);
        then(caseRepository).should().insertTimeline(eq(CASE_ID), eq(3), entry.capture());
        assertThat(entry.getValue().action()).isEqualTo("start");
        assertThat(entry.getValue().actor()).isEqualTo("manager");

        then(auditRepository).should().insert(
                eq("manager"), eq("case.start"), eq(CASE_ID), eq("开始处理"), anyLong());
    }

    @Test
    void startIgnoresForgedUsernameAndUsesSessionActor() {
        given(caseRepository.findById(CASE_ID))
                .willReturn(Optional.of(caseWith("ASSIGNED", "manager", 2)),
                        Optional.of(caseWith("IN_PROGRESS", "manager", 3)));
        given(caseRepository.updateStart(eq(CASE_ID), eq(2), anyLong())).willReturn(1);
        given(caseRepository.nextTimelineSeq(CASE_ID)).willReturn(3);

        // 请求体里的 username 只是客户端字段；start 的操作人必须取登录会话。
        caseService.applyAction(
                CASE_ID, "start", 2, null, "admin", user("manager", Role.MANAGER));

        ArgumentCaptor<CaseTimelineEntry> entry = ArgumentCaptor.forClass(CaseTimelineEntry.class);
        then(caseRepository).should().insertTimeline(eq(CASE_ID), eq(3), entry.capture());
        assertThat(entry.getValue().actor()).isEqualTo("manager");

        then(auditRepository).should().insert(
                eq("manager"), eq("case.start"), eq(CASE_ID), eq("开始处理"), anyLong());
    }

    @Test
    void adminCanStartAnAssignedEvent() {
        given(caseRepository.findById(CASE_ID))
                .willReturn(Optional.of(caseWith("ASSIGNED", "manager", 2)),
                        Optional.of(caseWith("IN_PROGRESS", "manager", 3)));
        given(caseRepository.updateStart(eq(CASE_ID), eq(2), anyLong())).willReturn(1);
        given(caseRepository.nextTimelineSeq(CASE_ID)).willReturn(3);

        Case result = caseService.applyAction(
                CASE_ID, "start", 2, null, null, user("admin", Role.ADMIN));

        assertThat(result.state()).isEqualTo("IN_PROGRESS");
        then(auditRepository).should().insert(
                eq("admin"), eq("case.start"), eq(CASE_ID), eq("开始处理"), anyLong());
    }

    @Test
    void managerCannotHandleEventAssignedToSomeoneElse() {
        given(caseRepository.findById(CASE_ID))
                .willReturn(Optional.of(caseWith("ASSIGNED", "manager2", 2)));

        assertThatThrownBy(() -> caseService.applyAction(
                CASE_ID, "start", 2, null, null, user("manager", Role.MANAGER)))
                .isInstanceOf(CaseActionForbiddenException.class);

        then(caseRepository).should(never()).updateStart(anyString(), eq(2), anyLong());
    }

    @Test
    void startRequiresAssignedState() {
        given(caseRepository.findById(CASE_ID)).willReturn(Optional.of(caseWith("NEW", null, 1)));

        assertThatThrownBy(() -> caseService.applyAction(
                CASE_ID, "start", 1, null, null, user("admin", Role.ADMIN)))
                .isInstanceOf(CaseStateException.class)
                .hasMessage("事件尚未分派，不能开始处理");

        then(caseRepository).should(never()).updateStart(anyString(), eq(1), anyLong());
    }

    @Test
    void assignedManagerCanWriteNote() {
        Case current = caseWith("IN_PROGRESS", "manager", 3);
        Case updated = new Case(CASE_ID, "d01", "温湿度偏高", "IN_PROGRESS", "manager",
                "ACTIVE", false, "已复核读数", "", 4,
                List.of(new CaseTimelineEntry(1L, "create", "admin", "创建")));

        given(caseRepository.findById(CASE_ID))
                .willReturn(Optional.of(current), Optional.of(updated));
        given(caseRepository.updateNote(eq(CASE_ID), eq("已复核读数"), eq(3), anyLong()))
                .willReturn(1);
        given(caseRepository.nextTimelineSeq(CASE_ID)).willReturn(4);

        Case result = caseService.applyAction(
                CASE_ID, "note", 3, "已复核读数", null, user("manager", Role.MANAGER));

        assertThat(result.state()).isEqualTo("IN_PROGRESS");
        assertThat(result.note()).isEqualTo("已复核读数");
        assertThat(result.version()).isEqualTo(4);

        ArgumentCaptor<CaseTimelineEntry> entry = ArgumentCaptor.forClass(CaseTimelineEntry.class);
        then(caseRepository).should().insertTimeline(eq(CASE_ID), eq(4), entry.capture());
        assertThat(entry.getValue().action()).isEqualTo("note");
        assertThat(entry.getValue().note()).isEqualTo("已复核读数");

        then(auditRepository).should().insert(
                eq("manager"), eq("case.note"), eq(CASE_ID), eq("填写处置记录"), anyLong());
    }

    @Test
    void adminCanWriteNoteOnManagerEvent() {
        given(caseRepository.findById(CASE_ID))
                .willReturn(Optional.of(caseWith("IN_PROGRESS", "manager", 3)),
                        Optional.of(caseWith("IN_PROGRESS", "manager", 4)));
        given(caseRepository.updateNote(eq(CASE_ID), eq("管理员补充"), eq(3), anyLong()))
                .willReturn(1);
        given(caseRepository.nextTimelineSeq(CASE_ID)).willReturn(4);

        Case result = caseService.applyAction(
                CASE_ID, "note", 3, "管理员补充", null, user("admin", Role.ADMIN));

        assertThat(result.version()).isEqualTo(4);
        then(auditRepository).should().insert(
                eq("admin"), eq("case.note"), eq(CASE_ID), eq("填写处置记录"), anyLong());
    }

    @Test
    void noteRequiresNonEmptyText() {
        given(caseRepository.findById(CASE_ID))
                .willReturn(Optional.of(caseWith("IN_PROGRESS", "manager", 3)));

        assertThatThrownBy(() -> caseService.applyAction(
                CASE_ID, "note", 3, "   ", null, user("manager", Role.MANAGER)))
                .isInstanceOf(CaseValidationException.class)
                .hasMessage("处置记录不能为空");

        then(caseRepository).should(never()).updateNote(anyString(), anyString(), eq(3), anyLong());
    }

    @Test
    void noteRequiresInProgressState() {
        given(caseRepository.findById(CASE_ID))
                .willReturn(Optional.of(caseWith("ASSIGNED", "manager", 2)));

        assertThatThrownBy(() -> caseService.applyAction(
                CASE_ID, "note", 2, "还没开始就记录", null, user("manager", Role.MANAGER)))
                .isInstanceOf(CaseStateException.class)
                .hasMessage("请先开始处理，再填写处置记录");

        then(caseRepository).should(never()).updateNote(anyString(), anyString(), eq(2), anyLong());
    }

    @Test
    void staleVersionReturnsConflictWithoutWrite() {
        given(caseRepository.findById(CASE_ID))
                .willReturn(Optional.of(caseWith("IN_PROGRESS", "manager", 3)));

        assertThatThrownBy(() -> caseService.applyAction(
                CASE_ID, "note", 2, "旧版本提交", null, user("manager", Role.MANAGER)))
                .isInstanceOf(CaseVersionConflictException.class)
                .hasMessage("演练事件已被其他人更新，请重新读取后再决定");

        then(caseRepository).should(never()).updateNote(anyString(), anyString(), eq(2), anyLong());
        then(caseRepository).should(never()).insertTimeline(anyString(),
                org.mockito.ArgumentMatchers.anyInt(), org.mockito.ArgumentMatchers.any());
        then(auditRepository).should(never()).insert(anyString(), anyString(), anyString(), anyString(), anyLong());
    }

    @Test
    void conditionalUpdateMissIsTreatedAsConflict() {
        given(caseRepository.findById(CASE_ID)).willReturn(Optional.of(caseWith("NEW", null, 1)));
        given(userRepository.findByUsername("manager"))
                .willReturn(Optional.of(account("manager", Role.MANAGER)));
        given(caseRepository.updateAssign(eq(CASE_ID), eq("manager"), eq(1), anyLong()))
                .willReturn(0);

        assertThatThrownBy(() -> caseService.applyAction(
                CASE_ID, "assign", 1, "并发分派", "manager", user("admin", Role.ADMIN)))
                .isInstanceOf(CaseVersionConflictException.class);

        then(caseRepository).should(never()).insertTimeline(anyString(),
                org.mockito.ArgumentMatchers.anyInt(), org.mockito.ArgumentMatchers.any());
        then(auditRepository).should(never()).insert(anyString(), anyString(), anyString(), anyString(), anyLong());
    }

    @Test
    void unsupportedActionIsRejected() {
        assertThatThrownBy(() -> caseService.applyAction(
                CASE_ID, "delete", 1, null, null, user("admin", Role.ADMIN)))
                .isInstanceOf(CaseValidationException.class)
                .hasMessage("不支持的事件动作");

        then(caseRepository).should(never()).findById(anyString());
    }

    @Test
    void nullExpectedVersionIsRejected() {
        assertThatThrownBy(() -> caseService.applyAction(
                CASE_ID, "start", null, null, null, user("admin", Role.ADMIN)))
                .isInstanceOf(CaseValidationException.class)
                .hasMessage("expectedVersion 必须是 JSON 非负整数");

        then(caseRepository).should(never()).findById(anyString());
    }

    // ---------- recover：仅 ADMIN，只改本地演练来源状态 ----------

    @Test
    void adminRecoversSourceWithoutClosingEvent() {
        given(caseRepository.findById(CASE_ID))
                .willReturn(Optional.of(detailedCase(
                                "IN_PROGRESS", "manager", "ACTIVE", false, "已处理并复核", 3)),
                        Optional.of(detailedCase(
                                "IN_PROGRESS", "manager", "RECOVERED", false, "已处理并复核", 4)));
        given(caseRepository.updateRecover(eq(CASE_ID), eq(3), anyLong())).willReturn(1);
        given(caseRepository.nextTimelineSeq(CASE_ID)).willReturn(4);

        Case result = caseService.applyAction(
                CASE_ID, "recover", 3, null, null, user("admin", Role.ADMIN));

        assertThat(result.state()).isEqualTo("IN_PROGRESS");
        assertThat(result.sourceState()).isEqualTo("RECOVERED");
        assertThat(result.verified()).isFalse();
        assertThat(result.version()).isEqualTo(4);

        ArgumentCaptor<CaseTimelineEntry> entry = ArgumentCaptor.forClass(CaseTimelineEntry.class);
        then(caseRepository).should().insertTimeline(eq(CASE_ID), eq(4), entry.capture());
        assertThat(entry.getValue().action()).isEqualTo("recover");
        assertThat(entry.getValue().note()).contains("不声称真实设备恢复");

        then(auditRepository).should().insert(
                eq("admin"), eq("case.recover"), eq(CASE_ID), eq("本地演练来源已恢复"), anyLong());
    }

    @Test
    void managerCannotRecover() {
        assertThatThrownBy(() -> caseService.applyAction(
                CASE_ID, "recover", 3, null, null, user("manager", Role.MANAGER)))
                .isInstanceOf(CaseActionForbiddenException.class);

        then(caseRepository).should(never()).findById(anyString());
    }

    @Test
    void recoverRequiresInProgressState() {
        given(caseRepository.findById(CASE_ID))
                .willReturn(Optional.of(detailedCase(
                        "ASSIGNED", "manager", "ACTIVE", false, "", 2)));

        assertThatThrownBy(() -> caseService.applyAction(
                CASE_ID, "recover", 2, null, null, user("admin", Role.ADMIN)))
                .isInstanceOf(CaseStateException.class)
                .hasMessage("请先开始处理，再恢复来源");

        then(caseRepository).should(never()).updateRecover(anyString(), eq(2), anyLong());
    }

    @Test
    void recoverRejectsAlreadyRecoveredSource() {
        given(caseRepository.findById(CASE_ID))
                .willReturn(Optional.of(detailedCase(
                        "IN_PROGRESS", "manager", "RECOVERED", false, "已处理", 3)));

        assertThatThrownBy(() -> caseService.applyAction(
                CASE_ID, "recover", 3, null, null, user("admin", Role.ADMIN)))
                .isInstanceOf(CaseStateException.class)
                .hasMessage("来源已恢复，不需要重复操作");

        then(caseRepository).should(never()).updateRecover(anyString(), eq(3), anyLong());
    }

    @Test
    void recoverRespectsExpectedVersion() {
        given(caseRepository.findById(CASE_ID))
                .willReturn(Optional.of(detailedCase(
                        "IN_PROGRESS", "manager", "ACTIVE", false, "已处理", 3)));

        assertThatThrownBy(() -> caseService.applyAction(
                CASE_ID, "recover", 2, null, null, user("admin", Role.ADMIN)))
                .isInstanceOf(CaseVersionConflictException.class);

        then(caseRepository).should(never()).updateRecover(anyString(), eq(2), anyLong());
    }

    // ---------- verify：ADMIN 或本事件 manager，服务端重新检查来源事实 ----------

    @Test
    void assignedManagerCanVerifyRecoveredSource() {
        given(caseRepository.findById(CASE_ID))
                .willReturn(Optional.of(detailedCase(
                                "IN_PROGRESS", "manager", "RECOVERED", false, "已处理", 4)),
                        Optional.of(detailedCase(
                                "IN_PROGRESS", "manager", "RECOVERED", true, "已处理", 5)));
        given(caseRepository.updateVerify(eq(CASE_ID), eq(4), anyLong())).willReturn(1);
        given(caseRepository.nextTimelineSeq(CASE_ID)).willReturn(5);

        Case result = caseService.applyAction(
                CASE_ID, "verify", 4, null, null, user("manager", Role.MANAGER));

        assertThat(result.verified()).isTrue();
        assertThat(result.state()).isEqualTo("IN_PROGRESS");
        assertThat(result.sourceState()).isEqualTo("RECOVERED");
        assertThat(result.version()).isEqualTo(5);

        ArgumentCaptor<CaseTimelineEntry> entry = ArgumentCaptor.forClass(CaseTimelineEntry.class);
        then(caseRepository).should().insertTimeline(eq(CASE_ID), eq(5), entry.capture());
        assertThat(entry.getValue().action()).isEqualTo("verify");
        assertThat(entry.getValue().actor()).isEqualTo("manager");

        then(auditRepository).should().insert(
                eq("manager"), eq("case.verify"), eq(CASE_ID), eq("核实本地演练来源恢复"), anyLong());
    }

    @Test
    void adminCanVerifyRecoveredSource() {
        given(caseRepository.findById(CASE_ID))
                .willReturn(Optional.of(detailedCase(
                                "IN_PROGRESS", "manager", "RECOVERED", false, "已处理", 4)),
                        Optional.of(detailedCase(
                                "IN_PROGRESS", "manager", "RECOVERED", true, "已处理", 5)));
        given(caseRepository.updateVerify(eq(CASE_ID), eq(4), anyLong())).willReturn(1);
        given(caseRepository.nextTimelineSeq(CASE_ID)).willReturn(5);

        Case result = caseService.applyAction(
                CASE_ID, "verify", 4, null, null, user("admin", Role.ADMIN));

        assertThat(result.verified()).isTrue();
        then(auditRepository).should().insert(
                eq("admin"), eq("case.verify"), eq(CASE_ID), eq("核实本地演练来源恢复"), anyLong());
    }

    @Test
    void verifyRequiresRecoveredSourceFromDatabase() {
        given(caseRepository.findById(CASE_ID))
                .willReturn(Optional.of(detailedCase(
                        "IN_PROGRESS", "manager", "ACTIVE", false, "已处理", 4)));

        // 即使请求里伪造 sourceState=RECOVERED、verified=true，服务层也只读数据库中的 ACTIVE。
        assertThatThrownBy(() -> caseService.applyAction(
                CASE_ID, "verify", 4, null, "manager", user("admin", Role.ADMIN)))
                .isInstanceOf(CaseStateException.class)
                .hasMessage("来源尚未恢复，不能核实");

        then(caseRepository).should(never()).updateVerify(anyString(), eq(4), anyLong());
    }

    @Test
    void verifyRejectsAlreadyVerifiedSource() {
        given(caseRepository.findById(CASE_ID))
                .willReturn(Optional.of(detailedCase(
                        "IN_PROGRESS", "manager", "RECOVERED", true, "已处理", 5)));

        assertThatThrownBy(() -> caseService.applyAction(
                CASE_ID, "verify", 5, null, null, user("admin", Role.ADMIN)))
                .isInstanceOf(CaseStateException.class)
                .hasMessage("来源恢复已核实，不需要重复核实");

        then(caseRepository).should(never()).updateVerify(anyString(), eq(5), anyLong());
    }

    @Test
    void managerCannotVerifyEventAssignedToSomeoneElse() {
        given(caseRepository.findById(CASE_ID))
                .willReturn(Optional.of(detailedCase(
                        "IN_PROGRESS", "manager2", "RECOVERED", false, "已处理", 4)));

        assertThatThrownBy(() -> caseService.applyAction(
                CASE_ID, "verify", 4, null, null, user("manager", Role.MANAGER)))
                .isInstanceOf(CaseActionForbiddenException.class);

        then(caseRepository).should(never()).updateVerify(anyString(), eq(4), anyLong());
    }

    @Test
    void verifyRespectsExpectedVersion() {
        given(caseRepository.findById(CASE_ID))
                .willReturn(Optional.of(detailedCase(
                        "IN_PROGRESS", "manager", "RECOVERED", false, "已处理", 4)));

        assertThatThrownBy(() -> caseService.applyAction(
                CASE_ID, "verify", 3, null, null, user("admin", Role.ADMIN)))
                .isInstanceOf(CaseVersionConflictException.class);

        then(caseRepository).should(never()).updateVerify(anyString(), eq(3), anyLong());
    }

    // ---------- close：逐项检查关闭条件 ----------

    @Test
    void closeRequiresInProgressState() {
        given(caseRepository.findById(CASE_ID))
                .willReturn(Optional.of(detailedCase(
                        "ASSIGNED", "manager", "RECOVERED", true, "已处理", 4)));

        assertThatThrownBy(() -> caseService.applyAction(
                CASE_ID, "close", 4, "关闭结论", null, user("admin", Role.ADMIN)))
                .isInstanceOf(CaseStateException.class)
                .hasMessage("请先开始处理，再关闭事件");

        then(caseRepository).should(never()).updateClose(anyString(), anyString(), eq(4), anyLong());
    }

    @Test
    void closeRequiresNonEmptyDispositionNote() {
        given(caseRepository.findById(CASE_ID))
                .willReturn(Optional.of(detailedCase(
                        "IN_PROGRESS", "manager", "RECOVERED", true, "   ", 5)));

        assertThatThrownBy(() -> caseService.applyAction(
                CASE_ID, "close", 5, "关闭结论", null, user("manager", Role.MANAGER)))
                .isInstanceOf(CaseStateException.class)
                .hasMessage("请先填写处置记录，再关闭事件");

        then(caseRepository).should(never()).updateClose(anyString(), anyString(), eq(5), anyLong());
    }

    @Test
    void closeRequiresRecoveredSource() {
        given(caseRepository.findById(CASE_ID))
                .willReturn(Optional.of(detailedCase(
                        "IN_PROGRESS", "manager", "ACTIVE", true, "已处理", 5)));

        assertThatThrownBy(() -> caseService.applyAction(
                CASE_ID, "close", 5, "关闭结论", null, user("admin", Role.ADMIN)))
                .isInstanceOf(CaseStateException.class)
                .hasMessage("来源尚未恢复，不能关闭事件");

        then(caseRepository).should(never()).updateClose(anyString(), anyString(), eq(5), anyLong());
    }

    @Test
    void closeRequiresIndependentVerification() {
        given(caseRepository.findById(CASE_ID))
                .willReturn(Optional.of(detailedCase(
                        "IN_PROGRESS", "manager", "RECOVERED", false, "已处理", 5)));

        assertThatThrownBy(() -> caseService.applyAction(
                CASE_ID, "close", 5, "关闭结论", null, user("admin", Role.ADMIN)))
                .isInstanceOf(CaseStateException.class)
                .hasMessage("来源恢复尚未核实，不能关闭事件");

        then(caseRepository).should(never()).updateClose(anyString(), anyString(), eq(5), anyLong());
    }

    @Test
    void closeRequiresNonEmptyConclusion() {
        given(caseRepository.findById(CASE_ID))
                .willReturn(Optional.of(detailedCase(
                        "IN_PROGRESS", "manager", "RECOVERED", true, "已处理", 5)));

        assertThatThrownBy(() -> caseService.applyAction(
                CASE_ID, "close", 5, "   ", null, user("admin", Role.ADMIN)))
                .isInstanceOf(CaseValidationException.class)
                .hasMessage("关闭结论不能为空");

        then(caseRepository).should(never()).updateClose(anyString(), anyString(), eq(5), anyLong());
    }

    @Test
    void closeStoresConclusionAndSetsClosed() {
        given(caseRepository.findById(CASE_ID))
                .willReturn(Optional.of(detailedCase(
                                "IN_PROGRESS", "manager", "RECOVERED", true, "已处理并复核", 5)),
                        Optional.of(closedCase("关闭结论：本地演练读数已恢复", 6)));
        given(caseRepository.updateClose(
                eq(CASE_ID), eq("关闭结论：本地演练读数已恢复"), eq(5), anyLong())).willReturn(1);
        given(caseRepository.nextTimelineSeq(CASE_ID)).willReturn(6);

        Case result = caseService.applyAction(
                CASE_ID, "close", 5, "关闭结论：本地演练读数已恢复", null, user("manager", Role.MANAGER));

        assertThat(result.state()).isEqualTo("CLOSED");
        assertThat(result.conclusion()).isEqualTo("关闭结论：本地演练读数已恢复");
        assertThat(result.version()).isEqualTo(6);

        ArgumentCaptor<CaseTimelineEntry> entry = ArgumentCaptor.forClass(CaseTimelineEntry.class);
        then(caseRepository).should().insertTimeline(eq(CASE_ID), eq(6), entry.capture());
        assertThat(entry.getValue().action()).isEqualTo("close");
        assertThat(entry.getValue().note()).isEqualTo("关闭结论：本地演练读数已恢复");

        then(auditRepository).should().insert(
                eq("manager"), eq("case.close"), eq(CASE_ID), eq("关闭事件"), anyLong());
    }

    @Test
    void closeRespectsExpectedVersion() {
        given(caseRepository.findById(CASE_ID))
                .willReturn(Optional.of(detailedCase(
                        "IN_PROGRESS", "manager", "RECOVERED", true, "已处理", 5)));

        assertThatThrownBy(() -> caseService.applyAction(
                CASE_ID, "close", 4, "关闭结论", null, user("admin", Role.ADMIN)))
                .isInstanceOf(CaseVersionConflictException.class);

        then(caseRepository).should(never()).updateClose(anyString(), anyString(), eq(4), anyLong());
    }

    @ParameterizedTest
    @ValueSource(strings = {"assign", "start", "note", "recover", "verify", "close"})
    void closedCaseRejectsEveryAction(String action) {
        given(caseRepository.findById(CASE_ID))
                .willReturn(Optional.of(closedCase("已关闭", 6)));

        assertThatThrownBy(() -> caseService.applyAction(
                CASE_ID, action, 6, "补充说明", "manager", user("admin", Role.ADMIN)))
                .isInstanceOf(CaseStateException.class)
                .hasMessage("事件已关闭，不能再修改");

        then(caseRepository).should(never()).insertTimeline(anyString(),
                org.mockito.ArgumentMatchers.anyInt(), org.mockito.ArgumentMatchers.any());
        then(auditRepository).should(never()).insert(anyString(), anyString(), anyString(), anyString(), anyLong());
    }

    private static Case caseWith(String state, String assignee, int version) {
        return new Case(CASE_ID, "d01", "温湿度偏高", state, assignee, "ACTIVE", false,
                "IN_PROGRESS".equals(state) ? "已开始处理" : "", "", version,
                List.of(new CaseTimelineEntry(1L, "create", "admin", "创建")));
    }

    private static Case detailedCase(String state, String assignee, String sourceState,
                                     boolean verified, String note, int version) {
        return new Case(CASE_ID, "d01", "温湿度偏高", state, assignee, sourceState, verified,
                note, "", version,
                List.of(new CaseTimelineEntry(1L, "create", "admin", "创建")));
    }

    private static Case closedCase(String conclusion, int version) {
        return new Case(CASE_ID, "d01", "温湿度偏高", "CLOSED", "manager", "RECOVERED", true,
                "已处理并复核", conclusion, version,
                List.of(new CaseTimelineEntry(1L, "create", "admin", "创建")));
    }

    private static AuthenticatedUser user(String username, Role role) {
        return new AuthenticatedUser(username, role);
    }

    private static UserAccount account(String username, Role role) {
        return new UserAccount(username, role, true, "hash");
    }
}
