-- 第11课 V4：建立 cases、case_timeline、audit，供演练事件的创建与列表使用。
-- 只新增表，不改已执行过的 V1、V2、V3：这三个文件的校验和必须保持原样，否则启动校验会失败。
-- 本步只做“创建 + 列表”：cases 与创建时间线由 POST /api/cases 一起写入；
-- audit 只建表，本步不写入、不提供查询接口，后续步骤再接审计。
-- 编号、创建时间、版本、来源状态与核实状态一律由服务端生成，
-- 客户端只能提交 deviceId 与 message，不能提交 assignee、created_at 等字段。
-- 仅本机教学模拟：不读取或修改原始报警，不控制设备，不发送任何外部通知。

CREATE TABLE cases (
    id           VARCHAR(32)  NOT NULL COMMENT '服务端生成的事件编号，形如 case-xxxxxxxxxxxx',
    device_id    VARCHAR(16)  NOT NULL COMMENT '关联设备，必须能在 devices 中找到',
    message      VARCHAR(500) NOT NULL COMMENT '演练内容，由管理员在创建时填写',
    state        VARCHAR(16)  NOT NULL COMMENT 'NEW / ASSIGNED / IN_PROGRESS / CLOSED',
    assignee     VARCHAR(32)  NULL COMMENT '处理人账号；未分派时为 NULL，必须能在 users 中找到',
    source_state VARCHAR(16)  NOT NULL DEFAULT 'ACTIVE' COMMENT 'ACTIVE / RECOVERED，创建时为 ACTIVE',
    verified     TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '创建时为 0，独立核实后才为 1',
    note         VARCHAR(500) NOT NULL DEFAULT '' COMMENT '处置记录',
    conclusion   VARCHAR(500) NOT NULL DEFAULT '' COMMENT '关闭结论',
    version      INT          NOT NULL DEFAULT 1 COMMENT '乐观锁版本，创建时为 1，每次成功动作 +1',
    created_at   BIGINT       NOT NULL COMMENT '服务端创建的 epoch 毫秒，不接受客户端提交',
    updated_at   BIGINT       NOT NULL COMMENT '服务端最后更新的 epoch 毫秒',
    PRIMARY KEY (id),
    KEY idx_cases_device_id (device_id),
    KEY idx_cases_created_at (created_at),
    CONSTRAINT fk_cases_device FOREIGN KEY (device_id) REFERENCES devices (id),
    CONSTRAINT fk_cases_assignee FOREIGN KEY (assignee) REFERENCES users (username),
    CONSTRAINT ck_cases_state CHECK (state IN ('NEW', 'ASSIGNED', 'IN_PROGRESS', 'CLOSED')),
    CONSTRAINT ck_cases_source_state CHECK (source_state IN ('ACTIVE', 'RECOVERED'))
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci COMMENT '演练事件：教学模拟，不操作设备、不发通知';

CREATE TABLE case_timeline (
    id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '自增主键',
    case_id    VARCHAR(32)     NOT NULL COMMENT '所属演练事件',
    seq        INT             NOT NULL COMMENT '同一事件内的时间线顺序，从 1 开始',
    `action`   VARCHAR(16)     NOT NULL COMMENT 'create / assign / start / note / recover / verify / close',
    actor      VARCHAR(32)     NOT NULL COMMENT '操作账号，取自登录会话，不使用客户端提交值',
    note       VARCHAR(500)    NOT NULL DEFAULT '' COMMENT '本次动作的说明',
    event_time BIGINT          NOT NULL COMMENT '服务端生成的 epoch 毫秒',
    PRIMARY KEY (id),
    UNIQUE KEY uk_case_timeline_seq (case_id, seq),
    CONSTRAINT fk_case_timeline_case FOREIGN KEY (case_id) REFERENCES cases (id) ON DELETE CASCADE,
    CONSTRAINT fk_case_timeline_actor FOREIGN KEY (actor) REFERENCES users (username),
    CONSTRAINT ck_case_timeline_action CHECK (`action` IN (
        'create', 'assign', 'start', 'note', 'recover', 'verify', 'close'))
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci COMMENT '事件时间线：创建时与事件同一次事务写入';

CREATE TABLE audit (
    id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '自增主键',
    actor      VARCHAR(32)     NOT NULL COMMENT '操作账号，取自登录会话',
    `action`   VARCHAR(32)     NOT NULL COMMENT '动作标识，如 case.create',
    target_id  VARCHAR(32)     NOT NULL COMMENT '动作目标编号',
    note       VARCHAR(255)    NOT NULL DEFAULT '' COMMENT '补充说明',
    event_time BIGINT          NOT NULL COMMENT '服务端生成的 epoch 毫秒',
    PRIMARY KEY (id),
    KEY idx_audit_event_time (event_time),
    CONSTRAINT fk_audit_actor FOREIGN KEY (actor) REFERENCES users (username)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci COMMENT '审计：本步只建表，后续步骤再写入与查询';
