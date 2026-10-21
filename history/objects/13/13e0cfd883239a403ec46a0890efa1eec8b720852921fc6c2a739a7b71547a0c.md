# 第10站 责任、审计与接入

模式：teacher-db；AIRIOT选做

目标：责任时间线、命令审计读取、接入状态

契约：owner版本独立；责任不追改旧事件；审计只读，远端控制关闭

人工过关：责任A→B，新事件跟B旧事件不变；普通身份不能读审计；未接入不写PASS

这些是完整可读参考源码。主线用begin准备业务骨架，让CodeBuddy按本站文件实现；apply为遇错恢复，绝不把导入说成AI生成。

- assembly：frontend/src/journey/registry.ts
- assembly：frontend/src/journey/features.ts
- business：frontend/src/views/OwnersView.vue
- business：frontend/src/views/AuditView.vue
- business：frontend/src/views/IntegrationView.vue
