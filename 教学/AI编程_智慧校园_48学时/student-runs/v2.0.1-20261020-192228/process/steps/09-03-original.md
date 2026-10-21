## 第3步：让后端签发和检查登录凭条

**现在在哪：** 在 B 按 Ctrl+C。MySQL 和 Redis 继续运行。

**发给 CodeBuddy：**

```text
请按materials/约定卡.md加入Spring Data Redis并完成登录接口。
Redis连接127.0.0.1:23502，密码使用REDIS_PASSWORD占位。
POST /api/login接收username/password，校验MySQL账号后，
使用数据库查到的规范username建立会话和返回用户，不把输入大小写当成另一个身份；
用安全随机数生成登录token，在Redis以campus:v2:session:前缀保存会话，
过期时间1800秒，返回token及user:{username,role}，不返回密码摘要。
GET /api/me读取Authorization: Bearer token并返回当前用户；
POST /api/logout删除当前会话。
除/api/health和/api/login外，/api下的请求都必须检查会话。
未登录或过期返回401；已登录但无权操作返回403；
Redis不可用返回清楚的503，不放行，也不伪造登录成功。
不要在请求日志打印密码、Authorization或token。
增加登录失败、缺令牌、失效令牌和退出后不能继续访问的测试；
若数据库忽略账号大小写，验证MANAGER登录后响应和会话都使用数据库中的manager身份。
不要修改前端，不启动服务。
```

**等 AI 完成并保存：** 阅读 AI 的接口说明，确认这次保护了上一课公开的设备接口。

**亲自操作：** B、`backend` 目录再次执行本课第2步对应系统的“测试→启动”。启动成功后，在浏览器新标签直接打开 `http://127.0.0.1:5188/api/devices`。

**应该看见：** 直接打开地址会收到“请先登录”或同义错误，浏览器网络面板中状态是 `401`。这是本步的正确结果。健康地址仍可读取；前端设备页要等下一步接上登录才恢复。

**失败时，只发这段修复提示：**

```text
加入登录检查后，直接访问/api/devices的实际结果是【结果】。
请只检查保护范围与会话校验：health/login公开，其余/api需要有效Redis会话。
不要把设备接口重新设为公开来消除错误。
```

**下一步：** 后端已经会认人，再把网页上的“角色演示”改成真实登录。

