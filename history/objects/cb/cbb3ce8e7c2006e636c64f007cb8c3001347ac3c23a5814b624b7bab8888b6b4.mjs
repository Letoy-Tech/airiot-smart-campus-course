import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { courseDir, launchBrowser } from './runtime.mjs';
const project = path.join(courseDir, 'resources/campus-ai-course');
const output = path.join(project, 'evidence/first-chain-v1');
fs.mkdirSync(output, { recursive: true });
const accounts = JSON.parse(fs.readFileSync(path.join(project, '.private/accounts.json'), 'utf8')).accounts;
const baseURL = 'http://127.0.0.1:5178';
const browser = await launchBrowser();
const record = { at: new Date().toISOString(), platform: `${process.platform}/${process.arch}`, browser: browser.version(), scope: '真实本机前后端HTTP与Chromium；固定mock；不连接MySQL/AIRIOT；非Windows实机', checks: [], status: 'RUNNING' };
const check = (name, details = {}) => record.checks.push({ name, passed: true, ...details });
try {
  for (const account of accounts) {
    const context = await browser.newContext({ baseURL });
    assert.equal((await context.request.get('/api/campus/devices')).status(), 401);
    const token = (await (await context.request.get('/api/auth/csrf')).json()).data;
    const before = (await context.cookies()).find(c => c.name === 'COURSESESSION');
    assert.ok(before?.httpOnly); assert.equal(before?.sameSite, 'Strict');
    const login = await context.request.post('/api/auth/login', { form: { username: account.username, password: account.password }, headers: { [token.headerName]: token.token } });
    assert.equal(login.status(), 200); assert.equal((await login.json()).code, 0);
    const after = (await context.cookies()).find(c => c.name === 'COURSESESSION');
    assert.ok(after?.httpOnly); assert.equal(after?.sameSite, 'Strict'); assert.notEqual(after?.value, before?.value);
    const me = await (await context.request.get('/api/auth/me')).json();
    assert.equal(me.data.username, account.username); assert.equal(me.data.source, 'TEACHING_MOCK');
    const devices = await (await context.request.get('/api/campus/devices')).json();
    assert.deepEqual(devices.data.items.map(d => d.online), [true, null]);
    assert.equal(devices.data.observedAt, 1792303200000);
    assert.equal(devices.data.items.length, 2); assert.ok(devices.data.items.every(d => d.simulated === true && !('source' in d)));
    const caps = await (await context.request.get('/api/campus/capabilities')).json();
    assert.equal(caps.data.canControl, false); assert.equal(caps.data.canRead, true);
    assert.equal((await context.request.post('/api/campus/locations/campuses', { data: { name: '独立测试' } })).status(), 403);
    const fresh = (await (await context.request.get('/api/auth/csrf')).json()).data;
    const write = await context.request.post('/api/campus/locations/campuses', { data: { name: '独立测试' }, headers: { [fresh.headerName]: fresh.token } });
    assert.equal(write.status(), account.username === 'admin' ? 501 : 403);
    const logout = await context.request.post('/api/auth/logout', { headers: { [fresh.headerName]: fresh.token } });
    assert.equal(logout.status(), 200);
    assert.equal((await context.request.get('/api/campus/devices')).status(), 401);
    check('真实HTTP身份/CSRF/读取/退出', { identity: account.username, roles: me.data.roles, cookieHttpOnly: true, cookieSameSite: 'Strict', sessionIdRotated: true, writeStatus: write.status(), writeScope: '未实现的校园写入桩，非数据库业务验收' });
    await context.close();
  }
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ baseURL, viewport: { width, height: 1000 } });
    const page = await context.newPage();
    const pageErrors = []; page.on('pageerror', error => pageErrors.push(error.message));
    await page.goto('/#first-read');
    await page.getByLabel('教学账号', { exact: true }).waitFor();
    await page.screenshot({ path: path.join(output, `${width === 1440 ? 'desktop' : 'mobile'}-login.png`), fullPage: true });
    const account = accounts.find(a => a.username === (width === 1440 ? 'admin' : 'viewer'));
    await page.getByLabel('教学账号', { exact: true }).fill(account.username);
    await page.getByLabel('密码', { exact: true }).fill(account.password);
    await page.getByRole('button', { name: '登录并查看设备' }).click();
    await page.locator('.device-table tbody tr').first().waitFor();
    assert.equal(await page.locator('.device-table tbody tr').count(), 2);
    assert.deepEqual(await page.locator('.device-table .status').allTextContents(), ['在线', '未知']);
    const time = await page.locator('.source-banner time').getAttribute('datetime');
    assert.equal(time, '2026-10-18T06:00:00.000Z');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(output, `${width === 1440 ? 'desktop' : 'mobile'}-ledger.png`), fullPage: true });
    await page.locator('#state-filter').selectOption('unknown');
    assert.equal(await page.locator('.device-table tbody tr').count(), 1);
    await page.getByRole('button', { name: '清除筛选', exact: true }).first().click();
    // 等价于仅阻断设备请求的浏览器网络条件，不改源码、不重载。
    await page.route('**/api/campus/devices', route => route.abort('blockedbyclient'));
    await page.getByRole('button', { name: '重新读取' }).click();
    await page.getByText('本次更新失败，以下保留上次成功快照。', { exact: true }).waitFor();
    assert.equal(await page.locator('.device-table tbody tr').count(), 2);
    assert.equal(await page.locator('.source-banner time').getAttribute('datetime'), time);
    await page.screenshot({ path: path.join(output, `${width === 1440 ? 'desktop' : 'mobile'}-failure.png`), fullPage: true });
    await page.unroute('**/api/campus/devices');
    await page.getByRole('button', { name: '重新读取' }).click();
    await page.waitForFunction(() => !document.querySelector('.notice.error'));
    await page.getByRole('button', { name: '退出 / 切换身份' }).click();
    await page.getByLabel('教学账号', { exact: true }).waitFor();
    assert.equal(await page.locator('.device-table').count(), 0);
    assert.deepEqual(await page.evaluate(() => Object.keys(localStorage)), []);
    assert.deepEqual(await page.evaluate(() => Object.keys(sessionStorage)), []);
    assert.deepEqual(pageErrors, []);
    check('真实页面读取/筛选/失败快照/恢复/退出/尺寸', { width, identity: account.username, horizontalOverflow: false, pageErrors, storageKeysEmpty: true, fault: '浏览器级阻断设备GET，非后端真实故障' });
    await context.close();
  }
  record.status = 'PASS';
} catch (error) {
  record.status = 'FAIL'; record.failure = error.message; throw error;
} finally {
  fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify(record, null, 2) + '\n');
  await browser.close();
}
console.log(`首次链路浏览器/HTTP检查${record.status}；${record.checks.length}组，未输出凭据。`);
