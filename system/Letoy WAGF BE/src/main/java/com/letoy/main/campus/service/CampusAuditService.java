package com.letoy.main.campus.service;

import com.letoy.main.campus.entity.CommandAudit;
import com.letoy.main.campus.mapper.CampusStoreMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Separate committed transactions preserve evidence when a control operation rolls back. */
@Service
public class CampusAuditService {
    private final CampusStoreMapper store;
    public CampusAuditService(CampusStoreMapper store) { this.store = store; }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void start(CommandAudit audit) {
        try {
            if (store.insertAudit(audit) != 1) throw new IllegalStateException();
        } catch (RuntimeException exception) {
            throw new CampusException(503, "AUDIT_UNAVAILABLE", "无法建立操作审计，已阻止控制");
        }
    }
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void update(CommandAudit audit) {
        try {
            if (store.updateAudit(audit) != 1) throw new IllegalStateException();
        } catch (RuntimeException exception) {
            throw new CampusException(503, "AUDIT_UNAVAILABLE", "无法保存操作确认，请管理员核对审计与远端状态");
        }
    }
}
