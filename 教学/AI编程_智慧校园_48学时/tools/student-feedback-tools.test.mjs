/** Author-only regressions: hermetic CLI/export fixtures, never real credentials/services. */
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const course=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
function fixture(t) {
  const parent=fs.mkdtempSync(path.join(os.tmpdir(),'course-feedback-'))
  t.after(()=>fs.rmSync(parent,{recursive:true,force:true}))
  const root=path.join(parent,'app');fs.mkdirSync(path.join(root,'tools'),{recursive:true})
  return {parent,root}
}
function write(root,file,text){const dest=path.join(root,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,text);return dest}
function invoke(root,script,action,env={}){return spawnSync(process.execPath,[path.join(root,'tools',script),...(action?[action]:[])],{cwd:root,encoding:'utf8',env:{...process.env,...env}})}
function exporter(root){fs.copyFileSync(path.join(course,'tools/hand-in-template.mjs'),path.join(root,'tools/hand-in.mjs'))}
function exported(parent){return fs.readdirSync(parent).filter(n=>n.startsWith('app-handoff-'))}
test('hand-in不读教师目录/IDE配置/父目录，保存当前实现和逐文件清单',t=>{
  const {parent,root}=fixture(t);exporter(root)
  write(root,'frontend/src/mine.ts','export const student = true')
  write(root,'README.md','当前实现及真实未验证项')
  write(root,'.private/accounts.json',JSON.stringify({accounts:[{password:'fake-local-password-for-test-only'}]}))
  write(root,'.codebuddy/models.json','not an exportable model config')
  write(root,'journey-backups/old.ts','old answer')
  const outside=path.join(parent,'outside');fs.mkdirSync(outside);write(outside,'never-copy.txt','outside fixture')
  fs.symlinkSync(outside,path.join(root,'lesson-bundles'),'dir')
  fs.symlinkSync(outside,path.join(root,'frontend','lesson-bundles'),'dir')
  fs.symlinkSync(outside,path.join(parent,'docs'),'dir')
  const run=invoke(root,'hand-in.mjs');assert.equal(run.status,0,run.stderr)
  const names=exported(parent);assert.equal(names.length,1)
  const out=path.join(parent,names[0]);const manifest=JSON.parse(fs.readFileSync(path.join(out,'HANDIN-MANIFEST.json')))
  assert.ok(manifest.files.some(x=>x.path==='frontend/src/mine.ts'))
  assert.ok(manifest.excluded.includes('lesson-bundles'));assert.ok(manifest.excluded.includes('.codebuddy'))
  assert.ok(!manifest.files.some(x=>/lesson-bundles|\.private|\.codebuddy|journey-backups|project-docs|never-copy/.test(x.path)))
  assert.equal(fs.readFileSync(path.join(out,'frontend/src/mine.ts'),'utf8'),'export const student = true')
})
test('交付前命中当前迁移密码则拒绝，且错误不打印密码',t=>{
  const {parent,root}=fixture(t);exporter(root)
  const fake='fake-migration-secret-only-for-hermetic-test'
  write(root,'.private/migration-database.json',JSON.stringify({password:fake}))
  write(root,'docs/bad.md',fake)
  const run=invoke(root,'hand-in.mjs');assert.equal(run.status,1)
  assert.match(run.stderr,/待交付文件含/);assert.ok(!run.stderr.includes(fake));assert.equal(exported(parent).length,0)
})
test('正常源码的符号链接仍拒绝，不能借链接导出外部文件',t=>{
  const {parent,root}=fixture(t);exporter(root)
  const target=write(parent,'outside.txt','external private fixture')
  fs.mkdirSync(path.join(root,'frontend'));fs.symlinkSync(target,path.join(root,'frontend','leak.txt'))
  const run=invoke(root,'hand-in.mjs');assert.equal(run.status,1);assert.match(run.stderr,/符号链接/);assert.equal(exported(parent).length,0)
})
function runtimeFixture(t,pathVersion=17){
  const {root,parent}=fixture(t)
  fs.copyFileSync(path.join(course,'tools/course-template.mjs'),path.join(root,'tools/course.mjs'))
  fs.copyFileSync(path.join(course,'resources/student-project/tools/private-json.mjs'),path.join(root,'tools/private-json.mjs'))
  const jdk=path.join(parent,'jdk17');const fakeBin=path.join(parent,'path-bin')
  const fakeJava=v=>`#!/bin/sh\nprintf 'openjdk version "${v}.0.12"\\n' >&2\n`
  fs.chmodSync(write(jdk,'bin/java',fakeJava(17)),0o700)
  fs.chmodSync(write(fakeBin,'java',fakeJava(pathVersion)),0o700)
  return {root,env:{JAVA_HOME:jdk,PATH:fakeBin+path.delimiter+process.env.PATH}}
}
test('doctor-env检查JAVA_HOME之外的PATH，不再隐藏Java21冲突',{skip:process.platform==='win32'},t=>{
  const {root,env}=runtimeFixture(t,21);const run=invoke(root,'course.mjs','doctor-env',env)
  assert.equal(run.status,1);assert.match(run.stderr,/PATH中的java不是17/)
})
test('doctor-env不要求后端文件，也不声称端口或数据库通过',{skip:process.platform==='win32'},t=>{
  const {root,env}=runtimeFixture(t);const run=invoke(root,'course.mjs','doctor-env',env)
  assert.equal(run.status,0,run.stderr);assert.match(run.stdout,/未检查端口、数据库或业务/)
})
test('build-backend不会编译未完成前端，仍实际调用Maven package',{skip:process.platform==='win32'},t=>{
  const {root,env}=runtimeFixture(t)
  write(root,'backend/mvnw','#!/bin/sh\nprintf "%s" "$*" > maven-called.txt\n')
  write(root,'frontend/src/unfinished.vue','<template>JOURNEY_IMPLEMENTATION_REQUIRED</template>')
  const run=invoke(root,'course.mjs','build-backend',env)
  assert.equal(run.status,0,run.stderr)
  assert.equal(fs.readFileSync(path.join(root,'backend/maven-called.txt'),'utf8'),'package')
  assert.match(run.stdout,/未编译\/验收待写前端/)
})
