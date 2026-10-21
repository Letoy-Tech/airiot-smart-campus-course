<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ReadStatus from '../components/ReadStatus.vue'
import { getIntegration } from '../api/full'
import { ApiError } from '../api/http'
import { useRequestScope } from '../composables/useRequestScope'
import { strictCapability } from '../domain/course'
import { useCampusStore } from '../stores/campus'
import type { IntegrationStatus } from '../types/full'

const store = useCampusStore()
/** 接入状态接口仅 ADMIN 可读；能力只认服务端布尔 true。 */
const canAdmin = computed(() => store.user !== null && strictCapability(store.capabilities?.canAdmin))

const status = ref<IntegrationStatus | null>(null)
const hasData = ref(false)
const written = ref('')

const scope = useRequestScope()
const { busy, error } = scope

/** 只有服务端同时确认为已配置且已连通，页面才允许写“已连通”。 */
const connectedAndConfigured = computed(
  () => status.value?.configured === true && status.value?.connected === true,
)
const connectionText = computed(() => {
  if (!status.value) return '未读取'
  return connectedAndConfigured.value ? '服务端报告已配置且已连通' : '未接通（配置与连通分开判定）'
})
const controlText = computed(() => {
  if (!status.value) return '未读取'
  return status.value.controlEnabled === false
    ? 'controlEnabled=false（本页不提供控制入口）'
    : `服务端返回 controlEnabled=${String(status.value.controlEnabled)}，超出教学契约；本页仍不提供控制入口`
})
const pendingCount = computed(
  () => status.value?.capabilities.filter((item) => item.status !== 'READY').length ?? 0,
)

function failureHint(reason: unknown): string {
  if (!(reason instanceof ApiError)) return ''
  if (reason.status === 403) return '仅 ADMIN 可读取接入状态；服务端会再次核对当前有效身份。'
  if (reason.status === 503) return '服务端未提供接入状态；未配置不等于已接通，页面不补造 configured/connected。'
  if (reason.status === 401) return '登录已失效，请重新登录。'
  return ''
}

async function load() {
  if (!canAdmin.value || busy.value) return
  written.value = ''
  const ok = await scope.run(
    (signal) => getIntegration(signal),
    (data) => {
      status.value = data
      hasData.value = true
    },
    (reason) => {
      written.value = failureHint(reason)
    },
  )
  if (!ok && !written.value) written.value = error.value || '接入状态读取未完成，请核对身份与教学服务。'
}

watch(
  canAdmin,
  (value) => {
    if (!value) return
    void load()
  },
  { immediate: true },
)
watch(
  () => store.user?.uid ?? '',
  () => {
    status.value = null
    hasData.value = false
    written.value = ''
    if (canAdmin.value) void load()
  },
)
</script>

<template>
  <section class="workspace full-page" data-testid="integration-view">
    <header class="page-heading">
      <div>
        <p class="eyebrow">第10站 · 责任、审计与接入</p>
        <h1>接入状态：配置、连通、能力分开看</h1>
        <p class="muted">
          configured 只说明服务端是否已提供接入配置，connected 才是当前连通结果，
          capabilities 各自给出状态。页面不下发命令、不保存凭据、不通知外部，也不把未配置或 PENDING 说成接通。
        </p>
      </div>
      <button
        type="button"
        class="button primary"
        :disabled="busy || !canAdmin"
        data-testid="integration-refresh"
        @click="load"
      >
        {{ busy ? '正在读取…' : status ? '重新读取' : '开始读取' }}
      </button>
    </header>

    <div v-if="!store.user" class="notice" role="status">
      <strong>需要已确认的身份</strong>
      <p>接入状态仅 ADMIN 可读；请先用顶部登录。本页不会用默认值冒充服务端结果。</p>
    </div>
    <div v-else-if="!canAdmin" class="notice warning" role="status">
      <strong>当前身份不能读取接入状态</strong>
      <p>接口按 ADMIN 判定；本页不发起请求，也不展示猜测的配置或连通状态。</p>
    </div>

    <div class="notice" role="status">
      <strong>只读，且没有写入入口</strong>
      <p>
        本页不提供凭据输入、保存配置、设备控制、远端操作或外部通知按钮；所有字段都直接取自
        GET /api/campus/integrations/airiot/status 的返回。
      </p>
    </div>

    <ReadStatus :busy="busy" :error="error" :has-data="hasData" />
    <div v-if="written" class="notice error" role="alert">
      <strong>本次读取未完成</strong>
      <p>{{ written }}</p>
    </div>
    <div v-if="canAdmin && !status && !busy && !error" class="notice" role="status">
      <strong>尚未读取接入状态</strong>
      <p>点右上角读取；接口无返回时页面保持“未读取”，不显示 configured=false 之类的猜测值。</p>
    </div>

    <template v-if="status">
      <section class="panel">
        <div class="section-heading">
          <h2>真实返回的三个判定</h2>
          <span>接口不返回观测时刻，本页不补造时间</span>
        </div>
        <dl class="detail-grid">
          <div>
            <dt>配置 configured</dt>
            <dd>
              <code>{{ String(status.configured) }}</code>
              <template v-if="status.configured">
                已提供接入配置；这只说明配置存在，不代表已经连通。
              </template>
              <template v-else>未提供接入配置；不能据此认为已接通。</template>
            </dd>
          </div>
          <div>
            <dt>连通 connected</dt>
            <dd>
              <code>{{ String(status.connected) }}</code>
              <template v-if="status.connected">服务端报告当前已连通。</template>
              <template v-else>服务端报告当前未连通；不把配置当成连通。</template>
            </dd>
          </div>
          <div>
            <dt>控制 controlEnabled</dt>
            <dd>{{ controlText }}</dd>
          </div>
          <div>
            <dt>结论</dt>
            <dd>{{ connectionText }}</dd>
          </div>
          <div>
            <dt>服务端说明</dt>
            <dd><code>{{ status.message }}</code></dd>
          </div>
          <div>
            <dt>能力完成度</dt>
            <dd>{{ status.capabilities.length }} 项 · 非 READY {{ pendingCount }} 项</dd>
          </div>
        </dl>
      </section>

      <section class="panel">
        <div class="section-heading">
          <h2>能力清单</h2>
          <span>状态原样展示；PENDING 或未知都不算接通</span>
        </div>
        <p v-if="status.capabilities.length === 0" class="tiny muted">
          服务端未返回能力项；这不表示能力已就绪。
        </p>
        <div v-else class="table-scroll">
          <table class="data-table integration-table">
            <caption>
              来自 GET /api/campus/integrations/airiot/status 的 capabilities；name、status、detail 均为原文。
            </caption>
            <thead>
              <tr>
                <th scope="col">能力</th>
                <th scope="col">状态（原文）</th>
                <th scope="col">说明</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in status.capabilities" :key="item.name">
                <td><strong>{{ item.name }}</strong></td>
                <td>
                  <code>{{ item.status }}</code>
                  <small>{{ item.status === 'READY' ? '服务端报告就绪' : '未就绪，不能视为接通' }}</small>
                </td>
                <td><span class="detail-text">{{ item.detail }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="ledger-footnote">
          本页只读：没有保存配置、输入凭据、下发命令、控制设备或发送外部通知的入口；
          未配置或能力 PENDING 时，页面不会写成“已接入成功”。
        </p>
      </section>
    </template>
  </section>
</template>

<style scoped>
.integration-table td:first-child {
  min-width: 170px;
}
.detail-text {
  display: block;
  font-size: 0.8rem;
  line-height: 1.7;
  overflow-wrap: anywhere;
}
</style>
