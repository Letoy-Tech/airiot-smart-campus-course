<script setup lang="ts">
import { computed } from 'vue'
import { getIntegrationStatus } from '@/api/campus'
import { useResource } from '@/composables/useResource'
import { timeLabel } from '@/utils/campus'
import ResourceState from '@/components/campus/ResourceState.vue'
import RingGauge from '@/components/viz/RingGauge.vue'
defineOptions({ name: 'CampusIntegration' })
const { data, loading, error, lastSuccess, load } = useResource(getIntegrationStatus)
const labels = { PASS: '通过', FAIL: '失败', PENDING: '待核对' }
const statusIcons = { PASS: 'ri-checkbox-circle-fill', FAIL: 'ri-close-circle-fill', PENDING: 'ri-time-fill' }
const counts = computed(() => ({
  pass: data.value?.capabilities.filter(item => item.status === 'PASS').length ?? 0,
  fail: data.value?.capabilities.filter(item => item.status === 'FAIL').length ?? 0,
  pending: data.value?.capabilities.filter(item => item.status === 'PENDING').length ?? 0,
  total: data.value?.capabilities.length ?? 0,
}))
</script>
<template><div class="campus-page integration-page">
  <header class="campus-page-head"><div><p class="campus-eyebrow">管理与接入</p><h1>AIRIOT <span class="gradient-text">接入状态</span></h1><p>检查专用机器身份和接口能力。秘密由 BE 受限配置持有。</p></div><button class="campus-button" :class="{ 'is-loading': loading }" :disabled="loading" @click="load"><i class="ri-refresh-line" aria-hidden="true"></i>重新检查</button></header>
  <ResourceState :loading="loading" :error="error" :has-data="!!data" :last-success="lastSuccess" @retry="load" />
  <template v-if="data">
    <section class="integration-hero campus-panel" :class="data.connected ? 'connected' : 'disconnected'">
      <div class="link-visual" aria-hidden="true">
        <span class="node be"><i class="ri-server-line"></i><small>BE</small></span>
        <span class="link-line"><span class="link-packet"></span></span>
        <span class="node airiot"><i class="ri-cloud-line"></i><small>AIRIOT</small></span>
      </div>
      <div class="integration-status">
        <span class="campus-chip" :class="data.connected ? 'ok' : 'bad'"><i :class="data.connected ? 'ri-link' : 'ri-link-unlink'" aria-hidden="true"></i>{{ data.connected ? '机器身份已连接' : '机器身份未连接' }}</span>
        <h2>{{ data.message }}</h2>
        <p class="campus-muted">检查时间 {{ timeLabel(data.checkedAt) }} · 配置{{ data.configured ? '已完成' : '未完成' }} · 模拟控制{{ data.controlEnabled ? '已启用' : '未启用' }}</p>
      </div>
      <RingGauge :ratio="counts.total ? counts.pass / counts.total : null" :size="104" :stroke="10" from="#34d399" to="#10b981" :label="`能力核对通过 ${counts.pass} / ${counts.total}`"><strong class="ring-big">{{ counts.pass }}<small>/{{ counts.total }}</small></strong><span class="ring-sub">项通过</span></RingGauge>
    </section>
    <section class="campus-section"><h2>连接与配置</h2><dl class="campus-definition"><dt>配置</dt><dd>{{ data.configured ? '已配置' : '未配置' }}</dd><dt>机器身份连接</dt><dd>{{ data.connected ? '已连接' : '未连接' }}</dd><dt>项目 ID</dt><dd>{{ data.projectId }}</dd><dt>接口地址</dt><dd>{{ data.baseUrl }}</dd><dt>身份 ID</dt><dd>{{ data.identityId || '未取得' }}</dd><dt>超级身份</dt><dd>{{ data.isSuper === null ? '未取得' : data.isSuper ? '是' : '否' }}</dd><dt>模拟控制配置</dt><dd>{{ data.controlEnabled ? '已启用' : '未启用' }}</dd><dt>检查时间</dt><dd>{{ timeLabel(data.checkedAt) }}</dd></dl></section>
    <section class="campus-section"><div class="campus-section-head"><h2>能力核对</h2><span class="capability-summary"><span class="campus-chip ok">通过 {{ counts.pass }}</span><span class="campus-chip sim">待核对 {{ counts.pending }}</span><span class="campus-chip bad">失败 {{ counts.fail }}</span></span></div>
      <div v-if="data.capabilities.length" class="capability-grid fx-stagger"><article v-for="(item, index) in data.capabilities" :key="index" class="capability-card fx-spotlight" :class="item.status"><span class="capability-icon" aria-hidden="true"><i :class="statusIcons[item.status] || 'ri-question-line'"></i></span><div><strong>{{ item.name }}</strong><span class="quality" :class="item.status === 'PASS' ? 'fresh' : item.status === 'FAIL' ? 'invalid' : 'stale'">{{ labels[item.status] || item.status }}</span><p>{{ item.detail }}</p></div></article></div>
      <p v-else class="campus-empty">尚未返回能力核对结果。</p>
    </section>
    <p class="campus-footnote"><i class="ri-information-line" aria-hidden="true"></i>连接成功仅证明当前机器身份可连接。历史、报警、控制与跨项目隔离分别按能力证据验收。</p>
  </template>
