最新进度与环境以 [CURRENT.md](CURRENT.md) 为准；本文件保留较早恢复说明。

# 当前学生实做恢复入口

工程：同级 ../campus-lab。过程资料不混入源码交付。原始V2.0.1，64步原文在steps，原教材冻结在source-text。业务代码只能经CodeBuddy独立IDE的Craft/Agent生成，不能Codex或教师参考实现。

当前31/64 PASS，第01–06课完成，07-01正确原提示已提交等待。曾因07–12采用text代码块，提取助手误发undefined一次；模型只读根目录问澄清、源码相对06-06manifest无变化。operator-invalid尝试及AX已保留，不算原教材失败。已从冻结原文逐步校验主提示首块与修复提示末块，排除学生终端命令；33步提示完整恢复。submitStep增加非空字符串guard。

CodeBuddy native app: /tmp/demo-workspace CN.app。独立campus-lab窗口，不碰旧app工程。Craft，实际模型Deepseek-V4.1-Flash 300K。CUA持久变量cb/fs/run/submitStep/inspectAI/submitActualRemedy。上下文压缩后先cua.rewriteDocumentation。最新函数文本在submit-step-current.js、inspect-ai-current.js、submit-actual-remedy.js；不使用eval/Function加载，直接重新声明。inspectAI会忽略The focused UI element is尾部复述，以当前步耗时且无Running/confirmation判断AI_DONE，只保存不判PASS。

每步：读XX-original.md→UI一条原提示→等完整回复并保存→实际IDE命令和浏览器点击→record.py登记PASS及manifest。必要补救用原本步提示加真实现象；不适用原修复模板时用精确actual-remedy。终端/源文件UI操作需每次读新AX。原生快捷键常需先点实际编辑器；Cmd+End在此机仅到行尾，手写笔记已通过IDE完整保留内容重排到末尾并保存。

A=IDE终端1/node，127.0.0.1:5188 serve.mjs运行中；PATH本终端指定Node22.21.1。C=IDE终端2/zsh，项目根，PATH含Node22和~/.docker/bin；Docker29.9.1/Compose5.6.0已实查，mysql:8.4、redis:7.4已拉取，尚无容器。B未创建。JDK17已安装在/Library/Java/JavaVirtualMachines/jdk-17.jdk/Contents/Home（17.0.6），全局JDK23未改。CodeBuddy工具仍默认Node26，与学生A/C实际Node22分开记录。07-02新建B先执行教材原命令核对Java17/Node22（若新B的Node26，真实反馈修复当前终端，不改全局）。启动前核对8098/23501/23502，不结束未知进程。backend、.env尚未生成。

Browser bsk session qvuv，固定Chrome实例675ffd6b，owned Agent Window1075951425/tab1075951426。不要借用户tab或换实例。browser_ops.py默认qvuv。只读保活process/keep-browser-session.py qvuv运行在exec session59121，每60秒observe并丢弃输出，8小时上限；结束任务创建process/keepalive.stop再session stop qvuv；不改共享daemon84504（session-idle300s）。密码阶段停debug和保活，切勿helper.fill秘密（它会记录argv）。需要秘密时只使用本课程本机生成.env，不在聊天/AX/证据泄露。

06 debug已stop/export commands/06-browser-debug.json，06 public-source快照在snapshots；当前capture student-v201-ch07-health已启动。历史05前段因session过期未导出，仅逐步JSONL/DOM/截图保留；不声称全程trace。

当前浏览器本地记录：101教室s1=教学楼A/2层；d01责任manager/备注日常巡查联系这位处理人（回读核对）/v2。case-1=d02、已关闭CLOSED/v7、sourceRECOVERED/verifiedtrue、7条时间线；case-2和case-3仍NEW/v1，未分派。审计只实际case-3创建一条，未补造case1/2旧记录。刷新身份回admin。mock-campus.json仍原公开样本：16设备4空间28点位，d03online未知+温度缺失，d05power0，报警a01只读1条SAMPLE_ACTIVE/NOTICE。多页翻页没有真实浏览器样本验证。

已确认教材修订：01-05保留学生平台名；05-03状态变量先定义/运行白屏补救；05-02/04图表首末刻度完整与裁剪补救；06-02提示明确sourceState/verified实际显示；06-05明确createCase也要审计，业务与审计同次保存，加入对应缺失修复模板；06-06去掉早期占位文案。所有失败原尝试、补救和真实复测记录保留。06-06本人结果已用IDE写入notes末尾。

tools/v2/build-reader.mjs已用VERSION2.0.2，但阅读版、index/README版本与ZIP仍未重建。原2.0.1ZIP必须保留。package-course.py尚未改/跑，原脚本会读teacher-reference/.env，不能照跑；最终改成2.0.2并避免读取无关私密配置，不能查阅教师参考业务实现。新2.0.2是本次V2.0.1实际试跑+补救后的修订，不声称已独立重跑所有新提示。

不访问system真实业务/CityU/AIRIOT，不发布，不覆盖.env，不删除数据卷。不留未知服务。最终还需07–12共33步、真实新目录Compose独立project/新配置/新卷交接、64步报告、学生源码导出与修订教材包。
