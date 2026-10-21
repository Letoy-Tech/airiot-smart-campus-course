package edu.campus.v2.space;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.mockito.Mockito.never;

import edu.campus.v2.audit.AuditRepository;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * 空间修改审计测试：成功才写审计；校验失败或更新失败都不写。
 */
@ExtendWith(MockitoExtension.class)
class SpaceServiceAuditTest {

    @Mock
    private SpaceRepository spaceRepository;

    @Mock
    private AuditRepository auditRepository;

    @InjectMocks
    private SpaceService spaceService;

    @Test
    void successfulUpdateWritesAudit() {
        given(spaceRepository.findById("s1"))
                .willReturn(Optional.of(new Space("s1", "101教室", "教学楼", "1")),
                        Optional.of(new Space("s1", "101教室", "实训楼", "5")));
        given(spaceRepository.updateLocation("s1", "实训楼", "5")).willReturn(1);

        Space result = spaceService.updateLocation("s1", "实训楼", "5", "admin");

        assertThat(result.building()).isEqualTo("实训楼");
        then(auditRepository).should().insert(
                eq("admin"), eq("space.update"), eq("s1"), eq("楼栋 实训楼，楼层 5"), anyLong());
    }

    @Test
    void updateMissDoesNotWriteAudit() {
        given(spaceRepository.findById("s1"))
                .willReturn(Optional.of(new Space("s1", "101教室", "教学楼", "1")));
        given(spaceRepository.updateLocation("s1", "实训楼", "5")).willReturn(0);

        assertThatThrownBy(() -> spaceService.updateLocation("s1", "实训楼", "5", "admin"))
                .isInstanceOf(SpaceNotFoundException.class);

        then(auditRepository).should(never()).insert(
                anyString(), anyString(), anyString(), anyString(), anyLong());
    }

    @Test
    void validationFailureDoesNotWriteAudit() {
        assertThatThrownBy(() -> spaceService.updateLocation("s1", " ", "5", "admin"))
                .isInstanceOf(SpaceValidationException.class);

        then(auditRepository).should(never()).insert(
                anyString(), anyString(), anyString(), anyString(), anyLong());
    }
}
