<script setup lang="ts">
import { computed } from 'vue'
import { getAuditPage } from '../api/read-models'
import { useReadPage } from '../composables/useReadPage'
import { useCampusStore } from '../stores/campus'
import { timeText } from '../domain/course'
import SourceBanner from '../components/SourceBanner.vue'
import ReadStatus from '../components/ReadStatus.vue'
const store = useCampusStore()
const allowed = computed(() => store.capabilities?.canAdmin === true && store.capabilities?.canAudit === true)
const { scope, data, skip, limit, scenario, snapshotSkip, snapshotLimit, denied, refresh, filtersChanged, page } = useReadPage(getAuditPage, () => allowed.value)
const state = (value: boolean | null) => value === null ? '未知' : value ? '开' : '关'
</script>
<template>
  <section class="workspace full-page" data-testid="audit-page">
    <header class="page-heading"><div><p class="eyebrow">管理员 · 只读</p><h1>命令审计</h1><p class="muted">固定历史教学样本，用于辨认请求、确认与失败。</p></div><button v-if="allowed" class="button subtle" :disabled="scope.busy.value || denied" @click="refresh">刷新审计</button></header>
    <p v-if="!allowed || denied" class="notice error">只有管理员可读取命令审计；权限变化后请重新登录。</p>
    <template v-else><SourceBanner :time="data?.observedAt" /><p class="notice warning">HISTORICAL_TEACHING_SAMPLE · 教学历史样本，不是本次真实控制结果。所有实体与远端模拟控制均关闭，本页不能发送命令。</p>
      <div class="query-bar"><label>每页<select v-model="limit" :disabled="scope.busy.value" @change="filtersChanged"><option :value="2">2 条</option><option :value="5">5 条</option><option :value="20">20 条</option></select></label><label>教学读取情境<select v-model="scenario" :disabled="scope.busy.value" @change="filtersChanged"><option value="normal">正常样本</option><option value="empty">成功空结果</option><option value="failure">读取失败</option></select></label></div>
      <ReadStatus :busy="scope.busy.value" :error="scope.error.value" :has-data="!!data" />
      <template v-if="data"><p class="muted tiny">成功查询：{{ timeText(data.queriedAt) }} · 当前快照第 {{ Math.floor(snapshotSkip / snapshotLimit) + 1 }} 页 · 共 {{ data.total }} 条。</p><div class="ledger table-scroll"><table class="data-table"><thead><tr><th>记录 / 操作者</th><th>设备 / 原因</th><th>之前 → 请求 → 确认</th><th>结果 / 时刻</th></tr></thead><tbody><tr v-for="item in data.items" :key="item.id"><td><code>{{ item.id }}</code><strong>{{ item.actorName }}</strong><small>{{ item.actorId }}</small></td><td><code>{{ item.deviceId }}</code>{{ item.reason }}</td><td>{{ state(item.before) }} → {{ state(item.requested) }} → {{ state(item.confirmed) }}</td><td>{{ item.outcome }}<small>{{ timeText(item.createdAt) }}</small><small v-if="item.error">{{ item.error }}</small></td></tr></tbody></table><p v-if="!data.items.length" class="empty-state">查询已成功，当前页没有审计样本。</p></div><p v-for="(issue, i) in data.issues" :key="i" class="notice warning">{{ issue.scope }} · {{ issue.message }}</p></template>
      <div class="pagination"><button class="button subtle" :disabled="scope.busy.value || skip === 0" @click="page(-1)">上一页</button><span>查询第 {{ Math.floor(skip / limit) + 1 }} 页</span><button class="button subtle" :disabled="scope.busy.value || !data || skip + limit >= data.total || skip + limit > 10000" @click="page(1)">下一页</button></div>
    </template>
  </section>
</template>
