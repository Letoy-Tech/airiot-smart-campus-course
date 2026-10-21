<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useCampusStore } from '../stores/campus'
import { categoryNames, filterDevices, qualityNames, timeText, type DeviceFilter } from '../domain/course'
import { onlineLabel } from './FirstDeviceRead.vue'
import { ApiError, safeError } from '../api/http'
import { getOverview } from '../api/full'
import { useCompletionPolling, useRequestScope } from '../composables/useRequestScope'
import { catalogHash, historyHash, readCatalogFilter } from '../domain/read-models'
import type { Overview } from '../types/full'
import SourceBanner from '../components/SourceBanner.vue'
import ReadStatus from '../components/ReadStatus.vue'
const store = useCampusStore()
const latestScope = useRequestScope(), latest = ref<Overview | null>(null), layout = ref<'table' | 'cards'>('table')
const selectedId = ref(new URLSearchParams(location.hash.split('?')[1]).get('deviceId') ?? '')
const selected = computed(() => store.devices.find((device) => device.id === selectedId.value))
function hashChanged() {
  if (location.hash.split('?')[0] !== '#devices') return
  Object.assign(filter, readCatalogFilter(location.hash))
  selectedId.value = new URLSearchParams(location.hash.split('?')[1]).get('deviceId') ?? ''
}
function openDevice(id: string) { location.hash = catalogHash({ ...filter, deviceId: id }) }
function closeDevice() {
  selectedId.value = ''
  history.replaceState(null, '', catalogHash(filter))
}
function clearFilters() {
  Object.assign(filter, { keyword: '', online: 'all', spaceId: '', category: '' })
}
window.addEventListener('hashchange', hashChanged)
onBeforeUnmount(() => window.removeEventListener('hashchange', hashChanged))
const filter = reactive<DeviceFilter>(readCatalogFilter(location.hash))
watch(filter, () => history.replaceState(null, '', catalogHash({ ...filter, deviceId: selectedId.value })))
const latestPoint = (tagId: string) => latest.value?.points.find(p => p.deviceId === selectedId.value && p.tagId === tagId)
const result = computed(() => {
  try {
    return { items: filterDevices(store.devices, filter), error: '' }
  } catch (error) {
    return { items: [], error: safeError(error) }
  }
})
const counts = computed(() => ({
  online: store.devices.filter((d) => d.online === true).length,
  offline: store.devices.filter((d) => d.online === false).length,
  unknown: store.devices.filter((d) => d.online === null).length,
}))
async function refresh() {
  await Promise.all([store.refreshDevices(), latestScope.run(getOverview, value => { latest.value = value }, error => {
    if (error instanceof ApiError && error.status === 403) latest.value = null
  })])
}
const poller = useCompletionPolling(refresh, () => store.loading || latestScope.busy.value)
watch(() => store.sessionEpoch, () => { latest.value = null }, { flush: 'sync' })
</script>
<template>
  <section class="workspace full-page" data-testid="device-page">
    <header class="page-heading">
      <div>
        <p class="eyebrow">06 / 校园资源</p>
        <h1>设备台账</h1>
        <p class="muted">从空间找到设备，再沿采样点进入历史。读取完成后 15 秒刷新，离页停止。</p>
      </div>
      <button class="button subtle" :disabled="store.loading || latestScope.busy.value" @click="poller.refresh">
        刷新台账
      </button>
    </header>
    <SourceBanner :time="store.observedAt" /><ReadStatus
      :busy="store.loading"
      :error="store.readError"
      :has-data="store.hasSucceeded"
    />
    <div class="metric-strip" v-if="store.hasSucceeded">
      <div>
        <strong>{{ store.devices.length }}</strong
        ><span>设备总数</span>
      </div>
      <div>
        <strong>{{ store.spaces.length }}</strong
        ><span>空间</span>
      </div>
      <div>
        <strong>{{ counts.online }}</strong
        ><span>在线</span>
      </div>
      <div>
        <strong>{{ counts.offline }}</strong
        ><span>离线</span>
      </div>
      <div>
        <strong>{{ counts.unknown }}</strong
        ><span>未知</span>
      </div>
    </div>
    <section v-if="selectedId" class="panel" data-testid="device-detail">
      <div class="section-heading">
        <h2>设备详情</h2>
        <button class="button subtle" @click="closeDevice">收起详情</button>
      </div>
      <template v-if="selected">
        <h3>{{ selected.name }}</h3><code>{{ selected.id }}</code>
        <dl class="detail-grid">
          <div><dt>资源表</dt><dd>{{ selected.tableId }}</dd></div>
          <div><dt>类型</dt><dd>{{ categoryNames[selected.category] }}</dd></div>
          <div><dt>空间</dt><dd>{{ selected.spaceName ?? '未知' }}<br/><code>{{ selected.spaceId ?? '未知' }}</code></dd></div>
          <div><dt>通信状态</dt><dd>{{ onlineLabel(selected.online) }}</dd></div>
          <div><dt>通信时刻</dt><dd>{{ timeText(selected.communicationTime) }}</dd></div>
          <div><dt>开关观测值（只读）</dt><dd>{{ selected.switchOn === null ? '未知' : selected.switchOn ? '开' : '关' }}</dd></div>
        </dl>
        <h3>采样点最新值</h3>
        <ReadStatus :busy="latestScope.busy.value" :error="latestScope.error.value" :has-data="!!latest" />
        <div class="table-scroll"><table class="data-table"><thead><tr><th>采样点</th><th>数值</th><th>服务端质量</th><th>采样时间</th><th>历史</th></tr></thead><tbody><tr v-for="tag in selected.tags" :key="tag.id"><td>{{ tag.name }}<code>{{ tag.id }}</code></td><td>{{ latestPoint(tag.id)?.value ?? '—' }} {{ tag.unit === '' ? '无量纲' : tag.unit ?? '单位未知' }}</td><td>{{ latestPoint(tag.id) ? qualityNames[latestPoint(tag.id)!.quality] : '尚无点值' }}</td><td>{{ timeText(latestPoint(tag.id)?.time) }}</td><td><a :href="historyHash(selected.id, tag.id)">查看历史</a></td></tr></tbody></table></div>
        <p class="muted tiny">以稳定 deviceId 定位；来源 TEACHING_MOCK，simulated={{ selected.simulated }}。未知字段不补零。</p>
      </template>
      <p v-else-if="store.hasSucceeded" class="notice error" role="alert">设备标识不存在：{{ selectedId }}。请回到台账选择有效设备。</p>
      <p v-else class="muted">正在等待台账读取，尚不能确定设备是否存在。</p>
    </section>
    <div class="ledger">
      <div class="filters wrap">
        <label class="search-field"
          ><span>关键词</span
          ><input
            data-testid="device-search"
            v-model="filter.keyword"
            placeholder="名称或设备 ID" /></label
        ><label
          ><span>空间</span
          ><select v-model="filter.spaceId">
            <option value="">全部空间</option>
            <option v-for="space in store.spaces" :key="space.id" :value="space.id">
              {{ space.name }}
            </option>
          </select></label
        ><label
          ><span>设备类型</span
          ><select v-model="filter.category">
            <option value="">全部类型</option>
            <option v-for="(label, key) in categoryNames" :key="key" :value="key">
              {{ label }}
            </option>
          </select></label
        ><label
          ><span>在线状态</span
          ><select v-model="filter.online" data-testid="online-filter">
            <option value="all">全部状态</option>
            <option value="online">在线</option>
            <option value="offline">离线</option>
            <option value="unknown">未知</option>
          </select></label
        >
      </div>
      <div class="clear-device-row"><div class="action-buttons" aria-label="台账显示方式"><button class="button subtle" :aria-pressed="layout === 'table'" @click="layout = 'table'" data-testid="catalog-table">表格</button><button class="button subtle" :aria-pressed="layout === 'cards'" @click="layout = 'cards'" data-testid="catalog-cards">卡片</button></div><button class="button subtle" data-testid="clear-device-filters" @click="clearFilters">清除全部筛选</button></div>
      <div v-if="result.error" class="notice error" role="alert">{{ result.error }}</div>
      <div v-if="layout === 'table'" class="table-scroll">
        <table class="data-table">
          <caption>
            设备列表 ·
            {{
              result.items.length
            }}
            条匹配记录
          </caption>
          <thead>
            <tr>
              <th>设备 / 标识</th>
              <th>类型与空间</th>
              <th>在线状态</th>
              <th>采样点</th>
              <th>通信时间</th>
              <th>详情</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="device in result.items"
              :key="device.id"
              :data-testid="`device-${device.id}`"
            >
              <td>
                <strong>{{ device.name }}</strong
                ><code>{{ device.id }}</code
                ><small>模拟设备</small>
              </td>
              <td>
                {{ categoryNames[device.category]
                }}<small>{{ device.spaceName ?? '未关联空间' }}</small>
              </td>
              <td>
                <span
                  class="state-badge"
                  :class="
                    device.online === true ? 'good' : device.online === false ? 'warning' : ''
                  "
                  >{{ onlineLabel(device.online) }}</span
                >
              </td>
              <td>{{ device.tags.map((t) => t.name).join('、') || '暂无点位' }}</td>
              <td class="time-cell">{{ timeText(device.communicationTime) }}</td>
              <td><button class="button subtle" :data-testid="`open-${device.id}`" @click="openDevice(device.id)">查看详情</button></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="layout === 'cards'" class="device-cards"><article v-for="device in result.items" :key="device.id" class="panel"><h3>{{ device.name }}</h3><code>{{ device.id }}</code><p>{{ categoryNames[device.category] }} · {{ device.spaceName ?? '未关联空间' }}</p><p>{{ onlineLabel(device.online) }} · 模拟设备</p><p class="muted tiny">通信：{{ timeText(device.communicationTime) }}</p><button class="button subtle" @click="openDevice(device.id)">查看详情</button></article></div>
      <div v-if="store.hasSucceeded && !result.items.length && !result.error" class="empty-state">
        {{ store.devices.length === 0 ? '目录暂无设备，当前读取已成功。' : '暂无匹配设备，请调整筛选。' }}
      </div>
      <p class="ledger-footnote">
        在线、离线、未知是三种不同状态。未知不计入离线；台账不提供设备远端控制。
      </p>
    </div>
  </section>
</template>
