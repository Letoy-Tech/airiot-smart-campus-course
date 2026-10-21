package com.letoy.main.campus.controller;

import com.letoy.main.campus.airiot.AiriotException;
import com.letoy.main.campus.service.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Standalone MockMvc: no Spring context, datasource, Redis, or external upstream. */
class CampusHttpContractTests {
    private MockMvc mvc;
    private CampusMonitoringService monitoring;
    private CampusControlService controls;
    @BeforeEach void setup() {
        monitoring = mock(CampusMonitoringService.class);
        controls = mock(CampusControlService.class);
        mvc = MockMvcBuilders.standaloneSetup(new CampusController(mock(CampusAccess.class), monitoring, controls,
                mock(CampusLocationService.class))).setControllerAdvice(new CampusExceptionHandler()).build();
    }
    @Test void upstreamUnauthorizedDoesNotLogOutMgSession() throws Exception {
        when(monitoring.overview()).thenThrow(new AiriotException("UPSTREAM_AUTH", 401, "专用机器身份失效"));
        mvc.perform(get("/campus/overview")).andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.status").value(502)).andExpect(jsonPath("$.code").value(5200));
    }
    @Test void permissionAndConflictUseHttp403And409() throws Exception {
        when(controls.audit(50, 0)).thenThrow(CampusException.denied());
        mvc.perform(get("/campus/audit")).andExpect(status().isForbidden());
        when(controls.switchState(eq("facility_demo_01"), any()))
                .thenThrow(new CampusException(409, "STATE_CONFLICT", "TEST state conflict"));
        mvc.perform(post("/campus/devices/facility_demo_01/simulated-switch").contentType(MediaType.APPLICATION_JSON)
                .content("{\"on\":true,\"reason\":\"TEST\",\"expectedState\":false}")).andExpect(status().isConflict());
    }
    @Test void invalidBooleanAndMissingOrBadTimesUseHttp400() throws Exception {
        mvc.perform(post("/campus/devices/facility_demo_01/simulated-switch").contentType(MediaType.APPLICATION_JSON)
                .content("{\"on\":\"true\",\"reason\":\"TEST\",\"expectedState\":false}")).andExpect(status().isBadRequest());
        mvc.perform(get("/campus/history").param("deviceId", "env_demo_01").param("tagId", "temperature_c"))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/campus/history").param("deviceId", "env_demo_01").param("tagId", "temperature_c")
                .param("from", "invalid").param("to", "1791053777001")).andExpect(status().isBadRequest());
        verifyNoInteractions(controls, monitoring);
    }
}
