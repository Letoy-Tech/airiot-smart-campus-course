package edu.campus.v2.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.mockito.Mockito.never;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import edu.campus.v2.auth.LoginSessionStore;
import edu.campus.v2.caseflow.Case;
import edu.campus.v2.caseflow.CaseActionForbiddenException;
import edu.campus.v2.caseflow.CaseNotFoundException;
import edu.campus.v2.caseflow.CaseService;
import edu.campus.v2.caseflow.CaseStateException;
import edu.campus.v2.caseflow.CaseTimelineEntry;
import edu.campus.v2.caseflow.CaseVersionConflictException;
import edu.campus.v2.user.AuthenticatedUser;
import edu.campus.v2.user.Role;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 演练事件接口测试：只启动 Web 层，服务层与会话用替身，不连数据库、不连 Redis、不占 8098 端口。
 * 三个登录角色都能读；创建只允许 ADMIN，且请求体里的处理人、状态、时间都必须被忽略。
 */
@WebMvcTest(CaseController.class)
class CaseControllerTest {

    private static final String TOKEN = "case-test-token";

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private CaseService caseService;

    @MockitoBean
    private LoginSessionStore sessionStore;

    @Test
    void viewerCanReadCasesWithTimeline() throws Exception {
        given(sessionStore.find(TOKEN))
                .willReturn(Optional.of(new AuthenticatedUser("viewer", Role.VIEWER)));
        given(caseService.listCases()).willReturn(List.of(
                new Case("case-abc123", "d01", "温湿度持续偏高", "ASSIGNED",
                        "manager", "ACTIVE", false, "", "", 1,
                        List.of(new CaseTimelineEntry(
                                1792454400000L, "create", "admin", "创建教学模拟演练事件")))));

        mockMvc.perform(get("/api/cases").header("Authorization", "Bearer " + TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].id").value("case-abc123"))
                .andExpect(jsonPath("$.data[0].deviceId").value("d01"))
                .andExpect(jsonPath("$.data[0].message").value("温湿度持续偏高"))
                .andExpect(jsonPath("$.data[0].state").value("ASSIGNED"))
                .andExpect(jsonPath("$.data[0].assignee").value("manager"))
                .andExpect(jsonPath("$.data[0].sourceState").value("ACTIVE"))
                .andExpect(jsonPath("$.data[0].verified").value(false))
                .andExpect(jsonPath("$.data[0].version").value(1))
                .andExpect(jsonPath("$.data[0].timeline[0].action").value("create"))
                .andExpect(jsonPath("$.data[0].timeline[0].actor").value("admin"))
                .andExpect(jsonPath("$.data[0].timeline[0].time").value(1792454400000L));
    }

    @Test
    void anonymousCannotReadCases() throws Exception {
        mockMvc.perform(get("/api/cases"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(401));
    }

    @Test
    void adminCreatesCaseAndForgedFieldsAreIgnored() throws Exception {
        given(sessionStore.find(TOKEN))
                .willReturn(Optional.of(new AuthenticatedUser("admin", Role.ADMIN)));
        given(caseService.createCase("d01", "温湿度持续偏高", "admin"))
                .willReturn(new Case("case-abc123", "d01", "温湿度持续偏高", "NEW",
                        null, "ACTIVE", false, "", "", 1,
                        List.of(new CaseTimelineEntry(
                                1792454400000L, "create", "admin", "创建教学模拟演练事件"))));

        // 请求体故意带上 assignee、state、createdAt、version：这些字段不在请求记录里，必须被忽略。
        mockMvc.perform(post("/api/cases")
                        .header("Authorization", "Bearer " + TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"deviceId":"d01","message":"温湿度持续偏高",
                                 "assignee":"admin","state":"CLOSED","createdAt":1,"version":99}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.id").value("case-abc123"))
                .andExpect(jsonPath("$.data.state").value("NEW"))
                .andExpect(jsonPath("$.data.assignee").doesNotExist())
                .andExpect(jsonPath("$.data.version").value(1));

        then(caseService).should().createCase("d01", "温湿度持续偏高", "admin");
    }

    @Test
    void managerCannotCreateCase() throws Exception {
        given(sessionStore.find(TOKEN))
                .willReturn(Optional.of(new AuthenticatedUser("manager", Role.MANAGER)));

        mockMvc.perform(post("/api/cases")
                        .header("Authorization", "Bearer " + TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"deviceId":"d01","message":"越权尝试"}
                                """))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403))
                .andExpect(jsonPath("$.message").value("已登录但无权执行该操作"));

        then(caseService).should(never()).createCase(any(), any(), any());
    }

    // ---------- POST /api/cases/{id}/actions ----------

    @Test
    void viewerCannotCallAction() throws Exception {
        given(sessionStore.find(TOKEN))
                .willReturn(Optional.of(new AuthenticatedUser("viewer", Role.VIEWER)));

        mockMvc.perform(post("/api/cases/case-1/actions")
                        .header("Authorization", "Bearer " + TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"action":"start","expectedVersion":1}
                                """))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403))
                .andExpect(jsonPath("$.message").value("已登录但无权执行该操作"));

        then(caseService).should(never()).applyAction(any(), any(), any(), any(), any(), any());
    }