</div></template>
<style scoped>
.integration-hero{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:28px;padding:24px 28px}
.link-visual{display:flex;align-items:center;gap:0}
.node{width:62px;height:62px;border-radius:20px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;color:#fff;font-size:24px;background:var(--brand-gradient);box-shadow:0 12px 26px -12px var(--brand-glow)}
.node small{font-size:9.5px;font-weight:700;letter-spacing:.08em}
.node.airiot{background:linear-gradient(135deg,#34d399,#0ea5e9)}
.link-line{position:relative;width:96px;height:3px;margin:0 8px;border-radius:3px;background:linear-gradient(90deg,var(--brand-2),#34d399);overflow:hidden}
.disconnected .link-line{background:repeating-linear-gradient(90deg,var(--bad) 0 8px,transparent 8px 14px)}
.link-packet{position:absolute;top:-2px;left:0;width:22px;height:7px;border-radius:7px;background:#fff;box-shadow:0 0 12px #fff,0 0 20px var(--brand-1);animation:packet 1.8s ease-in-out infinite}
.disconnected .link-packet{display:none}
@keyframes packet{0%{transform:translateX(-24px);opacity:0}15%{opacity:1}85%{opacity:1}100%{transform:translateX(100px);opacity:0}}
.integration-status h2{font-size:18px;font-weight:650;margin:10px 0 6px;line-height:1.5}
.ring-big{font-size:28px;font-weight:750;font-family:var(--font-number);color:var(--text-main)}
.ring-big small{font-size:14px;color:var(--text-tertiary)}
.ring-sub{font-size:11px;color:var(--text-tertiary)}
.capability-summary{display:flex;gap:6px;flex-wrap:wrap}
.capability-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}
.capability-card{--s:var(--text-tertiary);display:flex;gap:12px;align-items:flex-start;padding:16px;border-radius:18px;background:var(--surface-1);border:1px solid var(--border-base);box-shadow:var(--shadow-card)}
.capability-card.PASS{--s:var(--ok)}.capability-card.FAIL{--s:var(--bad)}.capability-card.PENDING{--s:var(--warn)}
.capability-icon{width:38px;height:38px;border-radius:12px;display:grid;place-items:center;font-size:20px;flex-shrink:0;color:var(--s);background:color-mix(in srgb,var(--s) 14%,transparent)}
.capability-card strong{display:block;font-size:14px;margin-bottom:6px}
.capability-card p{font-size:12.5px;color:var(--text-tertiary);line-height:1.6;margin-top:6px}
@media(max-width:900px){.integration-hero{grid-template-columns:1fr;justify-items:start;gap:18px}}
</style>
