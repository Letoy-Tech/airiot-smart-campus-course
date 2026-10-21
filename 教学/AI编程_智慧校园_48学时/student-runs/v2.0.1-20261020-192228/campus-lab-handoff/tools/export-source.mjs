#!/usr/bin/env node
// 校园值班台 · 第12课公开源码导出（Node 22 自带模块，无第三方依赖）
//
// 用法（在项目根目录）：
//   node tools/export-source.mjs --out .runtime/hand-in-v1/campus-lab
//
// 规则：
//   1. 只允许写到本项目 .runtime/ 下；输出目录必须原本不存在，已存在则拒绝覆盖。
//   2. 只按白名单复制公开源码，不遍历、不读取上级目录，不包含教师参考。
//   3. 任何层级都排除 .env 及 .env.* 变体（只保留根 .env.example）、.private、.runtime、
//      .codebuddy、node_modules、target、日志、个人截图与凭据文件。
//   4. 从文件系统根开始，项目根及其更高父目录、源路径与输出路径的每一级都检查符号链接，
//      发现即拒绝；只取 lstat 元数据，不读取上级目录内容。
//   5. 导出前读取根 .env 的值做泄漏检查；所有待复制文件都按原始字节完整比对，
//      不按体积、扩展名或“是否文本”跳过，读取失败即停止；只在内存里比对，不显示值。
//      一旦命中本机口令，立即停止，且只报告文件名。
//   6. 输出 SHA256SUMS.txt（两列：哈希 + 相对路径），可 cd 到输出目录后校验。
//
// 本工具只负责“复制 + 校验”，不启动任何服务，也不代表新目录已经能运行。

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const RUNTIME = path.join(ROOT, ".runtime");

// 白名单：只导出这些公开内容；不在此列表中的一律不碰。
const ALLOWLIST = [
  { type: "dir", rel: "frontend" },
  { type: "dir", rel: "backend/src" },
  { type: "file", rel: "backend/pom.xml" },
  { type: "file", rel: "backend/mvnw" },
  { type: "file", rel: "backend/mvnw.cmd" },
  { type: "dir", rel: "backend/.mvn" },
  { type: "dir", rel: "tools" },
  { type: "dir", rel: "materials" },
  { type: "file", rel: "compose.yaml" },
  { type: "file", rel: ".env.example" },
  { type: "file", rel: ".gitignore" },
  { type: "file", rel: "README.md" },
  { type: "dir", rel: "docs" },
];

// 目录名或文件名命中即跳过（大小写不敏感）。
const BLOCKED_SEGMENTS = new Set([
  ".private",
  ".runtime",
  ".codebuddy",
  "node_modules",
  "target",
  "logs",
  "process",
  "delivery",
  ".git",
  "screenshots",
  "screenshot",
]);

// 个人截图/凭据/构建产物的扩展名；本课程公开源码不含图片资产。
const BLOCKED_EXTENSIONS = new Set([
  ".log",
  ".pem",
  ".key",
  ".p12",
  ".pfx",
  ".jks",
  ".keystore",
  ".class",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".bmp",
  ".heic",
]);

// 明确属于凭据或个人配置的文件名。
const BLOCKED_NAMES = new Set([
  "id_rsa",
  "id_dsa",
  "id_ecdsa",
  "id_ed25519",
  ".npmrc",
  ".netrc",
  ".pgpass",
  "credentials",
  "credentials.json",
  ".ds_store",
]);

const PLACEHOLDER_VALUES = new Set([
  "change-me",
  "changeme",
  "your-password",
  "example",
  "password",
  "todo",
]);

function fail(message) {
  console.error(`[export] ${message}`);
  process.exitCode = 1;
}

function parseArgs(argv) {
  let out = null;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") return { help: true, out: null };
    if (arg === "--out") {
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) throw new Error("--out 需要一个目录参数");
      out = value;
      i += 1;
      continue;
    }
    if (arg.startsWith("--out=")) {
      out = arg.slice("--out=".length);
      if (!out) throw new Error("--out 需要一个目录参数");
      continue;
    }
    throw new Error(`未知参数：${arg}`);
  }
  if (!out) throw new Error("缺少 --out，例如：node tools/export-source.mjs --out .runtime/hand-in-v1/campus-lab");
  return { help: false, out };
}

