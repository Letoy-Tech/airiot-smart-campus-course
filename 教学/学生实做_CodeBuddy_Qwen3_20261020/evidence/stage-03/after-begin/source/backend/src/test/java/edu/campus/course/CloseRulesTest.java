package edu.campus.course;

import static org.assertj.core.api.Assertions.*;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.util.List;
import java.util.function.Consumer;

class CloseRulesTest {
    private CourseModels.AlarmCase valid() {
        var c = new CourseModels.AlarmCase();
        c.state = "IN_PROGRESS";
        c.sourceType = "DEMO";
        c.sourceScope = "LOCAL_DEMO";
        c.sourceState = "RECOVERED";
        c.sourceRawStatus = "DEMO_RECOVERED";
        c.occurredAt = 1000L;
        c.sourceRecoveredAt = 2000L;
        c.sourceCheckOutcome = "PASS";
        c.sourceVerifiedAt = 2000L;
        return c;
    }

    @Test
    void eachMissingCloseConditionIsIndependentlyRejected() {
        var service = new OperationsService(null, null, null, Clock.systemUTC(), true);
        var note = new CourseModels.CaseEvent();
        note.action = "NOTE";
        assertThatCode(() -> service.requireClosable(valid(), List.of(note)))
                .doesNotThrowAnyException();
        assertThatThrownBy(() -> service.requireClosable(valid(), List.of()))
                .isInstanceOf(ApiFailure.class)
                .hasMessage("STATE_CONFLICT");
        List<Consumer<CourseModels.AlarmCase>> changes =
                List.of(
                        c -> c.state = "ASSIGNED",
                        c -> c.sourceType = "AIRIOT",
                        c -> c.sourceScope = "OTHER",
                        c -> c.sourceState = "ACTIVE",
                        c -> c.sourceRawStatus = "DEMO_ACTIVE",
                        c -> c.sourceRecoveredAt = null,
                        c -> c.sourceRecoveredAt = 999L,
                        c -> c.sourceCheckOutcome = "UNKNOWN",
                        c -> c.sourceVerifiedAt = null,
                        c -> c.sourceVerifiedAt = 1999L);
        for (var change : changes) {
            var c = valid();
            change.accept(c);
            assertThatThrownBy(() -> service.requireClosable(c, List.of(note)))
                    .isInstanceOf(ApiFailure.class)
                    .hasMessage("STATE_CONFLICT");
        }
    }
}
