package edu.campus.v2.auth;

import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import edu.campus.v2.user.AuthenticatedUser;
import edu.campus.v2.user.Role;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 角色检查测试：用只允许 ADMIN 的示例接口（AdminOnlyDemoController）验证 403 规则，
 * 不涉及真实业务接口、不连数据库、不连 Redis。
 */
@WebMvcTest(AdminOnlyDemoController.class)
class RoleInterceptorTest {

    private static final String TOKEN = "role-test-token";

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private LoginSessionStore sessionStore;

    @Test
    void adminIsAllowed() throws Exception {
        given(sessionStore.find(TOKEN))
                .willReturn(Optional.of(new AuthenticatedUser("admin", Role.ADMIN)));

        mockMvc.perform(get("/api/role-demo").header("Authorization", "Bearer " + TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0));
    }

    @Test
    void managerIsForbidden() throws Exception {
        given(sessionStore.find(TOKEN))
                .willReturn(Optional.of(new AuthenticatedUser("manager", Role.MANAGER)));

        mockMvc.perform(get("/api/role-demo").header("Authorization", "Bearer " + TOKEN))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403))
                .andExpect(jsonPath("$.message").value("已登录但无权执行该操作"));
    }

    @Test
    void viewerIsForbidden() throws Exception {
        given(sessionStore.find(TOKEN))
                .willReturn(Optional.of(new AuthenticatedUser("viewer", Role.VIEWER)));

        mockMvc.perform(get("/api/role-demo").header("Authorization", "Bearer " + TOKEN))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));
    }

    @Test
    void anonymousIsUnauthorizedBeforeRoleCheck() throws Exception {
        mockMvc.perform(get("/api/role-demo"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(401));
    }
}
