# 第07站 身份与权限验证

模式：teacher-db；复用认证底座

目标：解释当前身份和严格能力

契约：身份来自me，能力只接受Boolean true；后端决定权限

人工过关：viewer不能写；身份切换清旧数据；401/403分开

这些是完整可读参考源码。主线用begin准备业务骨架，让CodeBuddy按本站文件实现；apply为遇错恢复，绝不把导入说成AI生成。

- assembly：frontend/src/journey/registry.ts
- assembly：frontend/src/journey/features.ts
- business：frontend/src/views/AccessView.vue
