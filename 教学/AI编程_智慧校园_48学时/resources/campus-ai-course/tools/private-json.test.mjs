import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { readPrivateJson } from './private-json.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function temporary(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'course-json-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}
for (const bom of ['', '\uFEFF']) {
  test(`private JSON accepts UTF-8 ${bom ? 'with' : 'without'} BOM`, t => {
    const file = path.join(temporary(t), 'config.json');
    fs.writeFileSync(file, bom + JSON.stringify({ username: '教学用户', password: 'synthetic-test-only' }));
    assert.deepEqual(readPrivateJson(file), { username: '教学用户', password: 'synthetic-test-only' });
  });
}
for (const [label, data] of [
  ['malformed JSON', '{"password":"secret-sentinel" BROKEN'],
  ['array root', '["secret-sentinel"]'],
  ['null root', 'null'],
  ['UTF-16LE', Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('{"password":"secret-sentinel"}', 'utf16le')])],
  ['invalid UTF-8', Buffer.from([0x7b, 0x22, 0xff, 0x22, 0x7d])],
]) {
  test(`${label} fails with sanitized error`, t => {
    const file = path.join(temporary(t), 'config.json');
    fs.writeFileSync(file, data);
    assert.throws(() => readPrivateJson(file), error => {
      assert.match(error.message, /UTF-8 JSON object/);
      assert.ok(!error.message.includes('secret-sentinel'));
      assert.equal(error.cause, undefined);
      return true;
    });
  });
}

// Exercise the real script entrypoints with synthetic BOM configs. The preload replaces
// child_process only inside each test process: no Java, Maven, database or network starts.
for (const [label, script, args] of [
  ['course migrate (accounts + database)', 'tools/course.mjs', ['migrate']],
  ['account admin', 'backend/tools/account-admin.mjs', ['admin', '--roles', 'CAMPUS_VIEWER']],
  ['MySQL test runner', 'backend/tools/test-mysql.mjs', ['test']],
]) {
  test(`${label} reads BOM config before launching its child`, t => {
    const dir = temporary(t);
    for (const file of [script, 'tools/private-json.mjs']) {
      fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
      fs.copyFileSync(path.join(root, file), path.join(dir, file));
    }
    fs.mkdirSync(path.join(dir, '.private'), { recursive: true });
    const config = {
      url: 'jdbc:mysql://127.0.0.1:1/campus_course_synthetic_test', username: 'synthetic-user',
      password: 'synthetic-private-secret', allowTestReset: true, allowAccountAdministration: true,
    };
    for (const name of ['database.json', 'test-database.json']) {
      fs.writeFileSync(path.join(dir, '.private', name), '\uFEFF' + JSON.stringify(config));
    }
    fs.writeFileSync(path.join(dir, '.private/accounts.json'), '\uFEFF' + JSON.stringify({
      accounts: ['admin', 'manager-a', 'manager-b', 'viewer'].map(username => ({ username, password: 'synthetic-account-password' })),
    }));
    const javaHome = path.join(dir, 'fake-jdk');
    fs.mkdirSync(path.join(javaHome, 'bin'), { recursive: true });
    fs.writeFileSync(path.join(javaHome, 'bin', process.platform === 'win32' ? 'java.exe' : 'java'), '');
    fs.mkdirSync(path.join(dir, 'backend/target'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'backend/target/campus-ai-course-0.1.0.jar'), '');
    const preload = path.join(dir, 'fake-child.mjs');
    fs.writeFileSync(preload, `
import child from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { EventEmitter } from 'node:events';
import { writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
function check(args, options) {
  assert.equal(options.env.COURSE_DB_USERNAME, 'synthetic-user');
  assert.equal(options.env.COURSE_DB_PASSWORD, 'synthetic-private-secret');
  assert.equal(options.env.COURSE_DB_URL, 'jdbc:mysql://127.0.0.1:1/campus_course_synthetic_test');
  if (args.includes('--course.migrate-only=true')) assert.equal(options.env.COURSE_ADMIN_PASSWORD, 'synthetic-account-password');
  writeFileSync(process.env.COURSE_JSON_TEST_MARKER, 'child-configuration-accepted');
}
child.spawnSync = (command, args, options) => {
  if (args.includes('-version')) return { status: 0, stdout: '', stderr: 'openjdk version "17.0.6"' };
  check(args, options); return { status: 0 };
};
child.spawn = (command, args, options) => {
  check(args, options); const emitter = new EventEmitter();
  process.nextTick(() => emitter.emit('exit', 0, null)); return emitter;
};
syncBuiltinESMExports();
`);
    const marker = path.join(dir, 'child-accepted.txt');
    const result = spawnSync(process.execPath, ['--import', preload, path.join(dir, script), ...args], {
      cwd: dir, encoding: 'utf8', env: { ...process.env, JAVA_HOME: javaHome, COURSE_JSON_TEST_MARKER: marker },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.readFileSync(marker, 'utf8'), 'child-configuration-accepted');
    assert.ok(!(result.stdout + result.stderr).includes('synthetic-private-secret'));
    assert.ok(!(result.stdout + result.stderr).includes('synthetic-account-password'));
  });
}
