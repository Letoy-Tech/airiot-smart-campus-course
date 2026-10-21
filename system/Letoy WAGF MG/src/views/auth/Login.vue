<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/store/auth'
import { theme, toggleTheme } from '@/utils/theme'
import NetworkCanvas from '@/components/viz/NetworkCanvas.vue'
defineOptions({ name: 'CampusLogin' })
const auth = useAuthStore(); const router = useRouter()
const username = ref(''); const password = ref(''); const loading = ref(false); const error = ref(''); const reveal = ref(false)
const login = async () => {
  if (!username.value.trim() || !password.value || loading.value) return
  loading.value = true; error.value = ''
  try { await auth.login(username.value.trim(), password.value); await router.replace('/campus/operations') }
  catch (e) { error.value = e instanceof Error ? e.message : '登录失败，请重试' }
  finally { loading.value = false }
}
const features = [
  { icon: 'ri-dashboard-3-line', title: '校园运行可视化', text: '趋势、采集质量、设备拓扑与空间热力' },
  { icon: 'ri-flow-chart', title: '事件处置闭环', text: '分派、处理、恢复核实与关闭全程留痕' },
  { icon: 'ri-user-star-line', title: '设备责任追溯', text: '设备归属与责任变更记录可查' },
]
</script>
<template><main class="campus-login">
  <div class="campus-aurora" aria-hidden="true"><span></span><i></i></div>
  <button class="campus-tool login-theme" type="button" :aria-label="theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'" @click="toggleTheme($event)"><i :class="theme === 'dark' ? 'ri-sun-line' : 'ri-moon-line'" class="theme-icon" aria-hidden="true"></i></button>
  <section class="login-brand" aria-hidden="true">
    <NetworkCanvas />
    <div class="login-brand-inner">
      <span class="campus-logo login-logo"><i class="ri-school-line"></i></span>
      <p class="login-kicker">AIRIOT · 大湾区高校产业联盟</p>
      <h2>智慧校园<br><span class="gradient-text">运营演示平台</span></h2>
      <ul class="login-features">
        <li v-for="(item, index) in features" :key="item.title" :style="{ '--i': index }"><span><i :class="item.icon"></i></span><div><strong>{{ item.title }}</strong><small>{{ item.text }}</small></div></li>
      </ul>
    </div>
  </section>
  <section class="campus-login-panel">
    <span class="campus-logo login-logo-sm" aria-hidden="true"><i class="ri-school-line"></i></span>
    <p class="campus-eyebrow">AIRIOT · 学校演示版</p>
    <h1>登录智慧校园</h1>
    <p class="campus-muted">查看校园运行、设备责任人与事件处置。请使用分配给你的演示账户。</p>
    <form class="campus-form" @submit.prevent="login">
      <label for="username">账户<span class="login-field"><i class="ri-user-3-line" aria-hidden="true"></i><input id="username" v-model="username" name="username" autocomplete="username" required :disabled="loading" placeholder="输入演示账户" /></span></label>
      <label for="password">密码<span class="login-field"><i class="ri-lock-2-line" aria-hidden="true"></i><input id="password" v-model="password" name="password" :type="reveal ? 'text' : 'password'" autocomplete="current-password" required :disabled="loading" placeholder="输入密码" /><button type="button" class="login-reveal" :aria-label="reveal ? '隐藏密码' : '显示密码'" :aria-pressed="reveal" @click="reveal = !reveal"><i :class="reveal ? 'ri-eye-off-line' : 'ri-eye-line'" aria-hidden="true"></i></button></span></label>
      <p v-if="error" class="campus-notice error" role="alert">{{ error }}</p>
      <button class="campus-button login-submit" :class="{ 'is-loading': loading }" type="submit" :disabled="loading || !username.trim() || !password"><i :class="loading ? 'ri-loader-4-line' : 'ri-login-circle-line'" aria-hidden="true"></i>{{ loading ? '登录中…' : '登录' }}</button>
    </form>
    <p class="campus-footnote"><i class="ri-flask-line" aria-hidden="true"></i>模拟设备 · DEMO 场景演练。页面不代表真实校园运行或实体设备控制。</p>
  </section>
