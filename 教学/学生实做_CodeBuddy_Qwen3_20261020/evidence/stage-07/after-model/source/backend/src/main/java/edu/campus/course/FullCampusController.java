package edu.campus.course;

import com.fasterxml.jackson.databind.JsonNode;

import org.springframework.context.annotation.Profile;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@Profile("teacher-db")
@RequestMapping("/api/campus")
public class FullCampusController {
    private final CampusProvider provider;
    private final AiriotReadOnlyProvider airiot;
    private final LocationService locations;
    private final OperationsService operations;

    public FullCampusController(
            CampusProvider provider,
            AiriotReadOnlyProvider airiot,
            LocationService locations,
            OperationsService operations) {
        this.provider = provider;
        this.airiot = airiot;
        this.locations = locations;
        this.operations = operations;
    }

    @GetMapping("/capabilities")
    public ApiResponse<?> capabilities(Authentication auth) {
        var roles =
                auth.getAuthorities().stream()
                        .map(a -> a.getAuthority().replaceFirst("^ROLE_", ""))
                        .sorted()
                        .toList();
        boolean admin = roles.contains("ADMIN");
        return ApiResponse.ok(
                new CampusController.Capabilities(
                        roles,
                        true,
                        false,
                        admin,
                        admin,
                        admin || roles.contains("CAMPUS_MANAGER"),
                        admin,
                        admin && operations.demoEnabled()));
    }

    @GetMapping("/spaces")
    public ApiResponse<?> spaces() {
        return ApiResponse.ok(locations.spaces());
    }

    @GetMapping("/devices")
    public ApiResponse<?> devices() {
        return ApiResponse.ok(provider.devices());
    }

    @GetMapping("/overview")
    public ApiResponse<?> overview() {
        var spaces = locations.spaces();
        var devices = provider.devices();
        var latest = provider.latest(null);
        var points = (List<?>) latest.get("items");
        return ApiResponse.ok(
                Map.of(
                        "source",
                        "TEACHING_MOCK",
                        "projectId",
                        "campus-ai-course",
                        "observedAt",
                        spaces.observedAt(),
                        "queriedAt",
                        latest.get("queriedAt"),
                        "simulated",
                        true,
                        "spaces",
                        spaces.items(),
                        "devices",
                        devices.items(),
                        "points",
                        points,
                        "issues",
                        latest.get("issues"),
                        "completeness",
                        Map.of(
                                "expectedSpaces",
                                4,
                                "expectedDevices",
                                16,
                                "expectedPoints",
                                28,
                                "actualSpaces",
                                spaces.items().size(),
                                "actualDevices",
                                devices.items().size(),
                                "actualPoints",
                                points.size())));
    }

    @GetMapping("/latest")
    public ApiResponse<?> latest(@RequestParam Map<String, String> p) {
        query(p, "deviceId");
        return ApiResponse.ok(
                provider.latest(p.containsKey("deviceId") ? text(p, "deviceId") : null));
    }

    @GetMapping("/history")
    public ApiResponse<?> history(@RequestParam Map<String, String> p) {
        query(p, "deviceId", "tagId", "from", "to", "scenario");
        return ApiResponse.ok(
                provider.history(
                        text(p, "deviceId"),
                        text(p, "tagId"),
                        Inputs.integer(p.get("from"), 0, QualityPolicy.MAX_EPOCH),
                        Inputs.integer(p.get("to"), 0, QualityPolicy.MAX_EPOCH),
                        p.getOrDefault("scenario", "normal")));
    }

    @GetMapping("/alarms")
    public ApiResponse<?> alarms(@RequestParam Map<String, String> p) {
        query(p, "limit", "skip", "scenario");
        return ApiResponse.ok(provider.alarms(limit(p), skip(p), p.getOrDefault("scenario", "normal")));
    }

    @GetMapping("/locations")
    public ApiResponse<?> locations() {
        return ApiResponse.ok(locations.locations());
    }

    @PostMapping("/locations/campuses")
    public ApiResponse<?> campus(@RequestBody JsonNode body) {
        return ApiResponse.ok(locations.createCampus(body));
    }

    @PostMapping("/locations/buildings")
    public ApiResponse<?> building(@RequestBody JsonNode body) {
        return ApiResponse.ok(locations.createBuilding(body));
    }

    @PutMapping("/locations/spaces/{id}")
    public ApiResponse<?> bind(@PathVariable String id, @RequestBody JsonNode body) {
        return ApiResponse.ok(locations.bind(id, body));
    }

    @GetMapping("/alarm-cases")
    public ApiResponse<?> cases(@RequestParam Map<String, String> p) {
        query(p, "sourceType", "state", "assigneeUid", "limit", "skip");
        return ApiResponse.ok(
                operations.list(
                        p.get("sourceType"),
                        p.get("state"),
                        p.get("assigneeUid"),
                        limit(p),
                        skip(p)));
    }

    @GetMapping("/alarm-cases/handlers")
    public ApiResponse<?> handlers() {
        return ApiResponse.ok(operations.handlers());
    }

    @GetMapping("/alarm-cases/{id}")
    public ApiResponse<?> detail(@PathVariable String id) {
        return ApiResponse.ok(operations.detail(id));
    }

    @PostMapping("/alarm-cases/{id}/{action}")
    public ApiResponse<?> update(
            @PathVariable String id, @PathVariable String action, @RequestBody JsonNode body) {
        if (!Set.of("assign", "start", "notes", "verify-recovery", "close").contains(action))
            throw ApiFailure.missing();
        return ApiResponse.ok(operations.update(id, action, body));
    }

    @GetMapping("/demo/status")
    public ApiResponse<?> demo() {
        return ApiResponse.ok(operations.demoStatus());
    }

    @PostMapping("/demo-alarm-scenarios/{scenario}/trigger")
    public ApiResponse<?> trigger(
            @PathVariable String scenario, @RequestBody(required = false) JsonNode body) {
        return ApiResponse.ok(operations.trigger(scenario, body));
    }

    @PostMapping("/demo-alarm-events/{id}/recover")
    public ApiResponse<?> recover(@PathVariable String id, @RequestBody JsonNode body) {
        return ApiResponse.ok(operations.update(id, "recover", body));
    }

    @GetMapping("/device-owners")
    public ApiResponse<?> owners() {
        return ApiResponse.ok(operations.owners());
    }

    @GetMapping("/device-owners/{id}")
    public ApiResponse<?> owner(@PathVariable String id) {
        return ApiResponse.ok(operations.owner(id));
    }

    @PutMapping("/device-owners/{id}")
    public ApiResponse<?> changeOwner(@PathVariable String id, @RequestBody JsonNode body) {
        return ApiResponse.ok(operations.changeOwner(id, body));
    }

    @GetMapping("/integrations/airiot/status")
    public ApiResponse<?> airiot() {
        Access.admin();
        return ApiResponse.ok(airiot.status());
    }

    private static int limit(Map<String, String> p) {
        return (int) Inputs.integer(p.getOrDefault("limit", "50"), 1, 100);
    }

    private static int skip(Map<String, String> p) {
        return (int) Inputs.integer(p.getOrDefault("skip", "0"), 0, 10000);
    }

    private static String text(Map<String, String> p, String key) {
        String s = p.get(key);
        if (s == null || s.isBlank() || s.length() > 64) throw ApiFailure.bad();
        return s;
    }

    private static void query(Map<String, String> p, String... keys) {
        Set<String> allowed = Set.of(keys);
        if (!allowed.containsAll(p.keySet())) throw ApiFailure.bad();
    }
}
