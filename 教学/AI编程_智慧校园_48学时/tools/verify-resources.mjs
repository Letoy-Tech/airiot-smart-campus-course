import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { courseDir, launchBrowser, option } from './runtime.mjs';
const output = path.resolve(courseDir, option('--output', 'illustrations/qa/round5-resources'));
fs.mkdirSync(output, { recursive: true });
const browser = await launchBrowser();
const records = [];
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    const errors = [], remote = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('http://**/*', route => { remote.push(route.request().url()); return route.abort(); });
    await page.route('https://**/*', route => { remote.push(route.request().url()); return route.abort(); });
    await page.goto(pathToFileURL(path.join(courseDir, 'resources/index.html')).href);
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => {document.documentElement.style.scrollBehavior='auto';for(const image of document.images) image.loading='eager'});
    await page.waitForFunction(() => [...document.images].every(i => i.complete && i.naturalWidth));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.equal(await page.locator('#devices tr').count(), 16);
    await page.locator('#space').selectOption('teaching_space_01');
    assert.equal(await page.locator('#devices tr').count(), 4);
    await page.locator('#online').selectOption('null');
    assert.equal(await page.locator('#devices tr').count(), 1);
    await page.locator('#space').selectOption('all');
    await page.locator('#online').selectOption('false');
    assert.equal(await page.locator('#devices tr').count(), 1);
    await page.locator('#online').selectOption('all');
    const broken = await page.evaluate(() => [...document.querySelectorAll('a[href^="#"]')].map(a => a.getAttribute('href')).filter(h => !document.getElementById(h.slice(1))));
    assert.deepEqual(broken, []); assert.deepEqual(errors, []); assert.deepEqual(remote, []);
    const fileLinks = await page.locator('a[href]').evaluateAll(links => links.map(a => a.href).filter(h => h.startsWith('file:')));
    for (const href of fileLinks) assert.equal(fs.existsSync(fileURLToPath(href)), true, href);
    await page.getByRole('link', { name: '第05章本地请求小工具', exact: true }).click();
    assert.equal(await page.evaluate(() => decodeURIComponent(location.hash)), '#task-05--本地直接请求小工具拒绝实验');
    assert.equal(await page.locator('#task-05--本地直接请求小工具拒绝实验').isVisible(), true);
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: path.join(output, `entry-${width}.png`) });
    await page.locator('#catalog').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(output, `catalog-${width}.png`) });
    await page.locator('#task').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(output, `task-${width}.png`) });
    records.push({ width, imagesLoaded: true, noPageOverflow: true, counts: [16, 4, 1, 1], errors, remote, brokenAnchors: broken, localFileLinks: fileLinks.length, crossChapterRequestToolLink: 'PASS' });
    await page.close();
  }
  fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify({ status: 'PASS', at: new Date().toISOString(), browser: browser.version(), scope: '离线资源页显示与夹具交互；不是后端实验', records }, null, 2) + '\n');
} finally { await browser.close(); }
console.log('资源页两尺寸、图片、离线、筛选与锚点PASS。');
