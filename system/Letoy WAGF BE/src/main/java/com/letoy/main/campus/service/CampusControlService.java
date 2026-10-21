package com.letoy.main.campus.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.letoy.main.campus.airiot.AiriotClient;
import com.letoy.main.campus.airiot.AiriotException;
import com.letoy.main.campus.dto.CampusDtos.AuditPage;
import com.letoy.main.campus.dto.CampusDtos.SwitchRequest;
import com.letoy.main.campus.dto.CampusDtos.SwitchResult;
import com.letoy.main.campus.entity.CommandAudit;
import com.letoy.main.campus.mapper.CampusStoreMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.UUID;

@Service
public class CampusControlService {
    private final AiriotClient client;
    private final CampusCatalog catalog;
    private final CampusAccess access;
    private final CampusStoreMapper store;
    private final CampusAuditService audits;
    public CampusControlService(AiriotClient client, CampusCatalog catalog, CampusAccess access,
                                CampusStoreMapper store, CampusAuditService audits) {
        this.client = client;
        this.catalog = catalog;
        this.access = access;
        this.store = store;
        this.audits = audits;
    }

    /** The transaction holds a dedicated per-device row lock across read, PATCH and verification.
     *  Audit transactions commit independently so rollback never erases an attempted operation.
     *  Other applications/admin AIRIOT writes cannot share this lock; expectedState detects existing drift.
     */
    @Transactional(timeout = 45)
    public SwitchResult switchState(String deviceId, SwitchRequest request) {
        CampusAccess.Actor actor = access.actor();
        CampusCatalog.DeviceSpec spec = catalog.require(deviceId);
        CommandAudit audit = new CommandAudit();
        audit.setId(UUID.randomUUID().toString());
        audit.setActorId(actor.id());
        audit.setActorName(actor.name());
        audit.setDeviceId(deviceId);
        audit.setTableId(spec.table());
        audit.setRequested(request.on());
        audit.setReason(request.reason());
        audit.setOutcome("PENDING");
        audit.setCreatedAt(System.currentTimeMillis());
        // If persistence is unavailable, no remote read or write can start.
        audits.start(audit);
        try {
            access.requireControl(actor);
            if (!spec.controllable()) throw new CampusException(403, "TARGET_DENIED", "此对象不属于已批准的 8 个模拟控制对象");
            if (!deviceId.equals(store.lockControl(deviceId))) {
                throw new CampusException(503, "CONTROL_LOCK_UNAVAILABLE", "模拟控制锁不存在，已阻止写入");
            }
            Map<String, Object> status = client.status();
            if (!Boolean.TRUE.equals(status.get("controlEnabled")) || !Boolean.TRUE.equals(status.get("connected"))) {
                throw new CampusException(503, "CONTROL_DISABLED", "专用机器身份未连通或模拟控制未启用");
            }
            boolean before = switchValue(client.record(spec.table(), deviceId), spec);
            audit.setBefore(before);
            if (before != request.expectedState()) {
                throw new CampusException(409, "STATE_CONFLICT", "远端模拟状态已变化，请刷新后重新操作");
            }
            audits.update(audit); // Commit the observed state before any write.
            if (before != request.on()) client.patchSwitch(spec.table(), deviceId, request.on());
            boolean confirmed = switchValue(client.record(spec.table(), deviceId), spec);
            audit.setConfirmed(confirmed);
            if (confirmed != request.on()) {
                throw new CampusException(502, "READBACK_MISMATCH", "AIRIOT 回读状态与请求不同，控制未确认成功");
            }
            audit.setOutcome(before == request.on() ? "NO_CHANGE" : "CONFIRMED");
            audits.update(audit);
            return new SwitchResult(audit.getId(), deviceId, before, request.on(), confirmed, System.currentTimeMillis());
        } catch (CampusException exception) {
            audit.setOutcome(exception.getStatus() == 403 ? "DENIED"
                    : exception.getStatus() == 409 ? "CONFLICT"
                    : "READBACK_MISMATCH".equals(exception.getCode()) ? "MISMATCH" : "FAILED");
            audit.setError(exception.getCode());
            audits.update(audit);
            throw exception;
        } catch (AiriotException exception) {
            audit.setOutcome("FAILED");
            audit.setError("AIRIOT_OPERATION_FAILED");
            audits.update(audit);
            throw exception;
        } catch (RuntimeException exception) {
            audit.setOutcome("FAILED");
            audit.setError("CONTROL_OR_AUDIT_UNAVAILABLE");
            audits.update(audit);
            throw new CampusException(503, "CONTROL_UNAVAILABLE", "操作未确认成功，请管理员核对审计与远端状态");
        }
    }
    private boolean switchValue(JsonNode record, CampusCatalog.DeviceSpec spec) {
        if (record == null || !record.isObject() || !spec.id().equals(record.path("id").asText())
                || (record.hasNonNull("_table") && !spec.table().equals(record.path("_table").asText()))
                || !record.path("is_simulated").isBoolean() || !record.path("is_simulated").booleanValue()
                || !record.path("simulated_switch_on").isBoolean()) {
            throw CampusException.upstream("AIRIOT 目标身份、模拟标识或 Boolean 状态未通过校验，已停止控制");
        }
        return record.path("simulated_switch_on").booleanValue();
    }
    public AuditPage audit(int limit, int skip) {
        access.requireAdmin();
        CampusMonitoringService.validatePage(limit, skip);
        return new AuditPage(store.audits(limit, skip), store.auditCount());
    }
    public Map<String, Object> status() {
        access.requireAdmin();
        return client.status();
    }
}
