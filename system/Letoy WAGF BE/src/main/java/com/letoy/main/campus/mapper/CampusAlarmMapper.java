package com.letoy.main.campus.mapper;

import com.letoy.main.campus.entity.*;
import org.apache.ibatis.annotations.*;
import java.util.List;

@Mapper
public interface CampusAlarmMapper {
    String CASE_COLUMNS = "id,source_type AS sourceType,source_scope AS sourceScope,source_id AS sourceId,scenario,simulated,"
            + "device_id AS deviceId,device_name AS deviceName,message,level,occurred_at AS occurredAt,source_state AS sourceState,"
            + "source_raw_status AS sourceRawStatus,source_recovered_at AS sourceRecoveredAt,source_observed_at AS sourceObservedAt,"
            + "source_verified_at AS sourceVerifiedAt,source_check_outcome AS sourceCheckOutcome,state,assignee_uid AS assigneeUid,"
            + "assignee_name AS assigneeName,created_at AS createdAt,updated_at AS updatedAt,closed_at AS closedAt,disposition,version";
    String CASE_FILTER = "<where><if test='sourceType != null'>source_type=#{sourceType}</if>"
            + "<if test='state != null'>AND state=#{state}</if><if test='assigneeUid != null'>AND assignee_uid=#{assigneeUid}</if></where>";
    @Select("<script>SELECT " + CASE_COLUMNS + " FROM campus_alarm_case " + CASE_FILTER
            + " ORDER BY created_at DESC,id DESC LIMIT #{limit} OFFSET #{skip}</script>")
    List<AlarmCase> cases(@Param("sourceType") String sourceType, @Param("state") String state,
                         @Param("assigneeUid") String assigneeUid, @Param("limit") int limit, @Param("skip") int skip);
    @Select("<script>SELECT COUNT(*) FROM campus_alarm_case " + CASE_FILTER + "</script>")
    long caseCount(@Param("sourceType") String sourceType, @Param("state") String state, @Param("assigneeUid") String assigneeUid);
    @Select("SELECT " + CASE_COLUMNS + " FROM campus_alarm_case WHERE id=#{id}")
    AlarmCase alarmCase(String id);
    @Select("SELECT " + CASE_COLUMNS + " FROM campus_alarm_case WHERE id=#{id} FOR UPDATE")
    AlarmCase lockCase(String id);
    @Insert("INSERT INTO campus_alarm_case(id,source_type,source_scope,source_id,scenario,simulated,device_id,device_name,message,level,"
            + "occurred_at,source_state,source_raw_status,source_recovered_at,source_observed_at,source_verified_at,source_check_outcome,"
            + "state,assignee_uid,assignee_name,created_at,updated_at,closed_at,disposition,version) VALUES(#{id},#{sourceType},#{sourceScope},"
            + "#{sourceId},#{scenario},#{simulated},#{deviceId},#{deviceName},#{message},#{level},#{occurredAt},#{sourceState},#{sourceRawStatus},"
            + "#{sourceRecoveredAt},#{sourceObservedAt},#{sourceVerifiedAt},#{sourceCheckOutcome},#{state},#{assigneeUid},#{assigneeName},"
            + "#{createdAt},#{updatedAt},#{closedAt},#{disposition},#{version})")
    int insertCase(AlarmCase item);
    @Update("UPDATE campus_alarm_case SET state=#{state},assignee_uid=#{assigneeUid},assignee_name=#{assigneeName},"
            + "source_state=#{sourceState},source_raw_status=#{sourceRawStatus},source_recovered_at=#{sourceRecoveredAt},"
            + "source_observed_at=#{sourceObservedAt},source_verified_at=#{sourceVerifiedAt},source_check_outcome=#{sourceCheckOutcome},"
            + "disposition=#{disposition},updated_at=#{updatedAt},closed_at=#{closedAt},version=#{version} WHERE id=#{id} AND version=#{version}-1")
    int updateCase(AlarmCase item);
    @Insert("INSERT INTO campus_alarm_case_event(id,case_id,action,actor_uid,actor_name,note,from_state,to_state,previous_assignee_uid,"
            + "assignee_uid,source_state,created_at,case_version) VALUES(#{id},#{caseId},#{action},#{actorUid},#{actorName},#{note},#{fromState},"
            + "#{toState},#{previousAssigneeUid},#{assigneeUid},#{sourceState},#{createdAt},#{caseVersion})")
    int insertCaseEvent(AlarmCaseEvent event);
    @Select("SELECT id,case_id AS caseId,action,actor_uid AS actorUid,actor_name AS actorName,note,from_state AS fromState,to_state AS toState,"
            + "previous_assignee_uid AS previousAssigneeUid,assignee_uid AS assigneeUid,source_state AS sourceState,created_at AS createdAt,"
            + "case_version AS caseVersion FROM campus_alarm_case_event WHERE case_id=#{id} ORDER BY case_version,id")
    List<AlarmCaseEvent> caseEvents(String id);
    @Select("SELECT COUNT(*) FROM campus_alarm_case_event WHERE case_id=#{id} AND action='NOTE'")
    long noteCount(String id);
    String OWNER_COLUMNS = "device_id AS deviceId,owner_uid AS ownerUid,owner_name AS ownerName,version,updated_at AS updatedAt";
    @Select("SELECT " + OWNER_COLUMNS + " FROM campus_device_owner ORDER BY device_id")
    List<DeviceOwner> owners();
    @Select("SELECT " + OWNER_COLUMNS + " FROM campus_device_owner WHERE device_id=#{id}")
    DeviceOwner owner(String id);
    @Select("SELECT " + OWNER_COLUMNS + " FROM campus_device_owner WHERE device_id=#{id} FOR UPDATE")
    DeviceOwner lockOwner(String id);
    @Update("UPDATE campus_device_owner SET owner_uid=#{ownerUid},owner_name=#{ownerName},version=#{version},updated_at=#{updatedAt}"
            + " WHERE device_id=#{deviceId} AND version=#{version}-1")
    int updateOwner(DeviceOwner owner);
    @Insert("INSERT INTO campus_device_owner_event(id,device_id,actor_uid,actor_name,note,previous_owner_uid,owner_uid,created_at,version)"
            + " VALUES(#{id},#{deviceId},#{actorUid},#{actorName},#{note},#{previousOwnerUid},#{ownerUid},#{createdAt},#{version})")
    int insertOwnerEvent(DeviceOwnerEvent event);
    @Select("SELECT id,device_id AS deviceId,actor_uid AS actorUid,actor_name AS actorName,note,previous_owner_uid AS previousOwnerUid,"
            + "owner_uid AS ownerUid,created_at AS createdAt,version FROM campus_device_owner_event WHERE device_id=#{id} ORDER BY version,id")
    List<DeviceOwnerEvent> ownerEvents(String id);
}
