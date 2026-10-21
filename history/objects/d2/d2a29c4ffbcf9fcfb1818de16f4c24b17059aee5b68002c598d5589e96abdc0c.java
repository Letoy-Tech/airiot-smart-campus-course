package edu.campus.course;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.reset;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.MockMvcPrint;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.nio.file.Path;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import javax.sql.DataSource;

@SpringBootTest
@AutoConfigureMockMvc(print = MockMvcPrint.NONE)
@ActiveProfiles("first-chain")
class FirstChainTest {
    // Test-only passwords are random on every JVM run and never printed or written.
    static final Map<String, String> PASSWORDS =
            Map.of(
                    "admin",
                    UUID.randomUUID().toString(),
                    "manager-a",
                    UUID.randomUUID().toString(),
                    "manager-b",
                    UUID.randomUUID().toString(),
                    "viewer",
                    UUID.randomUUID().toString());

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        PASSWORDS.forEach((name, value) -> registry.add("course.passwords." + name, () -> value));
        registry.add(
                "course.catalog-path",
                () -> Path.of("src/test/resources/catalog-test.json").toAbsolutePath().toString());
    }

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired ApplicationContext context;
    @MockitoSpyBean LocalAccountDirectory directory;

    @AfterEach
    void resetDirectory() {
        reset(directory);
    }

    record Token(MockHttpSession session, String header, String value) {}

    Token csrf(MockHttpSession session) throws Exception {
        var request = get("/api/auth/csrf");
        if (session != null) request.session(session);
        MvcResult result =
                mvc.perform(request)
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.code").value(0))
                        .andReturn();
        JsonNode data = mapper.readTree(result.getResponse().getContentAsString()).path("data");
        return new Token(
                (MockHttpSession) result.getRequest().getSession(),
                data.path("headerName").asText(),
                data.path("token").asText());
    }

    MockHttpSession login(String username) throws Exception {
        Token token = csrf(null);
        String oldId = token.session().getId();
        MvcResult result =
                mvc.perform(
                                post("/api/auth/login")
                                        .session(token.session())
                                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                                        .header(token.header(), token.value())
                                        .param("username", username)
                                        .param("password", PASSWORDS.get(username)))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.code").value(0))
                        .andExpect(jsonPath("$.data").isEmpty())
                        .andReturn();
        MockHttpSession session = (MockHttpSession) result.getRequest().getSession();
        assertThat(session.getId()).isNotEqualTo(oldId);
        return session;
    }

    @Test
    void anonymousReadsAndMissingCsrfAreClearJson401() throws Exception {
        for (String url :
                new String[] {
                    "/api/auth/me",
                    "/api/campus/capabilities",
                    "/api/campus/spaces",
                    "/api/campus/devices"
                }) {
            mvc.perform(get(url))
                    .andExpect(status().isUnauthorized())
                    .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                    .andExpect(jsonPath("$.code").value(401));
        }
        mvc.perform(
                        post("/api/auth/login")
                                .param("username", "admin")
                                .param("password", PASSWORDS.get("admin")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("CSRF_INVALID"));
    }

    @Test
    void badPasswordAndUnknownUserHaveSameResponse() throws Exception {
        for (String user : new String[] {"admin", "unknown-user"}) {
            Token token = csrf(null);
            mvc.perform(
                            post("/api/auth/login")
                                    .session(token.session())
                                    .header(token.header(), token.value())
                                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                                    .param("username", user)
                                    .param("password", UUID.randomUUID().toString()))
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.message").value("BAD_CREDENTIALS"));
        }
    }

    @Test
    void allFourIdentitiesReadExactFirstChainShape() throws Exception {
        for (String user : PASSWORDS.keySet()) {
            MockHttpSession session = login(user);
            mvc.perform(get("/api/auth/me").session(session))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.uid").value(user))
                    .andExpect(jsonPath("$.data.username").value(user))
                    .andExpect(jsonPath("$.data.source").value("TEACHING_MOCK"))
                    .andExpect(jsonPath("$.data.password").doesNotExist())
                    .andExpect(jsonPath("$.data.passwordHash").doesNotExist());
            JsonNode caps =
                    mapper.readTree(
                                    mvc.perform(get("/api/campus/capabilities").session(session))
                                            .andExpect(status().isOk())
                                            .andReturn()
                                            .getResponse()
                                            .getContentAsString())
                            .path("data");
            assertThat(caps.path("canControl").isBoolean()).isTrue();
            assertThat(caps.path("canControl").booleanValue()).isFalse();
            assertThat(caps.path("canAdmin").booleanValue()).isEqualTo(user.equals("admin"));
            assertThat(caps.path("canHandleAlarms").booleanValue())
                    .isEqualTo(!user.equals("viewer"));
            assertThat(caps.has("source")).isFalse();
            mvc.perform(get("/api/campus/spaces").session(session))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.items.length()").value(1))
                    .andExpect(jsonPath("$.data.items[0].id").value("teaching_space_01"))
                    .andExpect(jsonPath("$.data.observedAt").value(1792303200000L));
            mvc.perform(get("/api/campus/devices").session(session))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.items.length()").value(2))
                    .andExpect(jsonPath("$.data.observedAt").value(1792303200000L))
                    .andExpect(jsonPath("$.data.items[0].online").value(true))
                    .andExpect(jsonPath("$.data.items[1].online").isEmpty())
                    .andExpect(jsonPath("$.data.items[1].communicationTime").isEmpty())
                    .andExpect(jsonPath("$.data.items[0].simulated").value(true))
                    .andExpect(jsonPath("$.data.items[0].source").doesNotExist());
        }
        assertThat(context.getBeansOfType(DataSource.class)).isEmpty();
    }

    @Test
    void loginInvalidatesPreloginCsrfAndLogoutNeedsFreshToken() throws Exception {
        Token before = csrf(null);
        mvc.perform(
                        post("/api/auth/login")
                                .session(before.session())
                                .header(before.header(), before.value())
                                .param("username", "admin")
                                .param("password", PASSWORDS.get("admin")))
                .andExpect(status().isOk());
        mvc.perform(
                        post("/api/auth/logout")
                                .session(before.session())
                                .header(before.header(), before.value()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("CSRF_INVALID"));
        mvc.perform(post("/api/auth/logout").session(before.session()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("CSRF_INVALID"));
        Token after = csrf(before.session());
        mvc.perform(
                        post("/api/auth/logout")
                                .session(after.session())
                                .header(after.header(), after.value()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0));
        assertThat(after.session().isInvalid()).isTrue();
        mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
    }

    @Test
    void readOnlyRoleCannotWriteAndAdminGetsHonestTodo() throws Exception {
        for (String user : new String[] {"viewer", "manager-a", "manager-b", "admin"}) {
            Token token = csrf(login(user));
            mvc.perform(
                            post("/api/campus/locations/campuses")
                                    .session(token.session())
                                    .header(token.header(), token.value())
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content("{\"name\":\"教学校园\"}"))
                    .andExpect(status().is(user.equals("admin") ? 501 : 403))
                    .andExpect(jsonPath("$.code").value(user.equals("admin") ? 501 : 403));
        }
    }

    @Test
    void revokedAdminRoleAppliesToExistingSessionImmediately() throws Exception {
        MockHttpSession session = login("admin");
        AccountDirectory.Account original = directory.find("admin").orElseThrow();
        assertThat(original.roles()).containsExactlyInAnyOrder("ADMIN", "CAMPUS_VIEWER");
        doReturn(
                        Optional.of(
                                new AccountDirectory.Account(
                                        original.username(),
                                        original.displayName(),
                                        original.passwordHash(),
                                        true,
                                        Set.of("CAMPUS_VIEWER"))))
                .when(directory)
                .find("admin");
        mvc.perform(get("/api/campus/capabilities").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.canAdmin").value(false))
                .andExpect(jsonPath("$.data.canAudit").value(false));
        Token token = csrf(session);
        mvc.perform(
                        post("/api/campus/locations/campuses")
                                .session(session)
                                .header(token.header(), token.value())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"name\":\"不应写入\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/campus/devices").session(session)).andExpect(status().isOk());
    }

    @Test
    void disabledIdentityInvalidatesExistingSession() throws Exception {
        MockHttpSession session = login("manager-a");
        AccountDirectory.Account original = directory.find("manager-a").orElseThrow();
        doReturn(
                        Optional.of(
                                new AccountDirectory.Account(
                                        original.username(),
                                        original.displayName(),
                                        original.passwordHash(),
                                        false,
                                        original.roles())))
                .when(directory)
                .find("manager-a");
        mvc.perform(get("/api/campus/devices").session(session))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("IDENTITY_DISABLED"));
        assertThat(session.isInvalid()).isTrue();
    }
}
