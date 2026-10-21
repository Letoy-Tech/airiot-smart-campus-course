import fs from 'node:fs';
import path from 'node:path';
import { courseDir, dependency, escapeHtml as esc } from './runtime.mjs';
const root = path.join(courseDir, 'resources');
const project = path.join(root, 'campus-ai-course');
const catalog = JSON.parse(fs.readFileSync(path.join(project, 'fixtures/catalog.json'), 'utf8'));
const quality = JSON.parse(fs.readFileSync(path.join(project, 'fixtures/quality-cases.json'), 'utf8'));
const history = JSON.parse(fs.readFileSync(path.join(project, 'fixtures/history-cases.json'), 'utf8')).data;
const { Marked, Renderer } = await dependency('marked');
const docs = [
  ['start', 'campus-ai-course/docs/01-跨平台启动.md', '启动操作'],
  ['task', 'campus-ai-course/docs/04-首次贯通操作单.md', '第04章任务'],
  ['offline', 'offline-ai/学生练习.md', '离线AI练习'],
  ['next', 'campus-ai-course/docs/03-资源与章节映射.md', '章节资源表'],
  ['db', 'campus-ai-course/docs/02-教师数据库交接单.md', '教师数据库'],
  ...fs.readdirSync(path.join(project, 'docs')).filter(n => /^(0[5-9]|1[0-2])-.*\.md$/.test(n)).sort().map(n => ['task-' + n.slice(0,2), 'campus-ai-course/docs/' + n, '第' + n.slice(0,2) + '章任务']),
];
// Resolve links between embedded documents before encoding file URLs.
const slug = value => value.normalize('NFKC').toLowerCase().replace(/<[^>]*>/g, '').replace(/\s+/g, '-').replace(/[^\p{L}\p{N}_-]/gu, '');
const sources = docs.map(([id, file]) => {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  const counts = new Map();
  const headings = new Marked().lexer(text).filter(t => t.type === 'heading').map(t => {
    const base = slug(t.text), count = (counts.get(base) || 0) + 1;
    counts.set(base, count);
    const fragment = `${base}${count > 1 ? `-${count}` : ''}`;
    return { fragment, id: `${id}--${fragment}` };
  });
  return { id, file, text, headings };
});
const byFile = new Map(sources.map(d => [path.resolve(root, d.file), d]));
const sections = sources.map(doc => {
  const { id, file, text, headings } = doc;
  const renderer = new Renderer();
  let headingIndex = 0;
  renderer.heading = function(token) {
    const heading = headings[headingIndex++];
    return `<h${token.depth} id="${esc(heading.id)}">${this.parser.parseInline(token.tokens)}</h${token.depth}>\n`;
  };
  renderer.link = function (token) {
    let href = token.href;
    if (!/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href)) {
      const [filePart, fragmentPart] = href.split('#', 2);
      const target = filePart ? path.resolve(root, path.dirname(file), decodeURIComponent(filePart)) : path.resolve(root, file);
      const embedded = byFile.get(target);
      if (embedded) {
        const heading = fragmentPart === undefined ? null : embedded.headings.find(h => h.fragment === decodeURIComponent(fragmentPart));
        if (fragmentPart !== undefined && !heading) throw new Error(`Missing embedded heading: ${file} -> ${token.href}`);
        href = `#${heading?.id ?? embedded.id}`;
      } else {
        href = path.relative(root, target).split(path.sep).map(encodeURIComponent).join('/') + (fragmentPart === undefined ? '' : `#${encodeURIComponent(decodeURIComponent(fragmentPart))}`);
      }
    }
    return `<a href="${esc(href)}">${this.parser.parseInline(token.tokens)}</a>`;
  };
  renderer.table = function (token) { return `<div class="table-scroll" tabindex="0">${Renderer.prototype.table.call(this, token)}</div>`; };
  const markdown = new Marked({ gfm: true, renderer });
  return `<section id="${id}" class="document"><span class="tag">可操作材料</span>${markdown.parse(text)}</section>`;
}).join('');
const historyRows = history.samples.map(s => `<tr><td>${esc(new Date(s.time).toISOString())}</td><td>${s.value === null ? '<span class="unknown">null · 断点</span>' : esc(s.value)}</td><td>${s.value === null ? '保留采样时刻，不补零' : s.value === 0 ? '有效零，必须保留' : '有限数值'}</td></tr>`).join('');
const hrefs = docs.map(([id, , label]) => `<a href="#${id}">${label}</a>`).join('');
const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AI编程 · 完整教学资源</title><style>
:root{--ink:#163343;--muted:#526a76;--line:#d4e3e3;--accent:#14665b;--paper:#f5f8f6}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;color:var(--ink);background:var(--paper);font:16px/1.75 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif}a{color:#145e70;text-underline-offset:4px}button,input,select{font:inherit}header{max-width:1200px;margin:auto;padding:48px 28px 24px}header h1{font-size:clamp(32px,5vw,52px);line-height:1.25;margin:12px 0 18px;letter-spacing:-1px}.eyebrow,.tag{font-size:13px;letter-spacing:1px;color:var(--accent);font-weight:700}.lead{max-width:800px;color:var(--muted);font-size:18px}nav{display:flex;gap:10px;flex-wrap:wrap;margin-top:25px}nav a{border:1px solid var(--line);background:white;padding:8px 13px;border-radius:6px;text-decoration:none}nav a:hover{border-color:var(--accent)}main{max-width:1200px;margin:auto;padding:0 28px 64px}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin:20px 0 34px}.card,.document,.preview{background:white;border:1px solid var(--line);border-radius:12px;padding:26px;min-width:0}.card b{display:block;font-size:31px;line-height:1.3}.card span{display:block;color:var(--muted);margin-top:7px}.document{margin:25px 0;scroll-margin-top:18px}.document h1{font-size:29px;line-height:1.45}.document h2{font-size:23px;margin-top:30px}.document h3{font-size:19px}.document p,.document li{max-width:100%;overflow-wrap:anywhere}.document blockquote{border-left:3px solid var(--accent);padding-left:16px;color:var(--muted)}.document pre{overflow:auto;padding:17px;background:#112c38;color:#eaf3f0;border-radius:8px;font:14px/1.75 ui-monospace,monospace}.document code{overflow-wrap:anywhere}table{border-collapse:collapse;width:100%;font-size:14px}th{text-align:left;background:#edf4f2}th,td{padding:12px;border-bottom:1px solid var(--line);vertical-align:top}td code{white-space:normal}.table-scroll{overflow:auto;max-width:100%}.table-scroll:focus{outline:2px solid var(--accent)}.table-scroll table{min-width:650px}.filters{display:flex;gap:16px;flex-wrap:wrap;margin:20px 0}.filters label{display:flex;gap:8px;align-items:center}.filters select{padding:7px 12px;border:1px solid var(--line);border-radius:6px;background:white}.badge{display:inline-block;border-radius:5px;background:#e9f6f0;color:#1b604f;padding:2px 8px;font-size:12px}.unknown{color:#8a6224}.muted{color:var(--muted)}.flow{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:25px 0}.flow div{padding:15px;border-top:4px solid var(--accent);background:#edf5f2;border-radius:4px}.flow b{display:block}.flow small{color:var(--muted)}figure{margin:18px 0}figure img{width:100%;height:auto;border:1px solid var(--line);border-radius:8px;display:block}figcaption{font-size:14px;color:var(--muted);margin-top:10px}.notice{padding:15px 18px;border-left:4px solid #b77d27;background:#fff6e7;border-radius:0 5px 5px 0}.quality-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:18px 0}.quality-grid>div{padding:16px;background:#f5f8f6;border:1px solid var(--line);border-radius:6px}.quality-grid b{display:block}.quality-grid code{font-size:13px}.footer{font-size:14px;color:var(--muted);padding:16px 0}details{margin:18px 0}summary{cursor:pointer;font-weight:600}@media(max-width:700px){header{padding:28px 18px 16px}main{padding:0 18px 36px}.cards,.quality-grid{grid-template-columns:1fr}.cards{gap:9px}.card{padding:18px}.card b{font-size:25px}.document,.preview{padding:19px}.document h1{font-size:25px}.flow{grid-template-columns:repeat(2,1fr)}.filters{display:block}.filters label{margin:10px 0}nav a{font-size:14px}table{font-size:13px}th,td{padding:10px}.lead{font-size:16px}}
</style></head><body><header><div class="eyebrow">48 学时 / AI 编程 / V${JSON.parse(fs.readFileSync(path.join(courseDir, 'course-index.json'), 'utf8')).version} 完整教学包</div><h1>从需求到交付，<br>完成一套教学平台。</h1><p class="lead">为学生自带Windows/macOS电脑、教师提供数据库的课堂准备。先用固定教学数据完成登录与设备读取，再逐章扩展业务。学生使用通义等网页AI工具，无需模型API。</p><nav><a href="../reading/index.html">图文教程</a><a href="../lesson-plans/index.html">12次课教案</a><a href="student-chapters/README.md">逐章学生起点</a><a href="teacher-guide/README.md">教师参考</a><a href="#preview">运行截图</a><a href="#catalog">查看固定数据</a>${hrefs}</nav></header><main>
<div class="cards"><div class="card"><b>12 章完整教程</b><span>需求 → 设计 → 实现 → 测试 → 交付</span></div><div class="card"><b>9 个分章起点</b><span>第04—12章局部实现与断言任务，教师基础预置</span></div><div class="card"><b>6 张离线 AI 练习</b><span>先预测，再审查构造回复，最后记录证据</span></div></div>
<section class="preview" id="preview"><span class="tag">作者本机实测截图</span><h2>同一条记录，在页面与响应中核对</h2><div class="flow" aria-label="读取链路"><div><b>01 浏览器</b><small>本地登录与设备页</small></div><div><b>02 开发代理</b><small>保留 /api 前缀</small></div><div><b>03 后端</b><small>认证、授权、响应</small></div><div><b>04 夹具文件</b><small>固定目录与独立MySQL</small></div></div><figure><img src="campus-ai-course/evidence/full-browser/desktop-devices.png" alt="作者本机实际运行的设备台账，显示教学模拟来源、固定时钟与16台设备的三态标签"><figcaption>图 R01 · 实际本地浏览器截图，数据为教学模拟；采用独立课程MySQL与模拟采样，不代表真实硬件或Windows实机验收。</figcaption></figure><p class="notice">参考工程已补齐完整必修业务，作者本机各项验证见本包报告。学校正式数据库、Windows实机、学生独立复现与课堂耗时仍须课前试跑；AIRIOT选做组件没有真实连接证据。</p></section>
<section id="catalog" class="document"><span class="tag">不启动服务也可探索</span><h1>冻结数据：4 空间 · 16 设备 · 28 点</h1><p>下表直接来自本包catalog.json，属于浏览器内的<strong>夹具查看器</strong>；它不请求后端，不能当首次贯通证据。第04章后端仅选一空间两设备，第05—12章teacher-db模式使用全部目录。</p><div class="filters"><label>空间<select id="space"><option value="all">全部空间</option>${catalog.spaces.map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</select></label><label>通信状态<select id="online"><option value="all">全部状态</option><option value="true">在线</option><option value="false">离线</option><option value="null">未知</option></select></label><strong id="count" aria-live="polite"></strong></div><div class="table-scroll" tabindex="0"><table><thead><tr><th>设备 / ID</th><th>空间</th><th>通信状态</th><th>采集点与单位</th></tr></thead><tbody id="devices"></tbody></table></div><h2>质量边界：先预测，再展开</h2><p>以固定观察时刻2026-10-18 14:00（北京时间）计算，不能用电脑当前时间重算这些样例。</p><div class="quality-grid">${quality.cases.filter(c => ['valid-zero','age-60000ms','age-60001ms','future-5000ms','future-5001ms','missing-value'].includes(c.id)).map(c => `<div><b>${esc(c.id)}</b><code>value=${esc(JSON.stringify(c.raw.value))}</code><br><code>Δt=${esc(c.raw.time - quality.observedAt)}ms</code><details><summary>预期质量</summary><span class="badge">${esc(c.expectedQuality)}</span><p>${esc(c.reason)}</p></details></div>`).join('')}</div><h2>历史中的零和缺失</h2><p>4条原始样本，3个有效数值；null保留断点，0保留为有效测量。不制造没有采样的时刻。下列均为UTC时间。</p><div class="table-scroll" tabindex="0"><table><thead><tr><th>原始时刻（UTC）</th><th>功率 kW</th><th>处理原则</th></tr></thead><tbody>${historyRows}</tbody></table></div><p><a href="campus-ai-course/fixtures/README.md">字段与夹具说明</a> · <a href="campus-ai-course/fixtures/manifest.json">冻结清单</a> · <a href="campus-ai-course/evidence/verification-v1.0.1.json">实际验证记录</a></p></section>
<section class="document"><h2>从数据质量到业务闭环</h2><p>下列为作者本机实际浏览器截图，采样是教学模拟，事件和责任记录写入独立课程MySQL。</p>${[['desktop-history','历史样本中的有效零与null断点'],['desktop-cases','本地演练事件的状态、版本与时间线'],['desktop-owners','设备责任与历史变更']].map(([file,caption])=>`<figure><img loading="lazy" src="campus-ai-course/evidence/full-browser/${file}.png" alt="${caption}"><figcaption>${caption}。截图不代替学生自己的验收记录。</figcaption></figure>`).join('')}</section>
${sections}<section class="document"><h2>教师保留的资料</h2><p><a href="campus-ai-course/README.md">参考工程入口</a> · <a href="offline-ai/教师参考.md">离线练习参考</a> · <a href="../11-完整教程与教案验收.md">完整包检查记录</a></p><p>分发学生包时使用student-chapters中对应章节的独立起点；不要把本地账号、作者测试凭据或教师通过记录当作学生成果。</p></section><p class="footer">课程源稿仍为Markdown。此页由tools/build-resources.mjs生成；既有40幅课程图保留在整书，新增运行截图与交互夹具用于资源讲解。</p></main><script>
const catalog=${JSON.stringify(catalog).replace(/</g, '\\u003c')};
const space=document.getElementById('space'),online=document.getElementById('online'),body=document.getElementById('devices');
function render(){body.replaceChildren();const selected=catalog.devices.filter(d=>(space.value==='all'||d.spaceId===space.value)&&(online.value==='all'||String(d.online)===online.value));document.getElementById('count').textContent=selected.length+' / 16 台';for(const d of selected){const row=document.createElement('tr');const values=[d.name+' / '+d.id,catalog.spaces.find(s=>s.id===d.spaceId)?.name||'未映射',d.online===true?'在线':d.online===false?'离线':'未知',d.tags.map(t=>t.id+' '+(t.unit||'无量纲')).join(' · ')];for(const value of values){const td=document.createElement('td');td.textContent=value;row.append(td)}body.append(row)}}space.addEventListener('change',render);online.addEventListener('change',render);render();
</script></body></html>`;
fs.writeFileSync(path.join(root, 'index.html'), html);
console.log('resources/index.html 已生成；图片与交互需浏览器检查。');
