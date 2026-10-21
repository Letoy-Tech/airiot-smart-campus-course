<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { EChartsCoreOption } from 'echarts/core'
import { getAlarmCase, getAlarmCases, getAlarmHandlers, getDemoStatus, triggerDemoScenario } from '@/api/campus'
import { useResource } from '@/composables/useResource'
import { useCampusStore } from '@/store/campus'
import { caseStates, caseStateLabels, operationError, sourceStateLabels } from '@/utils/operations'
import { timeLabel } from '@/utils/campus'
import { alpha, gradient, vizTheme } from '@/utils/vizTheme'
import CampusChart from '@/components/campus/CampusChart.vue'
import ResourceState from '@/components/campus/ResourceState.vue'
import LivePulse from '@/components/viz/LivePulse.vue'
import CountUp from '@/components/viz/CountUp.vue'

defineOptions({ name: 'CampusOperations' })
const router = useRouter()
const campus = useCampusStore()
const state = ref('')
const assigneeUid = ref('')
const appliedState = ref('')
const appliedAssigneeUid = ref('')
const skip = ref(0)
const limit = 50
const cases = useResource(() => getAlarmCases({ sourceType: 'DEMO', state: appliedState.value || undefined, assigneeUid: appliedAssigneeUid.value || undefined, skip: skip.value, limit }), 30000)
const handlers = useResource(getAlarmHandlers)
const demo = useResource(getDemoStatus)
const scenarioId = ref('')
const triggering = ref(false)
const triggerError = ref('')
const scenario = computed(() => demo.data.value?.scenarios.find(item => item.id === scenarioId.value))
const stateIcons: Record<string, string> = { NEW: 'ri-inbox-unarchive-line', ASSIGNED: 'ri-user-shared-line', IN_PROGRESS: 'ri-tools-line', CLOSED: 'ri-checkbox-circle-line' }
const scenarioIcons: Record<string, string> = { 'temperature-patrol': 'ri-temp-hot-line', 'communication-patrol': 'ri-wifi-off-line', 'lighting-patrol': 'ri-lightbulb-flash-line' }
const distribution = computed(() => caseStates.map(value => ({ state: value, name: caseStateLabels[value], icon: stateIcons[value]!, color: vizTheme.value.state[value]!, count: cases.data.value?.items.filter(item => item.state === value).length || 0 })))
const pageTotal = computed(() => cases.data.value?.items.length || 0)
const stateChart = computed<EChartsCoreOption>(() => ({
  tooltip: { trigger: 'item', confine: true, renderMode: 'richText', formatter: '{b}：{c} 件（{d}%）' },
  series: [{
    type: 'pie', name: '处置状态', radius: ['62%', '86%'], padAngle: 3, startAngle: 90,
    itemStyle: { borderRadius: 7 }, label: { show: false }, labelLine: { show: false },
    emphasis: { scale: true, scaleSize: 5 },
    data: distribution.value.filter(item => item.count > 0).map(item => ({ name: item.name, value: item.count, itemStyle: { color: gradient(item.color, alpha(item.color, 0.65)), shadowBlur: 12, shadowColor: alpha(item.color, 0.45) } })),
  }],
}))
const refresh = () => { void cases.load(); void demo.load(); void handlers.load() }
const applyFilters = async () => { if (cases.loading.value) return; if (appliedState.value !== state.value || appliedAssigneeUid.value !== assigneeUid.value) cases.data.value = null; appliedState.value = state.value; appliedAssigneeUid.value = assigneeUid.value; skip.value = 0; await cases.load() }
const filterState = async (value: string) => { if (cases.loading.value) return; state.value = state.value === value ? '' : value; await applyFilters() }
const page = async (offset: number) => { if (cases.loading.value) return; const previous = skip.value; skip.value = Math.max(0, skip.value + offset); await cases.load(); if (cases.error.value) skip.value = previous }
const trigger = async () => {
  if (triggering.value || !scenario.value || !demo.data.value?.enabled || campus.capabilities?.canRunDemoScenarios !== true || demo.error.value) return
  triggering.value = true; triggerError.value = ''
  try {
    const created = await triggerDemoScenario(scenario.value.id)
    const confirmed = await getAlarmCase(created.id)
    if (confirmed.id !== created.id || confirmed.version < created.version || confirmed.sourceType !== 'DEMO' || confirmed.simulated !== true) throw new Error('演练事件已提交，但回读未确认。请刷新事件队列核对。')
    await router.push(`/campus/alarm-cases/${encodeURIComponent(confirmed.id)}`)
  } catch (error) { triggerError.value = `${operationError(error)}。请先在队列核对，避免重复触发。`; await cases.load() }
  finally { triggering.value = false }
}
const initial = (name: string | null) => (name || '').trim().charAt(0) || '?'
</script>

