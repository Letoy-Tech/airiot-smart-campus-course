package edu.campus.v2.web;

import edu.campus.v2.audit.AuditEntry;
import edu.campus.v2.audit.AuditService;
import edu.campus.v2.auth.RequireRole;
import edu.campus.v2.user.Role;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 审计接口：仅 ADMIN 可读。
 * 返回 audit 表中已提交的记录，按发生时间升序；失败操作没有成功事务，不会出现在结果里。
 * 记录只含操作者账号、动作、目标与时间，不含密码、令牌或请求头。
 */
@RestController
@RequestMapping("/api")
public class AuditController {

    private final AuditService auditService;

    public AuditController(AuditService auditService) {
        this.auditService = auditService;
    }

    @GetMapping("/audit")
    @RequireRole(Role.ADMIN)
    public ApiResponse<List<AuditEntry>> audit() {
        return ApiResponse.ok(auditService.listAudit());
    }
}
