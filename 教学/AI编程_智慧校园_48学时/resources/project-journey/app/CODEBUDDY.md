# 当前教学工程规则

你在CodeBuddy独立IDE中协助学生制作同一个校园平台。先读journey-state.json，再读lesson-bundles/stage-NN/manifest.json（NN是当前站），以及docs/项目卡.md和docs/接口与数据.md。不了解当前阶段时先说明缺什么，不猜当前完成状态。

- 主线只读取本次实际源码、manifest、公共接口和测试；默认不得读取或检索lesson-bundles/**/files、reference、journey-backups。学生/教师明确选择参考救援后才可读对应参考，并记录来源，不把导入声称为AI原创或本人通过。
- 每次只修改本次businessFiles、integrationFiles及documentationFiles中明确要求的文件。integrationFiles是需要继续修改的旧页面，begin不会覆盖它们；不要自行begin/apply或推进下一站。
- begin只准备当前底座与未完成骨架；verify只检查当前前端类型、单元测试、构建，不能证明真实HTTP、MySQL、Windows或AIRIOT通过。
- 不读取、检索、输出或上传.private、账号密码、数据库配置、Cookie、请求头、HAR。此文件是行为约束，不是操作系统权限隔离。需要环境时请教师配置；只引用脱敏错误。
- 不更换依赖、不删除锁文件、不改认证/密码/CSRF、数据库配置或真实AIRIOT接入，不启用远端控制与外部通知。除非当前明确任务要求，不新建/修改/删除测试（包括临时测试）。
- 不改阶段装配文件App.vue、FullWorkspace.vue、frontend/src/journey/，不删状态或备份来绕过冲突。需要改装配时先解释具体原因并由学生/教师确认。
- 学生修改过的业务文件必须保留。apply冲突时停止，比较journey-backups中的before/incoming；不强制覆盖。
- 用npm run test:unit -- --run，不猜npm test存在。无.git时用IDE变更或文件diff；git status失败不是源码审计。完成后列修改文件、行为、实际命令和结果；没执行写未执行，保留首错，不改测试预期凑通过。
