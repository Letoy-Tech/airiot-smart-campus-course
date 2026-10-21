import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
const here = dirname(fileURLToPath(import.meta.url))
const config = JSON.parse(readFileSync(resolve(here, '../../.private/database.json'), 'utf8'))
if (typeof config.url !== 'string' || !config.url.startsWith('jdbc:mysql://')) throw new Error('A MySQL JDBC URL is required')
const schema = new URL(config.url.replace(/^jdbc:/, '')).pathname.slice(1)
if (config.allowAccountAdministration !== true || !/^campus_course_[A-Za-z0-9_]+$/.test(schema)) throw new Error('Explicit account-administration authorization for a dedicated teaching schema required')
const java = process.env.JAVA_HOME ? resolve(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java') : 'java'
const result = spawnSync(java, ['-jar', resolve(here, '../target/campus-ai-course-0.1.0.jar'), 'account', ...process.argv.slice(2)], {
  stdio: 'inherit', env: { ...process.env, COURSE_DB_URL: config.url, COURSE_DB_USERNAME: config.username, COURSE_DB_PASSWORD: config.password, COURSE_ALLOW_ACCOUNT_ADMINISTRATION: 'true' },
})
if (result.error) console.error('Could not start Java 17 account tool')
process.exit(result.status ?? 1)
