package edu.campus.v2.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import org.springframework.http.MediaType;

/**
 * 在过滤器、拦截器这类还没有进入控制器的地方写统一响应：{code,message,data}。
 * code 与 HTTP 状态一致，例如 401 / 403 / 503。
 */
public final class ApiErrors {

    private ApiErrors() {
    }

    public static void write(ObjectMapper objectMapper, HttpServletResponse response,
                             int status, String message) throws IOException {
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        objectMapper.writeValue(response.getOutputStream(), new ApiResponse<Void>(status, message, null));
    }
}
