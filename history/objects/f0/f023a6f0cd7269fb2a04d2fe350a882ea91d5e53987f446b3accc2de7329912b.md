# 第06站 历史与原始报警

模式：teacher-db

目标：历史表曲线和原始报警只读

契约：GET /history固定时间窗口；GET /alarms只读分页；保留原状态/等级

人工过关：null断线、0保留；同单位对比；报警有记录/空/失败分开

这些是完整可读参考源码。主线用begin准备业务骨架，让CodeBuddy按本站文件实现；apply为遇错恢复，绝不把导入说成AI生成。

- assembly：frontend/src/journey/registry.ts
- assembly：frontend/src/journey/features.ts
- business：frontend/src/views/HistoryView.vue
- business：frontend/src/views/RawAlarmsView.vue
- foundation：frontend/src/api/read-models.ts
- foundation：frontend/src/types/read-models.ts
- foundation：frontend/src/composables/useReadPage.ts
- foundation：frontend/src/tests/comparison.test.ts
- foundation：frontend/src/tests/monitoring-views.test.ts
- foundation：frontend/src/tests/read-api.test.ts
- foundation：frontend/src/tests/read-models.test.ts
