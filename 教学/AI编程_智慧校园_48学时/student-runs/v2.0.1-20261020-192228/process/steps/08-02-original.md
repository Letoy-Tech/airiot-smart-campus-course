## 第2步：让课程 MySQL 运行起来

**现在在哪：** C 仍在 `campus-lab` 根目录。不要关闭 Docker Desktop。

**发给 CodeBuddy：**

```text
请新建根目录compose.yaml，项目名campus-v2。
本步定义MySQL8.4服务mysql：只映射127.0.0.1:23501到容器3306，
数据库campus_course、用户campus，口令从.env读取DB_PASSWORD和MYSQL_ROOT_PASSWORD。
使用本课程专属命名卷保存MySQL数据，增加能判断数据库就绪的healthcheck。
顶层volumes只声明课程卷的键，不设置显式name，也不设置external，
让Compose自动在卷名前加项目名，方便第12课建立独立交付环境。
不连学校或已有数据库，不打印展开后的配置。
Redis留到下一课加入，本步不要提前启动它。
请告诉我docker compose ps中怎样分辨starting与healthy。
不要替我启动服务，不使用down -v。
```

**等 AI 完成并保存：** 看见 `compose.yaml` 新增后再运行。配置文件只引用变量名，不应写出真实口令。

**亲自操作：** C、`campus-lab` 根目录，两种系统相同：

```text
docker version
docker compose up -d mysql
docker compose ps
```

首次需要下载 MySQL 镜像。第一次 `ps` 若显示 `starting`，过一会再执行同一条 `docker compose ps`。看到 `healthy` 再继续。

**应该看见：** 只有本课程 MySQL 使用本机 `23501` 端口。`up -d` 会返回输入提示符，MySQL 在 Docker 中继续运行；这与 B 里持续显示日志的 Java 程序不同。

**失败时，只发这段修复提示：**

```text
我在项目根运行docker compose up -d mysql后出现【不含口令的错误】，
docker compose ps显示【状态】。
请先区分Docker没启动、镜像下载失败、端口占用、数据库尚未就绪。
只修改本课程配置；不结束未知进程，不删除卷，不输出.env。
```

**下一步：** MySQL 显示 `healthy` 后，才让 Java 连进去。

