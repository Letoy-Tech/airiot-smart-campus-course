# CodeBuddy 项目调试练习：一页2条，为什么下一页消失

这是可选的故障练习。当前参考实现已经正确；下面的错误由学生在自己的副本里主动制造，不是假称工程现在有此缺陷。无需数据库，不启动后端服务。

1. 用 CodeBuddy 独立 IDE 打开长期工程 `app`，确认左侧同层有backend、frontend、fixtures、tools。打开 `backend/src/main/java/edu/campus/course/TeachingReadSamples.java`，搜索 `result.put("total", selected.size());`。先记下原行，再只把该行改成：

```java
result.put("total", Math.min(limit, Math.max(0, selected.size() - skip)));
```

2. 在IDE终端确认当前为app，当前终端已按安装章配置JDK17的JAVA_HOME，然后执行 `cd backend`。macOS执行 `sh ./mvnw -Dtest=ReadOnlyModelsTest#rawAlarmPaginationKeepsTrueTotalRawStatesAndNullableFields test`；Windows执行 `.\mvnw.cmd -Dtest=ReadOnlyModelsTest#rawAlarmPaginationKeepsTrueTotalRawStatesAndNullableFields test`。没有数据库配置也能执行；首次依赖下载需要网络。不要改测试或启动教师测试库。

预期失败位置是分页total断言：预期5，实际2。这是本故障设计的预期，不是替你执行后的结果。如果出现Java找不到、Maven下载失败或编译错误，先处理该环境/语法问题，不记为目标缺陷已复现。

3. 在CodeBuddy项目对话完整发送：

```text
请在当前app工程读取backend/src/main/java/edu/campus/course/TeachingReadSamples.java、
backend/src/test/java/edu/campus/course/ReadOnlyModelsTest.java和fixtures/raw-alarms.json。
我故意把page方法的total改成了本页条数。真实需求：5条固定模拟报警，limit=2时
首/次/末页items数量为2/2/1；每页total始终5，skip=10000时items为空但total仍5。
不要连接数据库或AIRIOT，不启动服务，不改夹具数量，不删测试或放宽断言。
请先解释total和items.length区别，再提出仅改这一行的修复，指出测试为何能抓住错误。
只修改我确认的副本文件；运行上述单个Maven测试前核对当前目录backend和Java17。
最后列出实际改动、实际测试命令/退出结果、没有验证的范围；未运行不得说通过。
```

4. 核对AI修复只恢复为 `result.put("total", selected.size());`，保存，再运行同一个测试。实际通过后，在自己的evidence里记录错误行、失败断言、修复行、重测结果。接着运行普通 `mvnw test`；被明确跳过的MySQL测试不计为数据库通过。若修改前已经失败，先恢复备份核对原始条件；不要用扩大修改范围掩盖问题。

这个练习检查“后端返回正确分页总数”的业务含义。HTTP或单测通过都不证明CodeBuddy替你完成了课堂验收、Windows复现或真实学校接入。
