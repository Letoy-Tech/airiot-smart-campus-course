<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useCampusStore } from '../stores/campus'
import { useRequestScope } from '../composables/useRequestScope'
import { getIntegration, getRawAlarms } from '../api/full'
import type { IntegrationStatus } from '../types/full'
import ReadStatus from '../components/ReadStatus.vue'
const store = useCampusStore(),
  scope = useRequestScope(),
  raw = useRequestScope(),
  data = ref<IntegrationStatus | null>(null),
  rawCount = ref<number | null>(null)
function refresh() {
  if (store.capabilities?.canAdmin === true)
    return scope.run(
      getIntegration,
      (value) => {
        data.value = value
      },
      () => {
        data.value = null
      },
    )
}
onMounted(() => {
  void refresh()
  void raw.run(getRawAlarms, (value) => {
    rawCount.value = value.items.length
  })
})
</script>
<template>
  <section class="workspace full-page" data-testid="integration-page">
    <header class="page-heading">
      <div>
        <p class="eyebrow">选做 / AIRIOT 只读适配</p>
        <h1>外部数据接入</h1>
        <p class="muted">保留适配边界，接入验证由教师单独组织。</p>
      </div>
    </header>
    <div class="notice warning">
      <strong>AIRIOT 配置与真实连通性尚未通过课程验收。</strong>
      <p>
        本工程主线使用
        TEACHING_MOCK。真实平台的空间、设备、点位、历史和原始报警分别验证；接口地址或配置存在不等于已接通。
      </p>
    </div>
    <div class="panel">
      <h2>接入状态</h2>
      <ReadStatus :busy="scope.busy.value" :error="scope.error.value" :has-data="!!data" />
      <dl v-if="data" class="detail-grid">
        <div>
          <dt>配置</dt>
          <dd>{{ data.configured ? '已配置，仍需核验' : '未配置' }}</dd>
        </div>
        <div>
          <dt>连接</dt>
          <dd>{{ data.connected ? '服务返回已连接，需留验收证据' : '未连接' }}</dd>
        </div>
        <div>
          <dt>远端控制</dt>
          <dd>关闭</dd>
        </div>
      </dl>
      <p v-if="store.capabilities?.canAdmin !== true" class="muted">仅管理员可读取配置状态。</p>
      <ul class="checklist" v-if="data">
        <li v-for="item in data.capabilities" :key="item.name">
          {{ item.name }} · {{ item.status }} · {{ item.detail }}
        </li>
      </ul>
      <p class="muted tiny">
        不在浏览器输入或保存 AIRIOT 密钥，不向真实设备下发控制，不发送外部通知。
      </p>
    </div>
    <div class="panel">
      <h2>上游原始报警（只读边界）</h2>
      <ReadStatus :busy="raw.busy.value" :error="raw.error.value" :has-data="rawCount !== null" />
      <p v-if="rawCount !== null">
        教学源当前返回 {{ rawCount }} 条。此列表与本地 DEMO 事件分开，当前没有报警导入或处置写入。
      </p>
    </div>
  </section>
</template>
