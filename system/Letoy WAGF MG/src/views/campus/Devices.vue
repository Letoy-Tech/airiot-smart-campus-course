<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { EChartsCoreOption } from 'echarts/core'
import { getOverview } from '@/api/campus'
import { useResource } from '@/composables/useResource'
import type { Device, DeviceCategory, Point } from '@/types/campus'
import { categoryLabels, onlineLabel, qualityLabels, switchLabel, timeLabel } from '@/utils/campus'
import { alpha, gradient, vizTheme } from '@/utils/vizTheme'
import CampusChart from '@/components/campus/CampusChart.vue'
import ResourceState from '@/components/campus/ResourceState.vue'
import PointValue from '@/components/campus/PointValue.vue'
import KpiCard from '@/components/viz/KpiCard.vue'
import LivePulse from '@/components/viz/LivePulse.vue'
import CountUp from '@/components/viz/CountUp.vue'
import SegmentTabs from '@/components/viz/SegmentTabs.vue'
import { useIsMobile } from '@/utils/responsive'

defineOptions({ name: 'CampusDevices' })

const route = useRoute()
const router = useRouter()
const category = ref('')
const spaceId = ref('')
const query = ref('')
const online = ref('')
const view = ref<'cards' | 'table'>('cards')
const viewTabs = [{ value: 'cards' as const, label: '卡片巡查', icon: 'ri-layout-grid-line' }, { value: 'table' as const, label: '表格台账', icon: 'ri-list-check' }]
const mobile = useIsMobile()
const distributionExpanded = ref(!mobile.value)
watch(mobile, narrow => { distributionExpanded.value = !narrow })
const toggleDistribution = (event: Event) => { distributionExpanded.value = (event.target as HTMLDetailsElement).open }
const categories: DeviceCategory[] = ['environment', 'energy', 'facility', 'lighting']
const categoryIcons: Record<DeviceCategory, string> = { environment: 'ri-leaf-line', energy: 'ri-flashlight-line', facility: 'ri-building-2-line', lighting: 'ri-lightbulb-line' }
const { data, loading, error, lastSuccess, nextRefreshAt, load } = useResource(getOverview, 15000)

watch(
  () => [route.query.category, route.query.spaceId],
  ([nextCategory, nextSpace]) => {
    category.value = typeof nextCategory === 'string' && categories.includes(nextCategory as DeviceCategory) ? nextCategory : ''
    spaceId.value = typeof nextSpace === 'string' ? nextSpace : ''
  },
  { immediate: true },
)

