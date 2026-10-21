-- Independent local DEMO events and device responsibility; never writes AIRIOT warnings or readings.
CREATE TABLE campus_alarm_case (
    id VARCHAR(64) PRIMARY KEY,
    source_type VARCHAR(16) NOT NULL,
    source_scope VARCHAR(64) NOT NULL,
    source_id VARCHAR(64) NOT NULL,
    scenario VARCHAR(64) NOT NULL,
    simulated BOOLEAN NOT NULL,
    device_id VARCHAR(64) NOT NULL,
    device_name VARCHAR(128) NOT NULL,
    message VARCHAR(1000) NOT NULL,
    level VARCHAR(32) NOT NULL,
    occurred_at BIGINT NOT NULL,
    source_state VARCHAR(16) NOT NULL,
    source_raw_status VARCHAR(64) NOT NULL,
    source_recovered_at BIGINT NULL,
    source_observed_at BIGINT NOT NULL,
    source_verified_at BIGINT NULL,
    source_check_outcome VARCHAR(16) NOT NULL,
    state VARCHAR(16) NOT NULL,
    assignee_uid VARCHAR(64) NULL,
    assignee_name VARCHAR(128) NULL,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    closed_at BIGINT NULL,
    disposition VARCHAR(2000) NULL,
    version BIGINT NOT NULL,
    UNIQUE KEY uk_alarm_source(source_type,source_scope,source_id),
    INDEX idx_alarm_state(state,created_at),
    INDEX idx_alarm_assignee(assignee_uid,state,created_at)
);
CREATE TABLE campus_alarm_case_event (
    id VARCHAR(64) PRIMARY KEY,
    case_id VARCHAR(64) NOT NULL,
    action VARCHAR(32) NOT NULL,
    actor_uid VARCHAR(64) NOT NULL,
    actor_name VARCHAR(128) NOT NULL,
    note VARCHAR(2000) NOT NULL,
    from_state VARCHAR(16) NULL,
    to_state VARCHAR(16) NOT NULL,
    previous_assignee_uid VARCHAR(64) NULL,
    assignee_uid VARCHAR(64) NULL,
    source_state VARCHAR(16) NOT NULL,
    created_at BIGINT NOT NULL,
    case_version BIGINT NOT NULL,
    UNIQUE KEY uk_alarm_case_version(case_id,case_version),
    CONSTRAINT fk_alarm_event_case FOREIGN KEY(case_id) REFERENCES campus_alarm_case(id)
);
CREATE TABLE campus_device_owner (
    device_id VARCHAR(64) PRIMARY KEY,
    owner_uid VARCHAR(64) NULL,
    owner_name VARCHAR(128) NULL,
    version BIGINT NOT NULL DEFAULT 0,
    updated_at BIGINT NULL
);
INSERT INTO campus_device_owner(device_id) VALUES
('env_demo_01'),('env_demo_02'),('env_demo_03'),('env_demo_04'),
('energy_demo_01'),('energy_demo_02'),('energy_demo_03'),('energy_demo_04'),
('facility_demo_01'),('facility_demo_02'),('facility_demo_03'),('facility_demo_04'),
('light_demo_01'),('light_demo_02'),('light_demo_03'),('light_demo_04');
CREATE TABLE campus_device_owner_event (
    id VARCHAR(64) PRIMARY KEY,
    device_id VARCHAR(64) NOT NULL,
    actor_uid VARCHAR(64) NOT NULL,
    actor_name VARCHAR(128) NOT NULL,
    note VARCHAR(500) NOT NULL,
    previous_owner_uid VARCHAR(64) NULL,
    owner_uid VARCHAR(64) NOT NULL,
    created_at BIGINT NOT NULL,
    version BIGINT NOT NULL,
    UNIQUE KEY uk_owner_version(device_id,version),
    CONSTRAINT fk_owner_event_device FOREIGN KEY(device_id) REFERENCES campus_device_owner(device_id)
);
