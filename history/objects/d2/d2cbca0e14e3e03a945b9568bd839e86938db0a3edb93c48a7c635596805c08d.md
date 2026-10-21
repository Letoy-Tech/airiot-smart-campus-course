# 第05站 概览与能源

模式：teacher-db

目标：概览及V/kW能源页

契约：GET /overview；source/simulated/observedAt/points/quality；不以kW推电量

人工过关：0/null/质量有区别；统计对应响应；离页停止刷新

这些是完整可读参考源码。主线用begin准备业务骨架，让CodeBuddy按本站文件实现；apply为遇错恢复，绝不把导入说成AI生成。

- assembly：frontend/src/journey/registry.ts
- assembly：frontend/src/journey/features.ts
- business：frontend/src/views/OverviewView.vue
- foundation：frontend/src/components/CompareHistory.vue
- foundation：frontend/src/components/HistoryChart.vue
- business：frontend/src/views/EnergyView.vue
- foundation：frontend/src/tests/energy-scope.test.ts
