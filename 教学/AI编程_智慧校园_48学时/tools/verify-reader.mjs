import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { courseDir, launchBrowser, option, relativeCourse, assertCoursePath, writeJson } from './runtime.mjs';

const sample = process.argv.includes('--sample');
const file = path.resolve(courseDir, option('--input', sample ? 'illustrations/reader-sample.html' : 'reading/index.html'));
const output = path.resolve(courseDir, option('--output', sample ? 'illustrations/qa/sample' : 'illustrations/qa/book'));
assertCoursePath(file);
assertCoursePath(output);
if (!fs.existsSync(file)) throw new Error('请先生成 HTML 阅读版');
fs.mkdirSync(output, { recursive: true });
const browser = await launchBrowser();
const records = [];
const failed = [];
const inputSha256 = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
// 高于视口的图若直接截元素，Chromium 会走 captureBeyondViewport，在鼠标移动过的长页上可能卡死渲染进程；
// 临时加高视口（宽度不变，版式相同）后再截，截完恢复。
async function figureShot(page, figure, file, width) {
  const box = await figure.boundingBox();
  const tall = box && box.height > 1000;
  if (tall) await page.setViewportSize({ width, height: Math.ceil(box.height) + 40 });
  await figure.scrollIntoViewIfNeeded();
  await figure.locator('img').evaluate(img => img.decode());
  await page.waitForTimeout(150);
  await figure.screenshot({ path: file });
  if (tall) await page.setViewportSize({ width, height: 1000 });
}
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, deviceScaleFactor: 1 });
    const externalRequests = [];
    const pageErrors = [];
    await page.route('http://**/*', route => { externalRequests.push(route.request().url()); return route.abort(); });
    await page.route('https://**/*', route => { externalRequests.push(route.request().url()); return route.abort(); });
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.goto(pathToFileURL(file).href, { waitUntil: 'load' });
    // 验证导航目标，不把长文平滑滚动的动画时长算作失败。
    await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => [...document.images].every(img => img.complete));
    const data = await page.evaluate(() => {
      const ids = [...document.querySelectorAll('[id]')].map(el => el.id);
      const images = [...document.images].map(img => ({ alt: img.alt, loaded: img.complete && img.naturalWidth > 0, width: img.naturalWidth, height: img.naturalHeight, caption: !!img.closest('figure')?.querySelector('figcaption') }));
      const brokenAnchors = [...document.querySelectorAll('a[href^="#"]')].map(a => a.getAttribute('href')).filter(href => !document.getElementById(decodeURIComponent(href.slice(1))));
      const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
      return { title: document.title, documentWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth, images, brokenAnchors, duplicateIds, hasScopeBoundary: document.body.textContent.includes('Windows实机') && document.body.textContent.includes('课堂'), rawFrontmatterVisible: /(?:chapter_id|source_basis|chapter_status|review_status):/.test(document.body.innerText), documentSections: document.querySelectorAll('section.chapter').length, chapters: document.querySelectorAll('h1[id^="chapter-"]').length, embeddedImages: [...document.images].every(i=>i.src.startsWith('data:')), figureIds: [...document.querySelectorAll('figure')].map(f=>f.id) };
    });
    if (data.documentWidth > width + 1) failed.push(`${width}px 文档横向溢出`);
    if (data.images.some(i => !i.loaded || !i.alt || !i.caption)) failed.push(`${width}px 图片、替代文字或图注缺失`);
    if (!data.images.length) failed.push(`${width}px 没有图片`);
    if (data.brokenAnchors.length || data.duplicateIds.length) failed.push(`${width}px 目录锚点无效或重复`);
    if (!sample && !data.hasScopeBoundary) failed.push(`${width}px 缺少课堂/Windows实机验证边界说明`);
    if (data.rawFrontmatterVisible) failed.push(`${width}px 原始 YAML 元信息出现在阅读正文`);
    if (!sample && (data.chapters !== 12 || data.images.length !== 40)) failed.push(`${width}px 整书章数或图片数不符`);
    if (externalRequests.length || pageErrors.length) failed.push(`${width}px 存在远端依赖或脚本错误`);
    await page.screenshot({ path: path.join(output, `reader-${width}.png`), fullPage: false });
    const visited = [];
    for (const href of await page.locator('nav a[href^="#chapter-"]').evaluateAll(els=>els.map(e=>e.getAttribute('href')))) {
      const link = page.locator(`nav a[href="${href}"]`).first();
      const details = link.locator('xpath=ancestor::details[1]');
      if (await details.count() && !(await details.getAttribute('open') !== null)) await details.locator('summary').first().click();
      await link.click();
      const found=await page.evaluate(h=>decodeURIComponent(location.hash)===decodeURIComponent(h) && !!document.getElementById(decodeURIComponent(h.slice(1))),href);
      if(!found) failed.push(`${width}px 目录点击失败：${href}`);
      visited.push({href,found});
    }
    data.visitedChapterLinks=visited;
    if (!sample) {
      await page.evaluate(()=>{document.documentElement.style.scrollBehavior='auto'});
      for(const chapter of ['01','09','12']){
        await page.locator(`#chapter-${chapter}`).evaluate(el=>el.scrollIntoView());
        await page.screenshot({path:path.join(output,`chapter-${chapter}-${width}.png`),fullPage:false});
      }
      if(width===1440){
        for(const stem of ['ch03-02-local-records-er','ch05-01-device-request','ch06-01-device-wireframe','ch07-01-quality-cases','ch09-02-close-gates','ch10-02-future-assignment','ch11-02-concurrent-updates']){
          await figureShot(page, page.locator(`#fig-${stem}`), path.join(output,`${stem}-in-reader.png`), width);
        }
      }
    }
    if (width === 1440) {
      const firstFigure=page.locator('figure').first();
      await figureShot(page, firstFigure, path.join(output, 'figure-in-reader.png'), width);
      if(data.embeddedImages){
        const event=page.waitForEvent('download');
        await firstFigure.locator('.figure-open').click();
        const download=await event;
        const saved=path.join(output,'standalone-download-check.png');
        await download.saveAs(saved);
        const source=await firstFigure.locator('img').getAttribute('src');
        const expected=crypto.createHash('sha256').update(Buffer.from(source.split(',')[1],'base64')).digest('hex');
        const actual=crypto.createHash('sha256').update(fs.readFileSync(saved)).digest('hex');
        data.downloadCheck={filename:download.suggestedFilename(),sha256:actual,matched:actual===expected};
        if(actual!==expected)failed.push('单文件 PNG 下载内容不匹配');
      }
      if (!process.argv.includes('--skip-pdf')) {
        await page.emulateMedia({ media: 'print' });
        await page.pdf({ path: path.join(output, 'print-preview.pdf'), printBackground: true, preferCSSPageSize: true });
      }
    }
    records.push({ width, ...data, externalRequests, pageErrors });
    await page.close();
  }
  if(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')!==inputSha256)failed.push('验证期间输入文件发生变化');
  writeJson(path.join(output, 'verification.json'), { generatedAt: new Date().toISOString(), input: relativeCourse(file), inputSha256, pdfGenerated:!process.argv.includes('--skip-pdf'), browser: browser.version(), status: failed.length ? 'FAIL' : 'PASS', scope: 'HTML 文件的本地离线显示、资源、目录点击、锚点与尺寸检查；不验证课程实验', visualReview: 'REQUIRES_IMAGE_VIEW', labVerified: false, checks: records, failures: failed });
} finally { await browser.close(); }
if (failed.length) throw new Error(failed.join('\n'));
console.log(`通过：桌面 1440px / 窄屏 390px；离线资源、图片图注、目录锚点。报告：${relativeCourse(path.join(output, 'verification.json'))}`);
