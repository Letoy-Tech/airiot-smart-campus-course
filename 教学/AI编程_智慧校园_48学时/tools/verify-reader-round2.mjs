import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { courseDir, dependency, launchBrowser, option, relativeCourse, assertCoursePath, writeJson } from './runtime.mjs';

const sample = process.argv.includes('--sample');
const file = path.resolve(courseDir, option('--input', 'reading/index.html'));
const output = path.resolve(courseDir, option('--output', 'illustrations/qa/round2-book'));
assertCoursePath(file);
assertCoursePath(output);
if (!relativeCourse(output).startsWith('illustrations/qa/round2-')) throw new Error('第二轮检查仅写入 illustrations/qa/round2-*');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const inputSha256 = hash(fs.readFileSync(file));
const build = JSON.parse(fs.readFileSync(file.replace(/\.html$/, '.build.json'), 'utf8'));
if (build.sha256 !== inputSha256) throw new Error('HTML 与构建记录不匹配');
if (!build.version?.startsWith('V0.3')) throw new Error('本检查器用于 V0.3');
fs.mkdirSync(output, { recursive: true });
const { Marked } = await dependency('marked');
const markdown = new Marked({ gfm: true });
const expectedCode = [];
for (const doc of build.documents) {
  const text = fs.readFileSync(path.join(courseDir, doc.file), 'utf8');
  if (hash(text) !== doc.sha256) throw new Error(`生成后源稿变化，请重新生成：${doc.file}`);
  const content = text.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '');
  markdown.walkTokens(markdown.lexer(content), token => {
    if (token.type === 'code') expectedCode.push(token.text + '\n');
  });
}

