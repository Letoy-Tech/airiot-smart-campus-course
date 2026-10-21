import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.resolve(root, '..', 'student-workspace');
if (fs.existsSync(output)) throw new Error('student-workspace 已存在，拒绝覆盖。保留学生作业，另复制一份完整资源包再生成。');
const replacements = [
  ['frontend/src/api/campus.ts', 'A', "  throw new ApiError('TODO-A：请先检查业务code，再返回items与observedAt。')"],
  ['frontend/src/views/FirstDeviceRead.vue', 'B', "  void value\n  return '待完成 TODO-B'"],
];
const edits = replacements.map(([file, marker, body]) => {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const pattern = new RegExp(`(  // STUDENT_TODO_${marker}_BEGIN[^\\n]*\\n)[\\s\\S]*?(  // STUDENT_TODO_${marker}_END)`);
  if ((source.match(new RegExp(`STUDENT_TODO_${marker}_BEGIN`, 'g')) || []).length !== 1 || !pattern.test(source)) throw new Error(`任务标记不唯一：${file}`);
  return [file, source.replace(pattern, `$1${body}\n$2`)];
});
const excluded = new Set(['node_modules', 'target', 'dist', '.private', '.runtime', '.git', '.DS_Store', 'make-student.mjs', 'validation']);
for (const entry of ['frontend', 'backend', 'fixtures', 'tools', 'docs', '.gitignore', '.nvmrc', 'package.json']) {
  fs.cpSync(path.join(root, entry), path.join(output, entry), {
    recursive: true,
    filter: source => !path.relative(root, source).split(path.sep).some(part => excluded.has(part) || part.startsWith('.env') && part !== '.env.example'),
  });
}
for (const [file, source] of edits) fs.writeFileSync(path.join(output, file), source);
fs.mkdirSync(path.join(output, 'evidence'), { recursive: true });
fs.writeFileSync(path.join(output, 'evidence', 'README.md'), '# 学生证据\n\n填写自己的命令、工具版本、预测与实际结果。不要复制教师PASS记录作为个人完成证据。\n');
fs.writeFileSync(path.join(output, 'README.md'), `# 第04章学生起点\n\n此目录由教师参考工程生成。任务A位于frontend/src/api/campus.ts，任务B位于frontend/src/views/FirstDeviceRead.vue；两个标记块尚未完成。\n\n先读[操作单](docs/04-首次贯通操作单.md)和[启动说明](docs/01-跨平台启动.md)。未填写时type-check/build可以通过，但前端任务测试应失败；页面提示TODO-A，不能把它当成接口故障。完成两处任务后再运行check并取自己的证据。\n\n此目录不包含密码或教师实验结果；需要自行init。保留其他源码与锁文件，不用AI重写登录底层。后续章业务尚待扩展。\n`);
console.log('已生成 resources/student-workspace（教师参考工程的同级目录）；两处TODO留空，未复制凭据、依赖或构建产物。');
