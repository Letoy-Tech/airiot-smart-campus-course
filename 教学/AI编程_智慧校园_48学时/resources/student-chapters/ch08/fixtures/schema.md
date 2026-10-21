# 夹具格式说明（schemaVersion 1）

本说明冻结文件格式，供人工阅读、Node 校验器和后续教学 Provider 使用。它不是 JSON Schema 标准文件，也不修改 共享教学合同（课程总包中的教师资料：`contracts/教学接口约定.md`；未随本练习副本分发，请由教师提供或从课程总包查阅）。未定义的接口错误格式、异常过滤优先级、历史排序或端点包含语义不在这里补充规定。

## catalog.json

顶层字段严格为 `schemaVersion/source/simulated/observedAt/spaces/devices/points`。`schemaVersion=1`、`source="TEACHING_MOCK"`、`simulated=true`；`observedAt=1792303200000`。

| 数组 | 每项字段 | 冻结约束 |
| --- | --- | --- |
| spaces | id、name、type、campusId、buildingId、floor | 共 4 项；id 唯一；当前三个映射字段均 null |
| devices | id、tableId、name、category、spaceId、spaceName、online、communicationTime、simulated、switchOn、tags | 共 16 项；每空间每类 1 台；online 为 true/false/null；模拟标记必须 true；不含 source |
| tags | id、name、unit | 每台至少 1 项；设备内 id 唯一；采用 manifest 中的标签/单位映射 |
| points | deviceId、tableId、tagId、value、time、quality、unit | 共 28 项；deviceId+tagId 唯一；设备、表、tag、单位匹配 |

`value` 只允许有限 Number 或 null；`time/communicationTime` 只允许有效 epoch 毫秒整数或 null。目录没有故意非法类型，它是 Provider 可读取的合法样本。质量错误输入单独放入 quality-cases，不混入目录。实际接口不能把这些 JSON 文件的文件名或 schemaVersion 当作合同字段返回。

## 其他文件

- `selectors.json`：`profiles.first-chain/full` 均列出 spaceIds、deviceIds 和 `includeAllTagsForSelectedDevices:true`。消费者必须同时过滤空间、设备与点，不靠数组前两个位置猜选取对象。
- `quality-cases.json`：顶层为固定时钟、策略说明、baseRaw、cases；每个 case 含 id、raw、expectedQuality、reason。除正常基线外每例只改 raw 的一个字段。正常/零、59999/60000/60001 毫秒、未来 4999/5000/5001 毫秒、缺值/缺时与非法类型分别独立。
- `history-cases.json`：本身就是 `{code:0,message,data}`；data 采用共享 History 合同，samples 恰有四条，含一个 null 和一个有效零。issues 为空，不定义非空 Issue 结构。
- `*-scenarios.json`：`kind="SCENARIO_SPEC"`、`executionStatus="NOT_EXECUTED"`；其余字段表达测试设计，不是 API 请求 DTO。`actorKey/ownerKey/logicalId` 是测试说明用逻辑引用，由隔离测试实现映射为 uid/已创建记录 id。尤其 ownerKey 不可原样提交为 API 字段。
- `manifest.json`：列出文件字节 SHA-256、目录计数、固定时钟、first-chain 和教学/原参考标签映射。哈希不包含 manifest 自身，避免循环依赖；校验脚本自身由外层工程清单管理。

## 后续落实责任

教师 Provider 要显式选择教学来源，用同一 catalog、选择器和可控时钟，实际输出对应合同 DTO；真实上游失败不能隐式改读此目录。后端测试需独立验证类型拒绝、身份当前角色、本人范围、分页、版本竞争与回滚。前端测试需独立验证合法响应解包、三态显示、null 断点和旧请求隔离。`SCENARIO_SPEC` 不能提前填写 HTTP 或 SQL 实际通过记录。
