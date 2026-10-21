import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { courseDir, toolsDir, dependency, dependencyVersion, escapeHtml as esc, option, relativeCourse, assertCoursePath, writeJson } from './runtime.mjs';

const sample = process.argv.includes('--sample');
const strict = process.argv.includes('--strict');
const embed = process.argv.includes('--embed-images');
const input = path.resolve(courseDir, option('--input', sample ? 'tools/fixtures/reader-sample.md' : 'manuscript'));
const output = path.resolve(courseDir, option('--output', sample ? 'illustrations/reader-sample.html' : 'reading/index.html'));
assertCoursePath(input);
assertCoursePath(output);
if (!output.endsWith('.html')) throw new Error('--output 必须以 .html 结尾');
if (output === input) throw new Error('输出不能覆盖 Markdown 源稿');
const { Marked, Renderer } = await dependency('marked');
const markdown = new Marked({ gfm: true });
const warnings = [];
const errors = [];
const figureList = [];
const references = [];
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
const documents = files.map((file, index) => {
  const source = fs.readFileSync(file, 'utf8');
  const frontmatter = source.match(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/)?.[0] || '';
  const content = source.slice(frontmatter.length);
  const chapter = path.dirname(file) === input && fs.statSync(input).isDirectory() ? path.basename(file).match(/^(\d{2})/)[1] : null;
  const id = sample ? 'sample' : chapter ? `chapter-${chapter}` : `preface-${index + 1}`;
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
  return { file, source, content, frontmatterRemoved: !!frontmatter, sha256: hash(source), id, chapter, headings, title: headings.find(h => h.depth === 1)?.text || path.basename(file, '.md'), images: [] };
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
    return { href: target };
  }
  const relative = path.relative(courseDir, file);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    warnings.push(`需原项目的参考链接：${href}`);
    return { href: urlRelative(file) + (rawFragment ? `#${encodeURIComponent(rawFragment)}` : ''), projectReference: true };
  }
  if (!fs.existsSync(file)) errors.push(`${doc.title}: 本地链接缺失 ${href}`);
  return { href: urlRelative(file) + (rawFragment ? `#${encodeURIComponent(rawFragment)}` : '') };
}

const sections = documents.map(doc => {
  const renderer = new Renderer();
  let headingIndex = 0;
  renderer.heading = function(token) {
    const heading = doc.headings[headingIndex++];
    return `<h${token.depth} id="${esc(heading.id)}">${this.parser.parseInline(token.tokens)}</h${token.depth}>\n`;
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
    return `<a href="${esc(target.href)}"${target.external ? ' target="_blank" rel="noopener"' : ''}>${this.parser.parseInline(token.tokens)}</a>${target.projectReference ? '<span class="source-note">需原项目</span>' : ''}`;
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
    return Renderer.prototype.code.call(this, token);
  };
  const body = markdown.parse(doc.content, { renderer });
  if (strict && doc.chapter) {
    const matching = new Set(doc.images.filter(f => f.stem.startsWith(`ch${doc.chapter}-`)).map(f => f.stem));
    if (matching.size < 3) errors.push(`第 ${doc.chapter} 章至少需要 3 幅独立 ch${doc.chapter}-* PNG，当前 ${matching.size} 幅`);
    for (const image of doc.images) if (!image.stem.startsWith(`ch${doc.chapter}-`)) warnings.push(`第 ${doc.chapter} 章引用了公共或其他章图片 ${image.stem}，不计入该章三幅图`);
  }
  return `<section class="chapter" aria-label="${esc(doc.title)}"><p class="chapter-meta">${sample ? '版式样张' : doc.chapter ? `第 ${doc.chapter} 章 · 图文初稿` : '阅读前言'} · 实验未验证</p>${body}<p class="chapter-footer"><a href="#contents">返回目录</a> · 源稿：${esc(relativeCourse(doc.file))}</p></section>`;
});

