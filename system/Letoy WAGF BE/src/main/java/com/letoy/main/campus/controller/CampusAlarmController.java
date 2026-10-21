package com.letoy.main.campus.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.letoy.main.campus.dto.CampusAlarmDtos;
import com.letoy.main.campus.dto.CampusAlarmDtos.*;
import com.letoy.main.campus.entity.AlarmCase;
import com.letoy.main.campus.entity.DeviceOwner;
import com.letoy.main.campus.service.CampusAlarmService;
import com.letoy.main.common.dto.ApiResponse;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/campus")
public class CampusAlarmController {
    private final CampusAlarmService service;
    public CampusAlarmController(CampusAlarmService service) { this.service = service; }
    @GetMapping("/demo/status")
    public ApiResponse<DemoStatus> demoStatus() { return ApiResponse.success(service.demoStatus()); }
    @GetMapping("/alarm-cases")
    public ApiResponse<CasePage> cases(@RequestParam(required = false) String sourceType, @RequestParam(required = false) String state,
                                      @RequestParam(required = false) String assigneeUid, @RequestParam(defaultValue = "50") int limit,
                                      @RequestParam(defaultValue = "0") int skip) {
        return ApiResponse.success(service.cases(sourceType, state, assigneeUid, limit, skip));
    }
    @GetMapping("/alarm-cases/handlers")
    public ApiResponse<Handlers> handlers() { return ApiResponse.success(service.handlers()); }
    @GetMapping("/alarm-cases/{id}")
    public ApiResponse<AlarmCase> detail(@PathVariable String id) { return ApiResponse.success(service.detail(id)); }
    @PostMapping("/alarm-cases/{id}/assign")
    public ApiResponse<AlarmCase> assign(@PathVariable String id, @RequestBody JsonNode body) {
        return ApiResponse.success(service.assign(id, CampusAlarmDtos.action(body, "assigneeUid", "note")));
    }
    @PostMapping("/alarm-cases/{id}/start")
    public ApiResponse<AlarmCase> start(@PathVariable String id, @RequestBody JsonNode body) {
        return ApiResponse.success(service.start(id, CampusAlarmDtos.action(body, null, "note")));
    }
    @PostMapping("/alarm-cases/{id}/notes")
    public ApiResponse<AlarmCase> note(@PathVariable String id, @RequestBody JsonNode body) {
        return ApiResponse.success(service.note(id, CampusAlarmDtos.action(body, null, "note")));
    }
    @PostMapping("/alarm-cases/{id}/verify-recovery")
    public ApiResponse<AlarmCase> verify(@PathVariable String id, @RequestBody JsonNode body) {
        return ApiResponse.success(service.verifyRecovery(id, CampusAlarmDtos.action(body, null, null)));
    }
    @PostMapping("/alarm-cases/{id}/close")
    public ApiResponse<AlarmCase> close(@PathVariable String id, @RequestBody JsonNode body) {
        return ApiResponse.success(service.close(id, CampusAlarmDtos.action(body, null, "disposition")));
    }
    @PostMapping("/demo-alarm-scenarios/{scenario}/trigger")
    public ApiResponse<AlarmCase> trigger(@PathVariable String scenario, @RequestBody(required = false) JsonNode body) {
        CampusAlarmDtos.empty(body);
        return ApiResponse.success(service.trigger(scenario));
    }
    @PostMapping("/demo-alarm-events/{id}/recover")
    public ApiResponse<AlarmCase> recover(@PathVariable String id, @RequestBody JsonNode body) {
        return ApiResponse.success(service.recoverDemo(id, CampusAlarmDtos.action(body, null, null)));
    }
    @GetMapping("/device-owners")
    public ApiResponse<OwnerPage> owners() { return ApiResponse.success(service.owners()); }
    @GetMapping("/device-owners/{deviceId}")
    public ApiResponse<DeviceOwner> owner(@PathVariable String deviceId) { return ApiResponse.success(service.owner(deviceId)); }
    @PutMapping("/device-owners/{deviceId}")
    public ApiResponse<DeviceOwner> setOwner(@PathVariable String deviceId, @RequestBody JsonNode body) {
        return ApiResponse.success(service.setOwner(deviceId, CampusAlarmDtos.action(body, "ownerUid", "note")));
    }
}
