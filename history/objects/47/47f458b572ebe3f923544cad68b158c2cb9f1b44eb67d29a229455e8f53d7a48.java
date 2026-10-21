package edu.campus.course;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.List;

@RestController
public class CampusController {
    private final CatalogReader catalog;
    public CampusController(CatalogReader catalog) { this.catalog = catalog; }
    public record Capabilities(List<String> roles, boolean canRead, boolean canControl, boolean canAdmin,
                               boolean canAudit, boolean canHandleAlarms, boolean canAssignAlarms, boolean canRunDemoScenarios) { }
    @GetMapping("/api/campus/capabilities")
    public ApiResponse<Capabilities> capabilities(Authentication authentication) {
        List<String> roles = authentication.getAuthorities().stream().map(a -> a.getAuthority().replaceFirst("^ROLE_", "")).sorted().toList();
        boolean admin = roles.contains("ADMIN");
        return ApiResponse.ok(new Capabilities(roles, true, false, admin, admin,
                admin || roles.contains("CAMPUS_MANAGER"), admin, false));
    }
    @GetMapping("/api/campus/spaces")
    public ApiResponse<CatalogReader.Items<CatalogReader.Space>> spaces() { return ApiResponse.ok(catalog.spaces()); }
    @GetMapping("/api/campus/devices")
    public ApiResponse<CatalogReader.Items<CatalogReader.Device>> devices() { return ApiResponse.ok(catalog.devices()); }
    @GetMapping("/api/campus/locations")
    public ResponseEntity<ApiResponse<Void>> locationsNotImplemented() {
        return ResponseEntity.status(501).body(ApiResponse.error(501, "TEACHING_TODO_NOT_IMPLEMENTED"));
    }
    @PostMapping("/api/campus/locations/campuses")
    public ResponseEntity<ApiResponse<Void>> createCampusNotImplemented() {
        return ResponseEntity.status(501).body(ApiResponse.error(501, "TEACHING_TODO_NOT_IMPLEMENTED"));
    }
}
