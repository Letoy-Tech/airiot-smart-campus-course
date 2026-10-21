# 智慧校园视觉系统 · 指挥中心

## Scene and Theme

学校讲解、投屏演示与日常巡查共用一套界面。默认跟随系统浅色 / 深色，顶栏可切换（View Transitions 圆形揭幕，偏好记忆在本机）。浅色为明亮玻璃质感工作台；深色为深海军蓝"校园指挥中心"，适合投屏与全屏展示。

## Color Strategy

令牌集中在 `src/styles/campus.css` 的 `:root[data-theme]`，图表色同步维护于 `src/utils/vizTheme.ts`（ECharts 不能读取 CSS 变量）。

- 品牌渐变：青 → 蓝 → 紫（`--brand-gradient`），用于主按钮、Logo、标题强调与当前导航。
- 四个业务色系保持语义：环境青绿、能源琥珀、设施蓝、照明紫；深色主题使用更亮的同色相。
- 状态：成功 / 警告 / 错误 / 未知均配文字；未知使用灰色虚线或斜纹，不与"关闭""离线"同色。
- 过期值以琥珀色斜纹（ECharts decal）标记，缺失 / 无效值不绘制。

## Typography

正文沿用 PingFang SC、Hiragino Sans GB、Microsoft YaHei、Noto Sans SC。数值使用 `--font-number`（DIN Alternate 优先）与 tabular-nums。页面标题 30px（窄屏 24px），区块标题 16–18px，正文 14px。

## Layout

可折叠侧栏（展开 252px / 收起 80px，记忆在本机）+ 玻璃顶栏（面包屑、⌘K 搜索、北京时间、主题、全屏）。窄屏侧栏改抽屉。页面以 KPI 卡片行开头，图表面板两列栅格，窄屏单列；KPI 卡片按容器宽度自动收紧环形图。

## Visualization Components

位于 `src/components/viz/`，全部只绘制真实读数：

- `KpiCard`：图标、滚动数值、渐变底线与可选环形比例；比例无法计算时显示虚线轨道。
- `RingGauge` / `ArcGauge`：环形与半圆表盘。表盘刻度两端标出数值；数值超出预设刻度时按数据自动扩展（`utils/gaugeScale.ts`）。
- `CountUp`：数值滚动；未取得值显示占位符，绝不以 0 代替。
- `LivePulse`：反映真实轮询状态——同步中旋转、成功后倒计时到下次读取、失败转琥珀并保留上次成功时间。
- `Sparkline`：原始样本迷你趋势，不插值。
- `SegmentTabs`：滑动高亮的分段选择器。
- `NetworkCanvas`：登录页装饰动画，不承载数据。

图表（`CampusChart`）：开启动画；轮询时合并更新让数值平滑过渡，系列结构变化时整体重建；主题切换即时换色。概览提供设备拓扑力导图（可拖拽、点击进入设备）、空间热力矩阵、玫瑰图与渐变条形图；空间页提供映射关系树。

## Visualization Evidence

最新值每15秒读取；原始历史为独立查询快照，最多4台并发，不随最新值轮询重复查询。默认15分钟，可选择1小时或6小时，达到1000条上限明确提示截断。筛选切换防止旧请求覆盖新范围；失败保留同范围的上次成功历史。未知值不绘制为0，过期点保留数值并标记，跨单位不共享数值轴。图表提供文字计数或原始样本表，`aria-label` 写明计数与单位。

## Components and State

复用按钮、输入框和状态标签；复杂数据筛选优先使用原生选择控件。loading（骨架闪光）、empty、error、stale、partial 与 success 分别呈现。操作等待期间禁用相关按钮，成功提示只在写后回读确认后出现。

## Elevation and Motion

玻璃面板（`backdrop-filter`）、18–20px 圆角、柔和投影；悬停时光斑跟随指针（`.fx-spotlight`）、边框高光（`.fx-glow-border`）、轻微 3D 倾斜（`.fx-tilt`）与按钮涟漪，均由 `utils/fx.ts` 事件委托实现，组件只需加类名。页面切换淡入上浮，卡片错峰入场。全部动效遵循 `prefers-reduced-motion`：减少动态时不倾斜、不涟漪、数值直接显示终值、背景极光静止。
