package cn.campus.course;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.MediaType;
import org.springframework.http.converter.json.Jackson2ObjectMapperBuilder;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class VersionJsonBoundaryTest {
    private MockMvc mvc;
    private CampusService campus;

    @BeforeEach
    void setup() {
        campus = mock(CampusService.class);
        var builder = new Jackson2ObjectMapperBuilder();
        new JsonInputConfig().strictIntegerInput().customize(builder);
        mvc = MockMvcBuilders.standaloneSetup(new CampusController(campus, mock(AuthService.class)))
                .setControllerAdvice(new ApiErrors())
                .setMessageConverters(new MappingJackson2HttpMessageConverter(builder.build()))
                .build();
    }

    @ParameterizedTest
    @ValueSource(strings = {"0.5", "1.0", "\"0\"", "\"\"", "true", "false", "null", "-1",
            "9223372036854775808", "[]", "{}"})
    void invalidVersionIs400BeforeEitherWrite(String raw) throws Exception {
        mvc.perform(put("/api/owners/d01").contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"manager\",\"note\":\"巡查\",\"expectedVersion\":" + raw + "}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value(400));
        mvc.perform(post("/api/cases/c1/actions").contentType(MediaType.APPLICATION_JSON)
                .content("{\"action\":\"start\",\"expectedVersion\":" + raw + "}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value(400));
        verifyNoInteractions(campus);
    }

    @ParameterizedTest
    @ValueSource(strings = {"0", "1", "9223372036854775807"})
    void validIntegerReachesServiceWithoutCoercion(String raw) throws Exception {
        mvc.perform(put("/api/owners/d01").contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"manager\",\"note\":\"巡查\",\"expectedVersion\":" + raw + "}"))
                .andExpect(status().isOk());
        verify(campus).updateOwner(null, "d01", "manager", "巡查", Long.valueOf(raw));
    }

    @ParameterizedTest
    @ValueSource(strings = {"/api/owners/d01", "/api/cases/c1/actions"})
    void omittedVersionIs400(String path) throws Exception {
        var request = path.contains("owners") ? put(path) : post(path);
        mvc.perform(request.contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"manager\",\"note\":\"巡查\",\"action\":\"start\"}"))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(campus);
    }
}
