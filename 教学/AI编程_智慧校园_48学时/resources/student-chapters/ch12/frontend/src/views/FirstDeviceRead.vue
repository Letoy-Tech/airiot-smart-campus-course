<script lang="ts">
import { ApiError } from '../api/http'

export function onlineLabel(value: boolean | null): string {
  // STUDENT_TODO_B_BEGIN：分别处理 true、false、null，不使用真假默认表达式。
  if (value === true) return '在线'
  if (value === false) return '离线'
  if (value === null) return '未知'
  throw new ApiError('online 不符合 boolean | null 合同。')
  // STUDENT_TODO_B_END
}
</script>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useCampusStore } from '../stores/campus'
import type { Device } from '../types/campus'
import { safeError } from '../api/http'

const store = useCampusStore()
const keyword = ref('')
const stateFilter = ref<'all' | 'online' | 'offline' | 'unknown'>('all')
const categoryNames: Record<Device['category'], string> = { environment: '环境监测', energy: '能源计量', facility: '校园设施', lighting: '照明设备' }
const stateClass = (value: boolean | null) => value === true ? 'online' : value === false ? 'offline' : 'unknown'
const devices = computed(() => store.devices.filter((device) =>
  device.name.toLocaleLowerCase().includes(keyword.value.trim().toLocaleLowerCase())
  && (stateFilter.value === 'all' || stateClass(device.online) === stateFilter.value)))
const counts = computed(() => ({
  total: store.devices.length,
  online: store.devices.filter((device) => device.online === true).length,
  offline: store.devices.filter((device) => device.online === false).length,
  unknown: store.devices.filter((device) => device.online === null).length,
}))
// 学生检查点允许 TODO 抛出明确错误；保留页面，不用默认三态伪造完成。
const labelError = computed(() => {
  try { store.devices.forEach((device) => onlineLabel(device.online)); return '' }
  catch (error) { return safeError(error) }
})
function checkedOnlineLabel(value: boolean | null): string {
  try { return onlineLabel(value) } catch { return '标签待完成' }
}
const displayTime = (value: number | null) => value === null ? '未提供通信时间' : new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
}).format(value)
const spaceName = (device: Device) => device.spaceId === null ? '未提供来源空间'
  : store.spaces.find((space) => space.id === device.spaceId)?.name ?? device.spaceName ?? device.spaceId
function clearFilters() { keyword.value = ''; stateFilter.value = 'all' }
onMounted(() => { void store.refreshDevices() })
</script>

