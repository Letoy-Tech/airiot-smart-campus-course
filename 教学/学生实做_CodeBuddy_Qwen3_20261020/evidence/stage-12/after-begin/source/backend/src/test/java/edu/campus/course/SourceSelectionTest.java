package edu.campus.course;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

class SourceSelectionTest {
    @Test
    void selectingAiriotCannotReturnMockData() {
        var mock = mock(MockCampusProvider.class);
        var airiot = new AiriotReadOnlyProvider();
        var environment = new MockEnvironment();
        environment.setActiveProfiles("teacher-db");
        var selected = new SelectedCampusProvider(mock, airiot, "AIRIOT", environment);
        assertThatThrownBy(selected::spaces)
                .isInstanceOf(ApiFailure.class)
                .hasMessage("AIRIOT_NOT_CONFIGURED");
        assertThat(selected.status().get("connected")).isEqualTo(false);
        assertThatThrownBy(() -> selected.alarms(10, 0, "normal"))
                .isInstanceOf(ApiFailure.class).hasMessage("AIRIOT_NOT_CONFIGURED");
        assertThatThrownBy(() -> selected.alarms(10, 0, "empty"))
                .isInstanceOf(ApiFailure.class).hasMessage("INVALID_REQUEST");
        assertThatThrownBy(() -> selected.history("d", "t", 0, 1, "failure"))
                .isInstanceOf(ApiFailure.class).hasMessage("INVALID_REQUEST");
        verifyNoInteractions(mock);
        environment.setActiveProfiles("first-chain");
        assertThatThrownBy(() -> new SelectedCampusProvider(mock, airiot, "AIRIOT", environment))
                .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> new SelectedCampusProvider(mock, airiot, "unknown", environment))
                .isInstanceOf(IllegalStateException.class);
    }
}
