# 第09站 恢复、核实与关闭

模式：teacher-db

目标：完成完整关闭链和拒绝反例

契约：NOTE+恢复事实+服务端核实PASS与有效时间+结论；旧版本409不重放

人工过关：恢复不自动关闭；缺NOTE拒绝；闭环后独立回读

这些是完整可读参考源码。主线用begin准备业务骨架，让CodeBuddy按本站文件实现；apply为遇错恢复，绝不把导入说成AI生成。

- assembly：frontend/src/journey/features.ts
- business：frontend/src/views/CloseChecklist.vue
