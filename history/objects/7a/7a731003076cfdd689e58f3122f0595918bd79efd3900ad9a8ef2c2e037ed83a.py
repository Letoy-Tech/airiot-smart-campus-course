"""Build an operator report from recorded evidence; never modifies student source."""
from pathlib import Path
from collections import Counter
import json

BASE = Path(__file__).resolve().parent
state = json.loads((BASE / 'progress.json').read_text())
steps = state['steps']
counts = Counter(step['status'] for step in steps)
passed = counts['PASS']
models = sorted({step.get('model') for step in steps if step.get('model')})
lines = [
    '# V2.0.1 从空白起点学生路线电脑实做报告', '',
    f'当前实际验收：{passed}/{len(steps)} 步。' + ('全部步骤完成。' if passed == len(steps) else '本报告尚未完结；非 PASS 项仍待实做。'), '',
    '本次逐步使用冻结的 V2.0.1 教材提示词，在独立 campus-lab 中由 CodeBuddy Craft 生成业务源码；Codex 负责操作、实际命令与浏览器验证、证据和教材修订。未用教师成品替代学生工程。', '',
    '实际模型：' + '、'.join(models) + '。这不构成 Qwen3 验证。', '',
    '实际环境：macOS；学生终端 Node 22.21.1、Java 17.0.12；Docker Desktop 的 MySQL 8.4、Redis 7.4。仅本机教学模拟，未接入 CityU、AIRIOT 或真实设备。', '',
    'V2.0.2 教材修订依据本次 V2.0.1 加实际补救的运行观察；修订后的全部提示词没有另从空白独立重跑。Windows、另一台电脑、真人学生独立操作及课堂用时仍未验证。', '',
    '## 可复核的完成结果', '',
    '本轮完成同一台电脑上的全新 campus-lab-handoff：独立生成配置、独立 Compose 项目和新 MySQL 卷；设备16/空间4，完成新事件 case-a4b66d456baa，最终 CLOSED v6、时间线6条、审计8条，刷新重新登录仍可回读。旧项目闭环 case-34586bbc372f 保留 CLOSED v7，两个数据库的个人记录没有混用。', '',
    '主工程与新目录的后端各实际运行153项测试、0失败；前端请求守卫3项通过；事件20项真实HTTP拒绝检查逐次回读不改写；公开导出8项边界在实际失败补救后通过。重复测试不相加成更多独立测试。', '',
    '[最终公开导出校验](environment/final-export.json)：141个公开文件逐项SHA256匹配原工程与新目录源码；两份说明在最终导出中再次实际打开。A/B与新旧课程容器均停止，四课程端口无监听，双卷和本机配置保留。', '',
    '证据层级：逐步文件变动由哈希清单与CodeBuddy原生变更观察记录；公开章节源码快照另有08至最终版本的派生差异。这不是Git提交历史，也未追溯编造每一步完整补丁。', '',
    '未验证：真人同伴与口头作答、Windows、另一台实体电脑、新旧环境再次往返启动后的旧库内容、真实校园/AIRIOT、设备控制和外部通知。', '',
    '## 逐步结果', '',
    '| 步骤 | 标题 | 状态 | AI 提交次数 | 实际结果 |',
    '| --- | --- | --- | --- | --- |',
]
def cell(text):
    return str(text or '未记录').replace('|', '\\|').replace('\n', ' ')

for step in steps:
    lines.append('| ' + ' | '.join([
        step['id'], cell(step['title'].removeprefix('## ')), step['status'],
        str(len(step.get('attempts', []))), cell(step.get('result')),
    ]) + ' |')

lines += ['', '## 提示词、修改与证据索引', '']
for step in steps:
    sid = step['id']
    lines += [f"### {sid} {step['title'].removeprefix('## ')}", '',
              f"状态：{step['status']}；实际模型：{step.get('model') or '尚未使用'}。", '',
              f'[冻结原步骤](steps/{sid}-original.md)；[最近 IDE 观察](steps/{sid}-latest.ax.txt)。', '']
    for index, attempt in enumerate(step.get('attempts', []), 1):
        lines.append(f"- 第 {index} 次：{attempt.get('kind', '未标注')}；提交 {attempt.get('submittedAt', '未记录')}；AI 回复完成 {attempt.get('replyCompletedAt', '尚未完成')}。")
        if attempt.get('actualOutcome'):
            lines.append('  实际判断：' + cell(attempt['actualOutcome']))
    lines += ['', '实际验收：' + str(step.get('result') or '待完成，不填通过结论。'), '']
    for check in step.get('checks', []):
        evidence = check.get('commandsEvidence')
        if evidence:
            lines.append(f'- [{check.get("kind", "证据")}]({evidence})')
    if step.get('changed_files'):
        lines += ['', '本步相对前一快照的文件变动：' + '、'.join('`' + name + '`' for name in step['changed_files']) + '。', '']

lines += ['', '## 范围与运行限制', '',
          '模拟数据、浏览器原型数据、MySQL 持久化及新目录数据库分别记录。服务启动或 HTTP 200 不单独等于该步骤通过。', '',
          'Flyway 10.20.1 对 MySQL 8.4 显示超出其已测试最高版本 8.1 的警告；本次迁移与读取实测通过的范围不外推为生产兼容保证。', '',
          '[实际课程与模型问题](issues.md)；[操作工具与断言修正](operator-issues.md)；[结构化原始进度](progress.json)。', '']
(BASE / '学生实做报告.md').write_text('\n'.join(lines))
print(json.dumps({'passed': passed, 'total': len(steps), 'report': str(BASE / '学生实做报告.md')}, ensure_ascii=False))
