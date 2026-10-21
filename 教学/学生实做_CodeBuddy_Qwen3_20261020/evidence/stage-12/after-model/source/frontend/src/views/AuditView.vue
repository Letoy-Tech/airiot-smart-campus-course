<script setup lang="ts">
import { computed, watch } from 'vue'
import ReadStatus from '../components/ReadStatus.vue'
import SourceBanner from '../components/SourceBanner.vue'
import { getAuditPage } from '../api/read-models'
import { useReadPage } from '../composables/useReadPage'
import { strictCapability, timeText } from '../domain/course'
import { useCampusStore } from '../stores/campus'
import type { AuditPage, CommandAudit } from '../types/read-models'

const store = useCampusStore()
/** 审计接口同时要求管理员身份与审计读取能力；能力只认服务端布尔 true，roles 只用于显示。 */
const canAdmin = computed(() => store.user !== null && strictCapability(store.capabilities?.canAdmin))
const canAudit = computed(() => store.user !== null && strictCapability(store.capabilities?.canAudit))
const allowed = computed(() => canAdmin.value && canAudit.value)

const {
  data,
  limit,
  scenario,
  skip,
  snapshotSkip,
  snapshotLimit,
  denied,
  refresh,
  filtersChanged,
  page: goPage,
  scope,
} = useReadPage<CommandAudit>(getAuditPage, () => allowed.value)
const { busy, error } = scope

const total = computed(() => data.value?.total ?? 0)
/** 页面级样例标识由服务端附加，读取失败时保持上次成功快照的标识。 */
const sampleKind = computed(() => (data.value as AuditPage | null)?.sampleKind ?? '')
/** 快照页码只由最近一次成功查询决定；失败不推进页码。 */
const currentPage = computed(() => Math.floor(snapshotSkip.value / snapshotLimit.value) + 1)
/** 本轮页码是当前查询条件（可能尚未成功），用于说明失败发生在哪一页。 */
const requestedPage = computed(() => Math.floor(skip.value / Math.max(1, limit.value)) + 1)
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / snapshotLimit.value)))
const canPrev = computed(() => snapshotSkip.value > 0 && !busy.value && !denied.value)
const canNext = computed(
  () =>
    data.value !== null &&
    snapshotSkip.value + snapshotLimit.value < data.value.total &&
    !busy.value &&
    !denied.value,
)
const emptyHeading = computed(() => {
  if (!data.value) return ''
  if (data.value.total === 0) return error.value ? '上次成功快照为空' : '查询已成功，当前页没有审计记录'
  return '当前页没有记录'
})
const scenarioNames: Record<string, string> = {
  normal: '正常样本',
  empty: '成功空结果',
  failure: '读取失败',
}

function refreshNow() {
  if (!busy.value && !denied.value && allowed.value) void refresh()
}

function filtersChangedNow() {
  if (denied.value || !allowed.value) return
  // 条件变化时取消旧请求，再从第 1 页读取，避免旧条件的结果覆盖新条件。
  scope.cancel()
  filtersChanged()
}

/** 原始布尔值与 null 都照原样显示，不把“未确认”解释成成功或失败。 */
function boolText(value: boolean | null): string {
  return value === null ? 'null（未知）' : String(value)
}

watch(allowed, (value) => {
  if (value) {
    denied.value = false
    void refresh()
    return
  }
  // 页面存活期间权限被撤销：取消在途请求并清空已缓存数据，旧请求的回填一律作废。
  scope.cancel()
  data.value = null
  error.value = ''
  denied.value = false
})
watch(
  () => store.user?.uid ?? '',
  () => {
    denied.value = false
  },
)
</script>