function communicationState(value: boolean | null) { return value === true ? 'online' : value === false ? 'offline' : 'unknown' }
function hasSwitch(device: Device) { return device.category === 'facility' || device.category === 'lighting' }
function switchState(value: boolean | null) { return value === true ? 'on' : value === false ? 'off' : 'unknown' }
function deviceSpaceLabel(device: Device) { return device.spaceName || (device.spaceId ? `空间 ${device.spaceId}（未读取名称）` : '未关联空间') }
const spaceOptions = computed(() => {
  const options = new Map((data.value?.spaces || []).map(space => [space.id, space.name]))
  for (const device of data.value?.devices || []) if (device.spaceId && !options.has(device.spaceId)) options.set(device.spaceId, deviceSpaceLabel(device))
  return [...options].map(([id, name]) => ({ id, name }))
})
const hasFilters = computed(() => !!(category.value || spaceId.value || query.value.trim() || online.value))
function clearFilters() {
  category.value = ''; spaceId.value = ''; query.value = ''; online.value = ''
  if (route.query.category || route.query.spaceId) void router.replace({ query: { ...route.query, category: undefined, spaceId: undefined } })
}
const matchesOthers = (device: Device) => {
  const search = query.value.trim().toLowerCase()
  return (!spaceId.value || (spaceId.value === '__unassigned__' ? device.spaceId === null : device.spaceId === spaceId.value))
    && (!online.value || communicationState(device.online) === online.value)
    && (!search || `${device.name} ${device.id}`.toLowerCase().includes(search))
}
const devices = computed(() => data.value?.devices.filter(device => (!category.value || device.category === category.value) && matchesOthers(device)) || [])
const facetCounts = computed(() => {
  const base = data.value?.devices.filter(matchesOthers) || []
  return { all: base.length, ...Object.fromEntries(categories.map(key => [key, base.filter(device => device.category === key).length])) } as Record<string, number>
})
const pickCategory = (key: string) => { category.value = key }
const pointMap = computed(() => {
  const map = new Map<string, Point>()
  for (const point of data.value?.points || []) map.set(`${point.deviceId}:${point.tagId}`, point)
  return map
})
function pointFor(deviceId: string, tagId: string) { return pointMap.value.get(`${deviceId}:${tagId}`) }
const validValue = (point: Point | undefined) => point && typeof point.value === 'number' && Number.isFinite(point.value) && point.quality !== 'invalid' && point.quality !== 'missing' ? point.value : null
const pointCounts = computed(() => {
  let total = 0
  let fresh = 0
  for (const device of devices.value) {
    for (const tag of device.tags) {
      total++
      const point = pointFor(device.id, tag.id)
      if (point?.quality === 'fresh' && typeof point.value === 'number' && Number.isFinite(point.value)) fresh++
    }
  }
  return { total, fresh, review: total - fresh }
})
const categoryCounts = computed(() => categories.map(key => ({ key, label: categoryLabels[key], color: vizTheme.value.category[key], glow: vizTheme.value.categoryGlow[key], count: devices.value.filter(device => device.category === key).length })))
const communicationCounts = computed(() => [
  { key: 'online', label: '在线', color: vizTheme.value.online, count: devices.value.filter(device => device.online === true).length },
  { key: 'offline', label: '离线', color: vizTheme.value.offline, count: devices.value.filter(device => device.online === false).length },
  { key: 'unknown', label: '状态未知', color: vizTheme.value.unknown, count: devices.value.filter(device => device.online !== true && device.online !== false).length },
])
const knownOnline = computed(() => communicationCounts.value[0]!.count + communicationCounts.value[1]!.count)
const onlineRatio = computed(() => (knownOnline.value ? communicationCounts.value[0]!.count / knownOnline.value : null))
const categoryOption = computed<EChartsCoreOption>(() => {
  const t = vizTheme.value
  return {
    tooltip: { trigger: 'item', valueFormatter: (value: unknown) => `${value} 台` },
    polar: { radius: ['22%', '92%'], center: ['50%', '50%'] },
    angleAxis: { max: Math.max(1, devices.value.length), startAngle: 90, show: false },
    radiusAxis: { type: 'category', data: categoryCounts.value.map(item => item.label), show: false },
    series: [{
      type: 'bar', name: '设备类型', coordinateSystem: 'polar', roundCap: true, barWidth: 11,
      showBackground: true, backgroundStyle: { color: alpha(t.subtext, 0.1) },
      data: categoryCounts.value.map(item => ({ value: item.count, name: item.label, itemStyle: { color: gradient(item.glow, item.color, true), shadowBlur: 10, shadowColor: alpha(item.color, 0.5) } })),
    }],
  }
})
const communicationOption = computed<EChartsCoreOption>(() => ({
  tooltip: { trigger: 'item', formatter: '{b}：{c} 台' },
  series: [{
    type: 'pie', name: '通信状态', radius: ['64%', '88%'], center: ['50%', '50%'], padAngle: 3, stillShowZeroSum: false,
    label: { show: false }, labelLine: { show: false }, emphasis: { scale: true, scaleSize: 5 },
    itemStyle: { borderRadius: 6 },
    data: communicationCounts.value.filter(item => item.count > 0).map(item => ({ name: item.label, value: item.count, itemStyle: { color: item.color, shadowBlur: 10, shadowColor: alpha(item.color, 0.45) } })),
  }],
}))
const categoryChartLabel = computed(() => `当前筛选设备类型分布：${categoryCounts.value.map(item => `${item.label}${item.count}台`).join('，')}`)
const communicationChartLabel = computed(() => `当前筛选设备通信状态分布：${communicationCounts.value.map(item => `${item.label}${item.count}台`).join('，')}`)
</script>

