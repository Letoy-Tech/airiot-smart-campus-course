-- 第09课 V2：建立 users，供本机课程演示账号与密码校验使用。
-- 只新增表，不改已执行过的 V1：V1 的校验和必须保持原样，否则启动校验会失败。
-- 本文件不写入任何口令明文或摘要：账号在后端启动时按需创建，摘要由 BCrypt 生成后写入。
-- 账号：admin / manager / viewer，角色依次 ADMIN / MANAGER / VIEWER，三个账号共用本机 DEMO_PASSWORD。
-- 账号已存在时不重置密码（初始化逻辑只做“不存在才插入”，唯一索引兜底）。

CREATE TABLE users (
    id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '自增主键',
    username      VARCHAR(32)  NOT NULL COMMENT '登录名，如 admin',
    password_hash VARCHAR(60)  NOT NULL COMMENT 'BCrypt 摘要（60 字符），不得存明文',
    role          VARCHAR(16)  NOT NULL COMMENT 'ADMIN / MANAGER / VIEWER',
    enabled       TINYINT(1)   NOT NULL DEFAULT 1 COMMENT '1=可用，0=停用',
    created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_users_username (username),
    CONSTRAINT ck_users_role CHECK (role IN ('ADMIN', 'MANAGER', 'VIEWER'))
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci COMMENT '课程账号：只保存 BCrypt 摘要，不保存明文';
