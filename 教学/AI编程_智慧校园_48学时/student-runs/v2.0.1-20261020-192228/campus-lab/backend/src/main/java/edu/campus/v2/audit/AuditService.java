package edu.campus.v2.audit;

import java.util.List;
import org.springframework.stereotype.Service;

/**
 * 审计读取：按发生时间升序返回已实际提交的业务修改记录。
 * 写入由各业务 Service 在同一个成功事务中完成；本类不补造、不修改审计。
 */
@Service
public class AuditService {

    private final AuditRepository auditRepository;

    public AuditService(AuditRepository auditRepository) {
        this.auditRepository = auditRepository;
    }

    public List<AuditEntry> listAudit() {
        return auditRepository.findAllOrderByEventTime();
    }
}
