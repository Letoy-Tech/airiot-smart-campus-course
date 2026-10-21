package edu.campus.course;

import java.util.List;
import java.util.Map;

/** Read-only boundary. It deliberately has no remote-control method. */
public interface CampusProvider {
    record Issue(String code, String message, String scope) {}

    record Point(
            String deviceId,
            String tableId,
            String tagId,
            Double value,
            Long time,
            String quality,
            String unit) {}

    record Sample(long time, Double value) {}

    record History(
            String source,
            String deviceId,
            String tagId,
            String unit,
            long from,
            long to,
            long observedAt,
            long queriedAt,
            List<Sample> samples,
            boolean truncated,
            List<Issue> issues) {}

    CatalogReader.Items<CatalogReader.Space> spaces();

    CatalogReader.Items<CatalogReader.Device> devices();

    Map<String, Object> latest(String deviceId);

    History history(String deviceId, String tagId, long from, long to);

    default History history(String deviceId, String tagId, long from, long to, String scenario) {
        if (!"normal".equals(scenario)) throw ApiFailure.bad();
        return history(deviceId, tagId, from, to);
    }

    Map<String, Object> alarms(int limit, int skip);

    default Map<String, Object> alarms(int limit, int skip, String scenario) {
        if (!"normal".equals(scenario)) throw ApiFailure.bad();
        return alarms(limit, skip);
    }

    Map<String, Object> status();
}
