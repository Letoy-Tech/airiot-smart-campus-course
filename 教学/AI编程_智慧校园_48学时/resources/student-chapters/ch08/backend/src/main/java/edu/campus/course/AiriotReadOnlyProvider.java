package edu.campus.course;

import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/** Extension component only: no network calls, no secret config, and no mock fallback. */
@Component
public class AiriotReadOnlyProvider implements CampusProvider {
    private ApiFailure unavailable() {
        return new ApiFailure(503, "AIRIOT_NOT_CONFIGURED");
    }

    @Override
    public CatalogReader.Items<CatalogReader.Space> spaces() {
        throw unavailable();
    }

    @Override
    public CatalogReader.Items<CatalogReader.Device> devices() {
        throw unavailable();
    }

    @Override
    public Map<String, Object> latest(String id) {
        throw unavailable();
    }

    @Override
    public History history(String d, String t, long from, long to) {
        throw unavailable();
    }

    @Override
    public Map<String, Object> alarms(int limit, int skip) {
        throw unavailable();
    }

    @Override
    public Map<String, Object> status() {
        return Map.of(
                "configured",
                false,
                "connected",
                false,
                "controlEnabled",
                false,
                "message",
                "AIRIOT_NOT_CONFIGURED",
                "capabilities",
                List.of("spaces", "devices", "latest", "history", "alarms", "status").stream()
                        .map(
                                name ->
                                        Map.of(
                                                "name",
                                                name,
                                                "status",
                                                "PENDING",
                                                "detail",
                                                "No real AIRIOT connection attempted"))
                        .toList());
    }
}
