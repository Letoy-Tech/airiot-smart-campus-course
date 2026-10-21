<script setup lang="ts">
import { computed, ref } from 'vue'
import { getOverview } from '../api/full'
import { ApiError } from '../api/http'
import { useCompletionPolling, useRequestScope } from '../composables/useRequestScope'
import type { Overview } from '../types/full'
import { qualityNames, timeText } from '../domain/course'
import { historyHash } from '../domain/read-models'
import CompareHistory from '../components/CompareHistory.vue'
import SourceBanner from '../components/SourceBanner.vue'
import ReadStatus from '../components/ReadStatus.vue'
const scope = useRequestScope(), data = ref<Overview | null>(null), tagId = ref('power')
const unit = computed(() => tagId.value === 'power' ? 'kW' : 'V')
const devices = computed(() => data.value?.devices.filter(d => d.category === 'energy') ?? [])
const point = (deviceId: string) => data.value?.points.find(p => p.deviceId === deviceId && p.tagId === tagId.value)
const refresh = () => scope.run(getOverview, value => { data.value = value }, error => {
  if (error instanceof ApiError && error.status === 403) data.value = null
})
const poller = useCompletionPolling(refresh, () => scope.busy.value)
</script>
<template>
  <section class="workspace full-page" data-testid="energy-page">
    <header class="page-heading"><div><p class="eyebrow">能源点位</p><h1>能源监测</h1><p class="muted">每次完成后 15 秒刷新最新值；历史比较由你选择后查询。</p></div><button class="button subtle" :disabled="scope.busy.value" @click="poller.refresh">刷新最新值</button></header>
    <SourceBanner :time="data?.observedAt" />
    <p class="notice">kW 是功率，V 是电压。这里不计算电量 kWh、费用或节能率。</p>
    <div class="query-bar"><label>能源指标<select v-model="tagId" data-testid="energy-metric"><option value="power">功率 · kW</option><option value="voltage">电压 · V</option></select></label></div>
    <ReadStatus :busy="scope.busy.value" :error="scope.error.value" :has-data="!!data" />
    <template v-if="data">
      <div class="space-cards">
        <section v-for="space in data.spaces" :key="space.id" class="panel" :data-testid="`energy-${space.id}`"><h2>{{ space.name }}</h2>
          <article v-for="device in devices.filter(d => d.spaceId === space.id)" :key="device.id"><h3>{{ device.name }}</h3><p class="energy-value">{{ point(device.id)?.value ?? '—' }} <small>{{ unit }}</small></p><p><span class="state-badge" :class="point(device.id)?.quality === 'fresh' ? 'good' : 'warning'">{{ qualityNames[point(device.id)?.quality ?? 'missing'] }}</span></p><p class="muted tiny">采样：{{ timeText(point(device.id)?.time) }}</p><a :href="historyHash(device.id, tagId)">查看此点历史</a></article>
          <p v-if="!devices.some(d => d.spaceId === space.id)" class="muted tiny">此空间没有能源设备。</p>
        </section>
      </div>
      <p v-for="(issue, i) in data.issues" :key="i" class="notice warning">{{ issue.scope }} · {{ issue.message }}</p>
      <CompareHistory :devices="devices" :tag-id="tagId" :unit="unit" :observed-at="data.observedAt" title="四空间能源历史比较" />
    </template>
  </section>
</template>
