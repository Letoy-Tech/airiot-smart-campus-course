import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { courseDir, toolsDir, dependency, dependencyVersion, escapeHtml as esc, option, relativeCourse, assertCoursePath, writeJson } from './runtime.mjs';

const sample = process.argv.includes('--sample');
const strict = process.argv.includes('--strict');
const embed = process.argv.includes('--embed-images');
const includeResources = !sample || process.argv.includes('--include-resources');
const version = 'V0.3 · 第二轮修订';
const input = path.resolve(courseDir, option('--input', sample ? 'tools/fixtures/reader-sample.md' : 'manuscript'));
const output = path.resolve(courseDir, option('--output', sample ? 'illustrations/qa/round2-sample/reader-sample.html' : 'reading/index.html'));
assertCoursePath(input);
assertCoursePath(output);
if (!output.endsWith('.html')) throw new Error('--output 必须以 .html 结尾');
if (output === input) throw new Error('输出不能覆盖 Markdown 源稿');
if (/V0\.2/.test(path.basename(output))) throw new Error('V0.2 阅读版属于保留证据，请使用 V0.3 输出文件名');
const { Marked, Renderer } = await dependency('marked');
const markdown = new Marked({ gfm: true });
const warnings = [];
const errors = [];
const figureList = [];
const references = [];
const dependencies = [];
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const slug = value => value.normalize('NFKC').toLowerCase().replace(/<[^>]*>/g, '').replace(/\s+/g, '-').replace(/[^\p{L}\p{N}_-]/gu, '');
const urlRelative = file => path.relative(path.dirname(output), file).split(path.sep).map(encodeURIComponent).join('/');
let files = fs.statSync(input).isDirectory()
  ? fs.readdirSync(input).filter(n => /^(0[1-9]|1[0-2])[-－—_].*\.md$/.test(n)).sort().map(n => path.join(input, n))
  : [input];
if (!files.length) throw new Error('没有正文；第一阶段使用 --sample，整书应等待 12 章正式交稿');
if (!sample) {
  const intro = path.join(courseDir, '07-图文初稿阅读指南.md');
  if (fs.existsSync(intro)) files.unshift(intro);
  else warnings.push('未找到 07-图文初稿阅读指南.md，未加入前言');
}
const resourceSpecs = [
  ['course-outline', '01-课程大纲.md'],
  ['api-contract', 'contracts/教学接口约定.md'],
  ['assessment', '04-考核与验收.md'],
  ['class-workload', 'appendices/48学时实施分工.md'],
  ['class-task', 'templates/课堂任务单.md'],
  ['ai-task', 'templates/AI任务卡.md'],
  ['ai-handoff', 'templates/AI接力包.md'],
  ['traceability', 'templates/需求与测试追踪表.md'],
  ['web-ai', 'appendices/Qwen与网页工具说明.md'],
  ['teacher-resources', 'appendices/教师资源制作清单.md', 'teacher'],
].map(([id, file, audience = 'student']) => ({ id: `resource-${id}`, file: path.join(courseDir, file), audience }));
const resourcesByFile = new Map((includeResources ? resourceSpecs : []).map(r => [r.file, r]));
for (const resource of resourcesByFile.values()) {
  if (!fs.existsSync(resource.file)) throw new Error(`常用资料不存在：${relativeCourse(resource.file)}`);
  files.push(resource.file);
}
const documents = files.map((file, index) => {
  const source = fs.readFileSync(file, 'utf8');
  const frontmatter = source.match(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/)?.[0] || '';
  const content = source.slice(frontmatter.length);
  const resource = resourcesByFile.get(file);
  const chapter = !resource && path.dirname(file) === input && fs.statSync(input).isDirectory() ? path.basename(file).match(/^(\d{2})/)[1] : null;
  const id = resource?.id || (sample ? 'sample' : chapter ? `chapter-${chapter}` : `preface-${index + 1}`);
  const tokens = markdown.lexer(content);
  const headings = [];
  const counts = new Map();
  for (const token of tokens) {
    if (token.type !== 'heading') continue;
    const base = slug(token.text);
    const occurrence = (counts.get(base) || 0) + 1;
    counts.set(base, occurrence);
    const anchor = token.depth === 1 && !headings.length ? id : `${id}-${base}${occurrence > 1 ? `-${occurrence}` : ''}`;
    headings.push({ text: token.text, depth: token.depth, slug: base, id: anchor });
  }
  let sectionHeading;
  let sectionIndex = 0;
  for (const token of tokens) {
    if (token.type === 'heading') sectionHeading = headings[sectionIndex++];
    else if (sectionHeading && token.type === 'table' && /待执行验收|验收项|核验项/.test(token.header.map(cell => cell.text).join(' '))) sectionHeading.containsAcceptance = true;
    else if (sectionHeading && token.type === 'paragraph' && /交给第\s*\d+\s*章|最终交付项目包/.test(token.text)) sectionHeading.containsHandoff = true;
  }
  return { file, source, content, frontmatterRemoved: !!frontmatter, sha256: hash(source), id, chapter, resource: !!resource, audience: resource?.audience, headings, title: headings.find(h => h.depth === 1)?.text || path.basename(file, '.md'), images: [] };
});
const chapterNumbers = documents.filter(d => d.chapter).map(d => d.chapter);
if (strict && !sample && (chapterNumbers.length !== 12 || new Set(chapterNumbers).size !== 12)) errors.push(`严格整书模式需要 01—12 章各一份，当前收到 ${chapterNumbers.join('、') || '0 章'}`);
const byFile = new Map(documents.map(d => [d.file, d]));
const allAnchors = new Set(['book-top', 'contents', 'book-main', 'figure-index', ...documents.flatMap(d => d.headings.map(h => h.id))]);

