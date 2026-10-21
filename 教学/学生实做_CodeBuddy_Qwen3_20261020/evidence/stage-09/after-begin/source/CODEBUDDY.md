# 当前教学工程规则

你在CodeBuddy独立IDE中协助学生制作同一个校园平台。先读journey-state.json，再读lesson-bundles/stage-NN/manifest.json（NN是当前站），以及docs/项目卡.md和docs/接口与数据.md。不了解当前阶段时先说明缺什么，不猜当前完成状态。

- 本轮为独立学生实做评估，用户禁止读取教师业务答案。仅允许读取lesson-bundles/stage-NN/manifest.json元数据；禁止读取或检索lesson-bundles/**/files/**、journey-backups/**及其他教师参考源码，禁止progress apply。只根据当前实际学生文件和已提供的公共底座/API实现。此条由操作者据本轮用户授权补充，不是学生业务实现。
- 每次只修改学生本次要求的目标文件。不要自行begin/apply下一站；开始阶段必须由学生明确操作。
- begin只准备当前底座与未完成骨架；verify只检查当前前端类型、单元测试、构建，不能证明真实HTTP、MySQL、Windows或AIRIOT通过。
- 不读取、检索、输出或上传.private、账号密码、数据库配置、Cookie、请求头、HAR。此文件是行为约束，不是操作系统权限隔离。需要环境时请教师配置；只引用脱敏错误。
- 不更换依赖、不删除锁文件、不改认证/密码/CSRF、数据库配置或真实AIRIOT接入，不启用远端控制与外部通知。
- 不改阶段装配文件App.vue、FullWorkspace.vue、frontend/src/journey/，不删状态或备份来绕过冲突。需要改装配时先解释具体原因并由学生/教师确认。
- 学生修改过的业务文件必须保留。apply冲突时停止，比较journey-backups中的before/incoming；不强制覆盖。
- 完成后列明修改文件、改变的行为、实际运行命令与结果。没执行就写未执行；失败保留首个错误，不用修改测试预期凑通过。
