<script lang="ts">
/**
 * 通信状态三态：true 在线、false 离线、null 未知。
 * 非法值不降级为“离线”或“未知”，直接抛错，避免脏数据冒充合法状态。
 */
export type DeviceOnlineState = boolean | null

export function onlineLabel(value: DeviceOnlineState): string {
  if (value === true) return '在线'
  if (value === false) return '离线'
  if (value === null) return '未知'
  throw new TypeError('online 只接受 true / false / null。')
}

export function onlineKey(value: DeviceOnlineState): 'online' | 'offline' | 'unknown' {
  if (value === true) return 'online'
  if (value === false) return 'offline'
  if (value === null) return 'unknown'
  throw new TypeError('online 只接受 true / false / null。')
}
</script>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useCampusStore } from '../stores/campus'
import type { Device } from '../types/campus'

const store = useCampusStore()

// 模板只能访问 <script setup> 的绑定，这里把具名导出转成本地引用再交给模板。
const statusText = onlineLabel
const statusKey = onlineKey

const CATEGORY_TEXT: Record<Device['category'], string> = {
  environment: '环境',
  energy: '能源',
  facility: '设施',
  lighting: '照明',
}

const categoryText = (device: Device) => CATEGORY_TEXT[device.category] ?? device.category
const spaceText = (device: Device) => device.spaceName ?? device.spaceId ?? '未关联空间'
const tagText = (device: Device) =>
  device.tags.length === 0
    ? '无标签'
    : device.tags.map((tag) => (tag.unit ? `${tag.name}（${tag.unit}）` : tag.name)).join('、')

/** 采样时刻只来自后端 data.observedAt，用固定 UTC 文本显示，不掺本机时区。 */
function formatSampleTime(value: number | null): string {
  if (value === null) return '尚未取得采样时刻'
  const iso = new Date(value).toISOString()
  return `${iso.slice(0, 10)} ${iso.slice(11, 19)} UTC`
}

const sampleTime = computed(() => formatSampleTime(store.observedAt))
const readLabel = computed(() => (store.hasSucceeded ? '重新读取' : '开始读取'))
const canRead = computed(() => store.capabilities?.canRead === true)

/** 成功过一次后再次失败：devices / observedAt 只是上次成功快照，本次结果以 readError 为准。 */
const isStale = computed(() => store.hasSucceeded && store.readError !== '')
const sampleLabel = computed(() => (isStale.value ? '上次采样时刻（固定教学时钟）' : '采样时刻（固定教学时钟）'))

function readOnce() {
  if (store.loading) return
  // 只调用已有认证链路上的 store 动作：会话、CSRF、cookie 都由 store 与 HTTP 层负责。
  void store.refreshDevices()
}

onMounted(readOnce)
</script>

<template>
  <section class="workspace full-page" data-testid="first-device-read">
    <header class="page-heading">
      <div>
        <p class="eyebrow">第02站 · 首次 HTTP 读取</p>
        <h1>从后端读取设备</h1>
        <p class="muted">页面通过 store 发一次真实 GET /api/campus/devices，不自己拼密码、token 或伪造成功。</p>
      </div>
      <button type="button" class="button primary" :disabled="store.loading" @click="readOnce">
        {{ readLabel }}
      </button>
    </header>

    <div class="source-banner">
      <div>
        <strong>TEACHING_MOCK</strong>
        <span>教学模拟数据 · 不连接真实 AIRIOT</span>
      </div>
      <p>通信状态严格三态：true 在线、false 离线、null 未知；未知不等于离线。</p>
    </div>

    <p v-if="store.loading" class="notice" role="status">正在读取设备与空间，请稍候…</p>

    <div v-if="store.readError" class="notice error" role="alert">
      <strong>{{ isStale ? '本次重新读取未成功' : '首次读取未成功' }}</strong>
      <p>{{ store.readError }}</p>
      <small v-if="isStale">
        下面是 {{ store.devices.length }} 台旧设备与上次采样时刻 {{ sampleTime }}，属于上一次成功读取的快照，不代表本次刷新结果。
      </small>
      <small v-else>读取失败不等于设备为空，本页不会用 0 台设备冒充成功结果。</small>
    </div>

    <div v-if="!store.hasSucceeded && !store.loading && !store.readError" class="notice" role="status">
      <strong>尚未完成首次读取</strong>
      <p>需要已登录会话且具备读取权限，点击右上角发起请求。</p>
      <small v-if="!store.user">尚未确认登录身份，本次请求可能被服务端按 401 拒绝。</small>
      <small v-else-if="!canRead">当前身份没有读取权限（403），请由教师核对角色。</small>
    </div>

    <div v-if="store.hasSucceeded" class="ledger">
      <div class="ledger-heading">
        <p class="small-label">
          后端返回的设备目录
          <span v-if="isStale" class="state-badge">上次成功读取的旧快照</span>
        </p>
        <p class="small-label">
          {{ sampleLabel }}
          <strong class="numeric">{{ sampleTime }}</strong>
        </p>
      </div>

      <div v-if="store.devices.length === 0" class="notice" role="status">
        <strong>{{ isStale ? '上次成功读取时目录为空' : '目录暂无设备' }}</strong>
        <p>{{ isStale ? '本次刷新未成功，无法确认当前是否仍为空。' : 'HTTP 与业务 code 均成功，但 data.items 为空；这不是读取失败。' }}</p>
      </div>

      <template v-else>
        <div class="catalog-summary">
          <span>
            显示
            <strong class="numeric">{{ store.devices.length }}</strong>
            /
            <strong class="numeric">{{ store.devices.length }}</strong>
            台设备
          </span>
          <ul>
            <li><span class="dot online"></span>在线</li>
            <li><span class="dot offline"></span>离线</li>
            <li><span class="dot unknown"></span>未知</li>
          </ul>
        </div>

        <div class="table-scroll">
          <table class="data-table">
            <caption>本次读取 {{ store.devices.length }} 台教学模拟设备</caption>
            <thead>
              <tr>
                <th scope="col">设备</th>
                <th scope="col">分类</th>
                <th scope="col">位置</th>
                <th scope="col">通信状态</th>
                <th scope="col">标签</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="device in store.devices" :key="device.id">
                <td>
                  <strong>{{ device.name }}</strong>
                  <code>{{ device.id }}</code>
                  <small>模拟设备 · {{ device.simulated ? '不连真实 AIRIOT' : '来源未知' }}</small>
                </td>
                <td>{{ categoryText(device) }}</td>
                <td>{{ spaceText(device) }}</td>
                <td>
                  <span class="status" :class="statusKey(device.online)">
                    <span class="dot" :class="statusKey(device.online)"></span>
                    {{ statusText(device.online) }}
                  </span>
                </td>
                <td>{{ tagText(device) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </div>
  </section>
</template>