function findFigureMeta(stem) {
  for (const dir of ['figure-sources', 'figure-sources/shared']) {
    const file = path.join(courseDir, dir, `${stem}.figure.json`);
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  }
  return null;
}

function imageInfo(token, doc) {
  if (/^(?:[a-z]+:|\/\/)/i.test(token.href)) throw new Error(`${doc.title}: 图片必须为本地 PNG，不能依赖网络`);
  const file = path.resolve(path.dirname(doc.file), decodeURIComponent(token.href.split('#')[0]));
  assertCoursePath(file);
  const illustrationRoot = path.join(courseDir, 'illustrations') + path.sep;
  if (!file.startsWith(illustrationRoot) || !file.endsWith('.png')) throw new Error(`${doc.title}: 正文配图必须引用 illustrations/ 下的 PNG：${token.href}`);
  if (!fs.existsSync(file)) throw new Error(`${doc.title}: 图片缺失 ${token.href}`);
  const bytes = fs.readFileSync(file);
  if (bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error(`PNG 格式无效：${file}`);
  const stem = path.basename(file, '.png');
  const meta = findFigureMeta(stem);
  const alt = token.text.trim();
  if (alt.length < 10 || alt === stem) errors.push(`${stem}: 请写明图的主要内容，替代文字不能只有文件名或图号`);
  const caption = meta?.caption || token.title || alt;
  const id = `fig-${stem}`;
  if (allAnchors.has(id)) errors.push(`${stem}: 重复插入同一幅图`);
  allAnchors.add(id);
  const svg = file.replace(/\.png$/, '.svg');
  if (!fs.existsSync(svg)) errors.push(`${stem}: 缺少配套 SVG`);
  const record = { id, chapter: doc.chapter, stem, alt, caption, file: relativeCourse(file), pngSha256: hash(bytes), width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  doc.images.push(record);
  figureList.push(record);
  return { ...record, src: embed ? `data:image/png;base64,${bytes.toString('base64')}` : urlRelative(file), svgHref: fs.existsSync(svg) ? (embed ? `data:image/svg+xml;base64,${fs.readFileSync(svg).toString('base64')}` : urlRelative(svg)) : null };
}

function makeFigure(token, doc) {
  const f = imageInfo(token, doc);
  const pngAction = embed ? `download="${esc(f.stem)}.png"` : 'target="_blank" rel="noopener"';
  const svgAction = embed ? `download="${esc(f.stem)}.svg"` : 'target="_blank" rel="noopener"';
  return `<figure id="${esc(f.id)}"><a class="figure-open" href="${esc(f.src)}" ${pngAction} aria-label="${embed ? '保存' : '打开'}大图：${esc(f.alt)}"><img src="${esc(f.src)}" alt="${esc(f.alt)}" width="${f.width}" height="${f.height}" decoding="async"></a><figcaption><span class="figure-badge">教学示意</span>${esc(f.caption)}</figcaption><div class="figure-tools"><a href="${esc(f.src)}" ${pngAction}>${embed ? '保存' : '打开'} PNG 大图</a>${f.svgHref ? `<a href="${esc(f.svgHref)}" ${svgAction}>${embed ? '保存' : '查看'} SVG 矢量图</a>` : ''}</div></figure>\n`;
}

function linkTarget(href, doc) {
  if (/^https?:\/\//i.test(href)) return { href, external: true };
  if (/^[a-z]+:/i.test(href) || href.startsWith('//')) throw new Error(`不支持的链接协议：${href}`);
  const [rawPath, rawFragment = ''] = href.split('#');
  const file = rawPath ? path.resolve(path.dirname(doc.file), decodeURIComponent(rawPath)) : doc.file;
  if (file.split(path.sep).includes('.private')) throw new Error('阅读版不得引用 .private');
  const targetDoc = byFile.get(file);
  if (targetDoc) {
    const fragment = decodeURIComponent(rawFragment);
    const match = !fragment ? targetDoc.headings[0] : targetDoc.headings.find(h => h.slug === slug(fragment) || h.id === fragment);
    if (!match) errors.push(`${doc.title}: 章节锚点不存在：${href}`);
    const target = `#${match?.id || targetDoc.id}`;
    references.push({ from: doc.id, target });
    return { href: target, kind: 'reader-section' };
  }
  const relative = path.relative(courseDir, file);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    warnings.push(`需原项目的参考链接：${href}`);
    dependencies.push({ from: doc.id, target: href, kind: 'original-project' });
    return { href: urlRelative(file) + (rawFragment ? `#${encodeURIComponent(rawFragment)}` : ''), kind: 'original-project', dependencyLabel: '需原项目' };
  }
  if (!fs.existsSync(file)) errors.push(`${doc.title}: 本地链接缺失 ${href}`);
  dependencies.push({ from: doc.id, target: relativeCourse(file), kind: 'course-package' });
  return { href: urlRelative(file) + (rawFragment ? `#${encodeURIComponent(rawFragment)}` : ''), kind: 'course-package', dependencyLabel: '需完整资料包' };
}

function sectionNavigation(doc) {
  const headings = doc.headings.filter(h => doc.resource
    ? h.depth === 2
    : h.depth > 1 && (/本章任务卡|模块[一二三123]|最小实验|验收|课后|练习|接力|交给下一章|下一章/.test(h.text) || h.containsAcceptance || h.containsHandoff));
  if (!headings.length) return '';
  const label = doc.resource ? '资料内定位' : '本章定位';
  const links = headings.map(h => {
    const note = [h.containsAcceptance && !/验收|核验/.test(h.text) ? '验收' : '', h.containsHandoff && !/交给|接力/.test(h.text) ? '接力' : ''].filter(Boolean);
    return `<li><a href="#${esc(h.id)}">${esc(h.text)}${note.length ? `（含${note.join('、')}）` : ''}</a></li>`;
  }).join('');
  return `<nav class="chapter-nav" aria-label="${label}：${esc(doc.title)}"><details${doc.resource ? '' : ' data-desktop-open'}><summary>${label}<span class="nav-hint">展开后选择本次内容</span></summary><ul>${links}</ul></details></nav>`;
}

const sections = documents.map(doc => {
  const renderer = new Renderer();
  let headingIndex = 0;
  let currentHeading = '';
  let codeIndex = 0;
  renderer.heading = function(token) {
    const heading = doc.headings[headingIndex++];
    currentHeading = token.text;
    return `<h${token.depth} id="${esc(heading.id)}">${this.parser.parseInline(token.tokens)}</h${token.depth}>\n${headingIndex === 1 ? sectionNavigation(doc) : ''}`;
  };
  renderer.paragraph = function(token) {
    const meaningful = token.tokens.filter(t => t.type !== 'text' || t.text.trim());
    if (meaningful.length === 1 && meaningful[0].type === 'image') return makeFigure(meaningful[0], doc);
    // Markdown retains a readable caption; HTML already supplies it in figcaption.
    if (meaningful.length === 1 && meaningful[0].type === 'em' && /^图\s*\d{2}-\d{2}\s/.test(meaningful[0].text) && /教学.*示意/.test(meaningful[0].text)) return '';
    return `<p>${this.parser.parseInline(token.tokens)}</p>\n`;
  };
  renderer.image = function(token) {
    errors.push(`${doc.title}: 图片必须独占一个 Markdown 段落，以便生成图注`);
    const f = imageInfo(token, doc);
    return `<img src="${esc(f.src)}" alt="${esc(f.alt)}" width="${f.width}" height="${f.height}">`;
  };
  renderer.link = function(token) {
    const target = linkTarget(token.href, doc);
    return `<a href="${esc(target.href)}"${target.external ? ' target="_blank" rel="noopener"' : ''}${target.kind ? ` data-link-kind="${target.kind}"` : ''}>${this.parser.parseInline(token.tokens)}</a>${target.dependencyLabel ? `<span class="source-note">${target.dependencyLabel}</span>` : ''}`;
  };
  renderer.html = function(token) {
    if (/^\s*<!--[\s\S]*-->\s*$/.test(token.text)) return '';
    if (/^<\/?(?:br|sub|sup|kbd)\s*\/?\s*>$/i.test(token.text)) return token.text;
    warnings.push(`${doc.title}: 原始 HTML 已显示为文字，请改用 Markdown`);
    return esc(token.text);
  };
  renderer.table = function(token) { return `<div class="table-scroll">${Renderer.prototype.table.call(this, token)}</div>`; };
  renderer.code = function(token) {
    if (/^(mermaid|plantuml)$/i.test(token.lang?.trim() || '')) errors.push(`${doc.title}: 正文仍有未渲染的 ${token.lang} 图代码块`);
    const lang = (token.lang || 'text').trim().split(/\s+/)[0].toLowerCase();
    const prose = ['text', 'txt', ''].includes(lang) && /\p{Script=Han}/u.test(token.text);
    const prompt = prose && /AI|提示|网页|助教|模型/.test(currentHeading + token.text.slice(0,120));
    const language = ({ ts: 'TypeScript', typescript: 'TypeScript', js: 'JavaScript', javascript: 'JavaScript', vue: 'Vue', html: 'HTML', java: 'Java', sh: 'Shell', bash: 'Shell', powershell: 'PowerShell', json: 'JSON', http: 'HTTP', sql: 'SQL', text: '文本', txt: '文本' })[lang] || lang;
    const purpose = prompt ? '网页 AI 提示' : prose ? '文本示例' : ['text','txt'].includes(lang) ? '文本 / 结构示例' : lang === 'json' ? '数据示例' : lang === 'http' ? '请求示例' : ['sh','bash','powershell'].includes(lang) ? '命令示例 · 条件见正文' : '教学代码 · 用途见正文';
    const id = `${doc.id}-code-${++codeIndex}`;
    return `<div class="code-example${prose ? ' prose-example' : ''}" data-language="${esc(lang)}" data-purpose="${esc(purpose)}"><div class="code-label" id="${id}"><span>${esc(purpose)}</span><span>${esc(language)}${prose ? ' · 自动折行' : ' · 可左右滚动'}</span></div><pre${prose ? '' : ' tabindex="0"'} aria-labelledby="${id}"><code class="language-${esc(lang)}">${esc(token.text)}\n</code></pre></div>\n`;
  };
  const body = markdown.parse(doc.content, { renderer });
  if (strict && doc.chapter) {
    const matching = new Set(doc.images.filter(f => f.stem.startsWith(`ch${doc.chapter}-`)).map(f => f.stem));
    if (matching.size < 3) errors.push(`第 ${doc.chapter} 章至少需要 3 幅独立 ch${doc.chapter}-* PNG，当前 ${matching.size} 幅`);
    for (const image of doc.images) if (!image.stem.startsWith(`ch${doc.chapter}-`)) warnings.push(`第 ${doc.chapter} 章引用了公共或其他章图片 ${image.stem}，不计入该章三幅图`);
  }
  return `<section class="chapter${doc.resource ? ' resource-section' : ''}" data-document="${doc.id}" aria-label="${esc(doc.title)}"><p class="chapter-meta">${doc.resource ? '常用资料 · ' + (doc.audience === 'teacher' ? '教师资源' : '学习资料') : sample ? '版式样张' : doc.chapter ? `第 ${doc.chapter} 章 · 图文初稿` : '阅读前言'} · 实验未验证</p>${body}<p class="chapter-footer"><a href="#contents">返回阅读目录</a>${doc.resource ? ' · <a href="#resource-contents">返回资料目录</a>' : ''} · 源稿：${esc(relativeCourse(doc.file))}</p></section>`;
});

for (const doc of documents) if (hash(fs.readFileSync(doc.file, 'utf8')) !== doc.sha256) errors.push(`生成期间源稿变化，请重新生成：${relativeCourse(doc.file)}`);
for (const reference of references) if (!allAnchors.has(reference.target.slice(1))) errors.push(`内部链接目标缺失：${reference.target}`);
if (errors.length) throw new Error('阅读版未写出，请先修正：\n- ' + errors.join('\n- '));
const css = fs.readFileSync(path.join(toolsDir, 'reader.css'), 'utf8');
const title = sample ? 'V0.3 阅读器验证样张' : 'AI 编程——以智慧校园平台重建为例';
const subtitle = sample ? '第二轮阅读器样张 · 导航、示例与资料入口检查' : `48 学时 · 12 章 · 当前汇入 ${chapterNumbers.length} 章`;
const status = sample ? `此页为阅读器验证样张，包含 ${figureList.length} 幅已有教学示意图。它不是整书成稿，不代表教学工程、实验或试讲已验证。` : '本版为图文教材初稿。拟定教学工程与实验步骤仍待制作、实测和试讲；教学示意及预期结果均不代表实际运行证据。';
const toc = documents.filter(doc => !doc.resource).map(doc => `<li><a href="#${esc(doc.headings[0]?.id || doc.id)}">${esc(doc.title)}</a></li>`).join('');
const resourceNav = ['student', 'teacher'].map(audience => {
  const docs = documents.filter(d => d.resource && d.audience === audience);
  if (!docs.length) return '';
  return `<details class="resource-nav"${audience === 'student' ? ' id="resource-contents"' : ''}><summary>${audience === 'teacher' ? '教师资料' : '常用资料'}（${docs.length}）</summary><ul>${docs.map(d => `<li><a href="#${esc(d.id)}">${esc(d.title)}</a></li>`).join('')}</ul></details>`;
}).join('');
const readerScript = `<script>document.querySelectorAll('[data-desktop-open]').forEach(function(el){el.open=window.matchMedia('(min-width:901px)').matches});document.addEventListener('click',function(event){var a=event.target.closest('a[href^="#"]');if(!a)return;var id=decodeURIComponent(a.getAttribute('href').slice(1));var target=document.getElementById(id);if(target){for(var p=target.parentElement;p;p=p.parentElement){if(p.tagName==='DETAILS')p.open=true}if(target.tagName==='DETAILS')target.open=true}});</script>`;
const figureIndex = figureList.map(f => `<li><a href="#${esc(f.id)}">${esc(f.caption)}</a></li>`).join('');
const html = `<!doctype html>\n<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="智慧校园 AI 编程课程图文初稿，教学示意与运行证据明确分开。"><title>${esc(title)} · ${version}</title><style>${css}</style></head><body id="book-top"><a class="skip-link" href="#book-main">跳到正文</a><div class="book-shell"><nav class="book-nav" aria-label="阅读目录" id="contents"><details class="main-toc" data-desktop-open><summary>阅读目录${sample ? '（样张）' : '（12 章）'}</summary><p class="nav-meta">${esc(subtitle)}</p><ol>${toc}<li><a href="#figure-index">图表目录（${figureList.length} 幅）</a></li></ol></details>${resourceNav}<p class="nav-meta">${embed ? '点击图片保存 PNG 大图。' : '点击图片打开大图。'}</p></nav><main class="book-main" id="book-main"><header class="book-cover"><p class="eyebrow">AI 编程 · 智慧校园</p><h1>${esc(title)}</h1><p class="deck">${esc(subtitle)}</p><p class="version-label">${version}</p><div class="status-note"><p>${esc(status)}</p></div><p class="reader-help">${includeResources ? '常用资料已编入本页，可通过资料目录打开。' : ''}${embed ? '正文、样式与配图已内嵌。' : ''}标注“需完整资料包”或“需原项目”的链接依赖其他文件；外部网站需要网络。</p></header>${sections.join('\n')}<section class="figure-index" id="figure-index"><h2>图表目录</h2><p>图像均为教学示意；PNG 供直接阅读，SVG 保留矢量文字与图形。</p><ol>${figureIndex}</ol></section><footer class="book-footer">${version} · 版本状态：${sample ? 'ILLUSTRATION_PREPARATION' : 'DRAFT_WRITTEN'} · lab_verified=false。此状态不因图文渲染成功而改变。</footer></main></div><a class="back-to-top" href="#contents">回到目录</a>${readerScript}</body></html>\n`;
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, html);
writeJson(output.replace(/\.html$/, '.build.json'), { schemaVersion: 2, version, generatedAt: new Date().toISOString(), output: relativeCourse(output), sha256: hash(html), mode: sample ? 'SAMPLE_ONLY' : strict ? 'BOOK_STRICT' : 'BOOK_PARTIAL', embeddedImages: embed, chapters: chapterNumbers.length, figures: figureList.length, resources: documents.filter(d => d.resource).length, dependency: { marked: dependencyVersion('marked') }, labVerified: false, documents: documents.map(({ source, content, file, ...rest }) => ({ file: relativeCourse(file), ...rest })), fileDependencies: dependencies, warnings });
console.log(`${relativeCourse(output)}：${chapterNumbers.length} 章，${figureList.length} 幅图，${embed ? '图片内嵌' : '图片相对引用'}。${sample ? '仅为排版样张。' : ''}`);
for (const warning of warnings) console.warn(`提示：${warning}`);
