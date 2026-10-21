# 第03站 完整设备台账

模式：teacher-db；教师独立库

目标：4空间16设备，筛选与稳定ID详情

契约：devices与spaces使用完整固定目录；online严格true/false/null

人工过关：16→4→1→0→清除16；详情刷新仍同ID；无匹配与失败分开

这些是完整可读参考源码。主线用begin准备业务骨架，让CodeBuddy按本站文件实现；apply为遇错恢复，绝不把导入说成AI生成。

- assembly：frontend/src/journey/registry.ts
- assembly：frontend/src/journey/features.ts
- business：frontend/src/views/DeviceCatalog.vue
- foundation：frontend/src/api/full.ts
- foundation：frontend/src/composables/useRequestScope.ts
- foundation：frontend/src/domain/read-models.ts
- foundation：frontend/src/components/SourceBanner.vue
- foundation：frontend/src/components/ReadStatus.vue
- foundation：frontend/src/tests/catalog-navigation.test.ts
- foundation：frontend/src/tests/course-domain.test.ts
- foundation：frontend/src/tests/request-scope.test.ts
