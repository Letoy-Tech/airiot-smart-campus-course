# 第11站 调试与测试

模式：真实数据库另用独立_test库

目标：修复真实缺陷并读并发回滚证据

契约：前端测试不是MySQL回滚证明；400/403/409不是事务回滚成功

人工过关：保留修复前后测试；真实DB因果链由实际报告证明

这些是完整可读参考源码。主线用begin准备业务骨架，让CodeBuddy按本站文件实现；apply为遇错恢复，绝不把导入说成AI生成。

- assembly：frontend/src/journey/features.ts
- foundation：frontend/src/tests/case-trigger-race.test.ts
- foundation：frontend/src/tests/comparison.test.ts
- foundation：frontend/src/tests/monitoring-views.test.ts
- foundation：frontend/src/tests/read-api.test.ts
- foundation：frontend/src/tests/read-models.test.ts
- foundation：frontend/src/tests/read-pages.test.ts
- foundation：frontend/src/tests/workflow-views.test.ts
- foundation：frontend/src/tests/journey-navigation.test.ts
- foundation：docs/调试记录.md
