import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { courseDir, dependency } from './runtime.mjs';

// Pure file inspection: no browser, server, screenshots, HTTP requests, or AI calls.
const { marked } = await dependency('marked');
const python = process.env.COURSE_PYTHON || 'python3';
const sourceDir = path.join(courseDir, 'walkthroughs');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const rel = value => path.relative(courseDir, value).split(path.sep).join('/');
const inside = value => {
  const relative = path.relative(courseDir, value);
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
};
const expectedFiles = [
  '01-项目想法.md', '02-范围确认.md', '03-项目任务书.md', '04-角色与场景.md',
  '05-验收条件.md', '06-异常与优先级.md', '07-需求规格.md', '08-页面与流程.md',
  '09-数据字典.md', '10-接口约定.md', '11-开发任务.md',
];

const pythonParser = String.raw`
import json, sys
from html.parser import HTMLParser
class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.refs=[]; self.ids={}; self.images=[]
    def handle_starttag(self, tag, attrs):
        a=dict(attrs); line=self.getpos()[0]
        for key in ('id',):
            if a.get(key): self.ids[a[key]]=self.ids.get(a[key],0)+1
        if tag=='a' and a.get('name') and a.get('name')!=a.get('id'):
            self.ids[a['name']]=self.ids.get(a['name'],0)+1
        for key in ('href','src'):
            if key in a: self.refs.append({'tag':tag,'attribute':key,'value':a[key] or '', 'line':line})
        if tag=='img': self.images.append({'src':a.get('src') or '', 'alt':a.get('alt') or '', 'line':line})
    def handle_startendtag(self, tag, attrs): self.handle_starttag(tag,attrs)
pages={}
for name, source in json.load(sys.stdin).items():
    p=Page(); p.feed(source); p.close()
    pages[name]={'references':p.refs,'ids':p.ids,'images':p.images}
print(json.dumps({'pythonVersion':sys.version.split()[0], 'pages':pages},ensure_ascii=False))
`;
let pythonVersion = null;
function parseHtml(documents) {
  const result = spawnSync(python, ['-c', pythonParser], {
    input: JSON.stringify(documents), encoding: 'utf8', maxBuffer: 30 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    throw new Error(`HTMLParser不可用：${result.error?.message || result.stderr.trim()}`);
  }
  const parsed = JSON.parse(result.stdout);
  pythonVersion = parsed.pythonVersion;
  return parsed.pages;
}

function indicator(text, expression, startLine) {
  const match = expression.exec(text);
  return {
    present: Boolean(match),
    evidence: match ? text.slice(Math.max(0, match.index - 25), match.index + 165).replace(/\s+/g, ' ').trim() : null,
    approximateLine: match ? startLine + text.slice(0, match.index).split('\n').length - 1 : null,
  };
}
function inspectSteps(markdown) {
  const tokens = marked.lexer(markdown);
  const sections = [];
  let offset = 0, current = null;
  for (const token of tokens) {
    const line = markdown.slice(0, offset).split('\n').length;
    if (token.type === 'heading' && token.depth === 2) {
      const isStep = /^(?:第[一二三四五六七八九十百\d]+步|准备[一二三四五六七八九十\d]|先准备保存位置|先找到本章工作位置|开始前|如果你刚收到一个ZIP)/.test(token.text);
      current = isStep ? { title: token.text, line, tokens: [] } : null;
      if (current) sections.push(current);
    } else if (current) current.tokens.push({ ...token, sourceLine: line });
    offset += token.raw?.length || 0;
  }
  return sections.map(section => {
    const prose = section.tokens.filter(t => t.type !== 'code').map(t => t.raw || '').join('');
    const prompt = section.tokens.find(t => t.type === 'code' && (!t.lang || t.lang === 'text') &&
      /请|我(?:在|是|将|要|做|已|现在)|我们|下一条|开始(?:C\d|页面)/.test(t.text) &&
      !/^(?:node |npm(?:\.cmd)? |git |java |export |\$env:)/.test(t.text.trim()));
    const inlinePrompt = indicator(prose, /(?:发(?:送)?|回复|追问)[：:]?\s*[“「][^”」]{6,}[”」]/, section.line + 1);
    const checks = {
      operation: indicator(prose, /打开|点击|输入|复制|粘贴|发送|下载|保存|执行|选择|新建|按.{0,12}(?:键|Ctrl|Command)|切换|填写|搜索/, section.line + 1),
      aiPrompt: prompt ? { present: true, evidence: prompt.text.slice(0, 190), approximateLine: prompt.sourceLine } : inlinePrompt,
      expectedResult: indicator(prose, /预期|应该|应(?:看到|显示|出现|得到|返回|保持|仍|为|有|正常|只|当)|成功后|完成后|保存后|确认.{0,20}(?:有|仍|是|存在)|看见|看到/, section.line + 1),
      failureHandling: indicator(prose, /(?:失败|出错|报错|错误|找不到|无法|不一致|若|如果)[\s\S]{0,200}?(?:先|检查|核对|回到|修正|重|停止|记录|发送|发给|请|保留|不要)/, section.line + 1),
    };
    const missing = Object.entries(checks).filter(([, value]) => !value.present).map(([key]) => key);
    return { title: section.title, line: section.line, status: missing.length ? 'REVIEW_REQUIRED' : 'INDICATORS_PRESENT', missing, checks };
  });
}

function resolveReference(from, value) {
  if (/^(?:https?:|mailto:|tel:|data:)/i.test(value)) return { kind: 'external-not-requested' };
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) && !value.startsWith('file:')) return { kind: 'unsupported-scheme' };
  const url = new URL(value, pathToFileURL(from));
  if (url.protocol !== 'file:') return { kind: 'external-not-requested' };
  const target = fileURLToPath(url);
  const kind = !inside(target) ? 'outside-course' : rel(target).split('/').includes('.private') ? 'forbidden-private' : 'local';
  return { kind, target, anchor: decodeURIComponent(url.hash.slice(1)) };
}

