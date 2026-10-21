 ---

Letoy Pro 管理端开发设计规范 (v1.0)

1. 核心技术栈 (Tech Stack)
* 框架: Vue 3 (Composition API) + TypeScript
* 构建: Vite
* 状态: Pinia (持久化 Token 与用户信息)
* 路由: Vue Router (基于 requiresAuth 的导航守卫)
* 图标: Remix Icon (统一使用 ri- 前缀)
* 可视化: ECharts (响应式自适应)
* Markdown: marked + DOMPurify

2. 视觉设计系统 (Design Language)
   2.1 主题风格
* 风格关键词: 天青蓝办公风、活泼轻快、顶级 SaaS 质感、玻璃拟态。
* 主色调: #0ea5e9 (Sky Blue)，变量为 --primary-color。
* 背景色: 珍珠灰 #f4f7fa，卡片白 #ffffff。
* 圆角规范: 核心组件 12px - 16px (Modern Large Radius)。
* 阴影规范:
    * 基础卡片: 0 10px 15px -3px rgba(0, 0, 0, 0.02)
    * 悬浮/弹窗: 0 20px 25px -5px rgba(31, 38, 135, 0.07)

2.2 核心布局 (Layout)
* 侧边栏 (Sidebar): 悬浮式圆角设计，Margin 为 12px。
* 头部 (Header): 毛玻璃背景 (blur(12px))，固定高度 64px。
* 页面切换: 统一使用 page-zoom 动画（缩放 + 淡入淡出）。

3. 目录与文件规范

1 src/
2   api/        # 纯请求函数，严禁包含业务逻辑
3   components/
4     common/   # 手写原子组件 (VButton, VInput, VCard, VTag, etc.)
5     business/ # 业务组件 (VSlideVerify, VTree)
6   layout/     # AdminLayout (响应式核心)
7   utils/      # 工具类 (request, toast, messageBox, countdown)
8   views/      # 业务页面 (security-rules 严禁包含 "api" 关键词)
9   styles/     # 变量库 vars.css 是灵魂

4. 手写公共组件使用指南
* VCard: 必须带有 tag-color 以区分模块；重要列表建议开启 :no-padding="true"。
* VButton: 支持 primary, secondary, ghost, danger, text 类型；优先使用图标插槽。
* VInput: 必须配合 required 和 errorMsg 实现校验反馈；优先配置 prefix 图标。
* VDrawer: 用于“新增”和“编辑”操作，严禁在主页面堆积复杂表单。
* VTag: 用于状态展示，预设类型：success, warning, error, info, primary。

5. 网络请求与数据逻辑 (Network Layer)
   5.1 响应拦截 (request.ts)
* 自动脱壳: 拦截器必须判断 code 字段。若 code === 0 返回 res.data；若无 code 字段，视为直接业务数据返回。
* 无感刷新: 401 错误必须触发 refreshToken 队列逻辑，失败则清除 Token 重定向至登录。
* 统一报错: 所有错误必须通过 toast.error 弹出，且抛出 Error 对象。

5.2 数据映射
* 后端 CSV 转换: 在 Pinia Store 中，必须将后端返回的逗号分隔字符串（Roles, GroupIds）转换为数组，以供前端逻辑判断。
* 标识不外露: 组织 ID、角色编码、策略枚举值等由后端维护的标识，一律不在界面展示，也不要求管理员填写。
    * 展示: 统一使用 utils/label.ts 的 resolveLabels / resolveLabel 翻译为名称。字典未就绪时不渲染，
      查不到时显示「未知组织 / 未知角色」。严禁 `map[id] || id` 这类回退为原始 ID 的写法。
    * 枚举: 在页面内维护「枚举值 → 中文名」映射（参考访问控制页的 POLICY_LABELS），选项文案不得夹带英文常量。
    * 新建: 后端要求调用方提供的标识（groupId / roleCode 均为 @NotBlank）由 generateBusinessKey 静默生成，
      表单中不出现 ID / 编码输入框。
    * 运维信息: 后端返回的 Actuator 组件名、主机与端口、异常原文等不直接展示，只给出管理员可执行的中文提示。
    * 例外: 用户名是登录账号、访问控制的路径与方法是规则本身的内容，属于业务数据，正常展示。

