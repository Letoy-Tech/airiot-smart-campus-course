<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getOverview, controlSwitch } from '@/api/campus'
import { useResource } from '@/composables/useResource'
import { useCampusStore } from '@/store/campus'
import { canControlDevice, categoryLabels, confirmedControl, onlineLabel, pointLabel, qualityLabels, switchLabel, timeLabel } from '@/utils/campus'
import { gaugeScale } from '@/utils/gaugeScale'
import { vizTheme } from '@/utils/vizTheme'
import type { ControlResult, DeviceCategory, Point } from '@/types/campus'
import ResourceState from '@/components/campus/ResourceState.vue'
import MetricTrend from '@/components/campus/MetricTrend.vue'
import ArcGauge from '@/components/viz/ArcGauge.vue'
import LivePulse from '@/components/viz/LivePulse.vue'
const route = useRoute()
const campus = useCampusStore()
const { data, loading, error, lastSuccess, nextRefreshAt, load } = useResource(getOverview, 15000)
const device = computed(() => data.value?.devices.find(item => item.id === route.params.id))
const tagId = ref('')
const reason = ref('')
const target = ref('true')
const controlLoading = ref(false)
const controlError = ref('')
const controlResult = ref<ControlResult | null>(null)
const allowed = computed(() => canControlDevice(device.value, campus.capabilities) && !error.value)
watch(device, item => { if (item && !item.tags.some(t => t.id === tagId.value)) tagId.value = item.tags[0]?.id || '' })
watch(() => route.params.id, () => { controlResult.value = null; controlError.value = '' })
const selectedTag = computed(() => device.value?.tags.find(tag => tag.id === tagId.value))
const trendDevices = computed(() => device.value ? [device.value] : [])
const categoryIcons: Record<DeviceCategory, string> = { environment: 'ri-leaf-line', energy: 'ri-flashlight-line', facility: 'ri-building-2-line', lighting: 'ri-lightbulb-line' }
const pointFor = (tag: string) => data.value?.points.find(p => p.deviceId === device.value?.id && p.tagId === tag)
const validValue = (point: Point | undefined) => point && typeof point.value === 'number' && Number.isFinite(point.value) && point.quality !== 'invalid' && point.quality !== 'missing' ? point.value : null
const scaleFor = (tag: string) => gaugeScale(tag, [validValue(pointFor(tag))])
const commState = computed(() => device.value?.online === true ? 'online' : device.value?.online === false ? 'offline' : 'unknown')
const switchState = computed(() => device.value?.switchOn === true ? 'on' : device.value?.switchOn === false ? 'off' : 'unknown')
const submitControl = async () => {
  if (!allowed.value || !device.value || typeof device.value.switchOn !== 'boolean' || controlLoading.value) return
  if (!reason.value.trim()) { controlError.value = '请填写操作理由'; return }
  const expectedState = device.value.switchOn; const on = target.value === 'true'; const id = device.value.id
  controlLoading.value = true; controlError.value = ''; controlResult.value = null
  try { const result = await controlSwitch(id, on, reason.value.trim(), expectedState); if (!confirmedControl(on, result)) throw new Error('写后回读与目标不一致，请刷新检查，操作记录已交由后端审计'); controlResult.value = result; reason.value = ''; await load() }
  catch (e) { controlError.value = e instanceof Error ? e.message : '模拟操作失败'; await load() }
  finally { controlLoading.value = false }
}
</script>
<template><div class="campus-page detail-page">
  <router-link class="campus-back" to="/campus/devices"><i class="ri-arrow-left-line" aria-hidden="true"></i>设备台账</router-link>
  <header class="campus-page-head detail-hero campus-panel" :class="device ? `category-${device.category}` : ''">
    <div class="detail-hero-main">
      <span class="detail-icon" aria-hidden="true"><i :class="device ? categoryIcons[device.category] : 'ri-cpu-line'"></i></span>
      <div>
        <p class="campus-eyebrow">模拟设备</p>
        <h1>{{ device?.name || '设备详情' }}</h1>
        <p class="detail-id">{{ device?.id || route.params.id }}</p>
        <div v-if="device" class="detail-chips">
          <span class="campus-chip"><i :class="categoryIcons[device.category]" aria-hidden="true"></i>{{ categoryLabels[device.category] }}</span>
          <span class="campus-chip"><i class="ri-map-pin-2-line" aria-hidden="true"></i>{{ device.spaceName || '未关联' }}</span>
          <span class="campus-chip detail-comm" :class="commState"><span class="comm-dot" aria-hidden="true"></span>{{ onlineLabel(device.online) }}</span>
          <span class="campus-chip sim"><i class="ri-flask-line" aria-hidden="true"></i>模拟</span>
        </div>
      </div>
    </div>
    <div class="campus-page-actions">
      <LivePulse :loading="loading" :error="error" :last-success="lastSuccess" :next-at="nextRefreshAt" />
      <button class="campus-button secondary" :class="{ 'is-loading': loading }" :disabled="loading" @click="load"><i class="ri-refresh-line" aria-hidden="true"></i>刷新点值</button>
    </div>
  </header>
  <ResourceState :loading="loading" :error="error" :has-data="!!data" :last-success="lastSuccess" @retry="load" />
  <p v-if="data && !device" class="campus-empty">本项目未读取到该设备，请返回台账核对设备 ID 与接入权限。</p>
  <template v-if="device && data">
    <dl class="detail-facts">
      <div><dt><i class="ri-apps-2-line" aria-hidden="true"></i>类型</dt><dd>{{ categoryLabels[device.category] }}</dd></div>
      <div><dt><i class="ri-map-pin-2-line" aria-hidden="true"></i>关联空间</dt><dd>{{ device.spaceName || '未关联' }}</dd></div>
      <div><dt><i class="ri-signal-tower-line" aria-hidden="true"></i>通信</dt><dd>{{ onlineLabel(device.online) }}<small>{{ timeLabel(device.communicationTime) }}</small></dd></div>
      <div><dt><i class="ri-time-line" aria-hidden="true"></i>读取时间</dt><dd>{{ timeLabel(data.observedAt) }}</dd></div>
    </dl>
    <section class="campus-section detail-readings">
      <div class="campus-section-head"><h2>最新采集值</h2><span class="campus-muted">每15秒刷新 · 点击表盘查看趋势</span></div>
      <div class="detail-point-grid fx-stagger">
        <button v-for="tag in device.tags" :key="tag.id" type="button" class="detail-point fx-spotlight" :class="{ selected: tagId === tag.id }" :aria-pressed="tagId === tag.id" :aria-label="`查看${tag.name || tag.id}原始历史，最新值${pointLabel(pointFor(tag.id))}，${qualityLabels[pointFor(tag.id)?.quality || 'missing']}`" @click="tagId = tag.id">
          <span class="detail-point-head"><strong>{{ tag.name || tag.id }}</strong><span class="quality" :class="pointFor(tag.id)?.quality || 'missing'">{{ qualityLabels[pointFor(tag.id)?.quality || 'missing'] }}</span></span>
          <ArcGauge :value="validValue(pointFor(tag.id))" :min="scaleFor(tag.id).min" :max="scaleFor(tag.id).max" :unit="pointFor(tag.id)?.unit || tag.unit" :color="vizTheme.category[device.category]" :glow="vizTheme.categoryGlow[device.category]" :stale="pointFor(tag.id)?.quality === 'stale'" :caption="`采样 ${timeLabel(pointFor(tag.id)?.time)}`" />
          <span class="detail-point-foot">{{ tag.id }} · 刻度 {{ scaleFor(tag.id).min }}–{{ scaleFor(tag.id).max }}{{ scaleFor(tag.id).auto ? '（按数值自动）' : '' }}</span>
        </button>
      </div>
    </section>
    <MetricTrend v-if="selectedTag" class="detail-trend" :devices="trendDevices" :tag-id="tagId" :unit="selectedTag.unit" :title="`${selectedTag.name || selectedTag.id} · 原始历史`" />
    <section v-if="device.category === 'facility' || device.category === 'lighting'" class="campus-panel detail-switch">
      <div class="detail-switch-visual" :class="switchState">
        <span class="big-switch" aria-hidden="true"><span class="big-thumb"><i :class="device.category === 'lighting' ? 'ri-lightbulb-flash-line' : 'ri-windy-line'"></i></span></span>
        <div><h2>模拟开关</h2><p>当前：<strong>{{ switchLabel(device.switchOn) }}</strong>。这是模拟 Boolean 状态，写入后由 BE 回读确认。</p></div>
      </div>
      <p v-if="!campus.capabilities?.canControl" class="campus-muted">当前角色仅可查看。</p>
      <p v-else-if="!allowed" class="campus-notice warning">当前状态未知或读取失败，暂不可操作。刷新取得有效状态后重试。</p>
      <form v-if="campus.capabilities?.canControl" class="campus-control-form" @submit.prevent="submitControl"><label>目标状态<select v-model="target" :disabled="!allowed || controlLoading"><option value="true">开启</option><option value="false">关闭</option></select></label><label>操作理由<textarea v-model="reason" :disabled="!allowed || controlLoading" maxlength="500" rows="2" placeholder="说明本次模拟操作目的" required /></label><button class="campus-button" :class="{ 'is-loading': controlLoading }" :disabled="!allowed || controlLoading" type="submit"><i :class="controlLoading ? 'ri-loader-4-line' : 'ri-send-plane-line'" aria-hidden="true"></i>{{ controlLoading ? '写入并回读中…' : '提交模拟状态' }}</button></form>
      <p v-if="controlError" class="campus-notice error" role="alert">{{ controlError }}</p>
      <p v-if="controlResult" class="campus-notice success" role="status">BE 已写后回读确认：{{ switchLabel(controlResult.before) }} → {{ switchLabel(controlResult.confirmed) }} · {{ timeLabel(controlResult.observedAt) }} · 审计 {{ controlResult.auditId }}</p>
    </section>
  </template>
