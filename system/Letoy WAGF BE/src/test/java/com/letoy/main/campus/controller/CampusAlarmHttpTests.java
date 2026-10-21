package com.letoy.main.campus.controller;

import com.letoy.main.campus.service.CampusAlarmService;
import com.letoy.main.campus.service.CampusException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class CampusAlarmHttpTests {
    private MockMvc mvc;
    private CampusAlarmService service;
    @BeforeEach void setup() {
        service = mock(CampusAlarmService.class);
        mvc = MockMvcBuilders.standaloneSetup(new CampusAlarmController(service))
                .setControllerAdvice(new CampusExceptionHandler()).build();
    }
    @Test void strictVersionsAndRequiredNotesRejectCoercionOrMissingFields() throws Exception {
        for (String body : new String[]{"{}", "{\"expectedVersion\":\"1\",\"note\":\"TEST\"}",
                "{\"expectedVersion\":1.5,\"note\":\"TEST\"}", "{\"expectedVersion\":-1,\"note\":\"TEST\"}",
                "{\"expectedVersion\":true,\"note\":\"TEST\"}", "{\"expectedVersion\":1,\"note\":\" \"}",
                "{\"expectedVersion\":1,\"note\":42}", "{\"expectedVersion\":9999999999999999999999999,\"note\":\"TEST\"}"}) {
            mvc.perform(post("/campus/alarm-cases/TEST/start").contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isBadRequest());
        }
        verifyNoInteractions(service);
    }
    @Test void sourceActorAndRecoveryClaimsCannotBeSubmitted() throws Exception {
        mvc.perform(post("/campus/alarm-cases/TEST/close").contentType(MediaType.APPLICATION_JSON)
                .content("{\"expectedVersion\":1,\"disposition\":\"TEST\",\"recovered\":true}")).andExpect(status().isBadRequest());
        mvc.perform(post("/campus/alarm-cases/TEST/notes").contentType(MediaType.APPLICATION_JSON)
                .content("{\"expectedVersion\":1,\"note\":\"TEST\",\"actorUid\":\"ADMIN\"}")).andExpect(status().isBadRequest());
        mvc.perform(post("/campus/demo-alarm-scenarios/temperature-patrol/trigger").contentType(MediaType.APPLICATION_JSON)
                .content("{\"sourceType\":\"AIRIOT\",\"deviceId\":\"real_device\"}")).andExpect(status().isBadRequest());
        mvc.perform(put("/campus/device-owners/env_demo_01").contentType(MediaType.APPLICATION_JSON)
                .content("{\"expectedVersion\":0,\"ownerUid\":\"TEST\",\"note\":\"TEST\",\"time\":1}")).andExpect(status().isBadRequest());
        verifyNoInteractions(service);
    }
    @Test void versionConflictAndForbiddenHaveExpectedHttpStatuses() throws Exception {
        when(service.verifyRecovery(eq("TEST"), any())).thenThrow(new CampusException(409, "VERSION_CONFLICT", "TEST 冲突"));
        mvc.perform(post("/campus/alarm-cases/TEST/verify-recovery").contentType(MediaType.APPLICATION_JSON)
                .content("{\"expectedVersion\":1}")).andExpect(status().isConflict());
        when(service.trigger("temperature-patrol")).thenThrow(CampusException.denied());
        mvc.perform(post("/campus/demo-alarm-scenarios/temperature-patrol/trigger")).andExpect(status().isForbidden());
    }
    @Test void closeUsesDispositionAndDemoTriggerAcceptsOnlyEmptyPayload() throws Exception {
        mvc.perform(post("/campus/alarm-cases/TEST/close").contentType(MediaType.APPLICATION_JSON)
                .content("{\"expectedVersion\":5,\"disposition\":\"TEST 巡查完成\"}")).andExpect(status().isOk());
        verify(service).close(eq("TEST"), argThat(request -> request.expectedVersion() == 5 && "TEST 巡查完成".equals(request.note())));
        mvc.perform(post("/campus/demo-alarm-scenarios/temperature-patrol/trigger").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isOk());
        verify(service).trigger("temperature-patrol");
    }
}
