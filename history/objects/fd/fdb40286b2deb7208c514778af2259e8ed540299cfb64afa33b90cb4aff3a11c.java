package edu.campus.v2.web;

import edu.campus.v2.auth.RequireRole;
import edu.campus.v2.auth.SessionAuthFilter;
import edu.campus.v2.space.Space;
import edu.campus.v2.space.SpaceService;
import edu.campus.v2.space.SpaceValidationException;
import edu.campus.v2.user.AuthenticatedUser;
import edu.campus.v2.user.Role;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 空间接口：三种角色都能读，只有 ADMIN 能改楼栋与楼层。
 * /api 下除 /api/health 与 /api/login 外都要 Bearer 令牌（SessionAuthFilter），
 * 因此 GET 也要求已登录；PUT 的角色判断由 RoleInterceptor 按会话里的角色执行。
 */
@RestController
@RequestMapping("/api")
public class SpaceController {

    private final SpaceService spaceService;

    public SpaceController(SpaceService spaceService) {
        this.spaceService = spaceService;
    }

    /** 三个登录角色都可读：不加 @RequireRole，表示只要求登录，不限制角色。 */
    @GetMapping("/spaces")
    public ApiResponse<List<Space>> spaces() {
        return ApiResponse.ok(spaceService.listSpaces());
    }

    /**
     * 仅 ADMIN：角色来自 SessionAuthFilter 写入的会话身份，不读请求体里的任何身份字段。
     * 成功时返回更新后从库里读回的那一行。
     */
    @PutMapping("/spaces/{id}")
    @RequireRole(Role.ADMIN)
    public ApiResponse<Space> updateSpace(
            @PathVariable String id,
            @RequestBody(required = false) SpaceLocationRequest request,
            @RequestAttribute(SessionAuthFilter.CURRENT_USER_ATTRIBUTE) AuthenticatedUser user) {
        if (request == null) {
            throw new SpaceValidationException("楼栋和楼层不能为空");
        }
        return ApiResponse.ok(spaceService.updateLocation(
                id, request.building(), request.floor(), user.username()));
    }
}
