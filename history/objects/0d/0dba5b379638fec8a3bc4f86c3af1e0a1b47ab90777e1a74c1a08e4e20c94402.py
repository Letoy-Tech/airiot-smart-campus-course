"""Publish only public trial facts into the revised teacher reader."""
from pathlib import Path
from collections import Counter
import datetime, json

BASE = Path(__file__).resolve().parent
BOOK = BASE.parents[2] / 'handbook-v2'
state = json.loads((BASE / 'progress.json').read_text())
steps = state['steps']
counts = Counter(row['status'] for row in steps)
complete = counts['PASS'] == len(steps) == 64
handoff = all(next(row for row in steps if row['id'] == sid)['status'] == 'PASS'
              for sid in ['12-03', '12-04', '12-05'])
models = sorted({row['model'] for row in steps if row.get('model')})
public = {
    'updated': datetime.datetime.now().astimezone().isoformat(),
    'trialSourceVersion': '2.0.1', 'revisedTextVersion': '2.0.2',
    'passed': counts['PASS'], 'total': len(steps), 'completeWithRecordedRemedies': complete,
    'v2_0_2_independent_retrial': False, 'actualModels': models,
    'operator': 'Codex operating CodeBuddy Craft and actual local terminals/browser',
    'businessSourceAuthoring': 'CodeBuddy Craft only; blank starter, no teacher implementation substitution',
    'freshComposeHandoffVerified': handoff,
    'notVerified': ['Windows', 'another physical computer', 'independent human student',
                    'classroom timing', 'real campus or AIRIOT', 'real device control', 'external notifications', 'human oral answers'],
    'steps': [{'id': row['id'], 'title': row['title'].removeprefix('## '),
               'status': row['status'], 'submissions': len(row.get('attempts', [])),
               'result': row.get('result') or '尚未完成实际验收'} for row in steps],
}
destination = BOOK / 'author/evidence/student-trial-v2.0.1.json'
destination.write_text(json.dumps(public, ensure_ascii=False, indent=2) + '\n')
start, end = '<!-- STUDENT_TRIAL_START -->', '<!-- STUDENT_TRIAL_END -->'
section = f'''{start}
## V2.0.2 校订依据：V2.0.1 从空白起点的实际试跑

当前实际验收 **{counts['PASS']}/64 步**。{'全部步骤已完成，实际失败与补救均保留。' if complete else '试跑仍在进行，未完成项不能视为通过。'}

使用冻结的 V2.0.1 提示词逐步生成，实际模型为 {'、'.join(models)}。业务源码仅由 CodeBuddy Craft 生成；Codex 负责操作、学生终端执行、真实浏览器检查、证据及教材校订。未用教师成品替代学生工程，也不构成 Qwen3 或真人学生独立验收。

本机实际环境为 macOS、Node 22.21.1、Java 17.0.12、Docker Desktop、MySQL 8.4 与 Redis 7.4。全新目录 Compose 交接{'已按第12课完成实际验收' if handoff else '尚未完成实际验收'}。源码生成、测试、真实页面操作和新目录交接分别记录。

本版 V2.0.2 依据观察到的名称回退、运行时变量遗漏、图表刻度裁剪、跨步提示缺口、镜像健康检查、来源说明、失败提示、空间/责任接入、版本输入、源码导出泄漏与路径边界、Compose容器命名隔离及交接文档等问题修订；**V2.0.2 修订后的提示词尚未另从空白完整重跑**。Windows、另一台电脑、真人学生或同伴独立操作、课堂用时、真实校园/AIRIOT与设备控制均未验证。

[逐步实际结果](author/evidence/student-trial-v2.0.1.json)随包保留。以下 V2.0.1 与 V2.0.0 段落为对应日期的作者参考工程历史记录，不替代本节学生路线试跑。
{end}
'''
path = BOOK / '教师验证记录.md'
text = path.read_text()
if start in text:
    before, rest = text.split(start, 1)
    _, after = rest.split(end, 1)
    text = before + section.rstrip() + after
else:
    title, body = text.split('\n', 1)
    text = title + '\n\n' + section + '\n' + body
text = text.replace('## 尚未验证\n', '## V2.0.1 作者复查时尚未验证（历史）\n')
path.write_text(text)
print(json.dumps({'passed': counts['PASS'], 'complete': complete, 'handoff': handoff}, ensure_ascii=False))
