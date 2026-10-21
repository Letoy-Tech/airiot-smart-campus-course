# 第二轮阅读器验证样张

本文件仅验证阅读器排版与链接，不是新增教材正文。实验仍未验证。

## 本章任务卡

先打开[课堂任务单](../../templates/课堂任务单.md)，再查阅[教学接口约定](../../contracts/教学接口约定.md#通用约定)。资料应在同一 HTML 内可达。

## 模块一 阅读图与合同（1 学时）

![学生审查网页 AI 建议后亲自操作本地工程，依据实际结果保存证据或继续修正](../../illustrations/shared-02-网页AI协作.png)

本样张复用已有公共图，不新增或修改图源。参见[课程大纲](../../01-课程大纲.md)及[资源分工](../../appendices/48学时实施分工.md)。

## 模块二 网页 AI 提示与代码（2 学时）

### 网页 AI 提示

```text
你是我的 Java 业务接口助教。请先阅读我随后提供的合同、DTO、一个相邻 Controller 和教师数据端口定义。
只协助 GET /campus/devices：Controller 调 Service，Service 保留校园读取授权并依赖数据端口。返回 {code:0,message,data}，data 为 {items,observedAt}。
不要臆造端口方法签名。online 和 communicationTime 可能为 null。先解释修改范围，再给出最小修改及人工核查步骤。未执行的检查必须写未执行。
```

### 教学代码

这段只检查代码展示，不是完整实现。

```ts
const categoryMatches = category.value === '' || device.category === category.value
const spaceMatches = spaceId.value === '' || device.spaceId === spaceId.value
```

### 结构示例

```text
begin transaction
  require current user is ADMIN
  require current.version == request.expectedVersion
  update current record and append timeline
commit
```

## 模块三 验收与解释（1 学时）

### 最小实验与验收

检查导航、折行、图片与内嵌资料。见[考核与验收](../../04-考核与验收.md)、[AI 任务卡](../../templates/AI任务卡.md)、[AI 接力包](../../templates/AI接力包.md)、[需求追踪表](../../templates/需求与测试追踪表.md)。

## 课后练习

对照[Qwen 与网页工具说明](../../appendices/Qwen与网页工具说明.md)理解模型名称记录方式。

## 交给下一章

教师使用[资源制作清单](../../appendices/教师资源制作清单.md)。[项目范围](../../02-项目范围与教学架构.md)暂为完整资料包文件，应显示依赖标签。
