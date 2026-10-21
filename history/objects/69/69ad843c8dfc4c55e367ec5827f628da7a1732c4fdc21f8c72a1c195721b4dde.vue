<script setup lang="ts">
import { computed, watch } from 'vue'
import ReadStatus from '../components/ReadStatus.vue'
import SourceBanner from '../components/SourceBanner.vue'
import { getAlarmPage } from '../api/read-models'
import { useReadPage } from '../composables/useReadPage'
import { useCampusStore } from '../stores/campus'
import { timeText } from '../domain/course'
import { historyHash } from '../domain/read-models'
import type { RawAlarm } from '../types/read-models'

const store = useCampusStore()
const readable = computed(() => store.user !== null && store.capabilities?.canRead === true)
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
} = useReadPage<RawAlarm>(getAlarmPage, () => readable.value)
const { busy, error } = scope

const total = computed(() => data.value?.total ?? 0)
/** 快照页码只由最近一次成功查询决定；失败不推进页码。 */
const currentPage = computed(() => Math.floor(snapshotSkip.value / snapshotLimit.value) + 1)
/** 本轮页码是当前查询条件（可能尚未成功），用于说明失败发生在哪一页。 */
const requestedPage = computed(() => Math.floor(skip.value / Math.max(1, limit.value)) + 1)
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / snapshotLimit.value)))
const canPrev = computed(() => snapshotSkip.value > 0 && !busy.value && !denied.value)
const canNext = computed(
  () => data.value !== null && snapshotSkip.value + snapshotLimit.value < data.value.total && !busy.value && !denied.value,
)
const emptyHeading = computed(() => {
  if (!data.value) return ''
  if (data.value.total === 0) return error.value ? '上次成功快照为空' : '查询已成功，当前页没有原始报警'
  return '当前页没有记录'
})

function refreshNow() {
  if (!busy.value && !denied.value) void refresh()
}

function filtersChangedNow() {
  if (denied.value) return
  // 条件变化时取消旧请求，再从第 1 页读取，避免旧条件的结果覆盖新条件。
  scope.cancel()
  filtersChanged()
}

watch(readable, (value) => {
  if (!value) return
  // 权限恢复后重新读取；此前的 403 标记不再拦截请求。
  denied.value = false
  void refresh()
})
</script>

