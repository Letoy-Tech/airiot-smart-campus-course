#!/usr/bin/env node
// Creates a separate, deliberately faulty teaching exercise. Never edits a project.
import { constants, copyFileSync, existsSync, mkdirSync, realpathSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const courseRoot = realpathSync(fileURLToPath(new URL('../../../', import.meta.url)));
const fixtureRoot = fileURLToPath(new URL('./test-fixtures/', import.meta.url));
const files = ['README.md', 'readings.mjs', 'checks.lab.mjs'];

function inside(base, candidate) {
    const rel = relative(base, candidate);
    return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`));
}

try {
    if (process.argv.length !== 3) {
        throw new Error('用法：node create-testing-lab.mjs <父目录已存在、目标尚不存在的独立目录>');
    }
    if (Number(process.versions.node.split('.')[0]) !== 22) {
        throw new Error('本课使用 Node 22。请先在这个终端检查 node --version 并选择已安装的22版本。');
    }
    const requested = resolve(process.argv[2]);
    const parent = realpathSync(dirname(requested));
    const destination = join(parent, basename(requested));
    if (inside(courseRoot, destination)) {
        throw new Error('目标必须位于教材目录之外，不能把故意错误放进教材工程。');
    }
    for (let current = parent; ; current = dirname(current)) {
        if (existsSync(join(current, '.git')) || /^campus-lab(?:-|$)/i.test(basename(current))) {
            throw new Error('目标位于已有Git仓库或campus-lab内。请选择独立的新目录。');
        }
        if (dirname(current) === current) break;
    }
    // mkdir is intentionally non-recursive and fails atomically when the target exists.
    mkdirSync(destination);
    for (const file of files) {
        copyFileSync(join(fixtureRoot, file), join(destination, file), constants.COPYFILE_EXCL);
    }
    console.log(`已生成独立故意失败练习：${destination}`);
    console.log('请在编辑器打开该目录和 README.md；进入该目录后运行 node --test checks.lab.mjs。');
    console.log('不自动测试、不启动服务。首轮预期包含一项失败，请填写自己的实际结果。');
} catch (error) {
    const detail = error?.code === 'EEXIST'
        ? '目标已存在；未覆盖。请保留原目录，改用另一个尚不存在的目录。'
        : error?.code === 'ENOENT'
            ? '父目录或练习材料不存在。先核对路径及完整教学包，不自动创建父目录。'
            : error.message;
    console.error(`未完成生成：${detail}`);
    console.error('不会删除已有文件。若复制中断，请检查留下的内容，再选择新目录重做。');
    process.exitCode = 1;
}
