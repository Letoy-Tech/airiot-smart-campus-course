# AI编程：用CodeBuddy做智慧校园 V1.2.1

完整解压后打开 [先打开这里.html](先打开这里.html)。学生主线是 [12站教程](journey/index.html)，使用 **CodeBuddy独立IDE**。

一份app从两设备页面开始，逐站增加台账、位置、概览、能源、历史、报警、事件与责任。每站给出具体操作、文件、提示词、可见结果与排错。百分比是教学检查点，读完不会自动算完成。

- [开始准备](journey/index.html#prep)：复制resources/project-journey/app，安装与第一次运行。
- [逐站工程说明](resources/project-journey/README.md)：begin保留旧页面，plan明确跨站组装，verify按功能所在站检查；参考救援需明确选择并记录。
- [教师48学时安排](journey/index.html#teacher)：12次×4学时，45分钟/学时；学生自带Windows/macOS，教师提供分组数据库。
- [最终验收](journey/index.html#acceptance)：逐项操作，拿实际结果确认完成。
- [本轮实做反馈修订](18-学生实做反馈修订与验证.md)：功能增量、代码测试和未验证项。

前端业务逐站建设，认证、请求、数据库和完整Java后端是可读的教师公共服务；学生带读、核对并修改业务规则。原平台通用用户/组织管理后台没有在此重写。UI自由，真实AIRIOT只读接入选做，控制和通知关闭。

源码：journey/*.md与lessons.json；生成页：node tools/build-journey.mjs。逐站工程由tools/build-progress-project.mjs生成；有个人修改时不覆盖。原网页AI带做、图文教材、旧正式Word/PDF仍保留为查阅，课堂入口以新版为准。

[旧详细带做](walkthroughs/index.html) · [原图文教材](reading/index.html) · [原正式教案](lesson-plans/index.html) · [资源目录](resources/index.html)
