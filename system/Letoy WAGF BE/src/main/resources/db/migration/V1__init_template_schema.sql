CREATE TABLE IF NOT EXISTS user_info (
    uid VARCHAR(64) PRIMARY KEY,
    username VARCHAR(64) NOT NULL UNIQUE,
    phone_number VARCHAR(32) NULL,
    email VARCHAR(128) NULL,
    nickname VARCHAR(64) NULL,
    avatar VARCHAR(255) NULL,
    description VARCHAR(255) NULL,
    gender TINYINT NULL,
    group_ids VARCHAR(255) NULL,
    roles VARCHAR(255) NULL,
    password VARCHAR(255) NOT NULL,
    active TINYINT(1) NOT NULL DEFAULT 1,
    create_time DATETIME NOT NULL,
    token_version INT NOT NULL DEFAULT 1,
    last_password_change_at DATETIME NULL,
    account_locked TINYINT(1) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS token_info (
    uid VARCHAR(64) PRIMARY KEY,
    token VARCHAR(1024) NULL,
    name VARCHAR(64) NULL,
    CONSTRAINT fk_token_info_user FOREIGN KEY (uid) REFERENCES user_info(uid) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS refresh_token (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    uid VARCHAR(64) NOT NULL,
    refresh_token VARCHAR(512) NOT NULL UNIQUE,
    access_token_jti VARCHAR(64) NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL,
    last_used_at DATETIME NULL,
    device_info VARCHAR(255) NULL,
    ip_address VARCHAR(64) NULL,
    revoked TINYINT(1) NOT NULL DEFAULT 0,
    revoked_at DATETIME NULL,
    revoke_reason VARCHAR(64) NULL,
    INDEX idx_refresh_token_uid (uid),
    CONSTRAINT fk_refresh_token_user FOREIGN KEY (uid) REFERENCES user_info(uid) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS groups_info (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    group_id VARCHAR(64) NOT NULL UNIQUE,
    group_name VARCHAR(128) NOT NULL,
    group_description VARCHAR(255) NULL,
    parent_group_id VARCHAR(64) NULL,
    path VARCHAR(255) NOT NULL,
    level INT NOT NULL DEFAULT 0,
    sort_order INT NOT NULL DEFAULT 0,
    status INT NOT NULL DEFAULT 1,
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sys_role (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    role_code VARCHAR(64) NOT NULL UNIQUE,
    role_name VARCHAR(128) NOT NULL,
    description VARCHAR(255) NULL,
    sort_order INT NOT NULL DEFAULT 0,
    status INT NOT NULL DEFAULT 1,
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sys_user_role (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    uid VARCHAR(64) NOT NULL,
    role_code VARCHAR(64) NOT NULL,
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_sys_user_role_uid_code (uid, role_code),
    CONSTRAINT fk_sys_user_role_user FOREIGN KEY (uid) REFERENCES user_info(uid) ON DELETE CASCADE,
    CONSTRAINT fk_sys_user_role_role FOREIGN KEY (role_code) REFERENCES sys_role(role_code) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS api_rule (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(128) NOT NULL,
    pattern VARCHAR(255) NOT NULL,
    methods VARCHAR(64) NULL,
    group_policy VARCHAR(32) NOT NULL DEFAULT 'ANY',
    allowed_group_ids VARCHAR(255) NULL,
    group_id_path_var VARCHAR(64) NULL,
    user_id_path_var VARCHAR(64) NULL,
    priority INT NOT NULL DEFAULT 0,
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
