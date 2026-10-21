package edu.campus.v2.owner;

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
import edu.campus.v2.user.Role;
import edu.campus.v2.user.UserAccount;
import edu.campus.v2.user.UserRepository;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * 责任登记审计测试：成功才写审计；版本冲突、账号校验失败都不写。
 */
@ExtendWith(MockitoExtension.class)
class OwnerServiceAuditTest {

    @Mock
    private OwnerRepository ownerRepository;

    @Mock
    private DeviceRepository deviceRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private AuditRepository auditRepository;

    @InjectMocks
    private OwnerService ownerService;

    @Test
    void successfulSaveWritesAudit() {
        given(deviceRepository.existsById("d01")).willReturn(true);
        given(userRepository.findByUsername("manager"))
                .willReturn(Optional.of(new UserAccount("manager", Role.MANAGER, true, "hash")));
        given(ownerRepository.findByDeviceId("d01"))
                .willReturn(Optional.empty(),
                        Optional.of(new Owner("d01", "manager", "日常巡检", 1)));
        given(ownerRepository.insert("d01", "manager", "日常巡检")).willReturn(1);

        Owner saved = ownerService.saveOwner("d01", "manager", "日常巡检", 0, "admin");

        assertThat(saved.version()).isEqualTo(1);
        then(auditRepository).should().insert(
                eq("admin"), eq("owner.save"), eq("d01"),
                eq("负责人 manager，版本 1"), anyLong());
    }

    @Test
    void versionConflictDoesNotWriteAudit() {
        given(deviceRepository.existsById("d01")).willReturn(true);
        given(userRepository.findByUsername("manager"))
                .willReturn(Optional.of(new UserAccount("manager", Role.MANAGER, true, "hash")));
        given(ownerRepository.findByDeviceId("d01"))
                .willReturn(Optional.of(new Owner("d01", "manager", "旧记录", 2)));

        assertThatThrownBy(() ->
                ownerService.saveOwner("d01", "manager", "新记录", 1, "admin"))
                .isInstanceOf(OwnerVersionConflictException.class);

        then(auditRepository).should(never()).insert(
                anyString(), anyString(), anyString(), anyString(), anyLong());
    }

    @Test
    void unknownUserDoesNotWriteAudit() {
        given(deviceRepository.existsById("d01")).willReturn(true);
        given(userRepository.findByUsername("missing")).willReturn(Optional.empty());

        assertThatThrownBy(() ->
                ownerService.saveOwner("d01", "missing", "巡检", 0, "admin"))
                .isInstanceOf(OwnerValidationException.class);

        then(auditRepository).should(never()).insert(
                anyString(), anyString(), anyString(), anyString(), anyLong());
    }
}
