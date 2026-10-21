<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from '@/store/auth'
defineOptions({ name: 'CampusProfile' })
const auth = useAuthStore()
const name = computed(() => auth.user?.nickname || auth.user?.username || '')
</script>
<template><div class="campus-page profile-page"><header class="campus-page-head"><div><p class="campus-eyebrow">当前管理会话</p><h1>账户<span class="gradient-text">信息</span></h1><p>身份信息由 BE 提供。账户和角色由管理员管理。</p></div></header>
  <template v-if="auth.user">
    <section class="profile-card campus-panel"><span class="profile-avatar" aria-hidden="true">{{ name.charAt(0).toUpperCase() || '我' }}</span><div><h2>{{ name }}</h2><p>@{{ auth.user.username }}</p><div class="profile-roles"><span v-for="role in auth.currentUserRoleNames" :key="role" class="campus-chip info"><i class="ri-shield-user-line" aria-hidden="true"></i>{{ role }}</span><span v-if="!auth.currentUserRoleNames.length" class="campus-chip">未分配角色</span><span class="campus-chip" :class="auth.user.active ? 'ok' : 'bad'">{{ auth.user.active ? '启用' : '停用' }}</span></div></div></section>
    <dl class="campus-definition"><dt>账户</dt><dd>{{ auth.user.username }}</dd><dt>显示名称</dt><dd>{{ auth.user.nickname || '未设置' }}</dd><dt>角色</dt><dd>{{ auth.currentUserRoleNames.join(' / ') || '未分配' }}</dd><dt>邮箱</dt><dd>{{ auth.user.email || '未提供' }}</dd><dt>手机号</dt><dd>{{ auth.user.phoneNumber || '未提供' }}</dd><dt>账户状态</dt><dd>{{ auth.user.active ? '启用' : '停用' }}</dd></dl>
  </template>
  <p v-else class="campus-empty">尚未取得账户信息，请重新登录。</p></div></template>
<style scoped>
.profile-card{display:flex;align-items:center;gap:20px;max-width:880px;margin-bottom:18px;padding:24px;background:radial-gradient(500px 200px at 0% 0%,color-mix(in srgb,var(--brand-2) 14%,transparent),transparent 70%),var(--surface-1)}
.profile-avatar{width:76px;height:76px;border-radius:24px;display:grid;place-items:center;font-size:32px;font-weight:750;color:#fff;background:var(--brand-gradient);box-shadow:0 18px 36px -14px var(--brand-glow);flex-shrink:0}
.profile-card h2{font-size:22px;font-weight:700}
.profile-card p{color:var(--text-tertiary);font-size:13px;margin-top:2px}
.profile-roles{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
</style>