</main></template>
<style scoped>
.campus-login{position:relative;height:100dvh;overflow:auto;display:grid;grid-template-columns:minmax(0,1.15fr) minmax(380px,.85fr);background:var(--bg-page)}
.login-theme{position:absolute;top:18px;right:18px;z-index:5}
.login-brand{position:relative;overflow:hidden;display:flex;align-items:center;padding:56px;background:radial-gradient(900px 600px at 20% 20%,rgba(59,130,246,.55),transparent 60%),radial-gradient(700px 500px at 90% 90%,rgba(168,85,247,.5),transparent 60%),linear-gradient(135deg,#0b1a3a,#111c44 50%,#1d1145);color:#fff}
.login-brand::after{content:'';position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px);background-size:44px 44px;-webkit-mask-image:radial-gradient(ellipse at 40% 50%,#000 20%,transparent 75%);mask-image:radial-gradient(ellipse at 40% 50%,#000 20%,transparent 75%);pointer-events:none}
.login-brand-inner{position:relative;z-index:1;max-width:520px}
.login-logo{width:58px;height:58px;border-radius:18px;font-size:28px;box-shadow:0 18px 40px -12px rgba(96,165,250,.8)}
.login-kicker{margin-top:28px;font-size:13px;letter-spacing:.18em;color:rgba(226,232,240,.75);font-weight:600}
.login-brand h2{font-size:44px;line-height:1.2;font-weight:800;letter-spacing:-.02em;margin:12px 0 34px}
.login-brand .gradient-text{background:linear-gradient(90deg,#67e8f9,#93c5fd,#d8b4fe);-webkit-background-clip:text;background-clip:text}
.login-features{display:flex;flex-direction:column;gap:14px}
.login-features li{display:flex;gap:14px;align-items:center;padding:14px 16px;border-radius:18px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);animation:fx-rise .7s cubic-bezier(.2,.8,.2,1) both;animation-delay:calc(var(--i) * 120ms + 200ms)}
.login-features li>span{width:42px;height:42px;border-radius:13px;display:grid;place-items:center;font-size:20px;background:linear-gradient(135deg,rgba(34,211,238,.9),rgba(139,92,246,.9));box-shadow:0 10px 24px -10px rgba(34,211,238,.8);flex-shrink:0}
.login-features strong{display:block;font-size:15px}
.login-features small{display:block;font-size:12.5px;color:rgba(226,232,240,.72);margin-top:2px}
.campus-login-panel{position:relative;z-index:1;align-self:center;justify-self:center;width:100%;max-width:440px;margin:40px 24px;padding:36px;border-radius:28px;background:var(--surface-1);border:1px solid var(--border-base);box-shadow:var(--shadow-pop);backdrop-filter:var(--glass);-webkit-backdrop-filter:var(--glass);animation:fx-rise .6s cubic-bezier(.2,.8,.2,1) both}
.login-logo-sm{display:none;width:48px;height:48px;font-size:24px;margin-bottom:18px}
.campus-login-panel h1{font-size:28px;margin:10px 0 8px}
.campus-login-panel .campus-form{margin-top:26px;max-width:none}
.campus-login-panel .campus-form label{font-size:13px;color:var(--text-secondary)}
.login-field{position:relative;display:block}
.login-field>i{position:absolute;left:14px;top:50%;transform:translateY(-50%);font-size:17px;color:var(--text-tertiary);pointer-events:none;transition:color .2s}
.login-field:focus-within>i{color:var(--brand-2)}
.login-field input{width:100%;min-height:48px;padding:12px 44px 12px 42px;border:1px solid var(--border-strong);border-radius:14px;background:var(--surface-raised);color:var(--text-main);font-size:15px;transition:border-color .2s,box-shadow .2s}
.login-field input::placeholder{color:var(--text-disabled)}
.login-reveal{position:absolute;right:4px;top:50%;transform:translateY(-50%);width:40px;height:40px;border:0;border-radius:10px;background:transparent;color:var(--text-tertiary);cursor:pointer;font-size:17px;display:grid;place-items:center}
.login-reveal:hover{color:var(--text-main);background:var(--surface-hover)}
.login-submit{width:100%;min-height:50px;font-size:15px;border-radius:14px;margin-top:4px}
.campus-login-panel .campus-footnote{margin-top:22px;font-size:12px}
@media(max-width:960px){.campus-login{grid-template-columns:1fr;place-items:center;padding:24px 16px}.login-brand{display:none}.login-logo-sm{display:grid}.campus-login-panel{margin:0;padding:28px 22px;border-radius:24px}.login-theme{top:12px;right:12px}}
</style>
