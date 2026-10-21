import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const toolsDir = path.dirname(fileURLToPath(import.meta.url));
export const courseDir = path.dirname(toolsDir);
export const fontFamily = '"PingFang SC", "Noto Sans CJK SC", "Microsoft YaHei", "Heiti SC", sans-serif';
const localRequire = createRequire(import.meta.url);

export function resolveDependency(name) {
  try { return localRequire.resolve(name); } catch { /* Optional, explicitly configured dependency cache. */ }
  for (const root of [process.env.COURSE_NODE_MODULES].filter(Boolean)) {
    try { return createRequire(path.join(root, '__course_resolver__.cjs')).resolve(name); } catch { /* next */ }
  }
  throw new Error(`缺少 ${name}。请从课程根目录执行 npm --prefix tools ci。离线环境可显式设置 COURSE_NODE_MODULES 到已验证的依赖目录。`);
}

export async function dependency(name) {
  const imported = await import(pathToFileURL(resolveDependency(name)).href);
  return imported.default && typeof imported.default === 'object' ? { ...imported.default, ...imported } : imported;
}

export function packageRoot(name) {
  let dir = path.dirname(resolveDependency(name));
  while (path.dirname(dir) !== dir) {
    const candidate = path.join(dir, 'package.json');
    if (fs.existsSync(candidate) && JSON.parse(fs.readFileSync(candidate, 'utf8')).name === name) return dir;
    dir = path.dirname(dir);
  }
  throw new Error(`无法定位 ${name} 的包目录`);
}

export function dependencyVersion(name) { return JSON.parse(fs.readFileSync(path.join(packageRoot(name), 'package.json'), 'utf8')).version; }

export async function launchBrowser() {
  const { chromium } = await dependency('playwright');
  const candidates = [process.env.COURSE_CHROMIUM_PATH, chromium.executablePath()];
  const executablePath = candidates.find(p => p && fs.existsSync(p));
  if (!executablePath) throw new Error('找不到锁定 Playwright 对应的 Chromium。请运行 node tools/node_modules/playwright/cli.js install chromium，或显式设置 COURSE_CHROMIUM_PATH 到已验证浏览器。');
  return chromium.launch({ headless: true, executablePath });
}

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function option(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  if (!process.argv[index + 1] || process.argv[index + 1].startsWith('--')) throw new Error(`${name} 缺少参数`);
  return process.argv[index + 1];
}

export function relativeCourse(file) { return path.relative(courseDir, file).split(path.sep).join('/'); }

export function assertCoursePath(file) {
  const relative = path.relative(courseDir, path.resolve(file));
  if (relative.startsWith('..') || path.isAbsolute(relative) || relative.split(path.sep).includes('.private')) throw new Error(`路径超出课程范围：${file}`);
}

export function writeJson(file, value) { fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n'); }