6. 交互反馈规范 (UX Rules)
   6.1 提示体系
* 轻量反馈: 使用 toast.success/error/info/warning。
* 操作确认:
    * 普通确认: messageBox.confirm
    * 危险操作 (删除/停用): 必须使用 messageBox.danger。
* 加载反馈: 所有提交按钮必须绑定 :loading 状态。

6.2 表单加固
* 异步规范: 所有的保存、删除操作必须使用 try...catch...finally。
* 校验: 提交前必须检查必填项，未通过时触发 errorMsg 抖动动效。

7. 高级功能开发指南
   7.1 流式 AI 对话
* 协议: 使用原生 fetch 处理 SSE 协议。
* 渲染: 使用 renderMarkdown 工具函数，样式必须包裹在 .markdown-body 下。
* 响应式: 必须处理数组清空的 ref 更新问题 (messages.value = [])。

7.2 可视化图表
* 适配: 必须在 onMounted 注册 window.resize 监听，在 onUnmounted 销毁。
* 配色: 必须引用 vars.css 中的颜色变量（或与其色值保持一致）。

8. 移动端适配规范 (Mobile)

8.1 断点与判定
* 统一断点：移动端 <= 768px，平板 <= 1024px。
* 组件内判定一律使用 useIsMobile() / useMediaQuery()（src/utils/responsive.ts），
  基于 matchMedia。严禁再写 window.addEventListener('resize', ...) 判断宽度：
  移动端软键盘弹出会改变视口高度并触发 resize，容易误判。

8.2 安全区域与视口
* index.html 的 viewport 必须带 viewport-fit=cover，否则 env(safe-area-inset-*) 恒为 0。
* 全屏高度使用 dvh（100dvh）而非 vh：移动端地址栏收起时 vh 不随之变化。
* 固定定位元素（Tab 栏、底部抽屉、Toast）必须自行处理 --safe-top / --safe-bottom /
  --safe-left / --safe-right，父级 padding 对 position: fixed 无效。

8.3 触控与输入
* 最小可点区域 --tap-target (44px)，主要操作用 --tap-target-lg (48px)。
  图标按钮、开关、复选框若视觉尺寸偏小，用 padding + 负 margin 扩大命中区。
* 移动端输入框字号必须 >= 16px（--font-size-input-mobile）：
  iOS Safari 聚焦 <16px 的输入框会强制放大页面且不会还原。
* :hover 效果需包在 @media (hover: hover) 中，触屏上 hover 会在点击后残留。

8.4 布局模式
* 表格：桌面端保留 table，移动端必须提供卡片列表分支。
  min-width 900px+ 的表格在手机上横向滚动不可用。
* 筛选区：移动端默认折叠，首屏直接呈现数据而非搜索表单。
* VDrawer / AppModal / AppSelect：移动端自动切换为底部 sheet（组件内已内置，无需调用方处理）。
* 多个弹层可叠加，滚动锁定必须走 src/utils/scrollLock.ts 的引用计数，
  不要各自设置 body.style.overflow，否则内层关闭会解除外层的锁。

8.5 导航
* 移动端不设底部 Tab 栏。本系统有 6 个平级功能区，超出 Tab 栏适用的 3-5 个区间；
  且底部 Tab 会常驻占用约 60px + 安全区的垂直空间，对表单与列表密集的后台代价过高。
* 唯一导航入口为左上角汉堡菜单唤出的左侧抽屉，与桌面端侧边栏共用 AdminLayout 的
  navGroups 数据。新增路由时只需改这一处，不存在两套菜单不同步的问题。
* 抽屉底部的用户卡片即「个人中心」入口，同时承载退出登录。

  ---

遵循以上规范，即可保证 Letoy Pro 管理端在持续迭代中保持其顶级的设计品质。
