<script setup lang="ts">
import { computed, ref } from 'vue'
import { getOverview } from '../api/full'
import type { Overview } from '../types/full'
import { categoryNames, qualityNames, timeText } from '../domain/course'
import { useRequestScope, useCompletionPolling } from '../composables/useRequestScope'
import { ApiError } from '../api/http'
import { catalogHash, qualityMatrix } from '../domain/read-models'
import CompareHistory from '../components/CompareHistory.vue'
import SourceBanner from '../components/SourceBanner.vue'
import ReadStatus from '../components/ReadStatus.vue'
const scope = useRequestScope(),
  data = ref<Overview | null>(null)
const environmentTag = ref('temperature')
const environmentUnit = computed(() => environmentTag.value === 'temperature' ? '°C' : '%')
const environmentDevices = computed(() => data.value?.devices.filter(d => d.category === 'environment') ?? [])
const matrix = computed(() => data.value ? qualityMatrix(data.value.spaces, data.value.devices, data.value.points) : [])
function refresh() {
  return scope.run(
    getOverview,
    (value) => {
      data.value = value
    },
    (error) => {
      if (error instanceof ApiError && error.status === 403) data.value = null
    },
  )
}
const poller = useCompletionPolling(refresh, () => scope.busy.value)
const pointName = (deviceId: string, tagId: string) =>
  data.value?.devices.find((d) => d.id === deviceId)?.tags.find((t) => t.id === tagId)?.name ??
  tagId
</script>
<template>
  <section class="workspace full-page" data-testid="overview-page">
    <header class="page-heading">
      <div>
        <p class="eyebrow">07 / 点值与数据质量</p>
        <h1>校园监测</h1>
        <p class="muted">每次读取完成后 15 秒轮询；离开此页即停止。</p>
      </div>
      <button class="button subtle" :disabled="scope.busy.value" @click="poller.refresh">
        立即刷新
      </button>
    </header>
    <SourceBanner :time="data?.observedAt" /><ReadStatus
      :busy="scope.busy.value"
      :error="scope.error.value"
      :has-data="!!data"
    />
    <template v-if="data"
      ><div class="metric-strip">
        <div>
          <strong
            >{{ data.completeness.actualSpaces }} / {{ data.completeness.expectedSpaces }}</strong
          ><span>空间覆盖</span>
        </div>
        <div>
          <strong
            >{{ data.completeness.actualDevices }} / {{ data.completeness.expectedDevices }}</strong
          ><span>设备覆盖</span>
        </div>
        <div>
          <strong
            >{{ data.completeness.actualPoints }} / {{ data.completeness.expectedPoints }}</strong
          ><span>点位覆盖</span>
        </div>
        <div>
          <strong>{{ data.issues.length }}</strong
          ><span>来源问题</span>
        </div>
      </div>
      <section class="panel"><h2>从统计进入台账</h2><div class="stat-links"><a v-for="space in data.spaces" :key="space.id" :href="catalogHash({ spaceId: space.id })">{{ space.name }} · {{ data.devices.filter(d => d.spaceId === space.id).length }} 台</a><a v-for="(label, category) in categoryNames" :key="category" :href="catalogHash({ category })">{{ label }} · {{ data.devices.filter(d => d.category === category).length }} 台</a></div></section>
      <section class="panel"><h2>空间质量矩阵</h2><p class="muted tiny">只统计服务端返回的点位质量；不按浏览器时间重新判定。</p><div class="table-scroll"><table class="data-table" data-testid="quality-matrix"><thead><tr><th>空间</th><th>设备 / 点位</th><th>新鲜</th><th>陈旧</th><th>缺失</th><th>无效</th></tr></thead><tbody><tr v-for="row in matrix" :key="row.space.id"><td><a :href="catalogHash({ spaceId: row.space.id })">{{ row.space.name }}</a></td><td>{{ row.devices }} / {{ row.points }}</td><td>{{ row.fresh }}</td><td>{{ row.stale }}</td><td>{{ row.missing }}</td><td>{{ row.invalid }}</td></tr></tbody></table></div></section>
      <div class="query-bar"><label>环境趋势<select v-model="environmentTag"><option value="temperature">温度 · °C</option><option value="humidity">湿度 · %</option></select></label></div>
      <CompareHistory :devices="environmentDevices" :tag-id="environmentTag" :unit="environmentUnit" :observed-at="data.observedAt" title="环境历史趋势" />
      <div class="notice" v-if="data.issues.length">
        <strong>来源质量提示</strong>
        <p v-for="(issue, index) in data.issues" :key="index">
          {{ issue.scope }} · {{ issue.code }} · {{ issue.message }}
        </p>
      </div>
      <div class="ledger">
        <div class="table-scroll">
          <table class="data-table">
            <caption>
              服务端返回的点值与质量
            </caption>
            <thead>
              <tr>
                <th>设备 / 采样点</th>
                <th>数值</th>
                <th>质量</th>
                <th>原始采样时刻</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="point in data.points" :key="`${point.deviceId}/${point.tagId}`">
                <td>
                  <strong>{{
                    data.devices.find((d) => d.id === point.deviceId)?.name ?? point.deviceId
                  }}</strong
                  ><small>{{ pointName(point.deviceId, point.tagId) }} · {{ point.tagId }}</small>
                </td>
                <td class="numeric">
                  {{ point.value === null ? '—' : point.value }}
                  <small class="inline">{{ point.unit || '无量纲' }}</small>
                </td>
                <td>
                  <span
                    class="state-badge"
                    :class="point.quality === 'fresh' ? 'good' : 'warning'"
                    >{{ qualityNames[point.quality] }}</span
                  >
                </td>
                <td class="time-cell">{{ timeText(point.time) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="ledger-footnote">
          “—”表示未知，0 是有效数值。V 与 kW 分别是电压与功率，不能据此计算电量、费用或节能率。
        </p>
      </div></template
    >
  </section>
</template>
