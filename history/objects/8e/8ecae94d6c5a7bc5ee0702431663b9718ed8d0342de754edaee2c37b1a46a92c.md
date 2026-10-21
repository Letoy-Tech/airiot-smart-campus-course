## 第1步：启动只属于本课程的 Redis

**现在在哪：** CodeBuddy 打开项目根的 `compose.yaml`。C 的目录是 `campus-lab`，B 已停止。

**发给 CodeBuddy：**

```text
请在现有compose.yaml加入Redis7.4服务redis。
项目名仍是campus-v2，只映射127.0.0.1:23502到容器6379；
密码引用.env里的REDIS_PASSWORD，不读取或输出真实值。
Redis在本课程只保存短时登录，明确关闭RDB与AOF持久化，
这样课程redis进程重新启动后登录凭条会消失。
增加使用本机配置检查可用性的healthcheck，检查日志不能打印口令。
保留原MySQL服务与命名卷不变。不要替我启动服务，不运行down -v。
```

**等 AI 完成并保存：** 看到新增 `redis` 服务，确认原 MySQL 配置没有被删除。

**亲自操作：** C、`campus-lab` 根目录，两种系统相同：

```text
docker compose up -d redis
docker compose ps
```

**应该看见：** MySQL、Redis 都运行，Redis 最终显示 `healthy`，本机端口分别是 `23501`、`23502`。Redis 还没有登录记录，因为登录接口尚未完成。

**失败时，只发这段修复提示：**

```text
课程Redis启动后docker compose ps显示【状态】，
不含口令的错误是【错误】。
请只检查Redis服务、23502端口和健康检查，不输出.env，不修改MySQL数据卷。
```

**下一步：** 两个服务都健康后，先在 MySQL 建立三个练习账号。

