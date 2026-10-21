package edu.campus.v2.caseflow;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.mockito.Mockito.never;

import edu.campus.v2.audit.AuditRepository;
import edu.campus.v2.device.DeviceRepository;
import edu.campus.v2.owner.DeviceNotFoundException;
import edu.campus.v2.owner.Owner;
import edu.campus.v2.owner.OwnerRepository;
import edu.campus.v2.user.UserRepository;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * 演练事件服务测试：不连数据库，只验证服务端生成字段与自动分派规则。
 */
@ExtendWith(MockitoExtension.class)
class CaseServiceTest {

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
    void managerOwnerIsAssignedAndStateIsAssigned() {
        given(deviceRepository.existsById("d01")).willReturn(true);
        given(ownerRepository.findByDeviceId("d01"))
                .willReturn(Optional.of(new Owner("d01", "manager", "日常巡检", 1)));
        captureInsertAndReadBack();

        Case created = caseService.createCase(" d01 ", "  温湿度持续偏高  ", "admin");

        assertThat(created.state()).isEqualTo("ASSIGNED");
        assertThat(created.assignee()).isEqualTo("manager");
        assertThat(created.sourceState()).isEqualTo("ACTIVE");
        assertThat(created.verified()).isFalse();
        assertThat(created.version()).isEqualTo(1);
        assertThat(created.deviceId()).isEqualTo("d01");
        assertThat(created.message()).isEqualTo("温湿度持续偏高");
        assertThat(created.id()).startsWith("case-");
        assertThat(created.timeline()).hasSize(1);

        CaseTimelineEntry entry = created.timeline().get(0);
        assertThat(entry.action()).isEqualTo("create");
        assertThat(entry.actor()).isEqualTo("admin");
        assertThat(entry.time()).isPositive();
        assertThat(entry.note()).contains("分派给 manager");

        then(auditRepository).should().insert(
                eq("admin"), eq("case.create"), eq(created.id()), eq("设备 d01"), anyLong());
    }

    @Test
    void noOwnerLeavesCaseNewAndUnassigned() {
        given(deviceRepository.existsById("d02")).willReturn(true);
        given(ownerRepository.findByDeviceId("d02")).willReturn(Optional.empty());
        captureInsertAndReadBack();

        Case created = caseService.createCase("d02", "等待分派", "admin");

        assertThat(created.state()).isEqualTo("NEW");
        assertThat(created.assignee()).isNull();
        assertThat(created.timeline().get(0).note()).contains("等待管理员分派");
    }

    @Test
    void ownerOtherThanManagerDoesNotAutoAssign() {
        given(deviceRepository.existsById("d03")).willReturn(true);
        given(ownerRepository.findByDeviceId("d03"))
                .willReturn(Optional.of(new Owner("d03", "viewer", "只读登记", 1)));
        captureInsertAndReadBack();

        Case created = caseService.createCase("d03", "责任人是查看者", "admin");

        assertThat(created.state()).isEqualTo("NEW");
        assertThat(created.assignee()).isNull();
    }

    @Test
    void blankMessageIsRejectedBeforeWrite() {
        assertThatThrownBy(() -> caseService.createCase("d01", "   ", "admin"))
                .isInstanceOf(CaseValidationException.class)
                .hasMessage("事件内容不能为空");

        then(caseRepository).should(never()).insert(any(), anyLong(), any());
        then(auditRepository).should(never())
                .insert(anyString(), anyString(), anyString(), anyString(), anyLong());
    }

    @Test
    void unknownDeviceIsRejectedBeforeWrite() {
        given(deviceRepository.existsById("d99")).willReturn(false);

        assertThatThrownBy(() -> caseService.createCase("d99", "未知设备", "admin"))
                .isInstanceOf(DeviceNotFoundException.class);

        then(caseRepository).should(never()).insert(any(), anyLong(), any());
        then(auditRepository).should(never())
                .insert(anyString(), anyString(), anyString(), anyString(), anyLong());
    }

    /**
     * insert 与随后的 findById 用同一个捕获对象：服务层返回的必须是“从库里读回”的那一条。
     */
    private void captureInsertAndReadBack() {
        AtomicReference<Case> inserted = new AtomicReference<>();
        AtomicReference<List<CaseTimelineEntry>> timeline = new AtomicReference<>();

        org.mockito.BDDMockito.willAnswer(invocation -> {
            inserted.set(invocation.getArgument(0));
            timeline.set(invocation.getArgument(2));
            return null;
        }).given(caseRepository).insert(any(), anyLong(), any());

        given(caseRepository.findById(anyString())).willAnswer(invocation -> {
            Case base = inserted.get();
            if (base == null) {
                return Optional.empty();
            }
            return Optional.of(base.withTimeline(timeline.get()));
        });
    }
}
