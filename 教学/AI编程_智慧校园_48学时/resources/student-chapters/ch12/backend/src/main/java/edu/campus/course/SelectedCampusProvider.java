package edu.campus.course;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Primary;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
@Primary
public class SelectedCampusProvider implements CampusProvider {
    private final CampusProvider selected;

    public SelectedCampusProvider(
            MockCampusProvider mock,
            AiriotReadOnlyProvider airiot,
            @Value("${course.source:TEACHING_MOCK}") String source,
            Environment environment) {
        selected =
                switch (source) {
                    case "TEACHING_MOCK" -> mock;
                    case "AIRIOT" -> airiot;
                    default -> throw new IllegalStateException("Unsupported course source");
                };
        if (!source.equals("TEACHING_MOCK")
                && !environment.acceptsProfiles(Profiles.of("teacher-db")))
            throw new IllegalStateException(
                    "first-chain requires TEACHING_MOCK; AIRIOT extension needs teacher-db");
    }

    public CatalogReader.Items<CatalogReader.Space> spaces() {
        return selected.spaces();
    }

    public CatalogReader.Items<CatalogReader.Device> devices() {
        return selected.devices();
    }

    public Map<String, Object> latest(String id) {
        return selected.latest(id);
    }

    public History history(String d, String t, long from, long to) {
        return selected.history(d, t, from, to);
    }

    public Map<String, Object> alarms(int limit, int skip) {
        return selected.alarms(limit, skip);
    }

    public Map<String, Object> status() {
        return selected.status();
    }
}