</div></template>
<style scoped>
.category-environment{--c:var(--viz-environment)}.category-energy{--c:var(--viz-energy)}.category-facility{--c:var(--viz-facility)}.category-lighting{--c:var(--viz-lighting)}
.detail-hero{--c:var(--brand-2);align-items:center;padding:24px;margin-bottom:18px;overflow:hidden;background:radial-gradient(600px 220px at 0% 0%,color-mix(in srgb,var(--c) 16%,transparent),transparent 70%),var(--surface-1)}
.detail-hero-main{display:flex;gap:18px;align-items:center;min-width:0}
.detail-icon{width:72px;height:72px;border-radius:22px;display:grid;place-items:center;font-size:34px;color:#fff;flex-shrink:0;background:linear-gradient(135deg,color-mix(in srgb,var(--c) 55%,#fff),var(--c));box-shadow:0 18px 36px -14px var(--c);animation:icon-breathe 4s ease-in-out infinite}
@keyframes icon-breathe{50%{box-shadow:0 22px 48px -12px var(--c)}}
.detail-hero h1{margin:4px 0 2px}
.detail-id{font-size:12.5px;color:var(--text-tertiary);font-variant-numeric:tabular-nums}
.detail-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
.comm-dot{width:7px;height:7px;border-radius:50%;background:var(--text-tertiary)}
.detail-comm.online{color:var(--ok-text);background:var(--ok-soft)}.detail-comm.online .comm-dot{background:var(--ok);box-shadow:0 0 0 3px color-mix(in srgb,var(--ok) 25%,transparent)}
.detail-comm.offline{color:var(--bad-text);background:var(--bad-soft)}.detail-comm.offline .comm-dot{background:var(--bad)}
.detail-facts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
.detail-facts>div{padding:14px 16px;border-radius:16px;background:var(--surface-1);border:1px solid var(--border-base)}
.detail-facts dt{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text-tertiary);margin-bottom:6px}
.detail-facts dd{font-size:14.5px;font-weight:650;font-variant-numeric:tabular-nums}
.detail-facts dd small{display:block;font-size:11.5px;font-weight:400;color:var(--text-tertiary);margin-top:2px}
.detail-readings{margin-top:24px}
.detail-readings h2{margin-bottom:14px}
.detail-point-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:16px}
.detail-point{position:relative;display:flex;flex-direction:column;gap:8px;text-align:left;padding:16px 18px;border-radius:var(--radius-card);background:var(--surface-1);border:1.5px solid var(--border-base);box-shadow:var(--shadow-card);color:var(--text-main);cursor:pointer;transition:border-color .25s,box-shadow .25s,transform .25s}
@media(hover:hover){.detail-point:hover{transform:translateY(-3px);border-color:color-mix(in srgb,var(--brand-2) 40%,transparent)}}
.detail-point.selected{border-color:var(--brand-2);box-shadow:0 0 0 4px color-mix(in srgb,var(--brand-2) 14%,transparent),var(--shadow-hover)}
.detail-point-head{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:14px}
.detail-point-foot{font-size:11px;color:var(--text-tertiary);text-align:center}
.detail-trend{margin-top:22px}
.detail-switch{margin-top:22px}
.detail-switch-visual{display:flex;align-items:center;gap:20px;margin-bottom:8px}
.detail-switch-visual h2{font-size:17px;margin-bottom:4px}
.detail-switch-visual p{font-size:13px;color:var(--text-secondary);line-height:1.6}
.big-switch{position:relative;width:96px;height:52px;border-radius:999px;flex-shrink:0;background:var(--ring-track);box-shadow:inset 0 2px 6px rgba(0,0,0,.12);transition:background .4s,box-shadow .4s}
.big-thumb{position:absolute;top:5px;left:5px;width:42px;height:42px;border-radius:50%;display:grid;place-items:center;font-size:20px;color:#64748b;background:#f8fafc;box-shadow:0 4px 10px rgba(0,0,0,.25);transition:transform .5s cubic-bezier(.34,1.56,.64,1),color .3s}
.on .big-switch{background:linear-gradient(135deg,#34d399,#10b981);box-shadow:0 0 24px color-mix(in srgb,var(--ok) 55%,transparent),inset 0 2px 6px rgba(0,0,0,.1)}
.on .big-thumb{transform:translateX(44px);color:var(--ok)}
.unknown .big-switch{background:repeating-linear-gradient(45deg,var(--ring-track) 0 6px,transparent 6px 12px);box-shadow:inset 0 0 0 1.5px var(--border-strong)}
.unknown .big-thumb{transform:translateX(22px);opacity:.7}
@media(max-width:900px){.detail-facts{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:768px){.detail-hero{padding:18px 16px}.detail-icon{width:56px;height:56px;font-size:26px;border-radius:18px}.detail-hero-main{align-items:flex-start;gap:14px}.detail-point-grid{grid-template-columns:1fr}.detail-switch-visual{gap:14px}.big-switch{width:80px;height:44px}.big-thumb{width:34px;height:34px;font-size:17px}.on .big-thumb{transform:translateX(36px)}.unknown .big-thumb{transform:translateX(18px)}}
</style>
