## 第3步：让 AI 只做一个“启动成功”接口

**现在在哪：** CodeBuddy 仍打开 `campus-lab`。B 还没有后端进程。

**发给 CodeBuddy：**

```text
请在当前工程新建 backend，完成最小Java后端。
使用Java17、Spring Boot3.4.2、Maven，包名edu.campus.v2。
把 materials/maven-wrapper 中的Maven启动工具复制到backend，保留隐藏的.mvn目录。
只加入Spring Web和测试依赖，不加入MySQL、Redis，不复制任何完整教师业务代码。
服务只监听127.0.0.1:8098。
实现 GET /api/health，返回：
{"code":0,"message":"ok","data":{"status":"UP"}}
增加一个不需要数据库的接口测试，检查status确实为UP。
把启动类、控制器和application.properties的作用各用一句话写到docs/后端启动笔记.md。
你可以运行会结束的测试；不要替我启动spring-boot:run。
不要修改frontend，不实现其他接口。
```

**等 AI 完成并保存：** 等它回复完成，查看 `backend`。至少应有 `pom.xml`、`mvnw`、`mvnw.cmd`、`.mvn`、`src/main`、`src/test`。确认本步没有突然多出设备、登录、事件等完整业务。

**亲自操作：** B 先进入后端目录，再运行测试。

macOS，起始目录为 `campus-lab`：

```sh
cd backend
sh ./mvnw test
```

Windows PowerShell，起始目录为 `campus-lab`：

```powershell
Set-Location backend
.\mvnw.cmd test
```

**应该看见：** 首次可能下载依赖，下载完成后显示 `BUILD SUCCESS`；测试统计里至少有刚生成的健康接口测试。只有“没有测试可运行”不算这个检查完成。

**失败时，只发这段修复提示：**

```text
我在backend运行Maven测试失败。第一段错误是【复制相关错误，去掉本机隐私】。
请只修复本课的最小健康接口和对应测试，不加入数据库、不删除测试、不跳过测试。
修好后告诉我重新运行哪条已有命令，不启动常驻服务。
```

**下一步：** 测试通过后，让后端真正运行起来。

