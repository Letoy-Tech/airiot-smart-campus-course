package edu.campus.v2.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.mockito.BDDMockito.willThrow;
import static org.mockito.Mockito.never;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import edu.campus.v2.auth.LoginSessionStore;
import edu.campus.v2.auth.LoginTokenGenerator;
import edu.campus.v2.auth.SessionStoreUnavailableException;
import edu.campus.v2.user.AuthenticatedUser;
import edu.campus.v2.user.Role;
import edu.campus.v2.user.UserAuthenticationService;
import java.time.Duration;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

/**
 * 登录接口测试：只启动 Web 层。会话存储、令牌生成、账号校验都用替身，
 * 不连 MySQL、不连 Redis、不启动常驻服务。
 * 本文件里的口令只是测试替身，不是课程真实配置。
 */
@WebMvcTest(AuthController.class)
class AuthControllerTest {

    private static final String RAW_PASSWORD = "LocalCourseOnly-5wZ9";
    private static final String TOKEN = "issued-token-4Qm2";

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private UserAuthenticationService authenticationService;

    @MockitoBean
    private LoginSessionStore sessionStore;

    @MockitoBean
    private LoginTokenGenerator tokenGenerator;

    @Test
    void loginUsesCanonicalUsernameFromDatabaseNotInputCase() throws Exception {
        // MySQL 排序规则不区分大小写：输入 MANAGER，查到的记录是 manager
        given(authenticationService.authenticate("MANAGER", RAW_PASSWORD))
                .willReturn(Optional.of(new AuthenticatedUser("manager", Role.MANAGER)));
        given(tokenGenerator.newToken()).willReturn(TOKEN);

        mockMvc.perform(post("/api/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"username":"MANAGER","password":"LocalCourseOnly-5wZ9"}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.message").value("ok"))
                .andExpect(jsonPath("$.data.token").value(TOKEN))
                .andExpect(jsonPath("$.data.user.username").value("manager"))
                .andExpect(jsonPath("$.data.user.role").value("MANAGER"));

        // 会话也按规范 username 保存，而不是输入的大写形式
        then(sessionStore).should().save(
                TOKEN, new AuthenticatedUser("manager", Role.MANAGER), Duration.ofSeconds(1800));
    }

    @Test
    void loginResponseContainsNoPasswordOrHash() throws Exception {
        given(authenticationService.authenticate("admin", RAW_PASSWORD))
                .willReturn(Optional.of(new AuthenticatedUser("admin", Role.ADMIN)));
        given(tokenGenerator.newToken()).willReturn(TOKEN);

        MvcResult result = mockMvc.perform(post("/api/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"username":"admin","password":"LocalCourseOnly-5wZ9"}"""))
                .andExpect(status().isOk())
                .andReturn();

        String body = result.getResponse().getContentAsString();
        assertThat(body).doesNotContain(RAW_PASSWORD);
        assertThat(body).doesNotContain("password");
        assertThat(body).doesNotContain("passwordHash");
        assertThat(body).doesNotContain("$2a$");
        assertThat(body).doesNotContain("$2b$");
    }

    @Test
    void wrongPasswordReturns401AndIssuesNoSession() throws Exception {
        given(authenticationService.authenticate(anyString(), anyString())).willReturn(Optional.empty());

        mockMvc.perform(post("/api/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"username":"admin","password":"wrong-password"}"""))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(401))
                .andExpect(jsonPath("$.data").doesNotExist());

