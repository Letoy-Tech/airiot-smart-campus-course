CREATE TABLE course_building (
 id VARCHAR(64) PRIMARY KEY, campus_id VARCHAR(64) NOT NULL, name VARCHAR(80) NOT NULL,
 UNIQUE KEY uk_building_name(campus_id,name), FOREIGN KEY(campus_id) REFERENCES course_campus(id)
) ENGINE=InnoDB;
CREATE TABLE course_space_binding (
 space_id VARCHAR(64) PRIMARY KEY, building_id VARCHAR(64) NOT NULL, floor VARCHAR(40),
 FOREIGN KEY(building_id) REFERENCES course_building(id)
) ENGINE=InnoDB;
CREATE TABLE course_identity (
 uid VARCHAR(64) PRIMARY KEY, enabled BOOLEAN NOT NULL, roles VARCHAR(128) NOT NULL
) ENGINE=InnoDB;
CREATE TABLE course_owner (
 device_id VARCHAR(64) PRIMARY KEY, owner_uid VARCHAR(64), owner_name VARCHAR(100),
 version BIGINT NOT NULL DEFAULT 0, updated_at BIGINT
) ENGINE=InnoDB;
CREATE TABLE course_owner_event (
 id VARCHAR(64) PRIMARY KEY, device_id VARCHAR(64) NOT NULL, actor_uid VARCHAR(64) NOT NULL,
 actor_name VARCHAR(100) NOT NULL, note VARCHAR(500) NOT NULL, previous_owner_uid VARCHAR(64),
 owner_uid VARCHAR(64) NOT NULL, created_at BIGINT NOT NULL, version BIGINT NOT NULL,
 UNIQUE KEY uk_owner_version(device_id,version), FOREIGN KEY(device_id) REFERENCES course_owner(device_id)
) ENGINE=InnoDB;
CREATE TABLE course_alarm_case (
 id VARCHAR(64) PRIMARY KEY,
 source_type VARCHAR(64),
 source_scope VARCHAR(64),
 source_id VARCHAR(64),
 scenario VARCHAR(64),
 device_id VARCHAR(64),
 device_name VARCHAR(100),
 message VARCHAR(500),
 level VARCHAR(64),
 source_state VARCHAR(64),
 source_raw_status VARCHAR(64),
 source_check_outcome VARCHAR(64),
 state VARCHAR(64),
 assignee_uid VARCHAR(64),
 assignee_name VARCHAR(100),
 disposition VARCHAR(2000),
 occurred_at BIGINT,
 source_recovered_at BIGINT,
 source_observed_at BIGINT,
 source_verified_at BIGINT,
 created_at BIGINT,
 updated_at BIGINT,
 closed_at BIGINT,
 simulated BOOLEAN NOT NULL, version BIGINT NOT NULL,
 UNIQUE KEY uk_case_source(source_type,source_scope,source_id),
 KEY ix_case_list(created_at,id), KEY ix_case_filter(state,assignee_uid)
) ENGINE=InnoDB;
CREATE TABLE course_case_event (
 id VARCHAR(64) PRIMARY KEY,
 case_id VARCHAR(64),
 action VARCHAR(64),
 actor_uid VARCHAR(64),
 actor_name VARCHAR(100),
 note VARCHAR(2000),
 from_state VARCHAR(64),
 to_state VARCHAR(64),
 previous_assignee_uid VARCHAR(64),
 assignee_uid VARCHAR(64),
 source_state VARCHAR(64),
 created_at BIGINT NOT NULL, case_version BIGINT NOT NULL,
 UNIQUE KEY uk_case_version(case_id,case_version), FOREIGN KEY(case_id) REFERENCES course_alarm_case(id)
) ENGINE=InnoDB;
