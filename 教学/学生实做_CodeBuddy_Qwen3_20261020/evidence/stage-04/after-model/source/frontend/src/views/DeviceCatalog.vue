<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import ReadStatus from '../components/ReadStatus.vue'
import SourceBanner from '../components/SourceBanner.vue'
import { useCompletionPolling } from '../composables/useRequestScope'
import { categoryNames, filterDevices, timeText, type DeviceFilter } from '../domain/course'
import { catalogHash, readCatalogFilter } from '../domain/read-models'
import { useCampusStore } from '../stores/campus'
import type { Device } from '../types/campus'

const store = useCampusStore()

/** 详情只从 URL 的 deviceId 恢复，不依赖列表顺序或数组下标。 */
function deviceIdFromHash(hash: string): string {
  return new URLSearchParams(hash.split('?')[1] ?? '').get('deviceId') ?? ''
}

const filter = reactive<DeviceFilter>(readCatalogFilter(location.hash))
const selectedId = ref(deviceIdFromHash(location.hash))
const view = ref<'table' | 'cards'>('table')

const filtered = computed(() => filterDevices(store.devices, filter))
const total = computed(() => store.devices.length)
const hasFilter = computed(
  () =>
    filter.keyword.trim() !== '' ||
    filter.spaceId !== '' ||
    filter.category !== '' ||
    filter.online !== 'all',
)
const isStale = computed(() => store.hasSucceeded && store.readError !== '')
const hasSucceeded = computed(() => store.hasSucceeded)

/** 统计跟随筛选：三态分别计数，未知不与离线合并。 */
const stateCounts = computed(() => ({
  online: filtered.value.filter((device) => device.online === true).length,
  offline: filtered.value.filter((device) => device.online === false).length,
  unknown: filtered.value.filter((device) => device.online === null).length,
}))

/** 空间下拉优先用服务端空间目录，缺失时用设备自带空间补足，不伪造空间。 */
const spaceOptions = computed(() => {
  const seen = new Map<string, string>()
  for (const space of store.spaces) seen.set(space.id, space.name)
  for (const device of store.devices) {
    if (device.spaceId) seen.set(device.spaceId, device.spaceName ?? device.spaceId)
  }
  return [...seen].map(([id, name]) => ({ id, name }))
})

const categoryOptions = computed(() =>
  Object.entries(categoryNames).map(([id, name]) => ({ id, name })),
)

const selectedDevice = computed<Device | null>(
  () => store.devices.find((device) => device.id === selectedId.value) ?? null,
)

function onlineText(value: boolean | null): string {
  if (value === true) return '在线'
  if (value === false) return '离线'
  return '未知'
}

function onlineKey(value: boolean | null): 'online' | 'offline' | 'unknown' {
  if (value === true) return 'online'
  if (value === false) return 'offline'
  return 'unknown'
}

const categoryText = (device: Device) => categoryNames[device.category] ?? device.category
const spaceText = (device: Device) => device.spaceName ?? device.spaceId ?? '未关联空间'
const tagText = (device: Device) =>
  device.tags.length === 0
    ? '无标签'
    : device.tags.map((tag) => (tag.unit ? `${tag.name}（${tag.unit}）` : tag.name)).join('、')

/** 筛选与详情都写回同一份 hash，刷新或复制链接后仍按稳定 ID 复原。 */
function syncHash() {
  const hash = catalogHash({ ...filter, deviceId: selectedId.value || undefined })
  if (location.hash !== hash) history.replaceState(null, '', hash)
}

watch(filter, syncHash)
watch(selectedId, syncHash)

function openDevice(id: string) {
  selectedId.value = id
}

function closeDetail() {
  selectedId.value = ''
}

function clearFilters() {
  filter.keyword = ''
  filter.spaceId = ''
  filter.category = ''
  filter.online = 'all'
  syncHash()
}

function refreshNow() {
  if (store.loading) return
  void store.refreshDevices()
}

// 首次进入即读一次，此后每次完成再等 15 秒；离页或会话变化自动停止，不叠加请求。
useCompletionPolling(() => store.refreshDevices(), () => store.loading)
</script>

