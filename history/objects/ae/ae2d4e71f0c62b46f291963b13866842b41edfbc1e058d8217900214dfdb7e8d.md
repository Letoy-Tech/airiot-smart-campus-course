## 第3步：让 Java 认识数据库，并建立设备表

**现在在哪：** B 已停止，工作目录为 `campus-lab/backend`。C 中的 MySQL 保持运行。

**发给 CodeBuddy：**

```text
请给现有最小后端加入JdbcTemplate、MySQL驱动和Flyway所需依赖，
沿用Java17、Spring Boot3.4.2。
application.properties从optional:file:../.env[.properties]导入本机配置，
连接127.0.0.1:23501/campus_course，用户名campus，使用DB_PASSWORD占位，
不得读取或复制.env的真实内容。
新增V1建表迁移，先建spaces和devices，字段严格按materials/约定卡.md；
从公开materials/mock-campus.json生成4个空间与16台设备的初始化SQL。
online未知必须是SQL NULL，模拟标记保留，device的spaceId须能找到空间。
迁移只在第一次使用这个数据库时建立和填充，不在每次启动时删除重建。
本步保留health接口，不实现其他页面接口。不要启动常驻服务。
```

**等 AI 完成并保存：** 查看新的迁移文件，找到 `d01`、`d16` 与四个空间。看不懂全部 SQL 没关系，先确认这些是自己的练习数据。

**亲自操作：** 在 B 运行测试；完成后启动后端。

macOS，工作目录为 `campus-lab/backend`：

```sh
sh ./mvnw test
sh ./mvnw spring-boot:run
```

Windows PowerShell，工作目录为 `campus-lab/backend`：

```powershell
.\mvnw.cmd test
.\mvnw.cmd spring-boot:run
```

前一条失败时先修好，不执行后一条。在浏览器访问 `http://127.0.0.1:5188/api/health`；若 A 没有启动，在 A、项目根运行 `node tools/serve.mjs`。

**应该看见：** B 启动日志显示迁移完成，健康接口仍返回 `UP`。这表示 Java 已连到数据库并建立表，设备页还没切换数据来源。

**失败时，只发这段修复提示：**

```text
MySQL已healthy，但后端启动出现【不含口令的第一段错误】。
请检查.env相对backend的导入路径、23501端口、数据库名与Flyway配置。
不要硬编码口令，不删除数据库，不让启动失败自动退回模拟成功。
如果V1已执行，后续修正用新的迁移文件，不篡改已执行的V1。
```

**下一步：** 健康接口成功后，增加第一条数据库查询。

