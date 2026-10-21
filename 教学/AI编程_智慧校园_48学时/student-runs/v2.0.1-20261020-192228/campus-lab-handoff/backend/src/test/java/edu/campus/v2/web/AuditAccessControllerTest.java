package edu.campus.v2.web;

import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.mockito.Mockito.never;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import edu.campus.v2.audit.AuditEntry;
import edu.campus.v2.audit.AuditService;
import edu.campus.v2.auth.LoginSessionStore;
import edu.campus.v2.user.AuthenticatedUser;
import edu.campus.v2.user.Role;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 管理页两个只读接口的 HTTP 角色测试：只启动 Web 层，服务层与会话用替身。
 * 覆盖：审计仅 ADMIN 可读（MANAGER/VIEWER 403，且不会读到数据）；
 * 接入状态三种登录角色都可读，并原样返回 TEACHING_MOCK 与三个标记。
 */
@WebMvcTest({AuditController.class, IntegrationController.class})
class AuditAccessControllerTest {

    private static final String TOKEN = "admin-page-test-token";

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private AuditService auditService;

    @MockitoBean
    private LoginSessionStore sessionStore;

    @Test
    void adminReadsAudit() throws Exception {
        given(sessionStore.find(TOKEN))
                .willReturn(Optional.of(new AuthenticatedUser("admin", Role.ADMIN)));
        given(auditService.listAudit()).willReturn(List.of(
                new AuditEntry(1_760_000_000_000L, "admin", "space.update", "s1",
                        "楼栋 实训楼，楼层 5"),
                new AuditEntry(1_760_000_060_000L, "manager", "case.close", "case-0001",
                        "关闭事件")));

        mockMvc.perform(get("/api/audit").header("Authorization", "Bearer " + TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].time").value(1_760_000_000_000L))
                .andExpect(jsonPath("$.data[0].actor").value("admin"))
                .andExpect(jsonPath("$.data[0].action").value("space.update"))
                .andExpect(jsonPath("$.data[0].targetId").value("s1"))
                .andExpect(jsonPath("$.data[1].action").value("case.close"));
    }

    @Test
    void managerCannotReadAudit() throws Exception {
        given(sessionStore.find(TOKEN))
                .willReturn(Optional.of(new AuthenticatedUser("manager", Role.MANAGER)));

        mockMvc.perform(get("/api/audit").header("Authorization", "Bearer " + TOKEN))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403))
                .andExpect(jsonPath("$.message").value("已登录但无权执行该操作"));

        then(auditService).should(never()).listAudit();
    }

    @Test
    void viewerCannotReadAudit() throws Exception {
        given(sessionStore.find(TOKEN))
                .willReturn(Optional.of(new AuthenticatedUser("viewer", Role.VIEWER)));

        mockMvc.perform(get("/api/audit").header("Authorization", "Bearer " + TOKEN))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        then(auditService).should(never()).listAudit();
    }

    @Test
    void anonymousCannotReadAudit() throws Exception {
        mockMvc.perform(get("/api/audit"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(401));

        then(auditService).should(never()).listAudit();
    }

    @Test
    void managerReadsIntegration() throws Exception {
        given(sessionStore.find(TOKEN))
                .willReturn(Optional.of(new AuthenticatedUser("manager", Role.MANAGER)));

        mockMvc.perform(get("/api/integration").header("Authorization", "Bearer " + TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.source").value("TEACHING_MOCK"))
                .andExpect(jsonPath("$.data.simulated").value(true))
                .andExpect(jsonPath("$.data.controlEnabled").value(false))
                .andExpect(jsonPath("$.data.notificationsEnabled").value(false));
    }

    @Test
    void viewerReadsIntegration() throws Exception {
        given(sessionStore.find(TOKEN))
                .willReturn(Optional.of(new AuthenticatedUser("viewer", Role.VIEWER)));

        mockMvc.perform(get("/api/integration").header("Authorization", "Bearer " + TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.source").value("TEACHING_MOCK"))
                .andExpect(jsonPath("$.data.simulated").value(true))
                .andExpect(jsonPath("$.data.controlEnabled").value(false))
                .andExpect(jsonPath("$.data.notificationsEnabled").value(false));
    }

    @Test
    void anonymousCannotReadIntegration() throws Exception {
        mockMvc.perform(get("/api/integration"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(401));
    }
}
