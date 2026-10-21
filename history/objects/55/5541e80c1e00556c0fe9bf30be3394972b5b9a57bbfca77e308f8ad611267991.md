## 第4步：启动 B，再从网页地址读它的回答

**现在在哪：** B 的工作目录是 `campus-lab/backend`。A 保持运行。

**发给 CodeBuddy：**

```text
请核对tools/serve.mjs与刚完成的后端是否符合约定：
页面服务在127.0.0.1:5188；/api请求转发到127.0.0.1:8098，保留/api路径。
它只能公开frontend，不能公开项目根、backend或.env。
如果已经正确，不改文件；如果有遗漏，只修复这个转发。
不要启动页面或后端服务。告诉我本次是否修改了serve.mjs。
```

**等 AI 完成并保存：** 若它修改了 `serve.mjs`，仅在 A 按一次 Ctrl+C，然后在 A、`campus-lab` 根目录重新运行 `node tools/serve.mjs`。没有修改就保持 A 原样运行。

**亲自操作：** 在 B 启动后端。

macOS，工作目录为 `campus-lab/backend`：

```sh
sh ./mvnw spring-boot:run
```

Windows PowerShell，工作目录为 `campus-lab/backend`：

```powershell
.\mvnw.cmd spring-boot:run
```

看到启动日志后，在浏览器新标签打开 `http://127.0.0.1:5188/api/health`。

**应该看见：** 浏览器显示 `code` 为 `0`、`status` 为 `UP`。B 没有回到输入提示符是正常的：这个程序正在等网页请求，保持窗口开着。

**失败时，只发这段修复提示：**

```text
我已在B启动最小后端，浏览器访问5188端口的/api/health时看到【现象】。
B最后几行不含隐私的日志是【日志】。
请检查8098监听、/api路径与页面转发，只修复本步链路。
如果端口被占用，先报告，不结束未知进程。
```

**下一步：** 看到真实 `UP` 后，给网页加一个让普通人看得懂的连接状态。

