# 第04站 本地位置登记

模式：teacher-db

目标：校园、楼栋、空间绑定保存并回读

契约：GET /locations；POST campuses/buildings；PUT spaces/{spaceId}；管理员写，合法引用

人工过关：保存重读；非法引用拒绝；查看者403；原关系不变

这些是完整可读参考源码。主线用begin准备业务骨架，让CodeBuddy按本站文件实现；apply为遇错恢复，绝不把导入说成AI生成。

- assembly：frontend/src/journey/registry.ts
- assembly：frontend/src/journey/features.ts
- business：frontend/src/views/LocationsView.vue
