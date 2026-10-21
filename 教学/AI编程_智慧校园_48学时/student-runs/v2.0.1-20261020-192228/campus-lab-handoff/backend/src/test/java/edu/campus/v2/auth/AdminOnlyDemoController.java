package edu.campus.v2.auth;

import edu.campus.v2.user.Role;
import edu.campus.v2.web.ApiResponse;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 只用于测试 @RequireRole 的示例接口：仅 ADMIN 可读。
 * 不参与正式运行，也不代表任何真实业务接口。
 */
@RestController
@RequestMapping("/api/role-demo")
public class AdminOnlyDemoController {

    @GetMapping
    @RequireRole(Role.ADMIN)
    public ApiResponse<Map<String, Boolean>> read() {
        return ApiResponse.ok(Map.of("ok", true));
    }
}
