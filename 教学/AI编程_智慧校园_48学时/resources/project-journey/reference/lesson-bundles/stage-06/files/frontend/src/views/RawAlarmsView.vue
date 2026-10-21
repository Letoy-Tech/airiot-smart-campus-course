<script setup lang="ts">
import { getAlarmPage } from '../api/read-models'
import { useReadPage } from '../composables/useReadPage'
import { useCampusStore } from '../stores/campus'
import { timeText } from '../domain/course'
import { historyHash } from '../domain/read-models'
import SourceBanner from '../components/SourceBanner.vue'
import ReadStatus from '../components/ReadStatus.vue'
const store = useCampusStore()
const { scope, data, skip, limit, scenario, snapshotSkip, snapshotLimit, denied, refresh, filtersChanged, page } = useReadPage(getAlarmPage, () => store.capabilities?.canRead === true)
</script>
<template>
  <section class="workspace full-page" data-testid="raw-alarms-page">
    <header class="page-heading"><div><p class="eyebrow">来源记录 · 只读</p><h1>原始报警</h1><p class="muted">本页是固定教学模拟样本。每次完成后 30 秒刷新，离页停止。</p></div><button class="button subtle" :disabled="scope.busy.value || denied" @click="refresh">刷新报警</button></header>
    <SourceBanner :time="data?.observedAt" /><p class="notice">读取报警不会创建或关闭本地演练事件，也不改变上游状态。这里没有确认、恢复或控制按钮。</p>
    <div class="query-bar"><label>每页<select v-model="limit" :disabled="scope.busy.value" @change="filtersChanged"><option :value="2">2 条</option><option :value="5">5 条</option><option :value="20">20 条</option></select></label><label>教学读取情境<select v-model="scenario" :disabled="scope.busy.value" @change="filtersChanged" data-testid="raw-scenario"><option value="normal">正常样本</option><option value="empty">成功空结果</option><option value="failure">读取失败</option></select></label></div>
    <ReadStatus :busy="scope.busy.value" :error="scope.error.value" :has-data="!!data" /><p v-if="denied" class="notice error">读取权限已变化，数据已清除。请重新登录。</p>
    <template v-if="data"><p class="muted tiny">成功查询：{{ timeText(data.queriedAt) }} · 当前快照第 {{ Math.floor(snapshotSkip / snapshotLimit) + 1 }} 页 · 共 {{ data.total }} 条。查询失败保留的是此快照。</p><div class="ledger table-scroll"><table class="data-table"><thead><tr><th>来源报警 / 设备</th><th>状态 / 级别（原文）</th><th>发生 / 恢复</th><th>记录 / 点位</th></tr></thead><tbody><tr v-for="alarm in data.items" :key="alarm.id"><td><strong>{{ alarm.deviceName ?? '设备未知' }}</strong><code>{{ alarm.id }}</code><small>{{ alarm.deviceId ?? '未知' }} · TEACHING_MOCK · 模拟</small></td><td>{{ alarm.status }}<small>{{ alarm.level }}</small></td><td>{{ timeText(alarm.occurredAt) }}<small>恢复：{{ timeText(alarm.recoveredAt) }}</small></td><td>{{ alarm.message }}<small>{{ alarm.tagId ?? '采样点未知' }}</small><a v-if="alarm.deviceId && alarm.tagId" :href="historyHash(alarm.deviceId, alarm.tagId)">查看点位历史</a></td></tr></tbody></table><p v-if="!data.items.length" class="empty-state">查询已成功，当前页没有原始报警。</p></div><p v-for="(issue, i) in data.issues" :key="i" class="notice warning">{{ issue.scope }} · {{ issue.message }}</p></template>
    <div class="pagination"><button class="button subtle" :disabled="scope.busy.value || denied || skip === 0" @click="page(-1)">上一页</button><span>查询第 {{ Math.floor(skip / limit) + 1 }} 页</span><button class="button subtle" :disabled="scope.busy.value || denied || !data || skip + limit >= data.total || skip + limit > 10000" @click="page(1)">下一页</button></div>
  </section>
</template>
