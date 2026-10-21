<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { useCampusStore } from '../stores/campus'
import { useRequestScope } from '../composables/useRequestScope'
import {
  getCases,
  getCase,
  getHandlers,
  getDemoStatus,
  triggerDemo,
  actOnCase,
  type CaseAction,
} from '../api/full'
import { ApiError, safeError } from '../api/http'
import type { CaseList, AlarmDetail, Handler, DemoStatus } from '../types/full'
import {
  caseQuery,
  changeCaseState,
  validCaseState,
  stateNames,
  sourceStateNames,
  actionNames,
  closeBlockers,
  timeText,
} from '../domain/course'
import SourceBanner from '../components/SourceBanner.vue'
import ReadStatus from '../components/ReadStatus.vue'
const store = useCampusStore(),
  listScope = useRequestScope(),
  detailScope = useRequestScope(),
  support = useRequestScope(),
  write = useRequestScope()
const state = ref(validCaseState(new URLSearchParams(location.hash.split('?')[1]).get('state'))),
  skip = ref(0),
  limit = ref(10),
  mine = ref(false)
const list = ref<CaseList | null>(null),
  detail = ref<AlarmDetail | null>(null),
  handlers = ref<Handler[]>([]),
  demo = ref<DemoStatus | null>(null)
const selectedId = ref(''),
  note = ref(''),
  assigneeUid = ref(''),
  disposition = ref(''),
  scenario = ref(''),
  notice = ref(''),
  filterError = ref('')
const conflict = ref(false),
  latestReady = ref(false),
  readDenied = ref(false)
