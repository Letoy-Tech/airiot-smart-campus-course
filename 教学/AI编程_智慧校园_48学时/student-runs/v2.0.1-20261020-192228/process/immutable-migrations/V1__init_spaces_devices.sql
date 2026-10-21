-- 第08课 V1：建立 spaces、devices，并用公开教学样本 materials/mock-campus.json 初始化。
-- 执行次数：Flyway 只在本数据库第一次使用时执行一次；之后每次启动只校验，不删表、不重建、不重复插入。
-- 需要改结构时新增 V2__*.sql，不要修改已执行过的 V1（改动会导致校验和不一致，启动被拒绝）。
-- 数据来源：materials/mock-campus.json（source=TEACHING_MOCK, simulated=true），仅课堂演示。

CREATE TABLE spaces (
    id       VARCHAR(16) NOT NULL COMMENT '空间编号，如 s1',
    name     VARCHAR(64) NOT NULL COMMENT '空间名称',
    building VARCHAR(64) NOT NULL COMMENT '楼栋',
    `floor`  VARCHAR(16) NOT NULL COMMENT '楼层，保留样本原值文本如 1、2',
    PRIMARY KEY (id)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci COMMENT '空间：s1-s4 共 4 个';

CREATE TABLE devices (
    id        VARCHAR(16) NOT NULL COMMENT '设备编号，如 d01',
    name      VARCHAR(64) NOT NULL COMMENT '设备名称',
    category  VARCHAR(32) NOT NULL COMMENT 'environment / energy / facility / lighting',
    space_id  VARCHAR(16) NOT NULL COMMENT '所属空间，必须能在 spaces 中找到',
    online    TINYINT(1)  NULL COMMENT '1=在线，0=离线，NULL=未知（未知必须是 NULL，不得用 0 代替）',
    simulated TINYINT(1)  NOT NULL DEFAULT 1 COMMENT '1=教学模拟数据，不做真实设备控制',
    PRIMARY KEY (id),
    KEY idx_devices_space_id (space_id),
    CONSTRAINT fk_devices_space FOREIGN KEY (space_id) REFERENCES spaces (id)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci COMMENT '设备：d01-d16 共 16 台';

INSERT INTO spaces (id, name, building, `floor`)
VALUES ('s1', '101教室', '教学楼', '1'),
       ('s2', '201教室', '教学楼', '2'),
       ('s3', '101实验室', '实验楼', '1'),
       ('s4', '201实验室', '实验楼', '2');

INSERT INTO devices (id, name, category, space_id, online, simulated)
VALUES ('d01', '温湿度01', 'environment', 's1', 1, 1),
       ('d02', '温湿度02', 'environment', 's2', 1, 1),
       ('d03', '温湿度03', 'environment', 's3', NULL, 1),
       ('d04', '温湿度04', 'environment', 's4', 0, 1),
       ('d05', '电表01', 'energy', 's1', 1, 1),
       ('d06', '电表02', 'energy', 's2', 1, 1),
       ('d07', '电表03', 'energy', 's3', 1, 1),
       ('d08', '电表04', 'energy', 's4', 1, 1),
       ('d09', '设施01', 'facility', 's1', 1, 1),
       ('d10', '设施02', 'facility', 's2', 1, 1),
       ('d11', '设施03', 'facility', 's3', 1, 1),
       ('d12', '设施04', 'facility', 's4', 1, 1),
       ('d13', '灯光01', 'lighting', 's1', 1, 1),
       ('d14', '灯光02', 'lighting', 's2', 1, 1),
       ('d15', '灯光03', 'lighting', 's3', 1, 1),
       ('d16', '灯光04', 'lighting', 's4', 1, 1);
