package com.letoy.main.campus.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.letoy.main.campus.dto.CampusDtos.*;
import com.letoy.main.campus.entity.CampusBuilding;
import com.letoy.main.campus.entity.CampusLocation;
import com.letoy.main.campus.entity.SpaceBinding;
import com.letoy.main.campus.service.CampusAccess;
import com.letoy.main.campus.service.CampusControlService;
import com.letoy.main.campus.service.CampusLocationService;
import com.letoy.main.campus.service.CampusMonitoringService;
import com.letoy.main.common.dto.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/campus")
public class CampusController {
    private final CampusAccess access;
    private final CampusMonitoringService monitoring;
    private final CampusControlService controls;
    private final CampusLocationService locations;
    public CampusController(CampusAccess access, CampusMonitoringService monitoring,
                            CampusControlService controls, CampusLocationService locations) {
        this.access = access;
        this.monitoring = monitoring;
        this.controls = controls;
        this.locations = locations;
    }
    @GetMapping("/capabilities")
    public ApiResponse<Capabilities> capabilities() { return ApiResponse.success(access.capabilities()); }
    @GetMapping("/overview")
    public ApiResponse<Overview> overview() { return ApiResponse.success(monitoring.overview()); }
    @GetMapping("/spaces")
    public ApiResponse<Items<Space>> spaces() { return ApiResponse.success(monitoring.spaces()); }
    @GetMapping("/devices")
    public ApiResponse<Items<Device>> devices() { return ApiResponse.success(monitoring.devices()); }
    @GetMapping("/history")
    public ApiResponse<History> history(@RequestParam String deviceId, @RequestParam String tagId,
                                       @RequestParam long from, @RequestParam long to) {
        return ApiResponse.success(monitoring.history(deviceId, tagId, from, to));
    }
    @GetMapping("/alarms")
    public ApiResponse<Alarms> alarms(@RequestParam(defaultValue = "50") int limit,
                                     @RequestParam(defaultValue = "0") int skip) {
        return ApiResponse.success(monitoring.alarms(limit, skip));
    }
    @PostMapping("/devices/{deviceId}/simulated-switch")
    public ApiResponse<SwitchResult> switchState(@PathVariable String deviceId, @RequestBody JsonNode request) {
        return ApiResponse.success(controls.switchState(deviceId, SwitchRequest.parse(request)));
    }
    @GetMapping("/audit")
    public ApiResponse<AuditPage> audit(@RequestParam(defaultValue = "50") int limit,
                                        @RequestParam(defaultValue = "0") int skip) {
        return ApiResponse.success(controls.audit(limit, skip));
    }
    @GetMapping("/integrations/airiot/status")
    public ApiResponse<Map<String, Object>> status() { return ApiResponse.success(controls.status()); }
    @GetMapping("/locations")
    public ApiResponse<CampusLocationService.Locations> locations() { return ApiResponse.success(locations.locations()); }
    @PostMapping("/locations/campuses")
    public ApiResponse<CampusLocation> createCampus(@Valid @RequestBody CreateCampusRequest request) {
        return ApiResponse.success(locations.createCampus(request));
    }
    @PostMapping("/locations/buildings")
    public ApiResponse<CampusBuilding> createBuilding(@Valid @RequestBody CreateBuildingRequest request) {
        return ApiResponse.success(locations.createBuilding(request));
    }
    @PutMapping("/locations/spaces/{spaceId}")
    public ApiResponse<SpaceBinding> bindSpace(@PathVariable String spaceId, @Valid @RequestBody BindSpaceRequest request) {
        return ApiResponse.success(locations.bind(spaceId, request));
    }
}
