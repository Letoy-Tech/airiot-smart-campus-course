import { readPrivateJson } from '../../tools/private-json.mjs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
const here = dirname(fileURLToPath(import.meta.url))
const backend = resolve(here, '..')
const config = readPrivateJson(resolve(here, '../../.private/test-database.json'))
if (typeof config.url !== 'string' || !config.url.startsWith('jdbc:mysql://')) throw new Error('A MySQL JDBC URL is required')
const schema = new URL(config.url.replace(/^jdbc:/, '')).pathname.slice(1)
if (config.allowTestReset !== true || !/^campus_course_[A-Za-z0-9_]+$/.test(schema) || !schema.endsWith('_test')) throw new Error('Explicit reset authorization for a dedicated teaching TEST schema required')
const args = ['-B', ...process.argv.slice(2)]
if (args.length === 1) args.push('test')
const result = spawnSync(process.platform === 'win32' ? 'cmd.exe' : 'sh', process.platform === 'win32' ? ['/d', '/s', '/c', 'mvnw.cmd', ...args] : ['./mvnw', ...args], {
  cwd: backend, stdio: 'inherit', env: { ...process.env, COURSE_TEST_MYSQL: 'true', COURSE_ALLOW_TEST_RESET: 'true', COURSE_DB_URL: config.url, COURSE_DB_USERNAME: config.username, COURSE_DB_PASSWORD: config.password, COURSE_DB_MIGRATE: 'true' },
})
if (result.error) console.error('Could not start the Java 17 / Maven test runner')
process.exit(result.status ?? 1)