if (process.argv.includes('--self-test')) {
  const sample = '# Sample\n\n## 第1步：示例\n\n打开文件并保存。预期看到正确标题。若失败，先核对路径。\n\n```text\n请只解释下一条错误，不改文件。\n```\n\n```markdown\n## 第2步：这是样例内的标题\n```\n';
  const steps = inspectSteps(sample);
  assert.equal(steps.length, 1, 'fenced sample headings must not become steps');
  assert.deepEqual(steps[0].missing, []);
  const missing = inspectSteps('# Sample\n\n## 第一步\n\n只有标题。\n')[0];
  assert.equal(missing.missing.length, 4);
  const parsed = parseHtml({ sample: '<h1 id="one">A</h1><a href="x.html?a=1&amp;b=2#two">B</a><img src="" alt="blank">' }).sample;
  assert.equal(parsed.ids.one, 1);
  assert.equal(parsed.references[0].value, 'x.html?a=1&b=2#two');
  assert.equal(parsed.images[0].src, '');
  const resolved = resolveReference(path.join(sourceDir, 'index.html'), '../reading/index.html#part-01');
  assert.equal(resolved.kind, 'local');
  assert.equal(resolved.anchor, 'part-01');
  assert.equal(resolveReference(path.join(courseDir, 'index.html'), '../../outside.html').kind, 'outside-course');
  assert.equal(resolveReference(path.join(courseDir, 'index.html'), 'https://example.com').kind, 'external-not-requested');
  assert.equal(resolveReference(path.join(courseDir, 'index.html'), '.private/private.html').kind, 'forbidden-private');
  console.log(JSON.stringify({ status: 'PASS_SELF_TEST', assertions: 11, pythonVersion, browserUsed: false, networkUsed: false }));
  process.exit(0);
}

const outputArg = process.argv.indexOf('--output');
if (outputArg >= 0 && !process.argv[outputArg + 1]) throw new Error('--output缺少文件路径');
const output = path.resolve(courseDir, outputArg >= 0 ? process.argv[outputArg + 1] : 'walkthroughs/qa/round9/offline-static.json');
if (!inside(output) || rel(output).split('/').includes('.private')) throw new Error('报告路径必须在课程目录内且不能位于.private');
const report = {
  status: 'PENDING', recordedAt: new Date().toISOString(),
  method: 'Markdown token inspection and Python HTMLParser over local files only',
  semantics: 'Step indicators are heuristics. Their presence does not prove completeness, correctness, usability, or classroom acceptance.',
  nodeVersion: process.version, pythonVersion: null,
  toolSha256: sha(fs.readFileSync(fileURLToPath(import.meta.url))),
  browserUsed: false, networkUsed: false, classroomVerified: false, manualReviewRequired: true,
  errors: [], warnings: [], sources: [], entries: [], referenceChecks: [], designOutputs: {},
};

const sourceNames = fs.readdirSync(sourceDir).filter(name => /^\d\d-.*\.md$/.test(name)).sort();
for (let i = 0; i <= 12; i++) {
  const number = String(i).padStart(2, '0');
  const names = sourceNames.filter(name => name.startsWith(`${number}-`));
  if (names.length !== 1) { report.errors.push({ code: 'CHAPTER_FILE_COUNT', chapter: number, files: names }); continue; }
  const file = path.join(sourceDir, names[0]);
  const content = fs.readFileSync(file, 'utf8');
  const steps = inspectSteps(content);
  if (!steps.length) report.errors.push({ code: 'NO_MAIN_STEPS', file: rel(file) });
  report.sources.push({ file: rel(file), sha256: sha(content), steps });
}
if (sourceNames.length !== 13) report.errors.push({ code: 'EXPECTED_13_CHAPTERS', actual: sourceNames.length });