        then(tokenGenerator).should(never()).newToken();
        then(sessionStore).should(never()).save(any(), any(), any());
    }

    @Test
    void loginFailureDoesNotRevealWhetherAccountExists() throws Exception {
        given(authenticationService.authenticate(anyString(), anyString())).willReturn(Optional.empty());

        MvcResult unknownUser = mockMvc.perform(post("/api/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"username":"ghost","password":"whatever-1"}"""))
                .andExpect(status().isUnauthorized())
                .andReturn();
        MvcResult wrongPassword = mockMvc.perform(post("/api/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"username":"admin","password":"whatever-2"}"""))
                .andExpect(status().isUnauthorized())
                .andReturn();

        assertThat(unknownUser.getResponse().getContentAsString())
                .isEqualTo(wrongPassword.getResponse().getContentAsString());
    }

    @Test
    void blankCredentialsAreRejectedWithoutTouchingDatabase() throws Exception {
        mockMvc.perform(post("/api/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"username":"","password":""}"""))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(401));

        then(authenticationService).should(never()).authenticate(any(), any());
    }

    @Test
    void meWithoutTokenReturns401() throws Exception {
        mockMvc.perform(get("/api/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(401))
                .andExpect(jsonPath("$.message").value("未登录：缺少 Bearer 令牌"));

        then(sessionStore).should(never()).find(anyString());
    }

    @Test
    void malformedAuthorizationHeaderIsTreatedAsMissingToken() throws Exception {
        mockMvc.perform(get("/api/me").header("Authorization", "Token abc"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(401));
        mockMvc.perform(get("/api/me").header("Authorization", "Bearer "))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(401));
    }

    @Test
    void expiredOrUnknownTokenReturns401() throws Exception {
        given(sessionStore.find("stale-token")).willReturn(Optional.empty());

        mockMvc.perform(get("/api/me").header("Authorization", "Bearer stale-token"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(401))
                .andExpect(jsonPath("$.message").value("未登录或会话已过期"));
    }

    @Test
    void meReturnsUserFromSession() throws Exception {
        given(sessionStore.find(TOKEN))
                .willReturn(Optional.of(new AuthenticatedUser("manager", Role.MANAGER)));

        mockMvc.perform(get("/api/me").header("Authorization", "Bearer " + TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.username").value("manager"))
                .andExpect(jsonPath("$.data.role").value("MANAGER"));
    }

    @Test
    void logoutDeletesSessionAndTokenCannotBeUsedAfterwards() throws Exception {
        given(sessionStore.find(TOKEN))
                .willReturn(Optional.of(new AuthenticatedUser("viewer", Role.VIEWER)));

        mockMvc.perform(post("/api/logout").header("Authorization", "Bearer " + TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0));

        then(sessionStore).should().delete(TOKEN);

        // 退出后同一个令牌不再对应任何会话
        given(sessionStore.find(TOKEN)).willReturn(Optional.empty());
        mockMvc.perform(get("/api/me").header("Authorization", "Bearer " + TOKEN))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(401));
    }

    @Test
    void logoutWithoutTokenReturns401() throws Exception {
        mockMvc.perform(post("/api/logout"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(401));

        then(sessionStore).should(never()).delete(anyString());
    }

    @Test
    void redisUnavailableDuringLoginReturns503AndIssuesNoToken() throws Exception {
        given(authenticationService.authenticate("admin", RAW_PASSWORD))
                .willReturn(Optional.of(new AuthenticatedUser("admin", Role.ADMIN)));
        given(tokenGenerator.newToken()).willReturn(TOKEN);
        willThrow(new SessionStoreUnavailableException("Redis 不可用", new RuntimeException("down")))
                .given(sessionStore).save(any(), any(), any());

        MvcResult result = mockMvc.perform(post("/api/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"username":"admin","password":"LocalCourseOnly-5wZ9"}"""))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value(503))
                .andExpect(jsonPath("$.message").value("会话服务暂时不可用，请稍后重试"))
                .andReturn();

        // 不放行、不伪造登录成功：响应里没有 token
        assertThat(result.getResponse().getContentAsString()).doesNotContain(TOKEN);
    }

    @Test
    void redisUnavailableOnProtectedRequestReturns503() throws Exception {
        given(sessionStore.find(TOKEN))
                .willThrow(new SessionStoreUnavailableException("Redis 不可用", new RuntimeException("down")));

        mockMvc.perform(get("/api/me").header("Authorization", "Bearer " + TOKEN))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value(503))
                .andExpect(jsonPath("$.message").value("会话服务暂时不可用，请稍后重试"));
    }
}
