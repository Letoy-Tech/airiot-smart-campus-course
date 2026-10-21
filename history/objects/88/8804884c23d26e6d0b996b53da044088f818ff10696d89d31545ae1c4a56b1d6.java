package edu.campus.v2.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.mockito.Mockito.never;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import edu.campus.v2.auth.LoginSessionStore;
import edu.campus.v2.owner.Owner;
import edu.campus.v2.owner.OwnerService;
import edu.campus.v2.owner.OwnerVersionConflictException;
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
 * 设备责任接口测试：只启动 Web 层，服务层与会话用替身，不连数据库、不连 Redis、不占 8098 端口。
 * 请求体经过真实的 Spring MVC + Jackson 反序列化，因此能验证 expectedVersion 的 JSON 类型限制，
 * 而不是在测试里直接调用服务层或让 mock 抛异常来“制造”400。
 */
@WebMvcTest(OwnerController.class)
class OwnerControllerTest {

    private static final String TOKEN = "owner-test-token";

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private OwnerService ownerService;

    @MockitoBean
    private LoginSessionStore sessionStore;

    @Test
    void viewerCanReadOwners() throws Exception {
        given(sessionStore.find(TOKEN))
                .willReturn(Optional.of(new AuthenticatedUser("viewer", Role.VIEWER)));
        given(ownerService.listOwners()).willReturn(List.of(
                new Owner("d01", "manager", "日常巡检", 1),
                new Owner("d02", "manager", "备用", 3)));

        mockMvc.perform(get("/api/owners").header("Authorization", "Bearer " + TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].deviceId").value("d01"))
                .andExpect(jsonPath("$.data[0].username").value("manager"))
                .andExpect(jsonPath("$.data[0].note").value("日常巡检"))
                .andExpect(jsonPath("$.data[0].version").value(1))
                .andExpect(jsonPath("$.data[1].version").value(3));
    }

    @Test
    void anonymousCannotReadOwners() throws Exception {
        mockMvc.perform(get("/api/owners"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(401));
    }

    @Test
    void adminCanSaveCurrentIntegerVersion() throws Exception {
        given(sessionStore.find(TOKEN))
                .willReturn(Optional.of(new AuthenticatedUser("admin", Role.ADMIN)));
        given(ownerService.saveOwner("d01", "manager", "日常巡检", 2))
                .willReturn(new Owner("d01", "manager", "日常巡检", 3));

        mockMvc.perform(put("/api/owners/d01")
                        .header("Authorization", "Bearer " + TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"username":"manager","note":"日常巡检","expectedVersion":2}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.deviceId").value("d01"))
                .andExpect(jsonPath("$.data.username").value("manager"))
                .andExpect(jsonPath("$.data.version").value(3));

        then(ownerService).should().saveOwner("d01", "manager", "日常巡检", 2);
    }

    @Test
    void viewerCannotSaveAndBodyRoleIsIgnored() throws Exception {
        given(sessionStore.find(TOKEN))
                .willReturn(Optional.of(new AuthenticatedUser("viewer", Role.VIEWER)));

        // 请求体故意带上 role=ADMIN：权限只认会话，body 里的角色必须被忽略。
        mockMvc.perform(put("/api/owners/d01")
                        .header("Authorization", "Bearer " + TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"username":"manager","note":"越权尝试","expectedVersion":2,"role":"ADMIN"}
                                """))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403))
                .andExpect(jsonPath("$.message").value("已登录但无权执行该操作"));

        then(ownerService).should(never()).saveOwner(any(), any(), any(), any());
    }

    @Test
    void staleIntegerVersionReturnsConflictWithoutOverwrite() throws Exception {
        given(sessionStore.find(TOKEN))
                .willReturn(Optional.of(new AuthenticatedUser("admin", Role.ADMIN)));
        given(ownerService.saveOwner("d01", "manager", "旧版本提交", 1))
                .willThrow(new OwnerVersionConflictException());

        mockMvc.perform(put("/api/owners/d01")
                        .header("Authorization", "Bearer " + TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"username":"manager","note":"旧版本提交","expectedVersion":1}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(409))
                .andExpect(jsonPath("$.message").value("负责人记录已被其他人更新，请重新读取后再决定"));
    }

    // ---------- expectedVersion 的 JSON 类型限制：必须是非负整数字面量 ----------
    // 这些用例不 stub 服务的成功返回、也不让 mock 抛异常：400 必须来自真实的 HTTP 反序列化。

    @Test
    void decimalVersionIsRejectedByJsonParsing() throws Exception {
        assertRejectedByJsonParsing(
                "{\"username\":\"manager\",\"note\":\"小数\",\"expectedVersion\":0.5}");
    }

    @Test
    void wholeNumberWrittenAsDecimalIsRejected() throws Exception {
        assertRejectedByJsonParsing(
                "{\"username\":\"manager\",\"note\":\"1.0\",\"expectedVersion\":1.0}");
    }

    @Test
    void stringVersionIsRejectedByJsonParsing() throws Exception {
        assertRejectedByJsonParsing(
                "{\"username\":\"manager\",\"note\":\"字符串\",\"expectedVersion\":\"0\"}");
    }

    @Test
    void booleanVersionIsRejectedByJsonParsing() throws Exception {
        assertRejectedByJsonParsing(
                "{\"username\":\"manager\",\"note\":\"布尔\",\"expectedVersion\":true}");
    }

    @Test
    void negativeVersionIsRejectedByJsonParsing() throws Exception {
        assertRejectedByJsonParsing(
                "{\"username\":\"manager\",\"note\":\"负数\",\"expectedVersion\":-1}");
    }

    @Test
    void overflowVersionIsRejectedByJsonParsing() throws Exception {
        assertRejectedByJsonParsing(
                "{\"username\":\"manager\",\"note\":\"溢出\",\"expectedVersion\":2147483648}");
    }

    /** null 不经过字段反序列化器，由控制器拦下，同样 400 且不写。 */
    @Test
    void nullVersionIsRejectedWithoutWrite() throws Exception {
        assertBadRequestAndNoWrite(
                "{\"username\":\"manager\",\"note\":\"null\",\"expectedVersion\":null}",
                "expectedVersion 必须是 JSON 非负整数");
    }

    @Test
    void missingVersionIsRejectedWithoutWrite() throws Exception {
        assertBadRequestAndNoWrite(
                "{\"username\":\"manager\",\"note\":\"缺省\"}",
                "expectedVersion 必须是 JSON 非负整数");
    }

    /** 类型/范围不合法：必须是 HttpMessageNotReadableException 那条 400，而不是业务层判断。 */
    private void assertRejectedByJsonParsing(String body) throws Exception {
        assertBadRequestAndNoWrite(body, "请求体格式不正确");
    }

    /** 走真实 HTTP 反序列化：必须 400，且服务层一次都没有被调用（不进入写入）。 */
    private void assertBadRequestAndNoWrite(String body, String expectedMessage) throws Exception {
        given(sessionStore.find(TOKEN))
                .willReturn(Optional.of(new AuthenticatedUser("admin", Role.ADMIN)));

        mockMvc.perform(put("/api/owners/d01")
                        .header("Authorization", "Bearer " + TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400))
                .andExpect(jsonPath("$.message").value(expectedMessage));

        then(ownerService).should(never()).saveOwner(any(), any(), any(), any());
    }
}