<template>
  <div class="campus-page operations-page">
    <header class="campus-page-head"><div><p class="campus-eyebrow">学校演示 · 运营闭环</p><h1>演示<span class="gradient-text">运营</span></h1><p>从巡查发现，到责任分派、处置记录和恢复核实，展示一次可追溯的校园运营流程。</p></div><div class="campus-page-actions"><LivePulse :loading="cases.loading.value" :error="cases.error.value" :last-success="cases.lastSuccess.value" :next-at="cases.nextRefreshAt.value" :interval="30000" label="DEMO" /><button class="campus-button secondary" :class="{ 'is-loading': cases.loading.value }" :disabled="cases.loading.value || demo.loading.value || triggering" @click="refresh"><i class="ri-refresh-line" aria-hidden="true"></i>刷新</button></div></header>
    <div class="operations-boundary" role="note"><span class="boundary-icon" aria-hidden="true"><i class="ri-flask-line"></i></span><strong>DEMO · 本地场景演示</strong><span>设备采集值读取 AIRIOT 模拟项目。这里的事件由本地演练创建，属于演示业务记录。</span><router-link to="/campus/alarms">查看 AIRIOT 原始报警 <i class="ri-arrow-right-line" aria-hidden="true"></i></router-link></div>
    <nav class="operations-guide" aria-label="学校演示讲解路径">
      <router-link to="/campus/overview" class="guide-step fx-spotlight fx-tilt"><span class="guide-number">01</span><span class="guide-icon" aria-hidden="true"><i class="ri-dashboard-3-line"></i></span><span><strong>看校园运行</strong><small>趋势、采集质量与空间对比</small></span><i class="ri-arrow-right-line guide-go" aria-hidden="true"></i></router-link>
      <a href="#case-queue" class="guide-step fx-spotlight fx-tilt"><span class="guide-number">02</span><span class="guide-icon" aria-hidden="true"><i class="ri-flow-chart"></i></span><span><strong>看事件处置</strong><small>分派、处理、核实与关闭</small></span><i class="ri-arrow-down-line guide-go" aria-hidden="true"></i></a>
      <router-link to="/campus/device-owners" class="guide-step fx-spotlight fx-tilt"><span class="guide-number">03</span><span class="guide-icon" aria-hidden="true"><i class="ri-user-star-line"></i></span><span><strong>看设备责任</strong><small>设备归属与责任人登记</small></span><i class="ri-arrow-right-line guide-go" aria-hidden="true"></i></router-link>
    </nav>
    <ResourceState :loading="demo.loading.value" :error="demo.error.value" :has-data="!!demo.data.value" :last-success="demo.lastSuccess.value" compact @retry="demo.load" />
    <section v-if="demo.data.value" class="operations-scenario campus-panel" aria-labelledby="scenario-title">
      <div class="campus-panel-head"><div><h2 id="scenario-title"><i class="ri-play-circle-line" aria-hidden="true"></i>演练场景</h2><p>{{ demo.data.value.label }}</p></div><span class="campus-chip" :class="demo.data.value.enabled ? 'ok' : ''"><i :class="demo.data.value.enabled ? 'ri-checkbox-circle-line' : 'ri-pause-circle-line'" aria-hidden="true"></i>{{ demo.data.value.enabled ? '演示已启用' : '演示已停用' }}</span></div>
      <form v-if="campus.capabilities?.canRunDemoScenarios === true" class="scenario-form" @submit.prevent="trigger">
        <fieldset class="scenario-cards" :disabled="triggering || !demo.data.value.enabled || !!demo.error.value">
          <legend class="sr-only">选择场景</legend>
          <label v-for="item in demo.data.value.scenarios" :key="item.id" class="scenario-card fx-spotlight" :class="{ selected: scenarioId === item.id }">
            <input v-model="scenarioId" class="sr-only" type="radio" name="scenario" :value="item.id" required />
            <span class="scenario-icon" aria-hidden="true"><i :class="scenarioIcons[item.id] || 'ri-alarm-warning-line'"></i></span>
            <span class="scenario-copy"><strong>{{ item.name }}</strong><small>{{ item.description }}</small></span>
            <span class="scenario-check" aria-hidden="true"><i class="ri-check-line"></i></span>
          </label>
        </fieldset>
        <div class="scenario-actions">
          <p v-if="scenario" class="scenario-description"><i class="ri-cpu-line" aria-hidden="true"></i>关联模拟设备 <router-link :to="`/campus/devices/${encodeURIComponent(scenario.deviceId)}`">{{ scenario.deviceId }} <i class="ri-arrow-right-line" aria-hidden="true"></i></router-link></p>
          <p v-else class="campus-muted">选择上方场景后触发一条本地演练事件。</p>
          <button class="campus-button" type="submit" :class="{ 'is-loading': triggering }" :disabled="triggering || !scenario || !demo.data.value.enabled || !!demo.error.value"><i :class="triggering ? 'ri-loader-4-line' : 'ri-flashlight-line'" aria-hidden="true"></i>{{ triggering ? '创建并回读中…' : '触发本地演练事件' }}</button>
        </div>
      </form>
      <template v-else>
        <div class="scenario-cards readonly"><div v-for="item in demo.data.value.scenarios" :key="item.id" class="scenario-card"><span class="scenario-icon" aria-hidden="true"><i :class="scenarioIcons[item.id] || 'ri-alarm-warning-line'"></i></span><span class="scenario-copy"><strong>{{ item.name }}</strong><small>{{ item.description }}</small></span></div></div>
        <p class="campus-muted">当前账户可查看演练记录。演练触发由管理员操作。</p>
      </template>
      <details v-if="demo.data.value.limitations.length" class="scenario-limitations"><summary><i class="ri-information-line" aria-hidden="true"></i>演示范围与限制</summary><ul><li v-for="(item, index) in demo.data.value.limitations" :key="index">{{ item }}</li></ul></details>
      <p v-if="triggerError" class="campus-notice error" role="alert">{{ triggerError }}</p>
    </section>

    <section id="case-queue" class="operations-queue campus-section" aria-labelledby="queue-title">
      <div class="campus-section-head"><h2 id="queue-title">演练事件队列</h2><router-link class="campus-arrow-link" to="/campus/devices">设备巡查 <i class="ri-arrow-right-line" aria-hidden="true"></i></router-link></div>
      <form class="operations-filters" @submit.prevent="applyFilters"><label>处置状态<select v-model="state" :disabled="cases.loading.value"><option value="">全部状态</option><option v-for="value in caseStates" :key="value" :value="value">{{ caseStateLabels[value] }}</option></select></label><label>负责人<select v-model="assigneeUid" :disabled="cases.loading.value || !handlers.data.value || !!handlers.error.value"><option value="">全部负责人</option><option v-for="item in handlers.data.value?.items || []" :key="item.uid" :value="item.uid">{{ item.displayName }}{{ item.uid === handlers.data.value?.currentUid ? '（我）' : '' }}</option></select></label><button class="campus-button secondary" type="submit" :disabled="cases.loading.value"><i class="ri-search-2-line" aria-hidden="true"></i>查询</button><router-link class="operations-energy-link campus-arrow-link" to="/campus/energy">能源点位 <i class="ri-arrow-right-line" aria-hidden="true"></i></router-link></form>
      <ResourceState :loading="handlers.loading.value" :error="handlers.error.value" :has-data="!!handlers.data.value" :last-success="handlers.lastSuccess.value" compact @retry="handlers.load" />
      <ResourceState :loading="cases.loading.value" :error="cases.error.value" :has-data="!!cases.data.value" :last-success="cases.lastSuccess.value" compact @retry="cases.load" />
      <template v-if="cases.data.value">
        <p class="campus-source">DEMO 来源 · 读取 {{ timeLabel(cases.data.value.observedAt) }} · 当前条件共 {{ cases.data.value.total }} 件 · 本页 {{ cases.data.value.items.length }} 件 · 每30秒静默刷新</p>
        <div v-if="cases.data.value.items.length" class="operations-distribution campus-panel">
          <div class="distribution-copy">
            <h3>本页处置流水线</h3>
            <p>点选阶段筛选队列，再次点选取消。计数仅包含本页返回的演练事件。</p>
            <ol class="pipeline">
              <li v-for="item in distribution" :key="item.state">
                <button type="button" class="pipeline-stage fx-spotlight" :style="{ '--c': item.color, '--w': pageTotal ? `${(item.count / pageTotal) * 100}%` : '0%' }" :aria-pressed="state === item.state" :disabled="cases.loading.value" @click="filterState(item.state)">
                  <span class="stage-icon" aria-hidden="true"><i :class="item.icon"></i></span>
                  <span class="stage-name">{{ item.name }}</span>
                  <strong><CountUp :value="item.count" /></strong>
                  <span class="stage-bar" aria-hidden="true"><span></span></span>
                </button>
              </li>
            </ol>
          </div>
          <div class="distribution-chart"><CampusChart :option="stateChart" :label="`本页演练事件处置状态：${distribution.map(item => `${item.name}${item.count}件`).join('，')}`" :height="200" /><div class="distribution-center" aria-hidden="true"><strong><CountUp :value="pageTotal" /></strong><span>本页事件</span></div></div>
        </div>
        <div v-if="cases.data.value.items.length" class="case-list fx-stagger">
          <router-link v-for="item in cases.data.value.items" :key="item.id" class="case-list-item fx-spotlight" :class="`state-${item.state}`" :to="`/campus/alarm-cases/${encodeURIComponent(item.id)}`">
            <span class="case-state-icon" aria-hidden="true"><i :class="stateIcons[item.state]"></i></span>
            <div class="case-list-main"><span class="case-meta"><span class="case-state" :class="item.state">{{ caseStateLabels[item.state] }}</span><span class="campus-chip sim">DEMO · 本地演练</span><span class="case-level">{{ item.level }}</span></span><strong>{{ item.message }}</strong><small><i class="ri-cpu-line" aria-hidden="true"></i>{{ item.deviceName || item.deviceId }} · <i class="ri-time-line" aria-hidden="true"></i>{{ timeLabel(item.occurredAt) }}</small></div>
            <div class="case-list-owner"><span class="case-owner"><span class="case-avatar" :class="{ empty: !item.assigneeName }" aria-hidden="true">{{ item.assigneeName ? initial(item.assigneeName) : '–' }}</span>{{ item.assigneeName || '未分派负责人' }}</span><small :class="`source-${item.sourceState}`">{{ sourceStateLabels[item.sourceState] }}</small></div>
            <i class="ri-arrow-right-line case-go" aria-hidden="true"></i>
          </router-link>
        </div>
        <p v-else class="campus-empty">当前条件未返回演练事件。管理员可选择上方场景创建一条本地演练，再演示分派、处置、核实与关闭流程。</p>
        <div class="campus-pagination"><button class="campus-button secondary" :disabled="cases.loading.value || skip === 0" @click="page(-limit)"><i class="ri-arrow-left-s-line" aria-hidden="true"></i>上一页</button><span>第 {{ Math.floor(skip / limit) + 1 }} 页</span><button class="campus-button secondary" :disabled="cases.loading.value || skip + limit >= cases.data.value.total" @click="page(limit)">下一页<i class="ri-arrow-right-s-line" aria-hidden="true"></i></button></div>
      </template>
    </section>
  </div>