<template>
  <div class="campus-page device-page">
    <header class="campus-page-head">
      <div>
        <p class="campus-eyebrow">资产与监控</p>
        <h1>设备<span class="gradient-text">台账</span></h1>
        <p>巡查最新点值与通信状态，进入详情核对原始历史和模拟开关。</p>
      </div>
      <div class="campus-page-actions">
        <LivePulse :loading="loading" :error="error" :last-success="lastSuccess" :next-at="nextRefreshAt" />
        <button class="campus-button secondary" :class="{ 'is-loading': loading }" :disabled="loading" @click="load"><i class="ri-refresh-line" aria-hidden="true"></i>{{ loading ? '读取中' : '刷新数据' }}</button>
      </div>
    </header>
    <ResourceState :loading="loading" :error="error" :has-data="!!data" :last-success="lastSuccess" @retry="load" />
    <form class="campus-panel device-filters" role="search" aria-label="设备筛选" @submit.prevent>
      <div class="device-filter-row">
        <label class="device-search"><span class="sr-only">搜索设备</span><i class="ri-search-2-line" aria-hidden="true"></i><input v-model="query" type="search" placeholder="搜索设备名称或设备 ID" aria-label="搜索设备" /></label>
        <label><span class="sr-only">所属空间</span><select v-model="spaceId" aria-label="所属空间"><option value="">全部空间</option><option value="__unassigned__">未关联空间</option><option v-for="space in spaceOptions" :key="space.id" :value="space.id">{{ space.name }}</option></select></label>
        <label><span class="sr-only">通信状态</span><select v-model="online" aria-label="通信状态"><option value="">全部通信状态</option><option value="online">在线</option><option value="offline">离线</option><option value="unknown">状态未知</option></select></label>
        <button type="button" class="campus-button secondary" :disabled="!hasFilters" @click="clearFilters"><i class="ri-filter-off-line" aria-hidden="true"></i>清空筛选</button>
      </div>
      <div class="device-chips" role="group" aria-label="设备类型">
        <button type="button" class="device-chip" :aria-pressed="!category" @click="pickCategory('')"><i class="ri-apps-2-line" aria-hidden="true"></i>全部类型<span>{{ data ? facetCounts.all : '—' }}</span></button>
        <button v-for="key in categories" :key="key" type="button" class="device-chip" :class="`category-${key}`" :aria-pressed="category === key" @click="pickCategory(key)"><i :class="categoryIcons[key]" aria-hidden="true"></i>{{ categoryLabels[key] }}<span>{{ data ? facetCounts[key] : '—' }}</span></button>
      </div>
    </form>
    <template v-if="data">
      <div class="device-source campus-live-source">
        <span class="campus-chip info"><i class="ri-database-2-line" aria-hidden="true"></i>来源 AIRIOT · {{ timeLabel(data.observedAt) }} 读取</span><span>每15秒刷新 · 全部为模拟设备</span>
      </div>
      <details v-if="devices.length" class="device-distribution" aria-labelledby="distribution-title" :open="distributionExpanded" @toggle="toggleDistribution">
        <summary class="device-distribution-head">
          <strong id="distribution-title" class="device-distribution-title"><i class="ri-bar-chart-box-line" aria-hidden="true"></i>当前筛选概况</strong>
          <span class="campus-muted">按实际读取的设备统计，通信状态与点值质量分别核对。</span>
          <span class="device-distribution-toggle">{{ distributionExpanded ? '收起图表' : '展开图表' }}<i class="ri-arrow-down-s-line" aria-hidden="true"></i></span>
        </summary>
        <div class="device-overview">
          <div class="campus-kpi-grid device-kpis">
            <KpiCard :index="0" label="匹配设备" icon="ri-cpu-line" tone="blue" :value="devices.length" unit="台" :hint="hasFilters ? '已应用筛选条件' : '全部读取设备'" />
            <KpiCard :index="1" label="通信在线" icon="ri-wifi-line" tone="emerald" :value="communicationCounts[0]!.count" :suffix="`/ ${devices.length} 台`" :ratio="onlineRatio" ratio-label="已知状态中的在线占比" :hint="communicationCounts[2]!.count ? `${communicationCounts[2]!.count} 台状态未知，不计入比例` : '在线 / 已知状态'" />
            <KpiCard :index="2" label="有效点值" icon="ri-shield-check-line" tone="cyan" :value="pointCounts.fresh" :suffix="`/ ${pointCounts.total} 点`" :ratio="pointCounts.total ? pointCounts.fresh / pointCounts.total : null" ratio-label="有效点值占比" hint="质量为有效且有数值" />
            <KpiCard :index="3" label="待核对点值" icon="ri-error-warning-line" tone="amber" :value="pointCounts.review" unit="点" :hint="pointCounts.review ? '过期、缺失或无效' : '暂无待核对点值'" :warn="pointCounts.review > 0" />
          </div>
          <div v-if="distributionExpanded" class="device-charts">
            <section class="campus-panel device-category-chart">
              <h3><i class="ri-donut-chart-line" aria-hidden="true"></i>设备类型分布</h3>
              <div class="device-chart-layout">
                <CampusChart :option="categoryOption" :label="categoryChartLabel" :height="170" />
                <ul class="device-category-counts" aria-label="设备类型计数">
                  <li v-for="item in categoryCounts" :key="item.key" :style="{ '--c': item.color }"><span class="device-category-dot" aria-hidden="true"></span><span>{{ item.label }}</span><strong><CountUp :value="item.count" /> 台</strong></li>
                </ul>
              </div>
              <p class="campus-muted">环形长度为占当前匹配设备的比例。</p>
            </section>
            <section class="campus-panel device-communication-chart">
              <h3><i class="ri-signal-tower-line" aria-hidden="true"></i>通信状态分布</h3>
              <div class="device-chart-layout">
                <div class="device-donut"><CampusChart :option="communicationOption" :label="communicationChartLabel" :height="170" /><div class="device-donut-center" aria-hidden="true"><strong><CountUp :value="communicationCounts[0]!.count" /></strong><span>在线</span></div></div>
                <ul class="device-communication-counts" aria-label="通信状态计数">
                  <li v-for="item in communicationCounts" :key="item.key" :style="{ '--c': item.color }"><span class="device-state-dot" :class="item.key" aria-hidden="true"></span><span>{{ item.label }}</span><strong><CountUp :value="item.count" /> 台</strong></li>
                </ul>
              </div>
              <p class="campus-muted">未知单独统计；最新点值不代表设备通信正常。</p>
            </section>
          </div>
        </div>
      </details>
      <section class="device-results" aria-labelledby="device-results-title">
        <div class="device-results-head">
          <div>
            <h2 id="device-results-title">巡查结果 <span>{{ devices.length }} 台</span></h2>
            <p v-if="pointCounts.review" class="campus-muted">{{ pointCounts.review }} 个点值过期、缺失或无效，请查看质量与采样时间。</p>
          </div>
          <SegmentTabs v-model="view" :options="viewTabs" label="设备显示方式" />
        </div>
        <Transition name="view-swap" mode="out-in">
          <div v-if="devices.length && view === 'cards'" key="cards" class="device-grid fx-stagger">
            <article v-for="device in devices" :key="device.id" class="device-card fx-spotlight fx-glow-border" :class="[`category-${device.category}`, communicationState(device.online)]" :aria-labelledby="`device-${device.id}`">
              <header class="device-card-head">
                <span class="device-icon" aria-hidden="true"><i :class="categoryIcons[device.category]"></i></span>
                <div class="device-identity">
                  <h3 :id="`device-${device.id}`">{{ device.name }}</h3>
                  <p>{{ categoryLabels[device.category] }}设备 · {{ device.id }}</p>
                </div>
                <span class="device-state" :class="communicationState(device.online)"><span class="device-state-dot" :class="communicationState(device.online)" aria-hidden="true"></span>{{ onlineLabel(device.online) }}</span>
              </header>
              <p class="device-location"><i class="ri-map-pin-2-line" aria-hidden="true"></i>{{ deviceSpaceLabel(device) }}</p>
              <div class="device-points" aria-label="最新采集点值">
                <div v-for="tag in device.tags" :key="tag.id" class="device-point" :class="pointFor(device.id, tag.id)?.quality || 'missing'">
                  <span class="device-point-name">{{ tag.name || tag.id }}</span>
                  <strong v-if="validValue(pointFor(device.id, tag.id)) !== null" class="device-point-value"><CountUp :value="validValue(pointFor(device.id, tag.id))" /><small>{{ pointFor(device.id, tag.id)?.unit || tag.unit }}</small></strong>
                  <strong v-else class="device-point-value unavailable">未取得有效值</strong>
                  <span class="device-point-meta"><span class="quality" :class="pointFor(device.id, tag.id)?.quality || 'missing'">{{ qualityLabels[pointFor(device.id, tag.id)?.quality || 'missing'] }}</span>{{ timeLabel(pointFor(device.id, tag.id)?.time).slice(-8) }}</span>
                </div>
                <p v-if="!device.tags.length" class="campus-muted">未提供采集点，无法核对最新值。</p>
              </div>
              <footer class="device-card-footer">
                <span v-if="hasSwitch(device)" class="device-switch" :class="switchState(device.switchOn)" :title="`模拟开关：${switchLabel(device.switchOn)}`"><span class="switch-track" aria-hidden="true"><span class="switch-thumb"></span></span>模拟开关 · {{ switchLabel(device.switchOn) }}</span>
                <span v-else class="device-comm"><i class="ri-time-line" aria-hidden="true"></i>通信 {{ timeLabel(device.communicationTime).slice(-8) }}</span>
                <router-link :to="`/campus/devices/${encodeURIComponent(device.id)}`" :aria-label="`查看${device.name}详情`">详情<i class="ri-arrow-right-line" aria-hidden="true"></i></router-link>
              </footer>
            </article>
          </div>
          <div v-else-if="devices.length" key="table" class="campus-table-scroll device-table-wrap">
            <table class="campus-table device-table">
              <caption class="sr-only">当前筛选设备台账，{{ devices.length }}台。所有点值显示质量与采样时间。</caption>
              <thead><tr><th scope="col">设备 / 类型</th><th scope="col">所属空间</th><th scope="col">通信状态</th><th scope="col">最新点值</th><th scope="col">模拟开关</th><th scope="col">详情</th></tr></thead>
              <tbody>
                <tr v-for="device in devices" :key="device.id">
                  <td><span class="device-table-name"><span class="device-icon sm" :class="`category-${device.category}`" aria-hidden="true"><i :class="categoryIcons[device.category]"></i></span><span><strong>{{ device.name }}</strong><small>{{ device.id }} · {{ categoryLabels[device.category] }}</small></span></span></td>
                  <td>{{ deviceSpaceLabel(device) }}</td>
                  <td><span class="device-state" :class="communicationState(device.online)"><span class="device-state-dot" :class="communicationState(device.online)" aria-hidden="true"></span>{{ onlineLabel(device.online) }}</span><small>{{ timeLabel(device.communicationTime) }}</small></td>
                  <td><div v-for="tag in device.tags" :key="tag.id" class="campus-point-row"><span>{{ tag.name || tag.id }}</span><PointValue :point="pointFor(device.id, tag.id)" /></div><span v-if="!device.tags.length" class="campus-muted">未提供采集点</span></td>
                  <td><span v-if="hasSwitch(device)" class="device-switch" :class="switchState(device.switchOn)"><span class="switch-track" aria-hidden="true"><span class="switch-thumb"></span></span>{{ switchLabel(device.switchOn) }}</span><span v-else class="campus-muted">不适用</span></td>
                  <td><router-link class="device-detail-link" :to="`/campus/devices/${encodeURIComponent(device.id)}`" :aria-label="`查看${device.name}详情`">查看详情<i class="ri-arrow-right-line" aria-hidden="true"></i></router-link></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else key="empty" class="device-empty campus-panel" role="status">
            <span class="device-empty-icon" aria-hidden="true"><i class="ri-filter-3-line"></i></span>
            <h3>{{ hasFilters ? '没有符合筛选的设备' : '尚未读取到设备' }}</h3>
            <p>{{ hasFilters ? '尝试清空条件，或选择其他类型、空间与通信状态。' : '等待下一次读取，或刷新数据检查接入完整性。' }}</p>
            <button v-if="hasFilters" type="button" class="campus-button secondary" @click="clearFilters">清空筛选</button>
          </div>
        </Transition>
      </section>
      <ul v-if="data.issues.length" class="campus-notice warning"><li v-for="(issue, index) in data.issues" :key="index">{{ issue.message }}</li></ul>
    </template>
  </div>
