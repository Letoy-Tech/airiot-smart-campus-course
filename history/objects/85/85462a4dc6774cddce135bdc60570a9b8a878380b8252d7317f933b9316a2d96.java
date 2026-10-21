package edu.campus.v2.web;

import edu.campus.v2.auth.RequireRole;
import edu.campus.v2.owner.Owner;
import edu.campus.v2.owner.OwnerService;
import edu.campus.v2.owner.OwnerValidationException;
import edu.campus.v2.user.Role;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 设备责任接口：三种登录角色都能读，只有 ADMIN 能登记或修改。
 * /api 下除 /api/health 与 /api/login 外都要 Bearer 令牌（SessionAuthFilter），
 * 因此 GET 也要求已登录；PUT 的角色判断由 RoleInterceptor 按会话里的角色执行。
 */
@RestController
@RequestMapping("/api")
public class OwnerController {

    private final OwnerService ownerService;

    public OwnerController(OwnerService ownerService) {
        this.ownerService = ownerService;
    }

    /** 三种登录角色都可读：不加 @RequireRole，表示只要求登录，不限制角色。 */
    @GetMapping("/owners")
    public ApiResponse<List<Owner>> owners() {
        return ApiResponse.ok(ownerService.listOwners());
    }

    /**
     * 仅 ADMIN：按 expectedVersion 写入，版本落后返回 409。
     * 成功时返回从库里读回的那一行（版本已 +1）；前端仍会用独立 GET 回读。
     */
    @PutMapping("/owners/{deviceId}")
    @RequireRole(Role.ADMIN)
    public ApiResponse<Owner> saveOwner(
            @PathVariable String deviceId,
            @RequestBody(required = false) OwnerSaveRequest request) {
        if (request == null) {
            throw new OwnerValidationException("负责人、备注和版本不能为空");
        }
        // null 与缺省不会经过字段反序列化器，这里再拦一次，保证 service 与数据库都收不到。
        if (request.expectedVersion() == null) {
            throw new OwnerValidationException("expectedVersion 必须是 JSON 非负整数");
        }
        return ApiResponse.ok(ownerService.saveOwner(
                deviceId, request.username(), request.note(), request.expectedVersion()));
    }
}
