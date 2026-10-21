## 第1步：生成自己的本机配置

**现在在哪：** CodeBuddy 打开 `campus-lab`。A 正在跑页面；B 已确认 Java 17并停止在 `backend` 目录；C-工具的工作目录是 `campus-lab`。

**发给 CodeBuddy：**

```text
请按materials/约定卡.md为课程准备本地配置工具，但这一步不生成业务代码。
新建tools/setup-env.mjs，使用Node自带crypto随机生成足够长的口令，
在项目根生成.env：DB_PASSWORD、MYSQL_ROOT_PASSWORD、REDIS_PASSWORD、DEMO_PASSWORD。
已有.env时拒绝覆盖，不打印口令。新建.env.example，只放说明和占位文字。
把.env、.private、.runtime、backend/target、node_modules和日志加入.gitignore。
不要读取已有私密配置，不要把口令写入前端、README或回复。
不要替我运行生成工具，我会亲自运行。
```

**等 AI 完成并保存：** 打开脚本看看它是否使用随机生成，检查 `.env.example` 里没有真实口令。此时没有 `.env` 是正常的，还没有执行生成。

**亲自操作：** C、`campus-lab` 根目录，两种系统相同：

```text
node tools/setup-env.mjs
```

**应该看见：** 工具提示本地配置已生成，但不显示口令。左侧文件树出现 `.env`。如果提示文件已存在，保留它，直接继续，不能为重做练习删除配置。

**失败时，只发这段修复提示：**

```text
配置工具运行后出现【不含口令的错误】。
请只修复setup-env.mjs，不读取或覆盖已有.env，不输出其中的值。
我需要它在缺文件时生成，在已有文件时明确保留。
```

**下一步：** 本机 `.env` 就绪后，再生成运行 MySQL 的说明。

