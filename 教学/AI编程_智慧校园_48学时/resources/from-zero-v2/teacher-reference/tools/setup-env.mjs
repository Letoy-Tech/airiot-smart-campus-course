import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const destination = fileURLToPath(new URL('../.env', import.meta.url));
const names = ['DB_PASSWORD', 'MYSQL_ROOT_PASSWORD', 'REDIS_PASSWORD', 'DEMO_PASSWORD'];
const lines = [
  '# 本机课堂练习配置，不提交、不打包、不发给 AI。',
  '# 三个练习账户 admin / manager / viewer 首次建库时使用 DEMO_PASSWORD。',
  '# 数据库已有账户后，改此文件不会重置已保存的账户口令。',
  ...names.map(name => `${name}=${randomBytes(24).toString('hex')}`),
  '',
];
try {
  await writeFile(destination, lines.join('\n'), { flag: 'wx', mode: 0o600 });
  console.log('已生成工程根目录的 .env。请只在本机编辑器查看 DEMO_PASSWORD；口令不会显示在终端。');
} catch (error) {
  if (error.code === 'EEXIST') {
    console.error('.env 已存在，已保留原文件。继续使用现有配置，不要重新生成口令或删除数据库。');
    process.exitCode = 1;
  } else {
    throw error;
  }
}