function clearDeniedResources() {
  readDenied.value = true
  listScope.cancel()
  detailScope.cancel()
  support.cancel()
  write.cancel()
  list.value = null
  detail.value = null
  handlers.value = []
  demo.value = null
  selectedId.value = ''
  note.value = ''
  disposition.value = ''
  assigneeUid.value = ''
  conflict.value = false
  latestReady.value = false
  write.error.value = ''
  notice.value = ''
}
const canHandle = computed(
  () =>
    !readDenied.value && store.capabilities?.canHandleAlarms === true &&
    (store.capabilities?.canAdmin === true || detail.value?.assigneeUid === store.user?.uid),
)
const isClosed = computed(() => detail.value?.state === 'CLOSED')
const blocked = computed(() => (detail.value ? closeBlockers(detail.value) : []))
const operationBlocked = computed(
  () =>
    write.busy.value || detailScope.busy.value || conflict.value || !detail.value || isClosed.value,
)
function refresh() {
  if (readDenied.value) return Promise.resolve(false)
  return listScope.run(
    (signal) =>
      getCases(
        caseQuery(state.value, skip.value, limit.value, mine.value ? store.user!.uid : ''),
        signal,
      ),
    (value) => {
      list.value = value
    },
    (error) => {
      if (error instanceof ApiError && error.status === 403) clearDeniedResources()
    },
  )
}
function readDetail() {
  const id = selectedId.value
  if (!id || readDenied.value) return Promise.resolve(false)
  return detailScope.run(
    (signal) => getCase(id, signal),
    (value) => {
      if (selectedId.value !== id) return
      detail.value = value
      if (conflict.value) latestReady.value = true
    },
    (error) => {
      if (error instanceof ApiError && error.status === 403) clearDeniedResources()
    },
  )
}
function selectCase(id: string) {
  if (write.busy.value) return
  detailScope.cancel()
  selectedId.value = id
  detail.value = null
  note.value = ''
  disposition.value = ''
  assigneeUid.value = ''
  conflict.value = false
  latestReady.value = false
  notice.value = ''
  write.error.value = ''
  void readDetail()
}
function updateState(value: string) {
  try {
    const next = changeCaseState(value)
    state.value = next.state
    skip.value = next.skip
    filterError.value = ''
    const query = state.value ? `?state=${state.value}` : ''
    history.replaceState(null, '', `#cases${query}`)
    void refresh()
  } catch (error) {
    filterError.value = safeError(error)
  }
}
function hashChanged() {
  if (location.hash.split('?')[0] === '#cases')
    updateState(validCaseState(new URLSearchParams(location.hash.split('?')[1]).get('state')))
}
function otherFilter() {
  skip.value = 0
  void refresh()
}
function page(delta: number) {
  skip.value = Math.max(0, skip.value + delta * limit.value)
  void refresh()
}
async function trigger() {
  if (readDenied.value || !scenario.value || write.busy.value || store.capabilities?.canRunDemoScenarios !== true)
    return
  // 新建操作接管详情；旧事件的迟到成功、403 和错误都不得影响新事件。
  detailScope.cancel()
  detailScope.error.value = ''
  notice.value = ''
  await write.run(
    (signal) => triggerDemo(scenario.value, store.csrf, signal),
    (value) => {
      detailScope.cancel()
      detailScope.error.value = ''
      selectedId.value = value.id
      detail.value = value
      conflict.value = false
      latestReady.value = false
      note.value = ''
      disposition.value = ''
      assigneeUid.value = ''
      notice.value = '已创建本地模拟事件。'
      skip.value = 0
      void refresh()
    },
  )
}
async function act(action: CaseAction) {
  if (operationBlocked.value || !detail.value) return
  if (
    (action === 'assign' && store.capabilities?.canAssignAlarms !== true) ||
    (action === 'recover' && store.capabilities?.canRunDemoScenarios !== true) ||
    (!['assign', 'recover'].includes(action) && !canHandle.value)
  )
    return
  const current = detail.value,
    body: Record<string, unknown> = { expectedVersion: current.version }
  if (action === 'assign') {
    if (!assigneeUid.value || !note.value.trim()) return
    body.assigneeUid = assigneeUid.value
    body.note = note.value.trim()
  }
  if (action === 'start' || action === 'notes') {
    if (!note.value.trim()) return
    body.note = note.value.trim()
  }
  if (action === 'close') {
    if (!disposition.value.trim() || blocked.value.length) return
    body.disposition = disposition.value.trim()
  }
  detailScope.cancel()
  notice.value = ''
  await write.run(
    (signal) => actOnCase(current.id, action, body, store.csrf, signal),
    (value) => {
      detail.value = value
      notice.value = '服务端已确认操作，版本与时间线已更新。'
      note.value = ''
      if (action === 'close') disposition.value = ''
      void refresh()
    },
    (error) => {
      if (error instanceof ApiError && error.status === 409) {
        conflict.value = true
        latestReady.value = false
        void readDetail()
      }
      // 输入保持不变；403 不能自动换身份或重试，500 不能宣称事务已回滚。
    },
  )
}
function acknowledge() {
  if (latestReady.value) {
    conflict.value = false
    latestReady.value = false
    write.error.value = ''
    notice.value = '已重新核对当前版本；请明确选择下一次操作。'
  }
}
onMounted(() => {
  void refresh()
  void support.run(
    async (signal) => ({ handlers: await getHandlers(signal), demo: await getDemoStatus(signal) }),
    (value) => {
      handlers.value = value.handlers.items
      demo.value = value.demo
      scenario.value = value.demo.scenarios[0]?.id ?? ''
    },
  )
  window.addEventListener('hashchange', hashChanged)
})
onBeforeUnmount(() => window.removeEventListener('hashchange', hashChanged))
</script>
<template>
  <section class="workspace full-page" data-testid="cases-page">
    <header class="page-heading">
      <div>
        <p class="eyebrow">09 / 演练事件 · 12 / 筛选与分页</p>
        <h1>事件工作台</h1>
        <p class="muted">分派、处理、恢复、核实、关闭，每一步保留版本和时间线。</p>
      </div>
      <button class="button subtle" :disabled="listScope.busy.value" @click="refresh">
        刷新列表
      </button>
    </header>
    <SourceBanner business />
    <p v-if="readDenied" class="notice error" role="alert" data-testid="case-read-denied">读取权限已变化，事件数据与操作入口已清除。请重新登录核对身份；不会自动重发请求。</p>
    <div v-if="demo && store.capabilities?.canRunDemoScenarios === true" class="panel demo-panel">
      <div>
        <h2>本地场景演练</h2>
        <p class="muted tiny">{{ demo.label }} · 触发会新建数据库事件。</p>
      </div>
      <label
        >场景<select v-model="scenario" data-testid="demo-scenario">
          <option v-for="item in demo.scenarios" :key="item.id" :value="item.id">
            {{ item.name }}
          </option>
        </select></label
      ><button
        class="button primary"
        data-testid="trigger-demo"
        :disabled="!demo.enabled || write.busy.value || !scenario"
        @click="trigger"
      >
        触发本地演练
      </button>
      <p v-if="!demo.enabled" class="notice">教学演练当前未启用。</p>
    </div>
    <p v-if="support.error.value" class="notice error" role="alert">{{ support.error.value }}</p>
    <div class="query-bar">
      <label
        >事件状态<select
          :value="state"
          data-testid="case-state"
          @change="updateState(($event.target as HTMLSelectElement).value)"
        >
          <option value="">全部状态</option>
          <option v-for="(label, key) in stateNames" :key="key" :value="key">{{ label }}</option>
        </select></label
      ><label
        >负责范围<select v-model="mine" @change="otherFilter">
          <option :value="false">当前可读全部</option>
          <option :value="true">仅分派给我</option>
        </select></label
      ><label
        >每页<select v-model="limit" @change="otherFilter">
          <option :value="5">5 条</option>
          <option :value="10">10 条</option>
          <option :value="20">20 条</option>
        </select></label
      ><span class="muted tiny">改变筛选回到首页；刷新保留状态筛选。</span>
    </div>
    <p v-if="filterError" role="alert" class="notice error">{{ filterError }}</p>
    <ReadStatus :busy="listScope.busy.value" :error="listScope.error.value" :has-data="!!list" />
    <div class="case-layout">
      <div class="case-list panel">
        <div class="section-heading">
          <h2>事件列表</h2>
          <span>{{ list?.total ?? '—' }} 条</span>
        </div>
        <button
          v-for="item in list?.items"
          :key="item.id"
          class="case-row"
          :class="{ selected: selectedId === item.id }"
          :disabled="write.busy.value"
          :data-testid="`case-${item.id}`"
          @click="selectCase(item.id)"
        >
          <span class="case-row-head"
            ><strong>{{ item.deviceName }}</strong
            ><span class="state-badge">{{ stateNames[item.state] }}</span></span
          ><span>{{ item.message }}</span
          ><small
            >{{ item.assigneeName ?? '未分派' }} · v{{ item.version }} ·
            {{ timeText(item.createdAt) }}</small
          ><code>{{ item.id }}</code>
        </button>
        <div v-if="list && !list.items.length" class="empty-state">当前筛选没有事件。</div>
        <div class="pagination">
          <button
            class="button subtle"
            :disabled="listScope.busy.value || skip === 0"
            @click="page(-1)"
          >
            上一页</button
          ><span data-testid="case-page">第 {{ Math.floor(skip / limit) + 1 }} 页</span
          ><button
            class="button subtle"
            :disabled="
              listScope.busy.value || !list || skip + limit >= list.total || skip + limit > 10000
            "
            @click="page(1)"
          >
            下一页
          </button>
        </div>
      </div>
      <div class="case-detail panel">
        <ReadStatus
          :busy="detailScope.busy.value"
          :error="detailScope.error.value"
          :has-data="!!detail"
        />
        <p v-if="!selectedId" class="empty-state">选择一个事件，查看处置条件与时间线。</p>
        <template v-if="detail"
          ><div class="section-heading">
            <div>
              <p class="eyebrow">{{ detail.sourceScope }} · 模拟事件</p>
              <h2>{{ detail.deviceName }}</h2>
            </div>
            <span class="state-badge" data-testid="case-version"
              >v{{ detail.version }} · {{ stateNames[detail.state] }}</span
            >
          </div>
          <p>{{ detail.message }}</p>
          <dl class="detail-grid">
            <div>
              <dt>分派给</dt>
              <dd>{{ detail.assigneeName ?? '未分派' }}</dd>
            </div>
            <div>
              <dt>演练源</dt>
              <dd>{{ sourceStateNames[detail.sourceState] }}</dd>
            </div>
            <div>
              <dt>核实结果</dt>
              <dd>{{ detail.sourceCheckOutcome }}</dd>
            </div>
            <div>
              <dt>恢复时刻</dt>
              <dd>{{ timeText(detail.sourceRecoveredAt) }}</dd>
            </div>
            <div>
              <dt>核实时刻</dt>
              <dd>{{ timeText(detail.sourceVerifiedAt) }}</dd>
            </div>
            <div>
              <dt>当前记录</dt>
              <dd>
                <code>{{ detail.id }}</code>
              </dd>
            </div>
          </dl>
          <div v-if="write.error.value" class="notice error" role="alert">
            {{ write.error.value }}
          </div>
          <div v-if="conflict" class="notice warning" data-testid="case-conflict">
            <strong>409：原操作没有自动重放，输入仍保留。</strong>
            <p>
              {{
                latestReady
                  ? '最新详情已回读。请比较版本、归属、状态及时间线，再决定是否提交。'
                  : '正在回读最新详情；回读失败时请重试，暂不能继续操作。'
              }}
            </p>
            <button
              class="button subtle"
              v-if="latestReady"
              @click="acknowledge"
              data-testid="ack-case-conflict"
            >
              已核对最新记录</button
            ><button
              class="button subtle"
              v-else
              :disabled="detailScope.busy.value"
              @click="readDetail"
            >
              重试回读
            </button>
          </div>
          <p v-if="notice" class="notice" role="status">{{ notice }}</p>
          <div v-if="isClosed" class="notice">
            <strong>事件已关闭，记录不可再修改。</strong>
            <p>{{ detail.disposition }}</p>
          </div>
          <div v-else class="action-panel">
            <h3>本次操作</h3>
            <p v-if="!canHandle && store.capabilities?.canAssignAlarms !== true" class="muted tiny">
              当前身份仅查看；处理权限取决于服务端能力与当前分派。
            </p>
            <template v-if="canHandle || store.capabilities?.canAssignAlarms === true"
              ><label
                >处理记录 / 分派说明<textarea
                  v-model="note"
                  maxlength="500"
                  rows="3"
                  data-testid="case-note"
                  placeholder="记录实际检查、判断与处理过程"
                ></textarea></label
            ></template>
            <div v-if="store.capabilities?.canAssignAlarms === true" class="query-bar compact">
              <label
                >接收人<select v-model="assigneeUid" data-testid="case-assignee">
                  <option value="">请选择</option>
                  <option v-for="handler in handlers" :value="handler.uid" :key="handler.uid">
                    {{ handler.displayName }}（{{ handler.uid }}）
                  </option>
                </select></label
              ><button
                class="button subtle"
                :disabled="operationBlocked || !assigneeUid || !note.trim()"
                data-testid="assign-case"
                @click="act('assign')"
              >
                分派 / 重新分派
              </button>
            </div>
            <div class="action-buttons">
              <button
                v-if="canHandle"
                class="button primary"
                :disabled="operationBlocked || detail.state !== 'ASSIGNED' || !note.trim()"
                data-testid="start-case"
                @click="act('start')"
              >
                开始处理</button
              ><button
                v-if="canHandle"
                class="button primary"
                :disabled="operationBlocked || detail.state !== 'IN_PROGRESS' || !note.trim()"
                data-testid="note-case"
                @click="act('notes')"
              >
                提交处理记录</button
              ><button
                v-if="store.capabilities?.canRunDemoScenarios === true"
                class="button subtle"
                :disabled="operationBlocked || detail.sourceState === 'RECOVERED'"
                data-testid="recover-case"
                @click="act('recover')"
              >
                恢复演练源</button
              ><button
                v-if="canHandle"
                class="button subtle"
                :disabled="operationBlocked || detail.state !== 'IN_PROGRESS'"
                data-testid="verify-case"
                @click="act('verify-recovery')"
              >
                服务端核实恢复
              </button>
            </div>
            <div v-if="canHandle" class="close-section">
              <h3>关闭前检查</h3>
              <ul v-if="blocked.length" class="checklist">
                <li v-for="reason in blocked" :key="reason">{{ reason }}</li>
              </ul>
              <p v-else class="muted tiny">页面预检通过，最终条件仍由服务端逐项检查。</p>
              <label
                >处置结论<textarea
                  v-model="disposition"
                  rows="3"
                  maxlength="2000"
                  data-testid="case-disposition"
                  placeholder="说明原因、已完成措施、恢复证据与后续事项"
                ></textarea></label
              ><button
                class="button primary"
                data-testid="close-case"
                :disabled="operationBlocked || blocked.length > 0 || !disposition.trim()"
                @click="act('close')"
              >
                提交结论并关闭
              </button>
            </div>
          </div>
          <h3 class="timeline-heading">处置时间线</h3>
          <ol class="timeline">
            <li v-for="item in detail.timeline" :key="item.id">
              <div>
                <strong>{{ actionNames[item.action] ?? item.action }}</strong
                ><span>v{{ item.caseVersion }} · {{ stateNames[item.toState] }}</span>
              </div>
              <p>{{ item.note || '无附加说明' }}</p>
              <small
                >{{ item.actorName }}（{{ item.actorUid }}） · {{ timeText(item.createdAt) }}</small
              ><small v-if="item.previousAssigneeUid !== item.assigneeUid"
                >分派：{{ item.previousAssigneeUid ?? '无人' }} →
                {{ item.assigneeUid ?? '无人' }}</small
              >
            </li>
          </ol></template
        >
      </div>
    </div>
  </section>
</template>