for (const doc of documents) if (hash(fs.readFileSync(doc.file, 'utf8')) !== doc.sha256) errors.push(`生成期间源稿变化，请重新生成：${relativeCourse(doc.file)}`);
for (const reference of references) if (!allAnchors.has(reference.target.slice(1))) errors.push(`内部链接目标缺失：${reference.target}`);
if (errors.length) throw new Error('阅读版未写出，请先修正：\n- ' + errors.join('\n- '));
const css = fs.readFileSync(path.join(toolsDir, 'reader.css'), 'utf8');
const title = sample ? '公共图与阅读版样张' : 'AI 编程——以智慧校园平台重建为例';
const subtitle = sample ? '图文制作准备 · 仅展示统一配图与阅读版式' : `48 学时 · 12 章 · 当前汇入 ${chapterNumbers.length} 章`;
const status = sample ? '此页为第一阶段排版样张，包含两幅公共示意图。它不是 12 章教材成稿，不代表教学工程、实验或试讲已验证。' : '本版为图文教材初稿。拟定教学工程与实验步骤仍待制作、实测和试讲；教学示意及预期结果均不代表实际运行证据。';
const toc = documents.map(doc => `<li><a href="#${esc(doc.headings[0]?.id || doc.id)}">${esc(doc.title)}</a></li>`).join('');
const figureIndex = figureList.map(f => `<li><a href="#${esc(f.id)}">${esc(f.caption)}</a></li>`).join('');
const html = `<!doctype html>\n<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="智慧校园 AI 编程课程图文初稿，教学示意与运行证据明确分开。"><title>${esc(title)}</title><style>${css}</style></head><body id="book-top"><a class="skip-link" href="#book-main">跳到正文</a><div class="book-shell"><nav class="book-nav" aria-label="阅读目录" id="contents"><details open><summary>阅读目录</summary><p class="nav-meta">${esc(subtitle)}</p><ol>${toc}<li><a href="#figure-index">图表目录（${figureList.length} 幅）</a></li></ol><p class="nav-meta">${embed ? '点击图片保存 PNG 大图。' : '点击图片打开大图。'}<br>可使用浏览器的打印功能。</p></details></nav><main class="book-main" id="book-main"><header class="book-cover"><p class="eyebrow">AI 编程 · 智慧校园</p><h1>${esc(title)}</h1><p class="deck">${esc(subtitle)}</p><div class="status-note"><p>${esc(status)}</p></div></header>${sections.join('\n')}<section class="figure-index" id="figure-index"><h2>图表目录</h2><p>图像均为教学示意；PNG 供直接阅读，SVG 保留矢量文字与图形。</p><ol>${figureIndex}</ol></section><footer class="book-footer">版本状态：${sample ? 'ILLUSTRATION_PREPARATION' : 'DRAFT_WRITTEN'} · lab_verified=false。此状态不因图文渲染成功而改变。</footer></main></div><a class="back-to-top" href="#contents">回到目录</a></body></html>\n`;
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, html);
writeJson(output.replace(/\.html$/, '.build.json'), { schemaVersion: 1, generatedAt: new Date().toISOString(), output: relativeCourse(output), sha256: hash(html), mode: sample ? 'SAMPLE_ONLY' : strict ? 'BOOK_STRICT' : 'BOOK_PARTIAL', embeddedImages: embed, chapters: chapterNumbers.length, figures: figureList.length, dependency: { marked: dependencyVersion('marked') }, labVerified: false, documents: documents.map(({ source, content, file, ...rest }) => ({ file: relativeCourse(file), ...rest })), warnings });
console.log(`${relativeCourse(output)}：${chapterNumbers.length} 章，${figureList.length} 幅图，${embed ? '图片内嵌' : '图片相对引用'}。${sample ? '仅为排版样张。' : ''}`);
for (const warning of warnings) console.warn(`提示：${warning}`);
