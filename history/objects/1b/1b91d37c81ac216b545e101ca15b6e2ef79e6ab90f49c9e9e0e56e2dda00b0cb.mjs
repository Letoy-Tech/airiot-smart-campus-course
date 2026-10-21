import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { courseDir, toolsDir, dependency, escapeHtml as esc, writeJson } from './runtime.mjs';

const root = path.join(courseDir, 'walkthroughs');
const { Marked, Renderer } = await dependency('marked');
const markdown = new Marked({ gfm: true });
const specs = [
  ['00-第一次用AI做项目.md', '00', '先学会操作和保存'],
  ['01-从想法到项目任务书.md', '01', '从想法到任务书'],
  ['02-从项目任务书到需求规格.md', '02', '从任务书到需求'],
  ['03-从需求规格到系统设计.md', '03', '从需求到系统设计'],
  ['04-安装工具与第一次改代码.md', '04', '安装与第一次改代码'],
  ['05-后端空间与设备接口.md', '05', '后端与空间绑定'],
  ['06-设备台账与自主UI.md', '06', '设备台账与界面'],
  ['07-监测历史与数据质量.md', '07', '监测与数据质量'],
  ['08-登录权限与失败排查.md', '08', '登录与权限排查'],
  ['09-演练事件与关闭规则.md', '09', '事件处置与关闭'],
  ['10-设备责任与时间线.md', '10', '设备责任与时间线'],
  ['11-调试测试与证据.md', '11', '调试测试与证据'],
  ['12-构建交付与接力.md', '12', '构建交付与接力'],
];
const filenames = ['00-保存练习.md','01-项目想法.md','02-范围确认.md','03-项目任务书.md','04-角色与场景.md','05-验收条件.md','06-异常与优先级.md','07-需求规格.md','08-页面与流程.md','09-数据字典.md','10-接口约定.md','11-开发任务.md'];
const sources = [];
let block = 0;
const nav = [];
const docs = specs.map(([file, part, label]) => {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  sources.push({ file, sha256: crypto.createHash('sha256').update(source).digest('hex') });
  const renderer = new Renderer();
  let n = 0;
  const heads = [];
  renderer.heading = function(t) {
    const id = t.depth === 1 ? `part-${part}` : `part-${part}-h${++n}`;
    if (t.depth === 2) heads.push({ id, text: t.text });
    return `<h${t.depth} id="${id}">${this.parser.parseInline(t.tokens)}</h${t.depth}>`;
  };
  renderer.code = function(t) {
    const id = `copy-${++block}`;
    const lang = t.lang || 'text';
    const sample = ['markdown', 'json', 'http', 'tree', 'output'].includes(lang) || /^\d+\. 哪些人|^本次必做：|^01-项目想法/.test(t.text);
    const command=['sh','bash','powershell','shell'].includes(lang) || lang==='text' && /^(?:node |npm(?:\.cmd)? |git |export |\$env:|cd |sh |java )/.test(t.text.trim());
    const filepath=lang==='text' && /^(?:backend|frontend|evidence|tools|docs)\/[^\n]+$/.test(t.text.trim());
    const program=['typescript','ts','javascript','js','java','vue','css','html','sql'].includes(lang);
    const label = filepath ? '文件路径 · 在编辑器中打开' : command ? '终端命令 · 在正文指定目录执行' : program ? '代码 · 按本步说明粘贴或替换' : sample ? '教学示例 · 供对照' : '发给 AI 的提示词';
    const button = filepath ? '复制路径' : command ? '复制命令' : program ? '复制代码' : sample ? '复制示例' : '复制提示词';
    return `<div class="copybox ${sample || command || program || filepath ? 'sample' : 'prompt'}"><div class="boxhead"><strong>${label}</strong><button type="button" data-copy="${id}" data-kind="${filepath ? 'path' : command ? 'command' : program ? 'code' : sample ? 'sample' : 'prompt'}">${button}</button></div><pre><code id="${id}">${esc(t.text)}</code></pre></div>`;
  };
  renderer.table = function(t) { return `<div class="table-wrap">${Renderer.prototype.table.call(this,t)}</div>`; };
  renderer.link = function(t) {
    if (/^https?:/.test(t.href)) return `<a href="${esc(t.href)}" target="_blank" rel="noopener">${this.parser.parseInline(t.tokens)}</a>`;
    const target=specs.find(s=>s[0]===decodeURIComponent(t.href));
    if(target)return `<a href="#part-${target[1]}">${this.parser.parseInline(t.tokens)}</a>`;
    return `<a href="${esc(t.href)}">${this.parser.parseInline(t.tokens)}</a>`;
  };
  renderer.image = function(t) {
    const img = path.resolve(root, t.href);
    if (!img.startsWith(courseDir + path.sep) || !fs.existsSync(img)) throw new Error(`缺图：${t.href}`);
    return `<a class="figure" href="${esc(t.href)}" target="_blank"><img src="${esc(t.href)}" alt="${esc(t.text)}" loading="lazy"></a>`;
  };
  const body = markdown.parse(source, { renderer });
  nav.push(`<li><a class="part-link" href="#part-${part}"><span>${part}</span>${label}</a><ol>${heads.map(h=>`<li><a href="#${h.id}">${esc(h.text)}</a></li>`).join('')}</ol></li>`);
  const idx = specs.findIndex(s=>s[0]===file);
  const next = specs[idx+1];
  return `<section class="part" aria-label="${esc(label)}">${body}<div class="end-part"><a href="${encodeURIComponent(file)}" download>下载本篇 Markdown 源稿</a>${next ? `<a class="primary-link" href="#part-${next[1]}">下一篇：${next[2]} →</a>` : '<a class="primary-link" href="../reading/index.html">返回原课程资料 →</a>'}</div></section>`;
});
const css = fs.readFileSync(path.join(toolsDir,'walkthrough.css'),'utf8');
const js = fs.readFileSync(path.join(toolsDir,'walkthrough.js'),'utf8');
const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>从零跟做到交付 · AI 编程手把手教程</title><style>${css}</style></head><body>
<div style="padding:12px 24px;background:#f3eee3">这是旧版网页AI详细带做。当前学生用CodeBuddy：<a href="../journey/index.html">转到新版项目主线</a>。</div><a class="skip" href="#main">跳到正文</a><header class="toolbar"><a href="#top" class="brand">AI 编程 <span>智慧校园 · 完整带做</span></a><div><a href="../reading/index.html" class="old-reader">原课程</a><button id="open-saver" type="button">保存 AI 回答</button></div></header>
<div class="layout" id="top"><aside><nav aria-label="跟做目录"><p class="nav-title">按顺序，每次做一步</p><ol class="toc">${nav.join('')}</ol></nav></aside><main id="main"><div class="hero"><p class="eyebrow">零项目经验也能开始</p><h1>从第一句话，<br>到一个能交付的项目。</h1><p class="lead">打开网页、复制提示词、检查回答、保存文件。<br>用同一个智慧校园工程，走完构思、设计、编码、调试、测试和交付。</p><div class="hero-actions"><a class="primary-link" href="#part-00">从第 00 步开始 →</a><a href="#part-01">已经会保存？直接做项目</a></div><p class="scope">00—12 共 13 篇带做：先完成设计，再持续修改同一份 app。<br>网页 AI 提供建议，你保存代码、执行命令并记录实际结果。</p><div class="milestones"><span><b>00—03</b>操作、构思与设计</span><span><b>04—10</b>编码与业务验证</span><span><b>11—12</b>调试、测试与交付</span></div></div>${docs.join('')}<footer>编辑源稿位于 walkthroughs/ · 本地离线阅读，访问 AI 网页时需要联网。<br>修改 Markdown 后运行 tools/build-walkthrough.mjs 重建本页。</footer></main></div>
<dialog id="saver" aria-labelledby="saver-title"><div class="dialog-head"><h2 id="saver-title">保存 AI 回答</h2><button id="close-saver" type="button">关闭</button></div><p class="helper">粘贴你检查过的回答 → 下载 → 放进桌面 campus-ai-lab/docs。<br>只在本机处理。未下载的内容会在刷新页面后丢失。</p><label for="filename">文件名</label><select id="filename">${filenames.map(f=>`<option>${f}</option>`).join('')}</select><label for="answer">AI 回答全文</label><textarea id="answer" rows="11" placeholder="在这里粘贴 AI 回答；不会替你自动填入参考答案。" spellcheck="false"></textarea><div class="save-actions"><button id="download-md" type="button">下载这个 .md 文件</button><button id="copy-answer" type="button">复制当前全文</button><label class="file-button" for="import-md">打开已有 .md 文件</label><input id="import-md" type="file" accept=".md,.txt,text/plain,text/markdown"></div><p id="save-status" role="status" aria-live="polite">还没有下载文件。</p></dialog><div id="copy-status" role="status" aria-live="polite" class="toast"></div><script>${js}</script></body></html>`;
fs.writeFileSync(path.join(root,'index.html'),html);
writeJson(path.join(root,'build.json'), { generatedAt:new Date().toISOString(), sources, sha256:crypto.createHash('sha256').update(html).digest('hex'), files:filenames, codeBlocks:block, labVerified:false, modelSessionExecuted:false });
console.log(`walkthroughs/index.html: ${specs.length} 篇，${filenames.length-1} 份项目产物，${block} 个可复制块`);