<template>
  <div class="workspace">
    <div class="page-heading">
      <div><p class="eyebrow">第 04 章 / 第一条贯通</p><h1>设备台账</h1><p class="muted">让页面上的每一条记录，都能在响应里找到依据。</p></div>
      <button class="button primary" type="button" :disabled="store.loading || store.capabilities?.canRead !== true" @click="store.refreshDevices">
        <span aria-hidden="true">↻</span> {{ store.loading ? '读取中…' : '重新读取' }}
      </button>
    </div>

    <section class="source-banner" aria-label="数据来源与时间">
      <div><span class="source-pill"><span aria-hidden="true"></span>TEACHING_MOCK</span><strong>教学模拟数据</strong><span>不代表真实设备运行</span></div>
      <p><span class="clock-label">固定教学时钟</span><time v-if="store.observedAt !== null" :datetime="new Date(store.observedAt).toISOString()">{{ displayTime(store.observedAt) }}（北京时间）</time><span v-else>等待读取观察时间</span></p>
    </section>

    <div class="content-grid">
      <section class="ledger" aria-labelledby="ledger-title" :aria-busy="store.loading">
        <div class="ledger-heading"><h2 id="ledger-title">设备目录</h2><span class="small-label">来源 / 空间 / 通信状态</span></div>
        <div v-if="store.capabilities?.canRead !== true" class="empty-state" role="alert"><h3>当前身份无法读取设备</h3><p>{{ store.readError || '服务端未授予读取能力，请退出后联系教师核对角色。' }}</p></div>
        <template v-else>
          <div class="filters">
            <label class="search-field" for="device-search"><span>设备名称</span><input id="device-search" v-model="keyword" type="search" placeholder="搜索设备名称" /></label>
            <label for="state-filter"><span>通信状态</span><select id="state-filter" v-model="stateFilter"><option value="all">全部状态</option><option value="online">在线</option><option value="offline">离线</option><option value="unknown">未知</option></select></label>
            <button class="button subtle clear-filter" type="button" :disabled="!keyword && stateFilter === 'all'" @click="clearFilters">清除筛选</button>
          </div>

          <div v-if="store.hasSucceeded" class="catalog-summary" aria-live="polite">
            <span>显示 <strong>{{ devices.length }}</strong> / {{ counts.total }} 台</span>
            <ul aria-label="本次成功响应的通信状态统计"><li><i class="dot online"></i>在线 {{ counts.online }}</li><li><i class="dot offline"></i>离线 {{ counts.offline }}</li><li><i class="dot unknown"></i>未知 {{ counts.unknown }}</li></ul>
          </div>

          <div v-if="store.readError" class="notice error" role="alert">
            <strong>{{ store.hasSucceeded ? '本次更新失败，以下保留上次成功快照。' : '首次读取未成功，当前没有可用设备结果。' }}</strong>
            <p>{{ store.readError }}</p><small v-if="store.hasSucceeded">快照观察时间：{{ displayTime(store.observedAt) }}（北京时间），没有更新成当前时间。</small>
          </div>
          <div v-if="labelError" class="notice error" role="alert"><strong>通信标签尚未完成</strong><p>{{ labelError }}</p></div>
          <div v-if="!store.hasSucceeded && store.loading" class="empty-state" role="status"><span class="loading-line" aria-hidden="true"></span><h3>正在读取教学设备</h3><p>数量将在成功取得响应后显示。</p></div>
          <div v-else-if="!store.hasSucceeded && !store.readError" class="empty-state"><h3>等待读取</h3><p>点击重新读取，取得本组设备目录。</p></div>
          <div v-else-if="store.hasSucceeded && store.devices.length === 0" class="empty-state"><h3>目录暂无设备</h3><p>接口成功返回了空列表。请与教师核对当前资源集。</p></div>
          <div v-else-if="store.hasSucceeded && devices.length === 0" class="empty-state"><h3>没有匹配的设备</h3><p>试试其他名称或通信状态，或清除筛选查看全部记录。</p><button class="button subtle" @click="clearFilters">清除筛选</button></div>
          <table v-else-if="store.hasSucceeded" class="device-table">
            <caption class="sr-only">当前筛选后的教学设备列表</caption>
            <thead><tr><th scope="col">设备</th><th scope="col">来源空间</th><th scope="col">通信状态</th><th scope="col">通信时间</th></tr></thead>
            <tbody><tr v-for="device in devices" :key="device.id">
              <td class="device-identity"><span class="device-symbol" aria-hidden="true">{{ device.category === 'energy' ? '电' : device.category === 'environment' ? '温' : device.category === 'lighting' ? '灯' : '设' }}</span><div><strong>{{ device.name }}</strong><code>{{ device.id }}</code><small>{{ categoryNames[device.category] }} <span class="simulation-tag">模拟</span></small></div></td>
              <td data-label="来源空间">{{ spaceName(device) }}</td>
              <td data-label="通信状态"><span class="status" :class="labelError ? 'unknown' : stateClass(device.online)"><i v-if="!labelError" class="dot" :class="stateClass(device.online)"></i>{{ checkedOnlineLabel(device.online) }}</span></td>
              <td data-label="通信时间" class="time-cell">{{ displayTime(device.communicationTime) }}<small v-if="device.communicationTime !== null">北京时间 · 固定样本</small></td>
            </tr></tbody>
          </table>
          <p v-if="store.hasSucceeded" class="ledger-footnote">通信未知不等于离线；在线也不能证明设备的全部业务功能正常。</p>
        </template>
      </section>

      <aside class="lesson-notes" aria-labelledby="lesson-title">
        <p class="eyebrow">本次观察</p><h2 id="lesson-title">沿着数据走一遍</h2>
        <ol class="trace-steps"><li><span>1</span><div><strong>发出请求</strong><code>GET /api/campus/devices</code></div></li><li><span>2</span><div><strong>核对响应</strong><code>code → data.items</code></div></li><li><span>3</span><div><strong>比对页面</strong><p>名称、状态、模拟标记、观察时间</p></div></li></ol>
        <div class="lesson-divider"></div><h3>这一版做到哪里？</h3><p>first-chain 使用两台设备，观察在线与未知。独立函数另验三态；完整页面三态留给 full 资源集。</p><p>筛选是教师参考便利功能。监测曲线、权限实验、事件与责任模块尚未在本界面实现。</p>
        <div class="lesson-divider"></div><h3>一次读取，一份证据</h3><p>固定教学时钟不会随刷新推进。保存 Network 响应与页面现象，不能把示意数据写成实时校园观测。</p>
      </aside>
    </div>
  </div>
</template>
