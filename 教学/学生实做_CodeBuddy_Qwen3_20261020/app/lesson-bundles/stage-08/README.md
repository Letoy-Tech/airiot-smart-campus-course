# 第08站 事件接收与处理

模式：teacher-db

目标：场景、列表、分派、开始、NOTE

契约：演练是DEMO/LOCAL_DEMO；expectedVersion；本人已分派范围

人工过关：创建→分派A→A开始/NOTE；B拒绝；来源与业务状态分开

这些是完整可读参考源码。主线用begin准备业务骨架，让CodeBuddy按本站文件实现；apply为遇错恢复，绝不把导入说成AI生成。

- assembly：frontend/src/journey/registry.ts
- assembly：frontend/src/journey/features.ts
- business：frontend/src/views/CasesView.vue
