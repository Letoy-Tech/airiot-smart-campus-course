package edu.campus.v2.web;

import edu.campus.v2.auth.RequireRole;
import edu.campus.v2.auth.SessionAuthFilter;
import edu.campus.v2.caseflow.Case;
import edu.campus.v2.caseflow.CaseService;
import edu.campus.v2.caseflow.CaseValidationException;
import edu.campus.v2.user.AuthenticatedUser;
import edu.campus.v2.user.Role;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 演练事件接口：三种登录角色都能读，只有 ADMIN 能创建。
 * assign / start / note / recover / verify / close 六个动作：VIEWER 在端点层就被拒绝；
 * assign、recover 仅 ADMIN；start、note、verify、close 要求 ADMIN 或本事件的 manager，
 * 归属判断在服务层按登录会话执行。
 */
@RestController
@RequestMapping("/api")
public class CaseController {

    private final CaseService caseService;

    public CaseController(CaseService caseService) {
        this.caseService = caseService;
    }

    /** 三种登录角色都可读：不加 @RequireRole，表示只要求登录，不限制角色。 */
    @GetMapping("/cases")
    public ApiResponse<List<Case>> cases() {
        return ApiResponse.ok(caseService.listCases());
    }

    /**
     * 仅 ADMIN：请求体只有 deviceId 与 message。
     * 处理人取自 owners 表，创建时间与编号由服务端生成；
     * 即使请求体带上 assignee、state、createdAt 等字段，也不会进入业务层。
     */
    @PostMapping("/cases")
    @RequireRole(Role.ADMIN)
    public ApiResponse<Case> createCase(
            @RequestBody(required = false) CaseCreateRequest request,
            @RequestAttribute(SessionAuthFilter.CURRENT_USER_ATTRIBUTE) AuthenticatedUser user) {
        if (request == null) {
            throw new CaseValidationException("设备和事件内容不能为空");
        }
        return ApiResponse.ok(caseService.createCase(
                request.deviceId(), request.message(), user.username()));
    }

    /**
     * 事件动作：VIEWER 由 RoleInterceptor 在端点层拒绝（403），不进入服务层。
     * assign、recover 仅 ADMIN；start、note、verify、close 由 ADMIN 或本事件的 manager 执行。
     * expectedVersion 必须是 JSON 非负整数字面量；null 与缺省在这里拦下（400）。
     */
    @PostMapping("/cases/{id}/actions")
    @RequireRole({Role.ADMIN, Role.MANAGER})
    public ApiResponse<Case> applyAction(
            @PathVariable String id,
            @RequestBody(required = false) CaseActionRequest request,
            @RequestAttribute(SessionAuthFilter.CURRENT_USER_ATTRIBUTE) AuthenticatedUser user) {
        if (request == null) {
            throw new CaseValidationException("动作和版本不能为空");
        }
        if (request.expectedVersion() == null) {
            throw new CaseValidationException("expectedVersion 必须是 JSON 非负整数");
        }
        return ApiResponse.ok(caseService.applyAction(
                id,
                request.action(),
                request.expectedVersion(),
                request.note(),
                request.username(),
                user));
    }
}
