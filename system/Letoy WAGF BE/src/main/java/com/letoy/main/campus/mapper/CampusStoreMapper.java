package com.letoy.main.campus.mapper;

import com.letoy.main.campus.entity.CampusBuilding;
import com.letoy.main.campus.entity.CampusLocation;
import com.letoy.main.campus.entity.CommandAudit;
import com.letoy.main.campus.entity.SpaceBinding;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;

@Mapper
public interface CampusStoreMapper {
    @Select("SELECT id,name FROM campus_local_campus ORDER BY name,id")
    List<CampusLocation> campuses();
    @Select("SELECT id,name FROM campus_local_campus WHERE id=#{id}")
    CampusLocation campus(String id);
    @Select("SELECT id,name FROM campus_local_campus WHERE name=#{name}")
    CampusLocation campusNamed(String name);
    @Insert("INSERT INTO campus_local_campus(id,name) VALUES(#{id},#{name})")
    int insertCampus(CampusLocation campus);
    @Select("SELECT id,campus_id AS campusId,name FROM campus_local_building ORDER BY campus_id,name,id")
    List<CampusBuilding> buildings();
    @Select("SELECT id,campus_id AS campusId,name FROM campus_local_building WHERE id=#{id}")
    CampusBuilding building(String id);
    @Insert("INSERT INTO campus_local_building(id,campus_id,name) VALUES(#{id},#{campusId},#{name})")
    int insertBuilding(CampusBuilding building);
    @Select("SELECT space_id AS spaceId,building_id AS buildingId,floor FROM campus_local_space_binding ORDER BY space_id")
    List<SpaceBinding> bindings();
    @Insert("INSERT INTO campus_local_space_binding(space_id,building_id,floor) VALUES(#{spaceId},#{buildingId},#{floor}) "
            + "ON DUPLICATE KEY UPDATE building_id=VALUES(building_id),floor=VALUES(floor)")
    int bindSpace(SpaceBinding binding);
    @Select("SELECT device_id FROM campus_control_lock WHERE device_id=#{id} FOR UPDATE")
    String lockControl(String id);
    @Insert("INSERT INTO campus_command_audit(id,actor_id,actor_name,device_id,table_id,before_state,requested_state,confirmed_state,outcome,reason,created_at,error) "
            + "VALUES(#{id},#{actorId},#{actorName},#{deviceId},#{tableId},#{before},#{requested},#{confirmed},#{outcome},#{reason},#{createdAt},#{error})")
    int insertAudit(CommandAudit audit);
    @Update("UPDATE campus_command_audit SET before_state=#{before},confirmed_state=#{confirmed},outcome=#{outcome},error=#{error} WHERE id=#{id}")
    int updateAudit(CommandAudit audit);
    @Select("SELECT id,actor_id AS actorId,actor_name AS actorName,device_id AS deviceId,table_id AS tableId,before_state AS `before`,"
            + "requested_state AS requested,confirmed_state AS confirmed,outcome,reason,created_at AS createdAt,error "
            + "FROM campus_command_audit ORDER BY created_at DESC,id DESC LIMIT #{limit} OFFSET #{skip}")
    List<CommandAudit> audits(@Param("limit") int limit, @Param("skip") int skip);
    @Select("SELECT COUNT(*) FROM campus_command_audit")
    long auditCount();
}