const records = [];
const failures = [];
const browser = await launchBrowser();
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, deviceScaleFactor: 1 });
    const externalRequests = [];
    const pageErrors = [];
    await page.route(/^https?:\/\//, route => { externalRequests.push(route.request().url()); return route.abort(); });
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.goto(pathToFileURL(file).href, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => [...document.images].every(img => img.complete));
    await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; });
    const data = await page.evaluate(() => {
      const ids = [...document.querySelectorAll('[id]')].map(e => e.id);
      const target = href => document.getElementById(decodeURIComponent(href.slice(1)));
      const nav = document.querySelector('.book-nav');
      const codeBlocks = [...document.querySelectorAll('.code-example')];
      return {
        title: document.title,
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: innerWidth,
        navHeight: nav.getBoundingClientRect().height,
        coverTop: document.querySelector('.book-cover').getBoundingClientRect().top,
        mobileMenuCollapsed: !document.querySelector('.main-toc').open,
        resources: document.querySelectorAll('.resource-section').length,
        chapters: document.querySelectorAll('h1[id^="chapter-"]').length,
        images: [...document.images].map(i => ({ id: i.closest('figure').id, alt: i.alt, loaded: i.complete && i.naturalWidth > 0, caption: !!i.closest('figure').querySelector('figcaption'), embedded: i.src.startsWith('data:') })),
        duplicateIds: ids.filter((id, index) => ids.indexOf(id) !== index),
        brokenAnchors: [...document.querySelectorAll('a[href^="#"]')].map(a => a.getAttribute('href')).filter(h => !target(h)),
        wrongLocalTargets: [...document.querySelectorAll('.chapter-nav a')].filter(a => target(a.getAttribute('href'))?.closest('.chapter') !== a.closest('.chapter')).map(a => a.getAttribute('href')),
        internalMaterialLinks: document.querySelectorAll('a[data-link-kind="reader-section"][href^="#resource-"]').length,
        unlabeledDependencies: [...document.querySelectorAll('a[data-link-kind="course-package"],a[data-link-kind="original-project"]')].filter(a => !a.nextElementSibling?.matches('.source-note')).map(a => a.getAttribute('href')),
        hasDependencyExplanation: document.querySelector('.reader-help').textContent.includes('需完整资料包'),
        unverified: document.body.textContent.includes('lab_verified=false') && document.body.textContent.includes('实验未验证'),
        rawFrontmatter: /(?:chapter_id|source_basis|chapter_status|review_status):/.test(document.body.innerText),
        code: codeBlocks.map(block => { const pre = block.querySelector('pre'); return { prose: block.classList.contains('prose-example'), language: block.dataset.language, purpose: block.dataset.purpose, visible: pre.clientWidth, full: pre.scrollWidth, label: block.querySelector('.code-label')?.textContent, whiteSpace: getComputedStyle(pre.querySelector('code')).whiteSpace, focusable: pre.tabIndex === 0 }; }),
        codeTexts: codeBlocks.map(b => b.querySelector('code').textContent),
        localNavigation: [...document.querySelectorAll('.chapter:not(.resource-section)')].filter(s => s.querySelector('h1[id^="chapter-"]')).map(s => ({ chapter: s.querySelector('h1').id, links: [...s.querySelectorAll('.chapter-nav a')].map(a => ({ text: a.textContent, href: a.getAttribute('href') })) })),
      };
    });
    const check = (ok, message) => { if (!ok) failures.push(`${width}px ${message}`); };
    check(data.documentWidth <= width + 1, '整页横向溢出');
    check(!data.duplicateIds.length && !data.brokenAnchors.length && !data.wrongLocalTargets.length, '锚点无效、重复或章内跳转跨章');
    check(data.images.length === build.figures && data.images.every(i => i.loaded && i.alt && i.caption), '图片数量、加载、替代文字或图注错误');
    check(data.resources === 10 && data.internalMaterialLinks > 0, '常用资料未完整编入');
    check(data.hasDependencyExplanation && !data.unlabeledDependencies.length, '文件依赖缺少标签');
    check(data.unverified && !data.rawFrontmatter, '实验状态或原始元信息展示错误');
    check(data.code.every(b => b.label && b.purpose && (b.prose ? b.full <= b.visible + 1 && b.whiteSpace === 'pre-wrap' : b.focusable && b.whiteSpace === 'pre')), '文本折行、语言用途或代码滚动访问错误');
    check(JSON.stringify(data.codeTexts) === JSON.stringify(expectedCode), '展示代码与 Markdown 原文不一致');
    if (width === 390) check(data.mobileMenuCollapsed && data.navHeight < 300, '手机目录未收起或初始占位过大');
    if (!sample) {
      check(data.chapters === 12 && data.images.length === 40, '整书章数或图数不符');
      check(data.localNavigation.length === 12 && data.localNavigation.every(n => /模块一/.test(n.links.map(l => l.text).join('|')) && /模块二/.test(n.links.map(l => l.text).join('|')) && /模块三/.test(n.links.map(l => l.text).join('|'))), '章内导航未覆盖三个模块');
      for (const doc of build.documents.filter(d => d.chapter)) {
        const nav = data.localNavigation.find(n => n.chapter === doc.id);
        for (const heading of doc.headings.filter(h => /本章任务卡/.test(h.text) || h.containsAcceptance || h.containsHandoff)) {
          check(nav?.links.some(l => l.href === `#${heading.id}`), `${doc.id} 任务、验收或接力定位缺失`);
        }
      }
    }
    await page.screenshot({ path: path.join(output, `reader-${width}.png`) });

    async function visitLinks(selector) {
      const links = await page.locator(selector).evaluateAll(as => as.map((a, index) => ({ index, href: a.getAttribute('href') })));
      const visited = [];
      for (const link of links) {
        const locator = page.locator(selector).nth(link.index);
        const details = locator.locator('xpath=ancestor::details[1]');
        if (await details.count() && !await details.evaluate(d => d.open)) await details.locator('summary').first().click();
        await locator.click();
        const ok = await page.evaluate(h => decodeURIComponent(location.hash) === decodeURIComponent(h) && !!document.getElementById(decodeURIComponent(h.slice(1))), link.href);
        check(ok, `点击跳转失败：${link.href}`);
        visited.push({ href: link.href, found: ok });
      }
      return visited;
    }
    data.visitedChapterLinks = await visitLinks('.book-nav .main-toc a');
    data.visitedResourceLinks = await visitLinks('.book-nav .resource-nav a');
    data.visitedLocalLinks = await visitLinks('.chapter:not(.resource-section) .chapter-nav a');
    data.visitedInlineResources = await visitLinks('a[data-link-kind="reader-section"][href^="#resource-"]');
    for (const [name, selector] of [
      ['chapter-entry', sample ? '#sample' : '#chapter-06'],
      ['prompt', '.prose-example'],
      ['code', '.code-example:not(.prose-example)'],
      ['api-contract', '#resource-api-contract'],
      ['class-task', '#resource-class-task'],
      ['chapter-task', sample ? '#sample-本章任务卡' : '#chapter-06-本章任务卡'],
      ['vue-template', '.code-example[data-language="vue"]'],
      ['chapter-05-prompt', '.chapter[data-document="chapter-05"] .prose-example[data-purpose="网页 AI 提示"]'],
    ]) {
      const element = page.locator(selector).first();
      if (await element.count()) {
        await element.evaluate(el => { window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 24); });
        await page.screenshot({ path: path.join(output, `${name}-${width}.png`) });
      }
    }
    const figure = page.locator('figure').first();
    await figure.scrollIntoViewIfNeeded();
    await figure.locator('img').evaluate(i => i.decode());
    await page.waitForTimeout(150);
    await figure.screenshot({ path: path.join(output, `figure-${width}.png`) });
    if (width === 1440 && build.embeddedImages) {
      const pending = page.waitForEvent('download');
      await figure.locator('.figure-open').click();
      const download = await pending;
      const destination = path.join(output, 'standalone-download-check.png');
      await download.saveAs(destination);
      const source = await figure.locator('img').getAttribute('src');
      const expected = hash(Buffer.from(source.split(',')[1], 'base64'));
      const actual = hash(fs.readFileSync(destination));
      data.downloadCheck = { filename: download.suggestedFilename(), sha256: actual, matched: actual === expected };
      check(actual === expected, '单文件 PNG 保存内容不符');
    }
    check(!externalRequests.length && !pageErrors.length, '存在外部资源请求或脚本错误');
    delete data.codeTexts;
    records.push({ width, ...data, externalRequests, pageErrors });
    await page.close();
  }
  if (hash(fs.readFileSync(file)) !== inputSha256) failures.push('验证过程中 HTML 变化');
  writeJson(path.join(output, 'verification.json'), {
    schemaVersion: 2, generatedAt: new Date().toISOString(), input: relativeCourse(file), inputSha256,
    version: build.version, browser: browser.version(), status: failures.length ? 'FAIL' : 'PASS',
    scope: '离线阅读器显示、导航、常用资料、文本折行、代码原文与单文件图片保存；不验证教学实验',
    labVerified: false, pdfGenerated: false, visualReview: 'REQUIRES_IMAGE_VIEW', checks: records, failures,
  });
} finally { await browser.close(); }
if (failures.length) throw new Error(failures.join('\n'));
console.log(`通过：1440px / 390px 阅读器检查。报告：${relativeCourse(path.join(output, 'verification.json'))}`);