function usage() {
  console.log("用法：node tools/export-source.mjs --out .runtime/<批次>/campus-lab");
  console.log("");
  console.log("  --out <dir>  输出目录，必须位于本项目 .runtime/ 下，且原本不存在");
  console.log("  --help       显示本说明");
}

/** 把绝对路径转换为相对项目根的 POSIX 路径，便于写清单与报错。 */
function toRel(absPath) {
  return path.relative(ROOT, absPath).split(path.sep).join("/");
}

/** 已确认不是符号链接的目录缓存，避免对同一个祖先反复 lstat。 */
const verifiedNoSymlink = new Set();

async function lstatOrNull(absPath) {
  try {
    return await fsp.lstat(absPath);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function displayPath(absPath) {
  const rel = path.relative(ROOT, absPath);
  if (rel && !rel.startsWith("..") && !path.isAbsolute(rel)) return rel;
  return absPath;
}

/**
 * 从文件系统根开始，逐级检查目标路径的每一级（含项目根及其更高父目录、目标自身）。
 * 任何一级是符号链接就拒绝；遇到尚不存在的层级即停止。
 * 这里只读取路径元数据（lstat），不读取上级目录中的任何文件内容。
 */
async function assertNoSymlinkChain(absPath) {
  const parsed = path.parse(absPath);
  const root = parsed.root;
  const segments = absPath
    .slice(root.length)
    .split(path.sep)
    .filter((segment) => segment.length > 0);

  const chain = [root];
  let current = root;
  for (const segment of segments) {
    current = path.join(current, segment);
    chain.push(current);
  }

  for (const entry of chain) {
    if (verifiedNoSymlink.has(entry)) continue;
    const stat = await lstatOrNull(entry);
    if (!stat) return;
    if (stat.isSymbolicLink()) {
      throw new Error(`路径含符号链接，拒绝处理：${displayPath(entry)}`);
    }
    verifiedNoSymlink.add(entry);
  }
}

/** 输出目录必须是 .runtime 的子目录，且尚不存在。 */
async function resolveOutputDir(outArg) {
  const outAbs = path.resolve(process.cwd(), outArg);
  const relToRuntime = path.relative(RUNTIME, outAbs);
  const outsideRuntime =
    relToRuntime === "" ||
    relToRuntime === ".." ||
    relToRuntime.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relToRuntime);
  if (outsideRuntime) {
    throw new Error("--out 必须指向本项目 .runtime/ 下的一个新目录");
  }

  await assertNoSymlinkChain(path.dirname(outAbs));

  try {
    await fsp.lstat(outAbs);
    throw new Error(`输出目录已存在，拒绝覆盖：${toRel(outAbs)}`);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  return outAbs;
}

/** 判断某个相对路径是否应被排除；返回原因字符串或 null。 */
function exclusionReason(relPosix, name) {
  const lowerName = name.toLowerCase();
  const segments = relPosix.split("/");
  const lowerSegments = segments.map((segment) => segment.toLowerCase());

  for (const segment of lowerSegments) {
    if (BLOCKED_SEGMENTS.has(segment)) return "排除的目录或名称";
  }
  if (BLOCKED_NAMES.has(lowerName)) return "凭据或个人配置文件";

  const isRootEnvExample = relPosix === ".env.example";
  if (lowerName === ".env" || lowerName.endsWith(".env")) return ".env 文件";
  if (lowerName.startsWith(".env.") && !isRootEnvExample) return ".env 变体";

  const ext = path.extname(lowerName);
  if (BLOCKED_EXTENSIONS.has(ext)) {
    if ([".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".heic"].includes(ext)) {
      return "个人截图或图片";
    }
    if (ext === ".class") return "编译产物";
    if (ext === ".log") return "日志";
    return "凭据或密钥文件";
  }
  return null;
}

async function collectDir(absDir, relDir, files, skipped) {
  await assertNoSymlinkChain(absDir);
  const entries = await fsp.readdir(absDir, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name, "en"));

  for (const entry of entries) {
    const abs = path.join(absDir, entry.name);
    const rel = relDir ? `${relDir}/${entry.name}` : entry.name;
    const stat = await fsp.lstat(abs);

    if (stat.isSymbolicLink()) {
      throw new Error(`源路径含符号链接，拒绝导出：${rel}`);
    }
    if (stat.isDirectory()) {
      const reason = exclusionReason(rel, entry.name);
      if (reason) {
        skipped.push({ rel, reason });
        continue;
      }
      await collectDir(abs, rel, files, skipped);
      continue;
    }
    if (stat.isFile()) {
      const reason = exclusionReason(rel, entry.name);
      if (reason) {
        skipped.push({ rel, reason });
        continue;
      }
      files.push({ abs, rel, mode: stat.mode });
      continue;
    }
    skipped.push({ rel, reason: "非常规文件" });
  }
}

async function collectFiles() {
  const files = [];
  const skipped = [];

  for (const item of ALLOWLIST) {
    const abs = path.join(ROOT, item.rel);
    await assertNoSymlinkChain(abs);

    let stat;
    try {
      stat = await fsp.lstat(abs);
    } catch (error) {
      if (error.code === "ENOENT") {
        throw new Error(`白名单条目不存在：${item.rel}`);
      }
      throw error;
    }
    if (stat.isSymbolicLink()) {
      throw new Error(`白名单条目是符号链接，拒绝导出：${item.rel}`);
    }

    if (item.type === "dir") {
      if (!stat.isDirectory()) throw new Error(`白名单条目不是目录：${item.rel}`);
      const reason = exclusionReason(item.rel, path.basename(item.rel));
      if (reason) {
        skipped.push({ rel: item.rel, reason });
        continue;
      }
      await collectDir(abs, item.rel, files, skipped);
    } else {
      if (!stat.isFile()) throw new Error(`白名单条目不是文件：${item.rel}`);
      const reason = exclusionReason(item.rel, path.basename(item.rel));
      if (reason) {
        skipped.push({ rel: item.rel, reason });
        continue;
      }
      files.push({ abs, rel: item.rel, mode: stat.mode });
    }
  }

  files.sort((a, b) => a.rel.localeCompare(b.rel, "en"));
  return { files, skipped };
}

/** 读取根 .env 的口令值，仅在内存中用于泄漏比对。 */
async function loadLocalSecrets() {
  const envPath = path.join(ROOT, ".env");
  let stat;
  try {
    stat = await fsp.lstat(envPath);
  } catch (error) {
    if (error.code === "ENOENT") return { secrets: [], note: "未发现根目录 .env，跳过口令泄漏检查（这不代表没有泄漏）" };
    throw error;
  }
  if (stat.isSymbolicLink()) {
    throw new Error("根目录 .env 是符号链接，拒绝读取，请先把口令文件换成普通文件");
  }

  const raw = await fsp.readFile(envPath, "utf8");
  const secrets = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(trimmed);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (value.length < 8) continue;
    if (PLACEHOLDER_VALUES.has(value.toLowerCase())) continue;
    secrets.push(value);
  }
  return { secrets, note: null };
}

/**
 * 逐文件检查是否出现本机口令。
 * 所有待复制文件都按原始字节完整比对，不按体积、扩展名或“是否文本”跳过；读取失败即停止。
 * 只返回命中的文件名，绝不返回口令、口令所在行或文件片段。
 */
async function findLeaks(files, secrets) {
  const secretBuffers = secrets.map((secret) => Buffer.from(secret, "utf8"));
  const leakFiles = [];

  for (const file of files) {
    let buffer;
    try {
      buffer = await fsp.readFile(file.abs);
    } catch (error) {
      throw new Error(
        `读取待导出文件失败，已停止：${file.rel}（${error?.code ?? "未知错误"}）`
      );
    }
    if (secretBuffers.some((secretBuffer) => buffer.includes(secretBuffer))) {
      leakFiles.push(file.rel);
    }
  }
  return { leakFiles, scanned: files.length };
}

async function sha256Of(filePath) {
  const hash = crypto.createHash("sha256");
  hash.update(await fsp.readFile(filePath));
  return hash.digest("hex");
}

async function copyAll(files, outAbs) {
  const manifest = [];
  for (const file of files) {
    const target = path.join(outAbs, ...file.rel.split("/"));
    await fsp.mkdir(path.dirname(target), { recursive: true });
    await fsp.copyFile(file.abs, target);
    try {
      await fsp.chmod(target, file.mode & 0o777);
    } catch {
      // Windows 上 chmod 可能无效，不影响内容完整性。
    }
    manifest.push(`${await sha256Of(target)}  ${file.rel}`);
  }
  return manifest;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }

  await assertNoSymlinkChain(ROOT);

  const outAbs = await resolveOutputDir(args.out);
  const { files, skipped } = await collectFiles();
  if (files.length === 0) throw new Error("白名单没有收集到任何文件，已停止");

  const { secrets, note } = await loadLocalSecrets();
  if (note) console.log(`[export] ${note}`);
  if (!note && secrets.length === 0) {
    console.log("[export] 根 .env 存在，但未解析到可检查的口令值（可能都是占位符或过短），本次没有做口令比对。");
  }

  let leakInfo = { leakFiles: [], scanned: 0 };
  if (secrets.length > 0) {
    leakInfo = await findLeaks(files, secrets);
  }
  if (leakInfo.leakFiles.length > 0) {
    console.error("[export] 待导出的文件中出现本机口令，已停止，未写入任何文件。");
    console.error("[export] 涉及文件（不含口令内容）：");
    for (const rel of leakInfo.leakFiles) console.error(`  - ${rel}`);
    console.error("[export] 请先清理这些文件中的口令后再导出。");
    process.exitCode = 1;
    return;
  }

  await assertNoSymlinkChain(RUNTIME);
  await fsp.mkdir(RUNTIME, { recursive: true });
  await fsp.mkdir(path.dirname(outAbs), { recursive: true });

  try {
    await fsp.mkdir(outAbs, { recursive: false });
  } catch (error) {
    if (error.code === "EEXIST") throw new Error(`输出目录已存在，拒绝覆盖：${toRel(outAbs)}`);
    throw error;
  }

  let manifest;
  try {
    manifest = await copyAll(files, outAbs);
  } catch (error) {
    throw new Error(`复制失败，${toRel(outAbs)} 可能不完整（未自动删除）：${error?.message ?? error}`);
  }
  const manifestPath = path.join(outAbs, "SHA256SUMS.txt");
  await fsp.writeFile(manifestPath, `${manifest.join("\n")}\n`, "utf8");

  const totalBytes = files.reduce((sum, file) => sum + fs.statSync(file.abs).size, 0);

  console.log(`[export] 源目录：${ROOT}`);
  console.log(`[export] 输出目录：${outAbs}`);
  console.log(`[export] 已复制：${files.length} 个文件，共 ${totalBytes} 字节`);
  console.log(`[export] 已跳过：${skipped.length} 项（.env/.private/.runtime/.git/node_modules/target/日志/截图/凭据）`);
  for (const item of skipped) {
    console.log(`  - 跳过 ${item.rel}（${item.reason}）`);
  }
  if (secrets.length > 0) {
    console.log(
      `[export] 口令泄漏检查：${leakInfo.scanned} 个待导出文件全部按字节比对，未命中（未显示任何口令）`
    );
  }
  console.log(`[export] 清单：${toRel(manifestPath)}`);
  console.log("");
  for (const line of manifest) console.log(line);
  console.log("");
  console.log("[export] 校验：进入输出目录后执行 sha256sum -c SHA256SUMS.txt（macOS 可用 shasum -a 256 -c SHA256SUMS.txt）");
  console.log("[export] 说明：导出成功只代表文件复制完整，不代表新目录已经启动或验收通过。");
}

main().catch((error) => {
  fail(error?.message ?? String(error));
});
