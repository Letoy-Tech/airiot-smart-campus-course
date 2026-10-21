## 第2步：建立三个有不同职责的账号

**现在在哪：** B 保持停止，CodeBuddy 打开 `backend`。

**发给 CodeBuddy：**

```text
请给现有后端增加spring-security-crypto，用BCrypt保存密码摘要。
新增V2迁移建立users表，不改已执行的V1。
在本地课程启动时，若账号尚不存在，创建admin、manager、viewer，
角色依次为ADMIN、MANAGER、VIEWER，初始密码从DEMO_PASSWORD配置读取。
三个账号共用这份本地练习初始密码，只适用于本机课程。
只保存BCrypt摘要，不在SQL、日志、接口、回复中输出明文或摘要。
账号已存在时不重置密码；缺少配置要说明缺项，不能使用写死的默认密码。
先做账号建立和密码校验的测试，不做前端登录，不启动服务。
```

**等 AI 完成并保存：** 查看新增 `V2` 文件与账号初始化代码。它们应使用配置名，而不是出现你的真实口令。

**亲自操作：** B、`campus-lab/backend`，先测试，成功后启动。

| 系统 | 先测试 | 再启动 |
| --- | --- | --- |
| macOS | `sh ./mvnw test` | `sh ./mvnw spring-boot:run` |
| Windows PowerShell | `.\mvnw.cmd test` | `.\mvnw.cmd spring-boot:run` |

浏览器检查 `http://127.0.0.1:5188/api/health`；A 未启动时，在 A、项目根运行 `node tools/serve.mjs`。

**应该看见：** 后端正常启动，测试包含正确密码能通过、错误密码不能通过。日志可以说账号准备完成，但不会出现密码。本步还没有登录按钮可用。

**失败时，只发这段修复提示：**

```text
账号准备这一步失败，相关错误是【已去掉私密内容的错误】。
请只修复V2、配置读取或BCrypt校验，不重建数据库，不重置已有用户，
不要让我把.env或密码贴给你。
```

**下一步：** 停止 B 后生成登录接口，让账号真正获得短时登录凭条。

