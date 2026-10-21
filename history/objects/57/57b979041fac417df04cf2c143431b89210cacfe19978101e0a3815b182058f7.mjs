import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const toolsDir = path.dirname(fileURLToPath(import.meta.url));
export const courseDir = path.dirname(toolsDir);
export const fontFamily = '"PingFang SC", "Noto Sans CJK SC", "Microsoft YaHei", "Heiti SC", sans-serif';
const localRequire = createRequire(import.meta.url);
const bundled = path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');

export function resolveDependency(name) {
  try { return localRequire.resolve(name); } catch { /* A Codex runtime may supply this dependency. */ }
  for (const root of [process.env.COURSE_NODE_MODULES, bundled].filter(Boolean)) {
    try { return createRequire(path.join(root, '__course_resolver__.cjs')).resolve(name); } catch { /* next */ }
  }
  throw new Error(`缺少 ${name}。使用 load_workspace_dependencies 查找运行库并设置 COURSE_NODE_MODULES，或在 tools/ 安装依赖。`);
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
  const cache = path.join(os.homedir(), 'Library/Caches/ms-playwright');
  if (fs.existsSync(cache)) {
    const revisions = fs.readdirSync(cache).filter(n => /^chromium(-|_headless_shell-)/.test(n)).sort().reverse();
    for (const revision of revisions) {
      for (const suffix of ['chrome-headless-shell-mac-arm64/chrome-headless-shell', 'chrome-headless-shell-mac-x64/chrome-headless-shell', 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing', 'chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing']) {
        candidates.push(path.join(cache, revision, suffix));
      }
    }
  }
  const executablePath = candidates.find(p => p && fs.existsSync(p));
  if (!executablePath) throw new Error('找不到 Chromium。设置 COURSE_CHROMIUM_PATH，或使用已安装 Playwright 的 install chromium 命令。');
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