<template>
  <section class="workspace full-page" data-testid="raw-alarms-page">
    <header class="page-heading">
      <div>
        <p class="eyebrow">第06站 · 原始报警</p>
        <h1>保留上游原文，只读分页</h1>
        <p class="muted">
          原始报警与本地演练事件分开；status/level 按原文展示，不映射、不改写，也不改变上游状态。
        </p>
      </div>
      <button type="button" class="button primary" :disabled="busy || denied || !readable" data-testid="raw-refresh" @click="refreshNow">
        {{ busy ? '正在读取…' : data ? '重新读取' : '开始读取' }}
      </button>
    </header>

    <SourceBanner :time="data?.observedAt" />
    <p class="refresh-note">
      首次进入立即读取一次，此后每次完成后等 30 秒再读；请求未完成不叠加，离页或会话变化即停止。
    </p>

    <ReadStatus :busy="busy" :error="error" :has-data="data !== null" />
    <div v-if="denied" class="notice error" role="alert">
      <strong>读取权限已变化</strong>
      <p>报警数据已清除，请重新登录核对当前身份的读取权限。</p>
    </div>
    <div v-if="!readable" class="notice warning" role="status">
      <strong>当前身份没有读取原始报警的权限</strong>
      <p>请先完成登录并确认身份具备校园读取权限。</p>
    </div>

    <div class="notice" role="status">
      <strong>只读来源记录</strong>
      <p>
        读取报警不会创建或关闭本地演练事件，也不改变上游状态。本页没有确认、恢复或控制按钮；
        status、level、occurredAt、recoveredAt 保留服务端原文与空值，不替换成本地演练状态。
      </p>
    </div>

    <div class="query-bar">
      <label
        >每页<select v-model.number="limit" :disabled="denied" data-testid="raw-limit" @change="filtersChangedNow">
          <option :value="2">2 条</option>
          <option :value="5">5 条</option>
          <option :value="10">10 条</option>
          <option :value="20">20 条</option>
        </select></label
      >
      <label
        >教学读取情境<select v-model="scenario" :disabled="denied" data-testid="raw-scenario" @change="filtersChangedNow">
          <option value="normal">正常样本</option>
          <option value="empty">成功空结果</option>
          <option value="failure">读取失败</option>
        </select></label
      >
      <p class="query-hint">
        limit 取 2/5/10/20，skip 由分页计算；切换每页条数或情境都从第 1 页重新读取。
      </p>
    </div>

    <div v-if="!readable" class="empty-state" role="status">
      <h3>等待读取权限</h3>
      <p>权限恢复后页面会重新读取，不会用空列表冒充成功结果。</p>
    </div>
    <div v-else-if="!data && !busy && !error" class="notice" role="status">
      <strong>尚未取得原始报警</strong>
      <p>读取需要已登录会话与读取权限；若长时间没有结果，请核对身份后点右上角读取。</p>
    </div>

    <template v-if="data">
      <p class="alarm-meta">
        成功查询：{{ timeText(data.queriedAt) }} · 固定教学采样时刻：{{ timeText(data.observedAt) }}
        · 当前快照第 {{ currentPage }} 页（共 {{ pageCount }} 页）· 共 {{ data.total }} 条 · 本页
        {{ data.items.length }} 条 · limit={{ snapshotLimit }} · skip={{ snapshotSkip }}
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
          <h2>原始报警记录</h2>
          <span>按服务端 occurredAt DESC、id DESC 返回；本页不排序、不合并、不改写状态。</span>
        </div>

        <div v-if="data.items.length === 0" class="empty-state" role="status">
          <h3>{{ emptyHeading }}</h3>
          <p v-if="error">
            本轮查询第 {{ requestedPage }} 页失败，这里显示的是上次成功快照（当前快照第 {{ currentPage }} 页），不是新的空结果。
          </p>
          <p v-else-if="data.total === 0">这是成功空结果；不创建本地演练事件，也不补造报警记录。</p>
          <p v-else>共 {{ data.total }} 条，当前 skip={{ snapshotSkip }}；请返回上一页查看。</p>
        </div>
        <div v-else class="table-scroll">
          <table class="data-table raw-alarm-table">
            <caption>
              记录来自 GET /api/campus/alarms；status 与 level 是上游原文，未知值也原样显示。
            </caption>
            <thead>
              <tr>
                <th scope="col">报警记录</th>
                <th scope="col">设备与点位</th>
                <th scope="col">状态 / 等级（原文）</th>
                <th scope="col">发生 / 恢复</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="alarm in data.items" :key="alarm.id">
                <td class="alarm-record">
                  <strong>{{ alarm.message }}</strong>
                  <code>{{ alarm.id }}</code>
                  <small>{{ alarm.source }} · simulated={{ alarm.simulated }}</small>
                </td>
                <td>
                  <strong>{{ alarm.deviceName ?? '设备未知' }}</strong>
                  <code>{{ alarm.deviceId ?? '未知（null）' }}</code>
                  <small>点位 {{ alarm.tagId ?? '采样点未知' }} · 表 {{ alarm.tableId ?? '表未知' }}</small>
                  <a
                    v-if="alarm.deviceId && alarm.tagId"
                    class="button subtle"
                    :href="historyHash(alarm.deviceId, alarm.tagId)"
                  >
                    查看点位历史
                  </a>
                  <small v-else>缺少设备或点位，不能钻取历史</small>
                </td>
                <td>
                  <strong class="raw-value">{{ alarm.status }}</strong>
                  <code class="raw-value">{{ alarm.level }}</code>
                  <small>原文保留，不映射本地状态</small>
                </td>
                <td class="time-cell">
                  <span>发生：{{ alarm.occurredAt === null ? '未知（null）' : timeText(alarm.occurredAt) }}</span>
                  <small>恢复：{{ alarm.recoveredAt === null ? '未知（null）' : timeText(alarm.recoveredAt) }}</small>
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
            <button type="button" class="button subtle" :disabled="!canPrev" data-testid="raw-prev" @click="goPage(-1)">
              上一页
            </button>
            <button type="button" class="button subtle" :disabled="!canNext" data-testid="raw-next" @click="goPage(1)">
              下一页
            </button>
          </div>
        </div>

        <p class="ledger-footnote">
          只读：没有确认、恢复、关闭或控制上游报警的按钮；读取失败保留上次成功快照，空结果不显示为错误。
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
.alarm-meta {
  margin: -6px 0 18px;
  color: var(--muted);
  font-size: 0.75rem;
  line-height: 1.8;
}
.raw-alarm-table td:first-child {
  min-width: 230px;
}
.alarm-record strong {
  line-height: 1.7;
}
.raw-value {
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 0.8rem;
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
