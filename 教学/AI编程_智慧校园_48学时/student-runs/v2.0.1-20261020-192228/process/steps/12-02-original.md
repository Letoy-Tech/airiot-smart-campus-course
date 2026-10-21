## 第2步：导出源码，亲自看清楚带走了什么

**现在在哪：** C-工具的工作目录是原 `campus-lab`。A、B 暂时可以继续运行。

**发给 CodeBuddy：**

```text
请生成tools/export-source.mjs，使用Node自带功能，不增加打包依赖。
接受--out参数，只允许输出到本项目.runtime下；输出目录已存在就拒绝覆盖。
按白名单复制frontend、backend/src、backend/pom.xml、Maven wrapper和.mvn、
公开tools、公开materials、compose.yaml、根.env.example、.gitignore、README.md、docs。
所有层级排除.env及.env.*变体（仅保留根.env.example）、.private、.runtime、
.codebuddy、node_modules、target、日志、个人截图和凭据。
检查源路径和输出路径的每一级父目录，拒绝符号链接；不能只检查最后一个文件。
不读取上级目录，不带完整教师参考。
工具可以在本机读取.env的值仅作泄漏检查，不显示这些值；
如果待导出的文本包含本机口令就停止并仅报告文件名。
输出一份文件清单和每个文件的SHA256，便于接手人确认复制完整。
不要替我运行导出，不把导出成功写成新目录运行成功。
```

**等 AI 完成并保存：** 查看导出工具，确认白名单只包含本项目公开源码与文档。自己的个人资料若放进 `docs`，先移到不导出的个人目录。

**亲自操作：** C、原 `campus-lab` 根目录，两种系统相同：

```text
node tools/export-source.mjs --out .runtime/hand-in-v1/campus-lab
```

用文件管理器打开 `.runtime/hand-in-v1/campus-lab`，显示隐藏文件，检查有 `.env.example` 和 `backend/.mvn`，但没有 `.env`、`target`、`node_modules`。

**应该看见：** 导出目录中有可读源码、启动工具、公开材料和文件清单。看不到你的本机密码，也没有一次旧运行产生的数据库文件。若需要重新导出修订版，把输出改成 `.runtime/hand-in-v2/campus-lab`，不覆盖第一次结果。

**失败时，只发这段修复提示：**

```text
源码导出在【阶段】失败，固定错误是【不含口令的提示】。
请只修复白名单、路径处理或泄漏检查；不要扩大到整个项目或上级目录，
不要忽略检查继续导出，也不要显示匹配到的口令。
```

**下一步：** 导出检查完成后，停止旧服务，再去新目录。

