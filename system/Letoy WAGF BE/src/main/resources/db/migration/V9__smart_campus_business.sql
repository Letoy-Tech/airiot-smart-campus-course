-- Local business metadata only. No copies of AIRIOT secrets, simulated readings or remote controls.
CREATE TABLE campus_local_campus (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE
);
CREATE TABLE campus_local_building (
    id VARCHAR(64) PRIMARY KEY,
    campus_id VARCHAR(64) NOT NULL,
    name VARCHAR(80) NOT NULL,
    UNIQUE KEY uk_campus_building_name(campus_id,name),
    CONSTRAINT fk_campus_building_campus FOREIGN KEY(campus_id) REFERENCES campus_local_campus(id)
);
CREATE TABLE campus_local_space_binding (
    space_id VARCHAR(64) PRIMARY KEY,
    building_id VARCHAR(64) NOT NULL,
    floor VARCHAR(64) NULL,
    CONSTRAINT fk_campus_space_building FOREIGN KEY(building_id) REFERENCES campus_local_building(id)
);
CREATE TABLE campus_control_lock (device_id VARCHAR(64) PRIMARY KEY);
INSERT INTO campus_control_lock(device_id) VALUES
('facility_demo_01'),('facility_demo_02'),('facility_demo_03'),('facility_demo_04'),
('light_demo_01'),('light_demo_02'),('light_demo_03'),('light_demo_04');
CREATE TABLE campus_command_audit (
    id VARCHAR(64) PRIMARY KEY,
    actor_id VARCHAR(64) NOT NULL,
    actor_name VARCHAR(64) NOT NULL,
    device_id VARCHAR(64) NOT NULL,
    table_id VARCHAR(64) NOT NULL,
    before_state BOOLEAN NULL,
    requested_state BOOLEAN NOT NULL,
    confirmed_state BOOLEAN NULL,
    outcome VARCHAR(32) NOT NULL,
    reason VARCHAR(500) NOT NULL,
    created_at BIGINT NOT NULL,
    error VARCHAR(255) NULL,
    INDEX idx_campus_audit_time(created_at),
    INDEX idx_campus_audit_device_time(device_id,created_at)
);
INSERT INTO sys_role(role_code,role_name,description,sort_order,status) VALUES
('CAMPUS_MANAGER','校园管理人员','校园数据读取和已批准对象的模拟控制，无账户和角色管理权限',30,1),
('CAMPUS_VIEWER','校园只读查看者','只读校园数据，不可控制、修改接入或查看命令审计',40,1);
INSERT INTO api_rule(name,pattern,methods,group_policy,allowed_group_ids,priority,enabled)
VALUES('Smart campus business authorization','/campus/**',NULL,'ANY',NULL,300,1);
