package cn.campus.course;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.util.Map;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class CampusController {
    private final CampusService campus;
    private final AuthService auth;

    public CampusController(CampusService campus, AuthService auth) {
        this.campus = campus;
        this.auth = auth;
    }

    public record Login(@NotBlank @Size(max = 40) String username,
                        @NotBlank @Size(max = 64) String password) {}
    public record SpaceEdit(@NotBlank @Size(max = 120) String building,
                            @NotBlank @Size(max = 40) String floor) {}
    public record OwnerEdit(@NotBlank @Size(max = 40) String username,
                            @NotBlank @Size(max = 500) String note,
                            @NotNull @PositiveOrZero Long expectedVersion) {}
    public record CaseCreate(@NotBlank @Size(max = 32) String deviceId,
                             @NotBlank @Size(max = 500) String message) {}
    public record CaseAction(@NotBlank @Size(max = 20) String action,
                             @NotNull @PositiveOrZero Long expectedVersion,
                             @Size(max = 2000) String note, @Size(max = 40) String username) {}

    @GetMapping("/health")
    Api<?> health() {
        return Api.ok(Map.of("status", "UP"));
    }

    @PostMapping("/login")
    Api<?> login(@RequestBody @Valid Login input) {
        return Api.ok(auth.login(input.username(), input.password()));
    }

    @PostMapping("/logout")
    Api<?> logout(HttpServletRequest request) {
        auth.logout(request.getHeader("Authorization"));
        return Api.ok(Map.of("loggedOut", true));
    }

    @GetMapping("/me")
    Api<?> me(HttpServletRequest request) {
        return Api.ok(user(request));
    }

    @GetMapping("/devices")
    Api<?> devices() {
        return Api.ok(campus.devices());
    }

    @GetMapping("/overview")
    Api<?> overview() {
        return Api.ok(campus.overview());
    }

    @GetMapping("/spaces")
    Api<?> spaces() {
        return Api.ok(campus.spaces());
    }

    @PutMapping("/spaces/{id}")
    Api<?> space(@PathVariable String id, @RequestBody @Valid SpaceEdit input, HttpServletRequest request) {
        return Api.ok(campus.updateSpace(user(request), id, input.building(), input.floor()));
    }

    @GetMapping("/owners")
    Api<?> owners() {
        return Api.ok(campus.owners());
    }

    @PutMapping("/owners/{deviceId}")
    Api<?> owner(@PathVariable String deviceId, @RequestBody @Valid OwnerEdit input, HttpServletRequest request) {
        return Api.ok(campus.updateOwner(user(request), deviceId, input.username(), input.note(), input.expectedVersion()));
    }

    @GetMapping("/cases")
    Api<?> cases() {
        return Api.ok(campus.cases());
    }

    @PostMapping("/cases")
    Api<?> create(@RequestBody @Valid CaseCreate input, HttpServletRequest request) {
        return Api.ok(campus.createCase(user(request), input.deviceId(), input.message()));
    }

    @PostMapping("/cases/{id}/actions")
    Api<?> act(@PathVariable String id, @RequestBody @Valid CaseAction input, HttpServletRequest request) {
        return Api.ok(campus.act(user(request), id, input.action(), input.expectedVersion(), input.note(), input.username()));
    }

    @GetMapping("/audit")
    Api<?> audit(HttpServletRequest request) {
        return Api.ok(campus.audit(user(request)));
    }

    @GetMapping("/integration")
    Api<?> integration() {
        return Api.ok(Map.of("source", "TEACHING_MOCK", "simulated", true,
                "controlEnabled", false, "notificationsEnabled", false));
    }

    private User user(HttpServletRequest request) {
        return (User) request.getAttribute("user");
    }
}
