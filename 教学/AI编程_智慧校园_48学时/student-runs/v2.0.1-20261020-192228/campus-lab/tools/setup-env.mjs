// 校园值班台 · 本地口令生成（Node 22 自带模块，无第三方依赖）
// 用法：在项目根目录执行  node tools/setup-env.mjs
// 作用：在项目根生成 .env，写入 DB_PASSWORD、MYSQL_ROOT_PASSWORD、REDIS_PASSWORD、DEMO_PASSWORD。
// 约定：已存在 .env 时只提示已保留、不覆盖，重复练习沿用现有配置；口令只在 .env 中落盘，控制台不打印任何口令内容。

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const ENV_PATH = path.join(PROJECT_ROOT, ".env");

// 只使用无歧义字母数字：避开 0/O、1/l/I，方便学生从 .env 手动抄写 DEMO_PASSWORD。
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

// 数据库与 Redis 口令较长且只需机器传参；DEMO_PASSWORD 要人工输入，稍短但仍远高于课堂所需强度。
const SECRET_PLANS = [
  { key: "DB_PASSWORD", length: 40 },
  { key: "MYSQL_ROOT_PASSWORD", length: 40 },
  { key: "REDIS_PASSWORD", length: 40 },
  { key: "DEMO_PASSWORD", length: 20 },
];

/** 用 crypto 随机字节 + 拒绝采样生成口令，避免取模偏差。 */
function generateSecret(length) {
  const limit = 256 - (256 % ALPHABET.length);
  let out = "";
  while (out.length < length) {
    const bytes = crypto.randomBytes(length * 2);
    for (const byte of bytes) {
      if (byte >= limit) continue;
      out += ALPHABET[byte % ALPHABET.length];
      if (out.length === length) break;
    }
  }
  return out;
}

/** 任何已存在的同名条目（普通文件、符号链接、目录）都算已存在，一律不覆盖。 */
function envEntryExists() {
  try {
    fs.lstatSync(ENV_PATH);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

function buildEnvContent() {
  const lines = [
    "# 校园值班台 · 本机教学配置",
    "# 由 tools/setup-env.mjs 随机生成，只在本机使用。",
    "# 请勿提交到版本库、请勿粘贴进聊天/文档/前端代码/截图。",
    "# 本文件一旦存在即长期沿用：重复练习直接使用，不需要重新生成。",
    "",
  ];
  for (const plan of SECRET_PLANS) {
    lines.push(`${plan.key}=${generateSecret(plan.length)}`);
  }
  lines.push("");
  return lines.join("\n");
}

/** 已有的 .env 一律保留：只说明现状，不指导删除或重新生成。 */
function reportEnvKept() {
  console.error("[setup-env] 已存在 .env：本次不生成、不覆盖，现有配置已保留。");
  console.error("[setup-env] 直接沿用现有 .env 继续练习即可，无需再次运行本工具。");
}

function main() {
  if (envEntryExists()) {
    reportEnvKept();
    process.exitCode = 1;
    return;
  }

  let content;
  try {
    content = buildEnvContent();
  } catch (error) {
    console.error("[setup-env] 随机数生成失败，未写入 .env。", error?.code ?? "");
    process.exitCode = 1;
    return;
  }

  try {
    // wx：排他创建，绝不覆盖；0600：仅当前用户可读写。
    fs.writeFileSync(ENV_PATH, content, { encoding: "utf8", flag: "wx", mode: 0o600 });
  } catch (error) {
    if (error.code === "EEXIST") {
      reportEnvKept();
    } else {
      console.error("[setup-env] 写入 .env 失败，未生成配置。", error?.code ?? "");
    }
    process.exitCode = 1;
    return;
  }

  console.log("[setup-env] 已生成 .env：", ENV_PATH);
  for (const plan of SECRET_PLANS) {
    console.log(`  ${plan.key}：已生成（${plan.length} 位，本工具不显示内容）`);
  }
  console.log("[setup-env] 口令只在 .env 内；.env 已在 .gitignore 中，请勿复制到前端、README 或聊天窗口。");
  console.log("[setup-env] 下一步由你本人打开 .env 查看 DEMO_PASSWORD，并手动填进登录页。");
}

main();