</template>

<style scoped>
.device-page{min-width:0}
.category-environment{--c:var(--viz-environment)}.category-energy{--c:var(--viz-energy)}.category-facility{--c:var(--viz-facility)}.category-lighting{--c:var(--viz-lighting)}
.device-filters{display:flex;flex-direction:column;gap:14px;padding:16px 18px;margin-bottom:16px}
.device-filter-row{display:grid;grid-template-columns:minmax(220px,1.8fr) repeat(2,minmax(150px,1fr)) auto;gap:12px;align-items:center}
.device-filter-row label{min-width:0}
.device-search{position:relative;display:block}
.device-search>i{position:absolute;left:14px;top:50%;transform:translateY(-50%);color:var(--text-tertiary);font-size:16px;pointer-events:none}
.device-search input{padding-left:40px!important}
.device-chips{display:flex;gap:8px;flex-wrap:wrap}
.device-chip{--c:var(--brand-2);display:inline-flex;align-items:center;gap:7px;height:36px;padding:0 8px 0 12px;border-radius:999px;border:1px solid var(--border-base);background:var(--surface-inset);color:var(--text-secondary);font-size:13px;cursor:pointer;transition:all .22s}
.device-chip i{font-size:15px;color:var(--c)}
.device-chip span{min-width:24px;height:22px;padding:0 7px;border-radius:999px;display:grid;place-items:center;font-size:11.5px;font-weight:700;font-variant-numeric:tabular-nums;background:var(--surface-raised);color:var(--text-secondary);transition:all .22s}
@media(hover:hover){.device-chip:hover{border-color:color-mix(in srgb,var(--c) 45%,transparent);color:var(--text-main)}}
.device-chip[aria-pressed="true"]{color:var(--text-main);font-weight:600;border-color:color-mix(in srgb,var(--c) 55%,transparent);background:color-mix(in srgb,var(--c) 12%,var(--surface-raised));box-shadow:0 6px 18px -10px var(--c)}
.device-chip[aria-pressed="true"] span{background:var(--c);color:#fff}
.device-source{margin:0 0 16px;justify-content:space-between}
.device-distribution{margin-bottom:22px}
.device-distribution summary{cursor:pointer;list-style:none;display:flex;align-items:center;gap:6px 14px;flex-wrap:wrap;margin-bottom:14px}
.device-distribution summary::-webkit-details-marker{display:none}
.device-distribution-title{display:inline-flex;align-items:center;gap:8px;font-size:17px;font-weight:650}
.device-distribution-title i{color:var(--brand-2)}
.device-distribution-toggle{margin-left:auto;display:inline-flex;align-items:center;gap:2px;font-size:12.5px;font-weight:600;color:var(--primary-color);white-space:nowrap}
.device-distribution-toggle i{font-size:16px;transition:transform .3s}
.device-distribution[open] .device-distribution-toggle i{transform:rotate(180deg)}
.device-kpis{margin-bottom:16px}
.device-charts{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.device-charts h3{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:650;margin-bottom:6px}
.device-charts h3 i{color:var(--brand-2)}
.device-chart-layout{display:grid;grid-template-columns:minmax(150px,1fr) minmax(130px,.9fr);align-items:center;gap:12px}
.device-category-counts,.device-communication-counts{display:flex;flex-direction:column;gap:6px}
.device-category-counts li,.device-communication-counts li{display:flex;align-items:center;gap:8px;font-size:12.5px;padding:8px 10px;border-radius:12px;background:var(--surface-inset)}
.device-category-counts strong,.device-communication-counts strong{margin-left:auto;font-variant-numeric:tabular-nums;font-weight:700}
.device-category-dot{width:9px;height:9px;border-radius:3px;background:var(--c);box-shadow:0 0 8px var(--c)}
.device-donut{position:relative}
.device-donut-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none}
.device-donut-center strong{font-size:28px;font-weight:750;font-family:var(--font-number);line-height:1.1}
.device-donut-center>span{font-size:11px;color:var(--text-tertiary)}
.device-charts .campus-muted{margin-top:8px}
.device-state-dot{position:relative;width:8px;height:8px;border-radius:50%;flex-shrink:0;background:var(--text-disabled)}
.device-state-dot.online{background:var(--ok)}
.device-state-dot.online::after{content:'';position:absolute;inset:0;border-radius:50%;background:var(--ok);animation:fx-ping 2s cubic-bezier(0,0,.2,1) infinite}
.device-state-dot.offline{background:var(--bad)}
.device-state-dot.unknown{background:transparent;box-shadow:inset 0 0 0 1.5px var(--text-tertiary)}
.device-results-head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;margin-bottom:16px;flex-wrap:wrap}
.device-results-head h2{font-size:19px;font-weight:650;margin-bottom:4px}
.device-results-head h2 span{font-size:13px;color:var(--text-tertiary);font-weight:500;margin-left:6px}
.device-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px}
.device-card{position:relative;display:flex;flex-direction:column;gap:12px;padding:18px;border-radius:var(--radius-card);background:var(--surface-1);border:1px solid var(--border-base);box-shadow:var(--shadow-card);backdrop-filter:var(--glass);-webkit-backdrop-filter:var(--glass);transition:transform .3s cubic-bezier(.2,.8,.2,1),box-shadow .3s}
.device-card::before{background:radial-gradient(380px circle at var(--mx,50%) var(--my,50%),color-mix(in srgb,var(--c) 12%,transparent),transparent 45%)!important}
.device-card::after{--spot-border:var(--c)}
.device-card>.device-card-head::before{content:'';position:absolute;left:18px;right:18px;top:0;height:2px;border-radius:0 0 2px 2px;background:linear-gradient(90deg,transparent,var(--c),transparent);opacity:.8}
@media(hover:hover){.device-card:hover{transform:translateY(-4px);box-shadow:var(--shadow-hover)}}
.device-card.offline{border-color:color-mix(in srgb,var(--bad) 30%,var(--border-base))}
.device-card-head{display:flex;align-items:flex-start;gap:12px}
.device-icon{width:42px;height:42px;border-radius:14px;display:grid;place-items:center;font-size:20px;color:#fff;flex-shrink:0;background:linear-gradient(135deg,color-mix(in srgb,var(--c) 60%,#fff),var(--c));box-shadow:0 10px 20px -10px var(--c)}
.device-icon.sm{width:32px;height:32px;border-radius:10px;font-size:16px}
.device-identity{flex:1;min-width:0}
.device-identity h3{font-size:15px;font-weight:650;line-height:1.4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.device-identity p{font-size:11.5px;color:var(--text-tertiary);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.device-state{display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 9px;border-radius:999px;font-size:11.5px;font-weight:600;white-space:nowrap;background:var(--muted-soft);color:var(--text-secondary)}
.device-state.online{background:var(--ok-soft);color:var(--ok-text)}
.device-state.offline{background:var(--bad-soft);color:var(--bad-text)}
.device-location{display:flex;align-items:center;gap:5px;font-size:12.5px;color:var(--text-secondary)}
.device-location i{color:var(--c)}
.device-points{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px}
.device-point{display:flex;flex-direction:column;gap:4px;padding:11px 12px;border-radius:14px;background:var(--surface-inset);border:1px solid var(--border-base);min-width:0}
.device-point.stale{border-color:color-mix(in srgb,var(--warn) 35%,transparent)}
.device-point-name{font-size:11.5px;color:var(--text-tertiary)}
.device-point-value{font-size:22px;font-weight:750;font-family:var(--font-number);line-height:1.15;letter-spacing:-.02em;color:var(--text-main)}
.device-point-value small{font-size:12px;font-weight:500;color:var(--text-tertiary);margin-left:3px;font-family:var(--font-family)}
.device-point-value.unavailable{font-size:13px;font-weight:600;color:var(--text-tertiary);font-family:var(--font-family);letter-spacing:0;padding:4px 0}
.device-point-meta{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-tertiary);font-variant-numeric:tabular-nums;flex-wrap:wrap}
.device-point-meta .quality{font-size:10.5px;padding:1px 7px}
.device-card-footer{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:auto;padding-top:12px;border-top:1px dashed var(--border-base);font-size:12px;color:var(--text-secondary)}
.device-card-footer a{display:inline-flex;align-items:center;gap:4px;font-weight:650;min-height:32px}
.device-card-footer a i{transition:transform .25s}
.device-card-footer a:hover i{transform:translateX(3px)}
.device-comm{display:inline-flex;align-items:center;gap:5px;font-variant-numeric:tabular-nums}
.device-switch{display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:600;white-space:nowrap}
.switch-track{position:relative;width:32px;height:18px;border-radius:999px;background:var(--ring-track);transition:background .3s;flex-shrink:0}
.switch-thumb{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25);transition:transform .35s cubic-bezier(.34,1.56,.64,1)}
.device-switch.on{color:var(--ok-text)}
.device-switch.on .switch-track{background:var(--ok);box-shadow:0 0 10px color-mix(in srgb,var(--ok) 50%,transparent)}
.device-switch.on .switch-thumb{transform:translateX(14px)}
.device-switch.unknown .switch-track{background:repeating-linear-gradient(45deg,var(--ring-track) 0 4px,transparent 4px 8px);box-shadow:inset 0 0 0 1px var(--border-strong)}
.device-switch.unknown .switch-thumb{transform:translateX(7px);opacity:.6}
.device-switch.unknown{color:var(--text-tertiary)}
.device-table-name{display:flex;align-items:center;gap:10px}
.device-table .device-state{margin-bottom:2px}
.device-detail-link{display:inline-flex;align-items:center;gap:4px;white-space:nowrap;font-weight:600;min-height:36px}
.device-empty{display:flex;flex-direction:column;align-items:center;text-align:center;gap:10px;padding:44px 20px}
.device-empty-icon{width:58px;height:58px;border-radius:18px;display:grid;place-items:center;font-size:26px;color:var(--brand-2);background:var(--info-soft)}
.device-empty h3{font-size:16px}
.device-empty p{font-size:13px;color:var(--text-tertiary)}
.view-swap-enter-active{animation:fx-rise .4s cubic-bezier(.2,.8,.2,1)}
.view-swap-leave-active{transition:opacity .12s ease}
.view-swap-leave-to{opacity:0}
@media(max-width:1100px){.device-filter-row{grid-template-columns:1fr 1fr}.device-search{grid-column:1/-1}.device-charts{grid-template-columns:1fr}}
@media(max-width:560px){.device-filter-row{grid-template-columns:1fr 1fr;gap:10px}.device-filter-row>.campus-button{grid-column:1/-1}.device-chips{flex-wrap:nowrap;overflow-x:auto;margin:0 -4px;padding:2px 4px;scrollbar-width:none}.device-chip{flex-shrink:0;height:40px}.device-chart-layout{grid-template-columns:1fr}.device-grid{grid-template-columns:1fr}.device-distribution-toggle{margin-left:0}}
</style>