const cache = new Map();
function htmlAt(file) {
  if (!cache.has(file)) cache.set(file, parseHtml({ page: fs.readFileSync(file, 'utf8') }).page);
  return cache.get(file);
}
for (const entryName of ['index.html', 'walkthroughs/index.html']) {
  const entry = path.join(courseDir, entryName);
  if (!fs.existsSync(entry)) { report.errors.push({ code: 'ENTRY_MISSING', file: entryName }); continue; }
  const html = fs.readFileSync(entry, 'utf8');
  const parsed = htmlAt(entry);
  report.entries.push({ file: entryName, sha256: sha(html), references: parsed.references.length, images: parsed.images.length });
  for (const image of parsed.images) {
    if (!image.src.trim()) report.errors.push({ code: 'EMPTY_IMAGE_SRC', file: entryName, line: image.line });
    if (!image.alt.trim()) report.warnings.push({ code: 'EMPTY_IMAGE_ALT', file: entryName, line: image.line });
  }
  for (const reference of parsed.references) {
    const item = { from: entryName, ...reference };
    try {
      const resolved = resolveReference(entry, reference.value);
      item.kind = resolved.kind;
      if (resolved.kind === 'external-not-requested') { item.status = 'NOT_REQUESTED'; }
      else if (resolved.kind !== 'local') {
        item.status = 'FAIL'; report.errors.push({ code: 'NONPORTABLE_REFERENCE', ...item });
      } else {
        item.target = rel(resolved.target); item.anchor = resolved.anchor || null;
        if (!fs.existsSync(resolved.target)) {
          item.status = 'FAIL'; report.errors.push({ code: 'LOCAL_TARGET_MISSING', ...item });
        } else {
          const stat = fs.statSync(resolved.target);
          item.status = 'PASS';
          if (reference.tag === 'img' && reference.attribute === 'src' && (!stat.isFile() || stat.size === 0)) {
            item.status = 'FAIL'; report.errors.push({ code: 'IMAGE_FILE_EMPTY', ...item });
          }
          if (resolved.anchor && /\.(?:html?|svg)$/i.test(resolved.target)) {
            item.anchorMatches = htmlAt(resolved.target).ids[resolved.anchor] || 0;
            if (item.anchorMatches !== 1) { item.status = 'FAIL'; report.errors.push({ code: 'ANCHOR_NOT_UNIQUE_OR_MISSING', ...item }); }
          } else if (resolved.anchor) report.warnings.push({ code: 'NON_HTML_FRAGMENT_REQUIRES_REVIEW', ...item });
        }
      }
    } catch (error) { item.status = 'FAIL'; report.errors.push({ code: 'REFERENCE_PARSE_FAILED', ...item, message: error.message }); }
    report.referenceChecks.push(item);
  }
}

const designSource = report.sources.find(source => /\/03-/.test(source.file));
const designText = designSource ? fs.readFileSync(path.join(courseDir, designSource.file), 'utf8') : '';
const checklist = designText.split('### 4. 进入编码前，逐个签收11份文件')[1] || '';
const htmlFile = path.join(sourceDir, 'index.html');
const finalHtml = fs.existsSync(htmlFile) ? fs.readFileSync(htmlFile, 'utf8') : '';
report.designOutputs = { expectedCount: 11, files: expectedFiles.map(name => ({ name, inFinalChecklist: checklist.includes(`| ${name} |`), inRenderedSaveOptions: finalHtml.includes(`<option>${name}</option>`) })) };
for (const item of report.designOutputs.files) if (!item.inFinalChecklist || !item.inRenderedSaveOptions) report.errors.push({ code: 'DESIGN_OUTPUT_MISSING', ...item });

const buildFile = path.join(sourceDir, 'build.json');
if (fs.existsSync(buildFile)) {
  const build = JSON.parse(fs.readFileSync(buildFile, 'utf8'));
  for (const source of report.sources) {
    const built = build.sources?.find(item => item.file === path.basename(source.file));
    if (built?.sha256 !== source.sha256) report.errors.push({ code: 'HTML_SOURCE_STALE', file: source.file });
  }
  if (build.sha256 !== sha(finalHtml)) report.errors.push({ code: 'HTML_BUILD_HASH_MISMATCH' });
} else report.errors.push({ code: 'BUILD_METADATA_MISSING', file: rel(buildFile) });

const steps = report.sources.flatMap(source => source.steps.map(step => ({ file: source.file, ...step })));
const reviewSteps = steps.filter(step => step.missing.length);
report.pythonVersion = pythonVersion;
report.summary = { chapters: report.sources.length, steps: steps.length, stepsRequiringReview: reviewSteps.length, errors: report.errors.length, warnings: report.warnings.length, localReferences: report.referenceChecks.filter(item => item.kind === 'local').length };
report.status = report.errors.length ? 'FAIL_STATIC' : reviewSteps.length ? 'REVIEW_REQUIRED' : 'PASS_STATIC';
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: report.status, report: rel(output), ...report.summary, browserUsed: false, networkUsed: false }, null, 2));
process.exitCode = report.errors.length ? 1 : reviewSteps.length ? 2 : 0;
