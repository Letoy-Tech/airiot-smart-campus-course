## 第4步：让设备接口读出十六台设备

**现在在哪：** 先在 B 按 Ctrl+C 停自己的后端。A、MySQL 保持运行。

**发给 CodeBuddy：**

```text
请在现有后端实现GET /api/devices。
本课暂时允许未登录读取，下一课再加登录。
使用JdbcTemplate从MySQL的devices表查询，按id排序；
返回{code:0,message:"ok",data:[设备数组]}，字段按约定卡。
online为NULL时返回JSON null，不能变成false；simulated保持true。
控制器接收请求，服务组织结果，查询代码单独放置，用简短注释说明各自作用。
增加测试检查true、false和null都能保持原意。
不要从mock-campus.json临时返回数据，不实现其他接口，不启动服务。
```

**等 AI 完成并保存：** 看 AI 列出的修改文件，再做一次“测试→启动”。新 Java 代码只有重新启动 B 后才生效。

**亲自操作：** B、`campus-lab/backend`：

| 系统 | 先测试，结束后再启动 |
| --- | --- |
| macOS | `sh ./mvnw test`，成功后 `sh ./mvnw spring-boot:run` |
| Windows PowerShell | `.\mvnw.cmd test`，成功后 `.\mvnw.cmd spring-boot:run` |

在浏览器新标签打开 `http://127.0.0.1:5188/api/devices`。

**应该看见：** `data` 中有16台设备，包含 `d01` 到 `d16`，四类各4台。数据来自 SQL 查询，不是为了凑16而写死响应。

**失败时，只发这段修复提示：**

```text
/api/devices实际返回【去掉无关信息的结果】。
请只检查V1初始化与devices查询：应有16台，ID不重复，未知online保持null。
不要在前端补出缺失设备，也不要删除数据库重新来过。
```

**下一步：** 接口可读后，再改已有设备页；不要同时重写整个网页。