</template>

<style scoped>
.operations-boundary{position:relative;display:flex;gap:10px 16px;flex-wrap:wrap;align-items:center;padding:14px 18px;border-radius:18px;font-size:13px;line-height:1.7;background:linear-gradient(100deg,color-mix(in srgb,var(--brand-1) 12%,transparent),color-mix(in srgb,var(--brand-3) 10%,transparent));border:1px solid color-mix(in srgb,var(--brand-2) 22%,transparent);overflow:hidden}
.operations-boundary::after{content:'';position:absolute;top:0;bottom:0;width:30%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.18),transparent);animation:fx-sheen 6s ease-in-out infinite;pointer-events:none}
.boundary-icon{width:34px;height:34px;border-radius:11px;display:grid;place-items:center;color:#fff;background:var(--brand-gradient);box-shadow:0 8px 18px -8px var(--brand-glow);font-size:17px}
.operations-boundary strong{color:var(--text-main);white-space:nowrap;font-weight:700}
.operations-boundary>span:not(.boundary-icon){flex:1;min-width:240px;color:var(--text-secondary)}
.operations-boundary a{font-weight:600;min-height:32px;display:inline-flex;align-items:center;gap:4px}
.operations-guide{position:relative;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin:20px 0 22px}
.guide-step{position:relative;display:flex;gap:14px;align-items:center;padding:18px;min-width:0;color:var(--text-main);border-radius:var(--radius-card);background:var(--surface-1);border:1px solid var(--border-base);box-shadow:var(--shadow-card);backdrop-filter:var(--glass);-webkit-backdrop-filter:var(--glass);overflow:hidden}
@media(hover:hover){.guide-step:hover{box-shadow:var(--shadow-hover);opacity:1}.guide-step:hover .guide-go{transform:translateX(4px);color:var(--brand-2)}.guide-step:hover .guide-icon{transform:scale(1.08) rotate(-4deg)}}
.guide-number{position:absolute;right:48px;top:50%;transform:translateY(-50%);font-size:44px;font-weight:800;font-family:var(--font-number);line-height:1;letter-spacing:-.04em;color:transparent;-webkit-text-stroke:1px var(--border-strong);pointer-events:none}
.guide-icon{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;font-size:21px;color:#fff;background:var(--brand-gradient);box-shadow:0 10px 22px -10px var(--brand-glow);flex-shrink:0;transition:transform .35s cubic-bezier(.34,1.56,.64,1)}
.guide-step:nth-child(2) .guide-icon{background:linear-gradient(135deg,#a78bfa,#ec4899)}
.guide-step:nth-child(3) .guide-icon{background:linear-gradient(135deg,#34d399,#0ea5e9)}
.guide-step strong{display:block;font-size:15px;margin-bottom:3px}
.guide-step small{display:block;font-size:12px;color:var(--text-tertiary);line-height:1.6}
.guide-go{margin-left:auto;font-size:18px;color:var(--text-tertiary);transition:transform .25s,color .25s;position:relative;z-index:1}
.operations-scenario{padding:22px}
.scenario-form{display:flex;flex-direction:column;gap:16px}
.scenario-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;border:0;padding:0;margin:0;min-width:0}
.scenario-cards:disabled{opacity:.6}
.scenario-card{position:relative;display:flex;gap:12px;align-items:flex-start;padding:14px;border-radius:16px;border:1.5px solid var(--border-base);background:var(--surface-inset);cursor:pointer;transition:border-color .2s,background .2s,transform .2s,box-shadow .2s}
.scenario-cards.readonly .scenario-card{cursor:default}
@media(hover:hover){.scenario-form .scenario-card:hover{transform:translateY(-2px);border-color:color-mix(in srgb,var(--brand-2) 40%,transparent)}}
.scenario-card.selected{border-color:var(--brand-2);background:color-mix(in srgb,var(--brand-2) 8%,var(--surface-raised));box-shadow:0 0 0 4px color-mix(in srgb,var(--brand-2) 14%,transparent),0 12px 28px -16px var(--brand-glow)}
.scenario-card:has(input:focus-visible){outline:2px solid var(--brand-2);outline-offset:3px}
.scenario-icon{width:38px;height:38px;border-radius:12px;display:grid;place-items:center;font-size:19px;color:var(--brand-2);background:var(--info-soft);flex-shrink:0;transition:all .25s}
.scenario-card.selected .scenario-icon{color:#fff;background:var(--brand-gradient)}
.scenario-copy{min-width:0}
.scenario-copy strong{display:block;font-size:14px;margin-bottom:3px}
.scenario-copy small{display:block;font-size:12px;color:var(--text-tertiary);line-height:1.6}
.scenario-check{position:absolute;top:10px;right:10px;width:20px;height:20px;border-radius:50%;display:grid;place-items:center;font-size:13px;color:#fff;background:var(--brand-2);transform:scale(0);transition:transform .3s cubic-bezier(.34,1.56,.64,1)}
.scenario-card.selected .scenario-check{transform:scale(1)}
.scenario-actions{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding-top:4px}
.scenario-description{display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--text-secondary);margin:0}
.scenario-description a{font-weight:600;display:inline-flex;align-items:center;gap:3px}
.scenario-limitations{font-size:12.5px;color:var(--text-secondary);margin-top:16px}
.scenario-limitations summary{cursor:pointer;min-height:32px;display:inline-flex;align-items:center;gap:6px;font-weight:600}
.scenario-limitations ul{margin:6px 0 0 18px;list-style:disc;line-height:1.9}
.operations-queue{scroll-margin-top:20px}
.campus-arrow-link{font-size:12.5px;min-height:44px;display:inline-flex;align-items:center;gap:4px;font-weight:600}
.operations-filters{display:flex;gap:14px;align-items:end;flex-wrap:wrap;margin:8px 0 14px}
.operations-filters label{display:flex;flex-direction:column;gap:8px;min-width:160px;flex:1;max-width:260px;font-size:12.5px;font-weight:600;color:var(--text-secondary)}
.operations-energy-link{margin-left:auto}
.operations-distribution{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(200px,.8fr);align-items:center;gap:24px;padding:20px 22px;margin-bottom:18px}
.distribution-copy h3{font-size:16px;font-weight:650;margin-bottom:4px}
.distribution-copy>p{font-size:12.5px;color:var(--text-tertiary);line-height:1.6}
.pipeline{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:16px;counter-reset:stage}
.pipeline li{position:relative;min-width:0}
.pipeline li:not(:last-child)::after{content:'';position:absolute;right:-9px;top:50%;width:8px;height:2px;background:var(--border-strong)}
.pipeline-stage{position:relative;width:100%;display:grid;grid-template-columns:auto 1fr;grid-template-rows:auto auto auto;column-gap:8px;row-gap:4px;text-align:left;padding:12px;border-radius:14px;cursor:pointer;color:var(--text-main);background:var(--surface-inset);border:1.5px solid var(--border-base);transition:border-color .2s,transform .2s,box-shadow .2s}
@media(hover:hover){.pipeline-stage:not(:disabled):hover{transform:translateY(-2px);border-color:color-mix(in srgb,var(--c) 50%,transparent)}}
.pipeline-stage[aria-pressed="true"]{border-color:var(--c);background:color-mix(in srgb,var(--c) 10%,var(--surface-raised));box-shadow:0 10px 24px -14px var(--c)}
.pipeline-stage:disabled{opacity:.6;cursor:not-allowed}
.stage-icon{grid-row:1/3;width:30px;height:30px;border-radius:10px;display:grid;place-items:center;font-size:15px;color:var(--c);background:color-mix(in srgb,var(--c) 14%,transparent)}
.stage-name{font-size:11.5px;color:var(--text-secondary);white-space:nowrap}
.pipeline-stage strong{font-size:22px;font-weight:750;line-height:1.05;font-family:var(--font-number)}
.stage-bar{grid-column:1/-1;height:4px;border-radius:4px;background:var(--ring-track);overflow:hidden;margin-top:6px}
.stage-bar span{display:block;height:100%;width:var(--w);background:var(--c);border-radius:inherit;box-shadow:0 0 8px var(--c);transition:width .8s cubic-bezier(.22,.8,.24,1)}
.distribution-chart{position:relative}
.distribution-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none}
.distribution-center strong{font-size:30px;font-weight:750;font-family:var(--font-number);line-height:1.1}
.distribution-center>span{font-size:11.5px;color:var(--text-tertiary)}
.case-list{display:flex;flex-direction:column;gap:10px}
.case-list-item{position:relative;display:flex;align-items:center;gap:16px;padding:16px 20px 16px 18px;border-radius:18px;color:var(--text-main);background:var(--surface-1);border:1px solid var(--border-base);box-shadow:var(--shadow-card);backdrop-filter:var(--glass);-webkit-backdrop-filter:var(--glass);overflow:hidden;transition:transform .25s cubic-bezier(.2,.8,.2,1),box-shadow .25s,border-color .25s}
.case-list-item::before{content:'';position:absolute;left:0;top:14px;bottom:14px;width:4px;border-radius:0 4px 4px 0;background:var(--sc);box-shadow:0 0 12px var(--sc)}
.state-NEW{--sc:var(--warn)}.state-ASSIGNED{--sc:#3b82f6}.state-IN_PROGRESS{--sc:#a855f7}.state-CLOSED{--sc:var(--ok)}
@media(hover:hover){.case-list-item:hover{transform:translateX(4px);box-shadow:var(--shadow-hover);opacity:1}.case-list-item:hover .case-go{transform:translateX(4px);color:var(--brand-2)}}
.case-state-icon{width:42px;height:42px;border-radius:14px;display:grid;place-items:center;font-size:20px;flex-shrink:0;color:var(--sc);background:color-mix(in srgb,var(--sc) 13%,transparent)}
.case-list-main{flex:1;min-width:0}
.case-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:7px}
.case-state{display:inline-flex;align-items:center;border-radius:999px;padding:2px 10px;font-size:11.5px;font-weight:650;color:var(--sc,var(--text-secondary));background:color-mix(in srgb,var(--sc,var(--text-tertiary)) 14%,transparent)}
.case-state.NEW{--sc:var(--warn)}.case-state.ASSIGNED{--sc:#3b82f6}.case-state.IN_PROGRESS{--sc:#a855f7}.case-state.CLOSED{--sc:var(--ok)}
.case-meta .campus-chip{height:22px;font-size:11px}
.case-level{font-size:11.5px;color:var(--text-tertiary)}
.case-list-main>strong{display:block;font-size:15px;font-weight:650;line-height:1.5}
.case-list-main>small{display:flex;align-items:center;gap:4px;flex-wrap:wrap;font-size:12px;color:var(--text-tertiary);margin-top:5px}
.case-list-owner{display:flex;flex-direction:column;align-items:flex-end;gap:6px;font-size:12.5px;flex-shrink:0;max-width:200px}
.case-owner{display:inline-flex;align-items:center;gap:8px;font-weight:600}
.case-avatar{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font-size:12px;font-weight:700;color:#fff;background:var(--brand-gradient)}
.case-avatar.empty{background:var(--surface-inset);color:var(--text-tertiary);border:1px dashed var(--border-strong)}
.case-list-owner small{font-size:11.5px;color:var(--text-tertiary)}
.case-list-owner small.source-ACTIVE{color:var(--warn-text)}
.case-list-owner small.source-RECOVERED{color:var(--ok-text)}
.case-go{font-size:19px;color:var(--text-tertiary);transition:transform .25s,color .25s}
@media(max-width:1050px){.operations-distribution{grid-template-columns:1fr;gap:12px}.distribution-chart{max-width:260px;margin:0 auto;width:100%}}
@media(max-width:768px){.operations-boundary{padding:13px 14px}.operations-boundary>span:not(.boundary-icon){min-width:100%}.operations-boundary a{min-height:44px}.operations-guide{grid-template-columns:1fr;gap:10px;margin:16px 0 18px}.guide-step{padding:14px}.operations-scenario{padding:16px 14px}.scenario-actions .campus-button{width:100%}.scenario-limitations summary{min-height:44px}.operations-filters{gap:12px}.operations-filters label{max-width:none;min-width:calc(50% - 6px)}.pipeline{grid-template-columns:repeat(2,minmax(0,1fr))}.pipeline li::after{display:none}.operations-distribution{padding:16px 14px}.case-list-item{padding:14px;gap:12px;flex-wrap:wrap}.case-state-icon{width:36px;height:36px;font-size:17px}.case-list-main{flex-basis:calc(100% - 90px)}.case-list-owner{order:3;flex-basis:100%;max-width:none;flex-direction:row;justify-content:space-between;align-items:center}.case-go{order:2}}
</style>