    @Test
    void managerAssignIsRejectedByService() throws Exception {
        given(sessionStore.find(TOKEN))
                .willReturn(Optional.of(new AuthenticatedUser("manager", Role.MANAGER)));
        given(caseService.applyAction(
                org.mockito.ArgumentMatchers.eq("case-1"),
                org.mockito.ArgumentMatchers.eq("assign"),
                org.mockito.ArgumentMatchers.eq(1),
                org.mockito.ArgumentMatchers.eq("越权分派"),
                org.mockito.ArgumentMatchers.eq("manager"),
                any(AuthenticatedUser.class)))
                .willThrow(new CaseActionForbiddenException());

        mockMvc.perform(post("/api/cases/case-1/actions")
                        .header("Authorization", "Bearer " + TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"action":"assign","expectedVersion":1,"note":"越权分派","username":"manager"}
                                """))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403))
                .andExpect(jsonPath("$.message").value("已登录但无权执行该事件动作"));
    }

    @Test
    void versionConflictReturns409() throws Exception {
        given(sessionStore.find(TOKEN))
                .willReturn(Optional.of(new AuthenticatedUser("manager", Role.MANAGER)));
        given(caseService.applyAction(any(), any(), any(), any(), any(), any()))
                .willThrow(new CaseVersionConflictException());

        mockMvc.perform(post("/api/cases/case-1/actions")
                        .header("Authorization", "Bearer " + TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"action":"start","expectedVersion":1}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(409))
                .andExpect(jsonPath("$.message")
                        .value("演练事件已被其他人更新，请重新读取后再决定"));
    }

    @Test
    void wrongStateReturns409WithReason() throws Exception {
        given(sessionStore.find(TOKEN))
                .willReturn(Optional.of(new AuthenticatedUser("admin", Role.ADMIN)));
        given(caseService.applyAction(any(), any(), any(), any(), any(), any()))
                .willThrow(new CaseStateException("事件尚未分派，不能开始处理"));

        mockMvc.perform(post("/api/cases/case-1/actions")
                        .header("Authorization", "Bearer " + TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"action":"start","expectedVersion":1}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(409))
                .andExpect(jsonPath("$.message").value("事件尚未分派，不能开始处理"));
    }

    @Test
    void missingCaseReturns404() throws Exception {
        given(sessionStore.find(TOKEN))
                .willReturn(Optional.of(new AuthenticatedUser("admin", Role.ADMIN)));
        given(caseService.applyAction(any(), any(), any(), any(), any(), any()))
                .willThrow(new CaseNotFoundException("case-404"));

        mockMvc.perform(post("/api/cases/case-404/actions")
                        .header("Authorization", "Bearer " + TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"action":"start","expectedVersion":1}
                                """))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(404))
                .andExpect(jsonPath("$.message").value("找不到该演练事件"));
    }

    @Test
    void adminAssignUsesSessionActorAndBodyFields() throws Exception {
        given(sessionStore.find(TOKEN))
                .willReturn(Optional.of(new AuthenticatedUser("admin", Role.ADMIN)));
        given(caseService.applyAction(
                org.mockito.ArgumentMatchers.eq("case-1"),
                org.mockito.ArgumentMatchers.eq("assign"),
                org.mockito.ArgumentMatchers.eq(1),
                org.mockito.ArgumentMatchers.eq("请到现场复核"),
                org.mockito.ArgumentMatchers.eq("manager"),
                any(AuthenticatedUser.class)))
                .willReturn(new Case("case-1", "d01", "温湿度偏高", "ASSIGNED",
                        "manager", "ACTIVE", false, "", "", 2,
                        List.of(new CaseTimelineEntry(
                                1792454400000L, "assign", "admin", "请到现场复核"))));

        mockMvc.perform(post("/api/cases/case-1/actions")
                        .header("Authorization", "Bearer " + TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"action":"assign","expectedVersion":1,"note":"请到现场复核",
                                 "username":"manager","actor":"forged","state":"CLOSED"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.state").value("ASSIGNED"))
                .andExpect(jsonPath("$.data.assignee").value("manager"))
                .andExpect(jsonPath("$.data.version").value(2));

        then(caseService).should().applyAction(
                org.mockito.ArgumentMatchers.eq("case-1"),
                org.mockito.ArgumentMatchers.eq("assign"),
                org.mockito.ArgumentMatchers.eq(1),
                org.mockito.ArgumentMatchers.eq("请到现场复核"),
                org.mockito.ArgumentMatchers.eq("manager"),
                org.mockito.ArgumentMatchers.eq(new AuthenticatedUser("admin", Role.ADMIN)));
    }

    @Test
    void closeIgnoresForgedVerifiedAndSourceStateFields() throws Exception {
        given(sessionStore.find(TOKEN))
                .willReturn(Optional.of(new AuthenticatedUser("admin", Role.ADMIN)));
        given(caseService.applyAction(
                org.mockito.ArgumentMatchers.eq("case-1"),
                org.mockito.ArgumentMatchers.eq("close"),
                org.mockito.ArgumentMatchers.eq(5),
                org.mockito.ArgumentMatchers.eq("关闭结论"),
                org.mockito.ArgumentMatchers.isNull(),
                any(AuthenticatedUser.class)))
                .willReturn(new Case("case-1", "d01", "温湿度偏高", "CLOSED",
                        "manager", "RECOVERED", true, "已处理", "关闭结论", 6,
                        List.of(new CaseTimelineEntry(
                                1792454400000L, "close", "admin", "关闭结论"))));

        // verified、sourceState 不在请求记录里：即使客户端提交，也不会传给服务层。
        mockMvc.perform(post("/api/cases/case-1/actions")
                        .header("Authorization", "Bearer " + TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"action":"close","expectedVersion":5,"note":"关闭结论",
                                 "verified":true,"sourceState":"RECOVERED","actor":"forged"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.state").value("CLOSED"))
                .andExpect(jsonPath("$.data.conclusion").value("关闭结论"));

        then(caseService).should().applyAction(
                org.mockito.ArgumentMatchers.eq("case-1"),
                org.mockito.ArgumentMatchers.eq("close"),
                org.mockito.ArgumentMatchers.eq(5),
                org.mockito.ArgumentMatchers.eq("关闭结论"),
                org.mockito.ArgumentMatchers.isNull(),
                org.mockito.ArgumentMatchers.eq(new AuthenticatedUser("admin", Role.ADMIN)));
    }

    @Test
    void stringExpectedVersionIsRejectedForAction() throws Exception {
        assertActionVersionRejected(
                "{\"action\":\"start\",\"expectedVersion\":\"1\"}",
                "请求体格式不正确");
    }

    @Test
    void decimalExpectedVersionIsRejectedForAction() throws Exception {
        assertActionVersionRejected(
                "{\"action\":\"start\",\"expectedVersion\":1.0}",
                "请求体格式不正确");
    }

    @Test
    void nullExpectedVersionIsRejectedForAction() throws Exception {
        assertActionVersionRejected(
                "{\"action\":\"start\",\"expectedVersion\":null}",
                "expectedVersion 必须是 JSON 非负整数");
    }

    @Test
    void missingExpectedVersionIsRejectedForAction() throws Exception {
        assertActionVersionRejected(
                "{\"action\":\"start\"}",
                "expectedVersion 必须是 JSON 非负整数");
    }

    /** 版本类型不合法必须在反序列化/控制器阶段 400，服务层一次都不进入。 */
    private void assertActionVersionRejected(String body, String expectedMessage) throws Exception {
        given(sessionStore.find(TOKEN))
                .willReturn(Optional.of(new AuthenticatedUser("admin", Role.ADMIN)));

        mockMvc.perform(post("/api/cases/case-1/actions")
                        .header("Authorization", "Bearer " + TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400))
                .andExpect(jsonPath("$.message").value(expectedMessage));

        then(caseService).should(never()).applyAction(any(), any(), any(), any(), any(), any());
    }
}
