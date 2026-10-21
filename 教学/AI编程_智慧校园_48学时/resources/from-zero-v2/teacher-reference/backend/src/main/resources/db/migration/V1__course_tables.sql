CREATE TABLE spaces (
    id VARCHAR(32) PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    building VARCHAR(120) NOT NULL,
    floor VARCHAR(40) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE devices (
    id VARCHAR(32) PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    category VARCHAR(40) NOT NULL,
    space_id VARCHAR(32) NOT NULL,
    online BOOLEAN NULL,
    simulated BOOLEAN NOT NULL DEFAULT TRUE,
    FOREIGN KEY (space_id) REFERENCES spaces(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE points (
    device_id VARCHAR(32) NOT NULL,
    tag_id VARCHAR(64) NOT NULL,
    payload JSON NOT NULL,
    PRIMARY KEY (device_id, tag_id),
    FOREIGN KEY (device_id) REFERENCES devices(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE history (
    device_id VARCHAR(32) NOT NULL,
    tag_id VARCHAR(64) NOT NULL,
    payload JSON NOT NULL,
    PRIMARY KEY (device_id, tag_id),
    FOREIGN KEY (device_id) REFERENCES devices(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE alarms (
    id VARCHAR(32) PRIMARY KEY,
    device_id VARCHAR(32) NOT NULL,
    payload JSON NOT NULL,
    FOREIGN KEY (device_id) REFERENCES devices(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE users (
    username VARCHAR(40) PRIMARY KEY,
    password_hash VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE owners (
    device_id VARCHAR(32) PRIMARY KEY,
    username VARCHAR(40) NOT NULL,
    note VARCHAR(500) NOT NULL,
    version BIGINT NOT NULL,
    FOREIGN KEY (device_id) REFERENCES devices(id),
    FOREIGN KEY (username) REFERENCES users(username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE cases (
    id VARCHAR(40) PRIMARY KEY,
    device_id VARCHAR(32) NOT NULL,
    message VARCHAR(500) NOT NULL,
    state VARCHAR(20) NOT NULL,
    assignee VARCHAR(40) NULL,
    source_state VARCHAR(20) NOT NULL,
    verified BOOLEAN NOT NULL DEFAULT FALSE,
    note VARCHAR(2000) NOT NULL,
    conclusion VARCHAR(2000) NOT NULL,
    version BIGINT NOT NULL,
    timeline JSON NOT NULL,
    FOREIGN KEY (device_id) REFERENCES devices(id),
    FOREIGN KEY (assignee) REFERENCES users(username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE audit (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    time BIGINT NOT NULL,
    username VARCHAR(40) NOT NULL,
    action VARCHAR(60) NOT NULL,
    target VARCHAR(80) NOT NULL,
    detail VARCHAR(2000) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE course_seed (
    id VARCHAR(40) PRIMARY KEY,
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