<template>
  <section class="workspace full-page" data-testid="audit-page">
    <header class="page-heading">
      <div>
        <p class="eyebrow">第10站 · 责任、审计与接入</p>
        <h1>命令审计只读：保留来源与样例标识</h1>
        <p class="muted">
          审计记录来自教学历史样例（HISTORICAL_TEACHING_SAMPLE），source=TEACHING_MOCK、simulated=true，
          不是真实下发过的命令；outcome、reason、before/requested/confirmed 与 error 原样展示，不改写、不映射。
        </p>
      </div>
      <button
        type="button"
        class="button primary"
        :disabled="busy || denied || !allowed"
        data-testid="audit-refresh"
        @click="refreshNow"
      >
        {{ busy ? '正在读取…' : data ? '重新读取' : '开始读取' }}
      </button>
    </header>

    <SourceBanner :time="data?.observedAt" />
    <p class="refresh-note">
      只有管理员（canAdmin 与 canAudit 均为 Boolean true）可读；首次进入立即读取一次，此后每次完成后等 30 秒再读，
      请求未完成不叠加，离页、会话变化或权限撤销即停止。
    </p>

    <ReadStatus :busy="busy" :error="error" :has-data="data !== null" />

    <div v-if="!store.user" class="notice" role="status">
      <strong>需要已确认的身份</strong>
      <p>命令审计只有管理员可读；请先用顶部登录。本页不会用空表冒充成功结果。</p>
    </div>
    <div v-else-if="!canAdmin" class="notice warning" role="status">
      <strong>当前身份不能读取命令审计</strong>
      <p>
        命令审计只有管理员（canAdmin 为 Boolean true）可读；接口按 ADMIN 判定并会再次核对当前有效身份。
        本页不发起请求，也不展示任何审计内容；字符串 "true"、1 等非布尔值不授予权限。
      </p>
    </div>
    <div v-else-if="!canAudit" class="notice warning" role="status">
      <strong>审计读取能力未开启</strong>
      <p>
        命令审计只有管理员且 canAudit 为 Boolean true 才可读；权限在页面存活期间撤销时，本页已取消在途请求、
        清除已缓存记录，旧请求结果不会回填。
      </p>
    </div>
    <div v-if="denied" class="notice error" role="alert">
      <strong>服务端拒绝读取（403）</strong>
      <p>审计内容已清除，请重新登录并核对当前身份的权限。</p>
    </div>

    <div class="notice" role="status">
      <strong>只读记录：本页不能发送命令</strong>
      <p>
        本页不能发送命令，也没有命令下发、设备控制、远端操作或外部通知按钮；远端控制与外部通知保持关闭，
        也不把教学样例说成真实 AIRIOT 成功。历史样例（HISTORICAL_TEACHING_SAMPLE）只用于说明审计字段，不是真实下发记录。
      </p>
    </div>

    <div class="query-bar">
      <label
        >每页<select v-model.number="limit" :disabled="denied || !allowed" data-testid="audit-limit" @change="filtersChangedNow">
          <option :value="5">5 条</option>
          <option :value="10">10 条</option>
          <option :value="20">20 条</option>
          <option :value="50">50 条</option>
        </select></label
      >
      <label
        >教学读取情境<select v-model="scenario" :disabled="denied || !allowed" data-testid="audit-scenario" @change="filtersChangedNow">
          <option value="normal">正常样本</option>
          <option value="empty">成功空结果</option>
          <option value="failure">读取失败</option>
        </select></label
      >
      <p class="query-hint">
        limit 取 5/10/20/50，skip 由分页计算；切换每页条数或情境都从第 1 页重新读取。
        情境只影响教学样例，不代表真实设备命令。
      </p>
    </div>

    <div v-if="allowed && !data && !busy && !error" class="notice" role="status">
      <strong>尚未取得审计记录</strong>
      <p>读取需要已登录且有效的管理员身份；若长时间没有结果，请核对身份后点右上角读取。</p>
    </div>

    <template v-if="data">
      <p class="audit-meta">
        来源 {{ data.source }} · simulated={{ data.simulated }} · {{ sampleKind }} ·
        成功查询：{{ timeText(data.queriedAt) }} · 固定教学采样时刻：{{ timeText(data.observedAt) }}
        · 当前快照第 {{ currentPage }} 页（共 {{ pageCount }} 页）· 共 {{ data.total }} 条 · 本页
        {{ data.items.length }} 条 · limit={{ snapshotLimit }} · skip={{ snapshotSkip }}
        · 情境 {{ scenarioNames[scenario] ?? scenario }}
      </p>
      <p v-if="error" class="muted tiny">
        本轮查询第 {{ requestedPage }} 页失败：{{ error }}。以下仍是上次成功快照（当前快照第 {{ currentPage }} 页，共
        {{ data.total }} 条、本页 {{ data.items.length }} 条），保留旧行、不推进页码，也不是新的空结果。
      </p>

      <div v-if="data.issues.length" class="notice warning" role="status">
        <strong>响应附带 {{ data.issues.length }} 条 issues</strong>
        <ul class="issue-list">
          <li v-for="issue in data.issues" :key="`${issue.code}-${issue.scope}-${issue.message}`">
            <code>{{ issue.code }}</code>
            <span>{{ issue.message }}</span>
            <small>{{ issue.scope }}</small>
          </li>
        </ul>
      </div>

      <section class="panel">
        <div class="section-heading">
          <h2>命令审计记录</h2>
          <span>服务端按 createdAt DESC、id DESC 返回；本页不排序、不合并、不改写结果。</span>
        </div>

        <div v-if="data.items.length === 0" class="empty-state" role="status">
          <h3>{{ emptyHeading }}</h3>
          <p v-if="error">
            本轮查询第 {{ requestedPage }} 页失败，这里显示的是上次成功快照（当前快照第 {{ currentPage }} 页），不是新的空结果。
          </p>
          <p v-else-if="data.total === 0">这是成功空结果；不补造命令记录，也不据此判定接入成功。</p>
          <p v-else>共 {{ data.total }} 条，当前 skip={{ snapshotSkip }}；请返回上一页查看。</p>
        </div>
        <div v-else class="table-scroll">
          <table class="data-table audit-table">
            <caption>
              记录来自 GET /api/campus/command-audit?limit={{ snapshotLimit }}&amp;skip={{ snapshotSkip }}&amp;scenario={{ scenario }}；
              outcome、reason、error 是样例原文，不映射为接入能力。
            </caption>
            <thead>
              <tr>
                <th scope="col">命令记录</th>
                <th scope="col">操作者</th>
                <th scope="col">设备与表</th>
                <th scope="col">请求与确认</th>
                <th scope="col">结果与原因</th>
                <th scope="col">发生时间</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in data.items" :key="item.id">
                <td>
                  <strong>{{ item.id }}</strong>
                  <small>{{ item.source }} · simulated={{ item.simulated }}</small>
                  <code>{{ item.sampleKind }}</code>
                </td>
                <td>
                  <strong>{{ item.actorName }}</strong>
                  <code>{{ item.actorId }}</code>
                </td>
                <td>
                  <code>{{ item.deviceId }}</code>
                  <small>表 {{ item.tableId }}</small>
                </td>
                <td>
                  <span>before：{{ boolText(item.before) }}</span>
                  <span>requested：{{ boolText(item.requested) }}</span>
                  <small>confirmed：{{ boolText(item.confirmed) }}</small>
                </td>
                <td>
                  <strong>{{ item.outcome }}</strong>
                  <span>{{ item.reason }}</span>
                  <small>error：{{ item.error ?? 'null（无）' }}</small>
                </td>
                <td class="time-cell">
                  <span>{{ timeText(item.createdAt) }}</span>
                  <small>服务端记录时间</small>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="pagination">
          <span>
            当前快照第 {{ currentPage }} / {{ pageCount }} 页 · 共 {{ data.total }} 条 · 本页 {{ data.items.length }} 条
            <template v-if="error"> · 本轮查询第 {{ requestedPage }} 页失败</template>
          </span>
          <div class="pagination-actions">
            <button type="button" class="button subtle" :disabled="!canPrev" data-testid="audit-prev" @click="goPage(-1)">
              上一页
            </button>
            <button type="button" class="button subtle" :disabled="!canNext" data-testid="audit-next" @click="goPage(1)">
              下一页
            </button>
          </div>
        </div>

        <p class="ledger-footnote">
          只读：本页不能发送命令，也没有命令下发、确认、控制或通知按钮；历史样例不是真实下发记录，
          读取失败保留上次成功快照，空结果不显示为错误。
        </p>
      </section>
    </template>
  </section>
</template>

<style scoped>
.refresh-note {
  margin: -16px 0 22px;
  color: var(--muted);
  font-size: 0.76rem;
  line-height: 1.7;
}
.query-hint {
  margin: 0;
  color: var(--muted);
  font-size: 0.72rem;
  line-height: 1.7;
}
.audit-meta {
  margin: -6px 0 18px;
  color: var(--muted);
  font-size: 0.75rem;
  line-height: 1.8;
}
.audit-table td:first-child {
  min-width: 190px;
}
.audit-table td span {
  display: block;
  font-size: 0.78rem;
  line-height: 1.7;
  overflow-wrap: anywhere;
}
.pagination-actions {
  display: flex;
  gap: 8px;
}
.issue-list {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
}
.issue-list li {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  align-items: baseline;
  padding: 5px 0;
  border-top: 1px solid var(--line);
  font-size: 0.8rem;
}
.issue-list li:first-child {
  border-top: 0;
}
.issue-list small {
  color: var(--muted);
  font-size: 0.7rem;
}
@media (max-width: 740px) {
  .refresh-note {
    margin-top: -12px;
  }
  .pagination-actions {
    width: 100%;
  }
  .pagination-actions .button {
    flex: 1;
  }
}
</style>