<template>
  <section class="workspace full-page" data-testid="device-catalog">
    <header class="page-heading">
      <div>
        <p class="eyebrow">第03站 · 完整设备台账</p>
        <h1>从 16 台设备中找到一台</h1>
        <p class="muted">
          名称或ID、空间、类型、通信三态可叠加筛选；点开设备按稳定 ID 进入详情，刷新与重新读取不改ID。
        </p>
      </div>
      <button type="button" class="button primary" :disabled="store.loading" @click="refreshNow">
        {{ store.loading ? '正在读取…' : hasSucceeded ? '重新读取' : '开始读取' }}
      </button>
    </header>

    <SourceBanner :time="store.observedAt" />

    <ReadStatus :busy="store.loading" :error="store.readError" :has-data="hasSucceeded" />
    <div v-if="isStale" class="notice" role="status">
      <strong>本次刷新未成功，台账保留上次成功快照</strong>
      <p>
        以下 {{ total }} 台设备与采样时刻 {{ timeText(store.observedAt) }} 来自上一次成功读取，不代表本次真实状态。
      </p>
    </div>

    <div v-if="!hasSucceeded && !store.loading && !store.readError" class="notice" role="status">
      <strong>尚未取得设备目录</strong>
      <p>读取需要已登录会话与读取权限；请先确认身份，再点右上角读取。</p>
    </div>

    <div v-if="hasSucceeded" class="ledger">
      <div class="ledger-heading">
        <h2>设备台账</h2>
        <div class="view-switch" role="group" aria-label="台账视图切换">
          <button
            type="button"
            class="button subtle"
            data-testid="view-table"
            :aria-pressed="view === 'table'"
            @click="view = 'table'"
          >
            表格
          </button>
          <button
            type="button"
            class="button subtle"
            data-testid="view-cards"
            :aria-pressed="view === 'cards'"
            @click="view = 'cards'"
          >
            卡片
          </button>
        </div>
      </div>

      <div class="filters">
        <label class="search-field" for="device-keyword">
          <span>名称或ID</span>
          <input
            id="device-keyword"
            v-model="filter.keyword"
            data-testid="device-search"
            type="search"
            autocomplete="off"
            placeholder="输入设备名称或稳定 ID"
          />
        </label>
        <label for="space-filter">
          <span>空间</span>
          <select id="space-filter" v-model="filter.spaceId">
            <option value="">全部空间</option>
            <option v-for="space in spaceOptions" :key="space.id" :value="space.id">
              {{ space.name }}
            </option>
          </select>
        </label>
        <label for="category-filter">
          <span>类型</span>
          <select id="category-filter" v-model="filter.category">
            <option value="">全部类型</option>
            <option v-for="category in categoryOptions" :key="category.id" :value="category.id">
              {{ category.name }}
            </option>
          </select>
        </label>
        <label for="online-filter">
          <span>在线状态</span>
          <select id="online-filter" v-model="filter.online" data-testid="online-filter">
            <option value="all">全部状态</option>
            <option value="online">在线</option>
            <option value="offline">离线</option>
            <option value="unknown">未知</option>
          </select>
        </label>
      </div>
      <div class="clear-device-row">
        <button
          type="button"
          class="button subtle clear-filter"
          data-testid="clear-device-filters"
          :disabled="!hasFilter"
          @click="clearFilters"
        >
          清空筛选
        </button>
      </div>

      <div class="catalog-summary">
        <span>
          显示
          <strong class="numeric">{{ filtered.length }}</strong>
          /
          <strong class="numeric">{{ total }}</strong>
          台设备
        </span>
        <ul>
          <li><span class="dot online"></span>在线 <strong class="numeric">{{ stateCounts.online }}</strong></li>
          <li><span class="dot offline"></span>离线 <strong class="numeric">{{ stateCounts.offline }}</strong></li>
          <li><span class="dot unknown"></span>未知 <strong class="numeric">{{ stateCounts.unknown }}</strong></li>
        </ul>
      </div>

      <div v-if="total === 0" class="empty-state" role="status">
        <h3>目录暂无设备，当前读取已成功</h3>
        <p>HTTP 与业务 code 均成功，但 data.items 为空；这不是读取失败，也不是筛选造成的空结果。</p>
      </div>

      <div v-else-if="filtered.length === 0" class="empty-state" role="status">
        <h3>暂无匹配设备，请调整筛选</h3>
        <p>当前目录共 {{ total }} 台设备，按现有名称/ID、空间、类型与在线状态组合没有命中。</p>
        <button type="button" class="button subtle" @click="clearFilters">清空筛选后重看</button>
      </div>

      <div v-else-if="view === 'table'" class="table-scroll">
        <table class="data-table">
          <caption>
            共 {{ total }} 台教学模拟设备，当前显示 {{ filtered.length }} 台；在线、离线、未知严格三态。
          </caption>
          <thead>
            <tr>
              <th scope="col">设备</th>
              <th scope="col">空间</th>
              <th scope="col">类型</th>
              <th scope="col">在线状态</th>
              <th scope="col">最近通信</th>
              <th scope="col">详情</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="device in filtered" :key="device.id">
              <td>
                <strong>{{ device.name }}</strong>
                <code>{{ device.id }}</code>
                <small>模拟设备 · 不连真实 AIRIOT</small>
              </td>
              <td>{{ spaceText(device) }}</td>
              <td>{{ categoryText(device) }}</td>
              <td>
                <span class="status" :class="onlineKey(device.online)">
                  <span class="dot" :class="onlineKey(device.online)"></span>
                  {{ onlineText(device.online) }}
                </span>
              </td>
              <td class="time-cell">{{ timeText(device.communicationTime) }}</td>
              <td>
                <button type="button" class="button subtle" @click="openDevice(device.id)">
                  查看详情
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else class="device-cards" data-testid="device-cards">
        <article v-for="device in filtered" :key="device.id" class="device-card">
          <header>
            <strong>{{ device.name }}</strong>
            <code>{{ device.id }}</code>
          </header>
          <p class="status" :class="onlineKey(device.online)">
            <span class="dot" :class="onlineKey(device.online)"></span>
            {{ onlineText(device.online) }}
          </p>
          <dl>
            <dt>空间</dt>
            <dd>{{ spaceText(device) }}</dd>
            <dt>类型</dt>
            <dd>{{ categoryText(device) }}</dd>
            <dt>标签</dt>
            <dd>{{ tagText(device) }}</dd>
            <dt>最近通信</dt>
            <dd>{{ timeText(device.communicationTime) }}</dd>
          </dl>
          <button type="button" class="button subtle" @click="openDevice(device.id)">
            查看详情
          </button>
        </article>
      </div>

      <p class="ledger-footnote">
        统计只跟随当前筛选结果；清空筛选恢复全量，不代表重新读取成功。
      </p>
    </div>

    <aside v-if="selectedId" class="panel device-detail" data-testid="device-detail">
      <div class="section-heading">
        <h2>设备详情</h2>
        <button type="button" class="button subtle" @click="closeDetail">关闭详情</button>
      </div>
      <template v-if="selectedDevice">
        <p class="small-label">
          稳定 ID：<code>{{ selectedDevice.id }}</code>
          <span v-if="isStale" class="state-badge">来自上次成功快照</span>
        </p>
        <dl class="detail-grid">
          <dt>名称</dt>
          <dd>{{ selectedDevice.name }}</dd>
          <dt>空间</dt>
          <dd>{{ spaceText(selectedDevice) }}</dd>
          <dt>类型</dt>
          <dd>{{ categoryText(selectedDevice) }}</dd>
          <dt>在线状态</dt>
          <dd>{{ onlineText(selectedDevice.online) }}</dd>
          <dt>最近通信</dt>
          <dd>{{ timeText(selectedDevice.communicationTime) }}</dd>
          <dt>开关状态</dt>
          <dd>
            {{ selectedDevice.switchOn === null ? '未知' : selectedDevice.switchOn ? '开' : '关' }}
          </dd>
          <dt>数据表</dt>
          <dd><code>{{ selectedDevice.tableId }}</code></dd>
          <dt>来源</dt>
          <dd>TEACHING_MOCK · simulated=true</dd>
        </dl>
        <p class="small-label">标签</p>
        <ul class="detail-tags">
          <li v-for="tag in selectedDevice.tags" :key="tag.id">
            <code>{{ tag.id }}</code>
            <span>{{ tag.name }}</span>
            <small>{{ tag.unit || '无单位' }}</small>
          </li>
        </ul>
      </template>
      <div v-else class="notice error" role="alert">
        <strong>设备标识不存在：{{ selectedId }}</strong>
        <p>URL 中的 deviceId 未出现在当前目录，页面不会用第一台设备冒充该标识。</p>
      </div>
    </aside>
  </section>
</template>

<style scoped>
.view-switch {
  display: flex;
  gap: 8px;
}
.device-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 14px;
  padding: 20px 22px;
}
.device-card {
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 16px;
  background: var(--paper);
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.device-card header strong {
  display: block;
  font-weight: 600;
  margin-bottom: 6px;
}
.device-card code {
  display: block;
  color: var(--muted);
  font-size: 0.7rem;
  overflow-wrap: anywhere;
}
.device-card dl {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 6px 12px;
  margin: 0;
  font-size: 0.78rem;
}
.device-card dt {
  color: var(--muted);
  font-size: 0.72rem;
}
.device-card dd {
  margin: 0;
  overflow-wrap: anywhere;
}
.device-detail {
  margin-top: 22px;
}
.detail-tags {
  list-style: none;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.detail-tags li {
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 8px 12px;
  background: var(--soft);
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 0.78rem;
}
.detail-tags small {
  color: var(--muted);
  font-size: 0.7rem;
}
@media (max-width: 740px) {
  .device-cards {
    grid-template-columns: 1fr;
    padding: 16px;
  }
}
</style>
