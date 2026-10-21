import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { courseDir, toolsDir, fontFamily, launchBrowser, packageRoot, dependencyVersion, escapeHtml, option, relativeCourse, assertCoursePath, writeJson } from './runtime.mjs';

const source = path.resolve(courseDir, option('--source', 'figure-sources/shared'));
const output = path.resolve(courseDir, option('--output', 'illustrations'));
const scale = Number(option('--scale', '2'));
if (!(scale >= 1 && scale <= 4)) throw new Error('--scale 只能为 1 至 4');
assertCoursePath(source);
assertCoursePath(output);
function collect(dir) {
  if (fs.statSync(dir).isFile()) return [dir];
  return fs.readdirSync(dir, { withFileTypes: true }).filter(entry => entry.name !== 'layouts').flatMap(entry => entry.isDirectory() ? collect(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
}
const files = collect(source).filter(f => /\.(mmd|svg)$/.test(f)).sort();
if (!files.length) throw new Error('没有可渲染的 .mmd 或 .svg 文件');
const names = files.map(f => path.basename(f, path.extname(f)));
if (new Set(names).size !== names.length) throw new Error('图源 basename 重复，会覆盖成品；请先修正命名');
fs.mkdirSync(output, { recursive: true });
const theme = JSON.parse(fs.readFileSync(path.join(toolsDir, 'mermaid-theme.json'), 'utf8'));
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const browser = await launchBrowser();
const records = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: scale });
  await page.route('http://**/*', route => route.abort());
  await page.route('https://**/*', route => route.abort());
  await page.setContent('<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"></head><body></body></html>');
  await page.addScriptTag({ path: path.join(packageRoot('mermaid'), 'dist/mermaid.min.js') });
  await page.evaluate(config => window.mermaid.initialize(config), theme);
  for (const file of files) {
    const original = fs.readFileSync(file, 'utf8');
    const stem = path.basename(file, path.extname(file));
    const metadataFile = file.replace(/\.(svg|mmd)$/, '.figure.json');
    const hasMetadata = fs.existsSync(metadataFile);
    const meta = hasMetadata ? JSON.parse(fs.readFileSync(metadataFile, 'utf8')) : { id: stem, title: stem, alt: stem, caption: '教学示意；非运行证据。' };
    for (const key of ['id', 'title', 'alt', 'caption']) if (!meta[key]) throw new Error(`${stem} 缺少 ${key}`);
    const renderSource = meta.renderSource ? path.resolve(courseDir, meta.renderSource) : file;
    assertCoursePath(renderSource);
    let svg = fs.readFileSync(renderSource, 'utf8');
    if (renderSource.endsWith('.mmd')) {
      if (/%%\s*\{|^---\s*\n/i.test(original)) throw new Error(`${stem}: 请移除图内主题配置，使用统一 mermaid-theme.json`);
      const rendered = await page.evaluate(async ({ text, id }) => {
        const result = await window.mermaid.render(id, text);
        const parsed = new DOMParser().parseFromString(result.svg, 'image/svg+xml');
        if (parsed.querySelector('parsererror')) throw new Error('Mermaid 导出 SVG XML 错误：' + parsed.querySelector('parsererror').textContent.slice(0, 240));
        const root = parsed.documentElement;
        const box = root.getAttribute('viewBox').trim().split(/[\s,]+/).map(Number);
        if (box.length !== 4 || box.some(n => !Number.isFinite(n))) throw new Error('Mermaid 缺少有效 viewBox');
        return { svg: result.svg, box };
      }, { text: original, id: `figure-${stem}` });
      const [, , width, height] = rendered.box;
      const factor = Math.min(1.4, 1184 / width);
      const canvasHeight = Math.ceil(height * factor + 238);
      const inner = rendered.svg.replace(/<svg\b([^>]*)>/, (_tag, attrs) => `<svg${attrs.replace(/\s(?:width|height|style|viewBox)="[^"]*"/g, '')} x="${(1280 - width * factor) / 2}" y="140" width="${width * factor}" height="${height * factor}" viewBox="${rendered.box.join(' ')}">`);
      svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="${canvasHeight}" viewBox="0 0 1280 ${canvasHeight}" role="img" aria-labelledby="fig-title fig-desc"><title id="fig-title">${escapeHtml(meta.title)}</title><desc id="fig-desc">${escapeHtml(meta.alt)}</desc><rect width="1280" height="${canvasHeight}" fill="#ffffff"/><g font-family="${escapeHtml(fontFamily)}"><rect x="48" y="38" width="5" height="64" rx="2" fill="#245b81"/><text x="72" y="53" font-size="17" fill="#526b7c">${escapeHtml(meta.id)} · 教学示意</text><text x="72" y="98" font-size="32" font-weight="600" fill="#17334b">${escapeHtml(meta.title)}</text></g>${inner}<g font-family="${escapeHtml(fontFamily)}"><line x1="48" y1="${canvasHeight - 68}" x2="1232" y2="${canvasHeight - 68}" stroke="#cfdae2"/><text x="48" y="${canvasHeight - 32}" font-size="19" fill="#526b7c">教学设计示意 · 非运行截图 · 不代表实验已验证</text></g></svg>`;
    }
    const checked = await page.evaluate(({ source, family }) => {
      const parsed = new DOMParser().parseFromString(source, 'image/svg+xml');
      if (parsed.querySelector('parsererror') || parsed.documentElement.tagName !== 'svg') throw new Error('SVG XML 无效');
      const root = parsed.documentElement;
      if (parsed.doctype || root.querySelector('script, foreignObject, image, iframe')) throw new Error('图源不能包含 DTD、脚本、foreignObject 或外部图像');
      for (const element of root.querySelectorAll('*')) {
        for (const attribute of element.attributes) {
          if (/^on/i.test(attribute.name) || (/href$/i.test(attribute.name) && !attribute.value.startsWith('#'))) throw new Error('SVG 含事件处理或外部引用');
        }
      }
      if (/@import|url\(\s*['"]?(?:https?:|\/\/)/i.test(source)) throw new Error('SVG 不能依赖远端样式或字体');
      const viewBox = root.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number);
      if (!viewBox || viewBox.length !== 4 || viewBox.some(n => !Number.isFinite(n)) || viewBox[2] <= 0 || viewBox[3] <= 0) throw new Error('需要合法 viewBox');
      root.setAttribute('width', String(Math.ceil(viewBox[2])));
      root.setAttribute('height', String(Math.ceil(viewBox[3])));
      root.setAttribute('role', 'img');
      document.body.style.cssText = 'margin:0;background:white;';
      document.body.replaceChildren(document.importNode(root, true));
      document.body.style.fontFamily = family;
      return { svg: new XMLSerializer().serializeToString(root), width: Math.ceil(viewBox[2]), height: Math.ceil(viewBox[3]) };
    }, { source: svg, family: fontFamily });
    await page.setViewportSize({ width: checked.width, height: Math.min(checked.height, 1200) });
    await page.evaluate(() => document.fonts.ready);
    const geometry = await page.evaluate(() => {
      const root = document.querySelector('body > svg');
      const canvas = root.getBoundingClientRect();
      const text = [...root.querySelectorAll('text')].map(el => {
        const box = el.getBoundingClientRect();
        const matrix = el.getScreenCTM();
        return { text: el.textContent.trim(), x: box.x, y: box.y, width: box.width, height: box.height, effectiveFontSize: Number((parseFloat(getComputedStyle(el).fontSize) * Math.hypot(matrix.a, matrix.b)).toFixed(2)) };
      }).filter(t => t.text);
      return { textCount: text.length, minimumEffectiveFontSize: Math.min(...text.map(t=>t.effectiveFontSize)), smallText: text.filter(t=>t.effectiveFontSize<14), outOfCanvasText: text.filter(t => t.x < canvas.x - 1 || t.y < canvas.y - 1 || t.x + t.width > canvas.right + 1 || t.y + t.height > canvas.bottom + 1) };
    });
    if (geometry.outOfCanvasText.length) throw new Error(`${stem}: 文字超出画布：${geometry.outOfCanvasText.map(t => t.text).join(' / ')}`);
    const svgFile = path.join(output, `${stem}.svg`);
    const pngFile = path.join(output, `${stem}.png`);
    if (path.resolve(file) === svgFile) throw new Error('输出路径不能覆盖图源');
    fs.writeFileSync(svgFile, '<?xml version="1.0" encoding="UTF-8"?>\n' + checked.svg + '\n');
    await page.locator('body > svg').screenshot({ path: pngFile, animations: 'disabled' });
    records.push({ id: meta.id, title: meta.title, alt: meta.alt, caption: meta.caption, source: relativeCourse(file), sourceSha256: hash(original), renderSource: relativeCourse(renderSource), renderSourceSha256: hash(fs.readFileSync(renderSource)), metadata: hasMetadata ? relativeCourse(metadataFile) : null, svg: relativeCourse(svgFile), png: relativeCourse(pngFile), svgSha256: hash(fs.readFileSync(svgFile)), pngSha256: hash(fs.readFileSync(pngFile)), width: checked.width, height: checked.height, rasterWidth: checked.width * scale, rasterHeight: checked.height * scale, ...geometry, visualReview: 'PENDING_HUMAN_OR_IMAGE_VIEW', labVerified: false });
    console.log(`${relativeCourse(file)} -> ${relativeCourse(pngFile)} (${checked.width * scale} × ${checked.height * scale})`);
  }
  writeJson(path.join(output, option('--report', 'render-report.json')), { schemaVersion: 1, generatedAt: new Date().toISOString(), purpose: '教学配图渲染；不证明业务代码或实验通过', browser: browser.version(), dependencies: { playwright: dependencyVersion('playwright'), mermaid: dependencyVersion('mermaid') }, scale, figures: records });
} finally { await browser.close(); }
