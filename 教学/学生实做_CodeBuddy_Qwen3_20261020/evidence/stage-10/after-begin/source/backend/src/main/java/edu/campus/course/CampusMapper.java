package edu.campus.course;

import static edu.campus.course.CourseModels.*;

import org.apache.ibatis.annotations.*;
import org.springframework.context.annotation.Profile;

import java.util.List;

@Mapper
@Profile("teacher-db")
public interface CampusMapper {
    @Select("SELECT id,name FROM course_campus ORDER BY name,id")
    List<Campus> campuses();

    @Select("SELECT id,name FROM course_campus WHERE id=#{id}")
    Campus campus(String id);

    @Insert("INSERT INTO course_campus(id,name) VALUES(#{id},#{name})")
    void insertCampus(Campus campus);

    @Select("SELECT id,campus_id,name FROM course_building ORDER BY campus_id,name,id")
    List<Building> buildings();

    @Select("SELECT id,campus_id,name FROM course_building WHERE id=#{id}")
    Building building(String id);

    @Insert("INSERT INTO course_building(id,campus_id,name) VALUES(#{id},#{campusId},#{name})")
    void insertBuilding(Building building);

    @Select("SELECT space_id,building_id,floor FROM course_space_binding ORDER BY space_id")
    List<Binding> bindings();

    @Insert(
            "INSERT INTO course_space_binding(space_id,building_id,floor)"
                    + " VALUES(#{spaceId},#{buildingId},#{floor}) ON DUPLICATE KEY UPDATE"
                    + " building_id=VALUES(building_id),floor=VALUES(floor)")
    void bind(Binding binding);

    @Insert(
            "INSERT IGNORE INTO course_identity(uid,enabled,roles)"
                    + " VALUES(#{uid},#{enabled},#{roles})")
    void seedIdentity(UserState user);

    @Select("SELECT uid,enabled,roles FROM course_identity WHERE uid=#{uid}")
    UserState identity(String uid);

    @Insert("INSERT IGNORE INTO course_owner(device_id,version) VALUES(#{deviceId},0)")
    void seedOwner(String deviceId);

    @Select("SELECT * FROM course_owner ORDER BY device_id")
    List<Owner> owners();

    @Select("SELECT * FROM course_owner WHERE device_id=#{deviceId}")
    Owner owner(String deviceId);

    @Select("SELECT * FROM course_owner WHERE device_id=#{deviceId} FOR UPDATE")
    Owner lockOwner(String deviceId);

    @Update(
            "UPDATE course_owner SET"
                + " owner_uid=#{ownerUid},owner_name=#{ownerName},version=#{version},updated_at=#{updatedAt}"
                + " WHERE device_id=#{deviceId}")
    void updateOwner(Owner owner);

    @Select("SELECT * FROM course_owner_event WHERE device_id=#{deviceId} ORDER BY version,id")
    List<OwnerEvent> ownerEvents(String deviceId);

    @Insert(
            "INSERT INTO"
                + " course_owner_event(id,device_id,actor_uid,actor_name,note,previous_owner_uid,owner_uid,created_at,version)"
                + " VALUES(#{id},#{deviceId},#{actorUid},#{actorName},#{note},#{previousOwnerUid},#{ownerUid},#{createdAt},#{version})")
    void insertOwnerEvent(OwnerEvent event);

    @Select("SELECT * FROM course_alarm_case WHERE id=#{id}")
    AlarmCase alarmCase(String id);

    @Select("SELECT * FROM course_alarm_case WHERE id=#{id} FOR UPDATE")
    AlarmCase lockCase(String id);

    @Insert(
            "INSERT INTO course_alarm_case"
                + " (id,source_type,source_scope,source_id,scenario,device_id,device_name,message,level,source_state,source_raw_status,source_check_outcome,state,assignee_uid,assignee_name,disposition,occurred_at,source_recovered_at,source_observed_at,source_verified_at,created_at,updated_at,closed_at,simulated,version)"
                + " VALUES"
                + " (#{id},#{sourceType},#{sourceScope},#{sourceId},#{scenario},#{deviceId},#{deviceName},#{message},#{level},#{sourceState},#{sourceRawStatus},#{sourceCheckOutcome},#{state},#{assigneeUid},#{assigneeName},#{disposition},#{occurredAt},#{sourceRecoveredAt},#{sourceObservedAt},#{sourceVerifiedAt},#{createdAt},#{updatedAt},#{closedAt},#{simulated},#{version})")
    void insertCase(AlarmCase value);

    @Update(
            "UPDATE course_alarm_case SET"
                + " source_type=#{sourceType},source_scope=#{sourceScope},source_id=#{sourceId},scenario=#{scenario},device_id=#{deviceId},device_name=#{deviceName},message=#{message},level=#{level},source_state=#{sourceState},source_raw_status=#{sourceRawStatus},source_check_outcome=#{sourceCheckOutcome},state=#{state},assignee_uid=#{assigneeUid},assignee_name=#{assigneeName},disposition=#{disposition},occurred_at=#{occurredAt},source_recovered_at=#{sourceRecoveredAt},source_observed_at=#{sourceObservedAt},source_verified_at=#{sourceVerifiedAt},created_at=#{createdAt},updated_at=#{updatedAt},closed_at=#{closedAt},simulated=#{simulated},version=#{version}"
                + " WHERE id=#{id}")
    void updateCase(AlarmCase value);

    @Select("SELECT * FROM course_case_event WHERE case_id=#{id} ORDER BY case_version,id")
    List<CaseEvent> caseEvents(String id);

    @Insert(
            "INSERT INTO course_case_event"
                + " (id,case_id,action,actor_uid,actor_name,note,from_state,to_state,previous_assignee_uid,assignee_uid,source_state,created_at,case_version)"
                + " VALUES"
                + " (#{id},#{caseId},#{action},#{actorUid},#{actorName},#{note},#{fromState},#{toState},#{previousAssigneeUid},#{assigneeUid},#{sourceState},#{createdAt},#{caseVersion})")
    void insertCaseEvent(CaseEvent event);

    @Select(
            "<script>SELECT * FROM course_alarm_case <where><if test='sourceType !="
                + " null'>source_type=#{sourceType}</if><if test='state != null'> AND"
                + " state=#{state}</if><if test='assigneeUid != null'> AND"
                + " assignee_uid=#{assigneeUid}</if></where> ORDER BY created_at DESC,id DESC LIMIT"
                + " #{limit} OFFSET #{skip}</script>")
    List<AlarmCase> cases(
            @Param("sourceType") String sourceType,
            @Param("state") String state,
            @Param("assigneeUid") String assigneeUid,
            @Param("limit") int limit,
            @Param("skip") int skip);

    @Select(
            "<script>SELECT COUNT(*) FROM course_alarm_case <where><if test='sourceType !="
                    + " null'>source_type=#{sourceType}</if><if test='state != null'> AND"
                    + " state=#{state}</if><if test='assigneeUid != null'> AND"
                    + " assignee_uid=#{assigneeUid}</if></where></script>")
    long countCases(
            @Param("sourceType") String sourceType,
            @Param("state") String state,
            @Param("assigneeUid") String assigneeUid);
}
