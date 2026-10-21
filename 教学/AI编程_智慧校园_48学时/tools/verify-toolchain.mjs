// 依赖和浏览器预检；不读取账号、不启动教学服务、不修改课程正文或图件。
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { toolsDir, resolveDependency, dependencyVersion, launchBrowser } from './runtime.mjs';

const expected = JSON.parse(fs.readFileSync(path.join(toolsDir, 'package.json'), 'utf8')).dependencies;
const report = { at: new Date().toISOString(), scope: 'Node教学出版工具与浏览器预检；不代表业务实验或图面审校', node: process.version, dependencies: {}, status: 'RUNNING' };
let browser;
try {
  assert.ok(Number(process.versions.node.split('.')[0]) >= 22, '需要Node22或更新版本');
  for (const name of ['marked', 'mermaid', 'playwright']) {
    const version = dependencyVersion(name);
    assert.equal(version, expected[name], `${name} 与声明版本不符；请重新 npm --prefix tools ci`);
    const resolved = resolveDependency(name);
    const relative = path.relative(path.join(toolsDir, 'node_modules'), resolved);
    const local = relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
    assert.ok(local || process.env.COURSE_NODE_MODULES, `${name} 不能隐式来自工程外依赖`);
    report.dependencies[name] = { version, origin: local ? 'tools/node_modules' : 'explicit COURSE_NODE_MODULES' };
  }
  browser = await launchBrowser();
  report.browser = browser.version();
  report.browserSource = process.env.COURSE_CHROMIUM_PATH ? 'explicit COURSE_CHROMIUM_PATH' : 'locked Playwright browser installation';
  const page = await browser.newPage();
  await page.setContent('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><h1>教学工具预检</h1></html>');
  assert.equal(await page.locator('h1').textContent(), '教学工具预检');
  report.status = 'PASS';
} catch (error) {
  report.status = 'FAIL';
  report.failure = error.message;
  process.exitCode = 1;
} finally {
  await browser?.close();
  console.log(JSON.stringify(report, null, 2));
}
