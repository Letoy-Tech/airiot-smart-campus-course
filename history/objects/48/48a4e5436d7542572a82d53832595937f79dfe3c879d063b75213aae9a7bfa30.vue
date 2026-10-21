<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useCampusStore } from './stores/campus'
import FirstDeviceRead from './views/FirstDeviceRead.vue'

const store = useCampusStore()
const username = ref('')
const password = ref('')
const roleNames: Record<string, string> = { ADMIN: '管理员', CAMPUS_MANAGER: '校园管理人员', CAMPUS_VIEWER: '只读查看者' }
const roleText = computed(() => store.user?.roles.map((role) => roleNames[role] ?? role).join(' / '))
onMounted(() => { void store.initialize() })
async function submitLogin() {
  if (!username.value.trim() || !password.value || store.authBusy) return
  const suppliedPassword = password.value
  password.value = ''
  await store.signIn(username.value.trim(), suppliedPassword)
}
async function signOut() {
  username.value = ''
  password.value = ''
  await store.signOut()
}
</script>

<template>
  <a class="skip-link" href="#main-content">跳到主要内容</a>
  <header class="topbar">
    <a class="brand" href="/" aria-label="校园实验室首页">
      <span class="brand-symbol" aria-hidden="true">校</span>
      <span>校园实验室<small>AI 编程 · 智慧校园</small></span>
    </a>
    <div v-if="store.user" class="account">
      <span class="account-text"><strong>{{ store.user.displayName }}</strong><small>{{ roleText }}</small></span>
      <button class="button subtle" type="button" @click="signOut">退出 / 切换身份</button>
    </div>
    <span v-else class="edition">教师参考 · 第一条贯通</span>
  </header>

  <main id="main-content">
    <div v-if="!store.initialized || store.authBusy" class="session-loading" role="status">
      <span class="loading-line" aria-hidden="true"></span>
      <h1>{{ store.logoutUnconfirmed ? '正在确认退出' : '正在确认教学会话' }}</h1>
      <p>正在连接本组教学服务，请稍候。</p>
    </div>

    <FirstDeviceRead v-else-if="store.user" :key="store.sessionEpoch" />

    <div v-else class="login-layout">
      <section class="login-intro" aria-labelledby="welcome-title">
        <p class="eyebrow">智慧校园 · 独立教学工程</p>
        <h1 id="welcome-title">从一次真实请求，<br />读懂一个小系统。</h1>
        <p class="intro-copy">用教师分配的教学身份进入台账，沿着请求、响应和页面，核对每一条设备记录。</p>
        <div class="source-pill"><span aria-hidden="true"></span>TEACHING_MOCK · 教学模拟数据</div>
        <ol class="learning-path" aria-label="本次学习路径">
          <li><span>01</span><div><strong>确认身份</strong><p>角色由服务端返回</p></div></li>
          <li><span>02</span><div><strong>读取设备</strong><p>观察同一份接口合同</p></div></li>
          <li><span>03</span><div><strong>核对结果</strong><p>区分在线、离线与未知</p></div></li>
        </ol>
        <p class="boundary-note">本轮只完成登录与设备读取。事件处置、设备责任、真实 AIRIOT 接入留到后续学习。</p>
      </section>

      <section class="login-panel" aria-labelledby="login-title">
        <p class="eyebrow">进入本组环境</p>
        <h2 id="login-title">教学账号登录</h2>
        <p class="muted">账号由教师提供，没有预设密码。</p>
        <div v-if="store.authError" class="notice error" role="alert">{{ store.authError }}</div>
        <template v-if="store.logoutUnconfirmed">
          <button type="button" class="button primary full" @click="signOut">重新确认退出</button>
          <p class="field-help">退出确认前不显示旧身份数据。</p>
        </template>
        <form v-else @submit.prevent="submitLogin">
          <label for="username">教学账号</label>
          <input id="username" v-model="username" autocomplete="username" required maxlength="100" placeholder="输入教师分配的账号" />
          <label for="password">密码</label>
          <input id="password" v-model="password" autocomplete="current-password" type="password" required maxlength="200" placeholder="输入本组教学密码" />
          <p class="field-help">密码仅用于本次登录，不保存到浏览器存储。</p>
          <button class="button primary full" type="submit" :disabled="!username.trim() || !password">登录并查看设备 <span aria-hidden="true">→</span></button>
        </form>
        <button v-if="store.authError && !store.logoutUnconfirmed" class="text-button" type="button" @click="store.initialize">重新连接教学服务</button>
        <div class="login-footer"><span aria-hidden="true">◉</span> 本地教学环境 · 不连接真实校园设备</div>
      </section>
    </div>
  </main>
  <footer class="site-footer"><span>AI 编程课程资源</span><span>先预测 · 再操作 · 留证据</span></footer>
</template>
