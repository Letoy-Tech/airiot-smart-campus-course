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
import edu.campus.v2.space.Space;
import edu.campus.v2.space.SpaceNotFoundException;
import edu.campus.v2.space.SpaceService;
import edu.campus.v2.space.SpaceValidationException;
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
 * 空间接口测试：只启动 Web 层，服务层与会话用替身，不连数据库、不连 Redis、不占 8098 端口。
 * 覆盖：三种角色都能读；只有 ADMIN 能改；请求体里的 role 不参与判权。
 */
@WebMvcTest(SpaceController.class)
class SpaceControllerTest {

    private static final String TOKEN = "space-test-token";

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private SpaceService spaceService;

    @MockitoBean
    private LoginSessionStore sessionStore;

    @Test
    void viewerCanReadSpaces() throws Exception {
        given(sessionStore.find(TOKEN))
                .willReturn(Optional.of(new AuthenticatedUser("viewer", Role.VIEWER)));
        given(spaceService.listSpaces()).willReturn(List.of(
                new Space("s1", "101教室", "教学楼", "1"),
                new Space("s2", "201教室", "教学楼", "2")));

        mockMvc.perform(get("/api/spaces").header("Authorization", "Bearer " + TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].id").value("s1"))
                .andExpect(jsonPath("$.data[0].building").value("教学楼"))
                .andExpect(jsonPath("$.data[0].floor").value("1"));
    }

    @Test
    void anonymousCannotReadSpaces() throws Exception {
        mockMvc.perform(get("/api/spaces"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(401));
    }

    @Test
    void adminCanUpdateAndGetsReadBackRow() throws Exception {
        given(sessionStore.find(TOKEN))
                .willReturn(Optional.of(new AuthenticatedUser("admin", Role.ADMIN)));
        given(spaceService.updateLocation("s1", "实训楼", "5", "admin"))
                .willReturn(new Space("s1", "101教室", "实训楼", "5"));

        mockMvc.perform(put("/api/spaces/s1")
                        .header("Authorization", "Bearer " + TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"building":"实训楼","floor":"5"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.id").value("s1"))
                .andExpect(jsonPath("$.data.name").value("101教室"))
                .andExpect(jsonPath("$.data.building").value("实训楼"))
                .andExpect(jsonPath("$.data.floor").value("5"));

        then(spaceService).should().updateLocation("s1", "实训楼", "5", "admin");
    }

    @Test
    void viewerIsForbiddenAndBodyRoleIsIgnored() throws Exception {
        given(sessionStore.find(TOKEN))
                .willReturn(Optional.of(new AuthenticatedUser("viewer", Role.VIEWER)));

        // 请求体故意带上 role=ADMIN：权限只认会话，body 里的角色必须被忽略。
        mockMvc.perform(put("/api/spaces/s1")
                        .header("Authorization", "Bearer " + TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"building":"实训楼","floor":"5","role":"ADMIN"}
                                """))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403))
                .andExpect(jsonPath("$.message").value("已登录但无权执行该操作"));

        then(spaceService).should(never()).updateLocation(any(), any(), any(), any());
    }

    @Test
    void managerIsForbidden() throws Exception {
        given(sessionStore.find(TOKEN))
                .willReturn(Optional.of(new AuthenticatedUser("manager", Role.MANAGER)));

        mockMvc.perform(put("/api/spaces/s1")
                        .header("Authorization", "Bearer " + TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"building":"实训楼","floor":"5"}
                                """))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        then(spaceService).should(never()).updateLocation(any(), any(), any(), any());
    }

    @Test
    void unknownSpaceReturnsNotFound() throws Exception {
        given(sessionStore.find(TOKEN))
                .willReturn(Optional.of(new AuthenticatedUser("admin", Role.ADMIN)));
        given(spaceService.updateLocation("s9", "实训楼", "5", "admin"))
                .willThrow(new SpaceNotFoundException("s9"));

        mockMvc.perform(put("/api/spaces/s9")
                        .header("Authorization", "Bearer " + TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"building":"实训楼","floor":"5"}
                                """))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(404))
                .andExpect(jsonPath("$.message").value("找不到该空间"));
    }

    @Test
    void blankBuildingReturnsBadRequest() throws Exception {
        given(sessionStore.find(TOKEN))
                .willReturn(Optional.of(new AuthenticatedUser("admin", Role.ADMIN)));
        given(spaceService.updateLocation("s1", " ", "5", "admin"))
                .willThrow(new SpaceValidationException("楼栋不能为空"));

        mockMvc.perform(put("/api/spaces/s1")
                        .header("Authorization", "Bearer " + TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"building":" ","floor":"5"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400))
                .andExpect(jsonPath("$.message").value("楼栋不能为空"));
    }
}
