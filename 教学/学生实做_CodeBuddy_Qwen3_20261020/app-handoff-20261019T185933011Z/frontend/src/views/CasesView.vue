<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import ReadStatus from '../components/ReadStatus.vue'
import SourceBanner from '../components/SourceBanner.vue'
import { actOnCase, getCase, getCases, getDemoStatus, getHandlers, triggerDemo } from '../api/full'
import { ApiError, safeError } from '../api/http'
import { useRequestScope } from '../composables/useRequestScope'
import {
  actionNames,
  caseQuery,
  caseStates,
  changeCaseState,
  closeBlockers,
  sourceStateNames,
  stateNames,
  strictCapability,
  timeText,
  validCaseState,
  type CaseState,
} from '../domain/course'
import { closurePanel } from '../journey/features'
import { useCampusStore } from '../stores/campus'
import type { AlarmCase, AlarmDetail, DemoStatus, Handler } from '../types/full'

const store = useCampusStore()
const PAGE_SIZE = 10

const cases = ref<AlarmCase[]>([])
const total = ref(0)
const observedAt = ref<number | null>(null)
const hasList = ref(false)
/** 只从 URL 恢复合法 state；skip 一律回到第 1 页，旧链接的分页不沿用。 */
function hashState(): CaseState | '' {
  const match = /^#cases(?:\?(.*))?$/.exec(location.hash)
  const params = new URLSearchParams(match?.[1] ?? '')
  return validCaseState(params.get('state'))
}
const stateFilter = ref<CaseState | ''>(hashState())
const assigneeFilter = ref('')
const skip = ref(0)
/** 列表 403 后锁定读取与写入口，直到身份变化（重新登录）才解除。 */
const readDenied = ref(false)
/** 409 回读后仍需人工确认，确认前不允许手动重新提交。 */
const conflictLocked = ref(false)
const handlers = ref<Handler[]>([])
const currentUid = ref('')
const demo = ref<DemoStatus | null>(null)
const selectedId = ref('')
const detail = ref<AlarmDetail | null>(null)

const assignForm = reactive({ assigneeUid: '', note: '' })
const startNote = ref('')
const noteText = ref('')
const dispositionText = ref('')

type WriteKind = 'trigger' | 'assign' | 'start' | 'note' | 'recover' | 'verify' | 'close'
const writeBusy = ref<WriteKind | null>(null)
const writeError = ref('')
const writeNotice = ref('')

/** 列表、详情、处理人、演练状态各用一个序号，互不覆盖对方的失败与取消。 */
const listScope = useRequestScope()
const detailScope = useRequestScope()
const handlersScope = useRequestScope()
const demoScope = useRequestScope()
const listBusy = listScope.busy
const listError = listScope.error
const detailBusy = detailScope.busy
const detailError = detailScope.error
const handlersBusy = handlersScope.busy
const handlersError = handlersScope.error
const demoBusy = demoScope.busy
const demoError = demoScope.error

/** 能力只认服务端布尔 true；roles 只用于显示。 */
const canAssign = computed(() => strictCapability(store.capabilities?.canAssignAlarms))
const canAdmin = computed(() => strictCapability(store.capabilities?.canAdmin))
const canHandle = computed(() => strictCapability(store.capabilities?.canHandleAlarms))
const canRunDemo = computed(() => strictCapability(store.capabilities?.canRunDemoScenarios))
const myUid = computed(() => currentUid.value || store.user?.uid || '')
const assignedToMe = computed(
  () => detail.value?.assigneeUid !== null && detail.value?.assigneeUid === myUid.value,
)
/** 管理员能力可处理任意事件；CAMPUS_MANAGER 只处理本人被分派的事件。 */
const canAct = computed(() => canHandle.value && (canAssign.value || assignedToMe.value))
const canStart = computed(() => canAct.value && detail.value?.state === 'ASSIGNED')
const canNote = computed(() => canAct.value && detail.value?.state === 'IN_PROGRESS')
/** 恢复只允许 ADMIN；核实与关闭沿用 handler 能力，仍需服务端最终判定。 */
const canRecover = computed(
  () =>
    canAdmin.value &&
    detail.value !== null &&
    detail.value.state !== 'CLOSED' &&
    detail.value.sourceState !== 'RECOVERED' &&
    demo.value?.enabled === true,
)
const canVerify = computed(
  () =>
    canAct.value &&
    detail.value !== null &&
    detail.value.state !== 'CLOSED' &&
    detail.value.sourceState === 'RECOVERED' &&
    detail.value.sourceCheckOutcome !== 'PASS',
)
const disposition = computed(() => dispositionText.value.trim())
const dispositionProblem = computed(() => {
  if (!disposition.value) return '关闭结论去掉首尾空格后不能为空（1..2000 字）。'
  if (disposition.value.length > 2000) return '关闭结论最多 2000 字。'
  return ''
})
/** 缺项直接取自 closeBlockers，与后端 requireClosable 同源。 */
const missingClose = computed(() => (detail.value ? closeBlockers(detail.value) : ['先选择事件']))
const closeReady = computed(
  () =>
    canAct.value &&
    detail.value !== null &&
    detail.value.state !== 'CLOSED' &&
    missingClose.value.length === 0 &&
    dispositionProblem.value === '',
)

const isMineOnly = computed(() => !!myUid.value && assigneeFilter.value === myUid.value)
const listQuery = computed(() =>
  caseQuery(stateFilter.value, skip.value, PAGE_SIZE, assigneeFilter.value),
)
/** 状态计数只统计本页返回的条目，不能当作全库数量。 */
const stateCounts = computed(() => {
  const counts: Record<CaseState, number> = { NEW: 0, ASSIGNED: 0, IN_PROGRESS: 0, CLOSED: 0 }
  for (const item of cases.value) counts[item.state] += 1
  return counts
})
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))
const pageNo = computed(() => Math.floor(skip.value / PAGE_SIZE) + 1)
const selectedInList = computed(
  () => detail.value !== null && cases.value.some((item) => item.id === detail.value?.id),
)

function badgeClass(state: CaseState): string {
  if (state === 'IN_PROGRESS') return 'good'
  if (state === 'NEW' || state === 'ASSIGNED') return 'warning'
  return ''
}

/** 列表 403：清掉详情、输入与写入口，并在重新登录前不再重发读取。 */
function denyRead() {
  readDenied.value = true
  cases.value = []
  total.value = 0
  observedAt.value = null
  hasList.value = false
  selectedId.value = ''
  detail.value = null
  handlers.value = []
  currentUid.value = ''
  demo.value = null
  assignForm.assigneeUid = ''
  assignForm.note = ''
  startNote.value = ''
  noteText.value = ''
  dispositionText.value = ''
  conflictLocked.value = false
  writeBusy.value = null
  writeError.value = ''
  writeNotice.value = ''
  detailScope.cancel()
  handlersScope.cancel()
  demoScope.cancel()
}

async function loadList() {
  if (readDenied.value) return
  await listScope.run(
    (signal) => getCases(listQuery.value, signal),
    (data) => {
      cases.value = data.items
      total.value = data.total
      observedAt.value = data.observedAt
      hasList.value = true
    },
    (reason) => {
      if (reason instanceof ApiError && reason.status === 403) denyRead()
    },
  )
}

async function loadDetail(caseId: string) {
  await detailScope.run(
    (signal) => getCase(caseId, signal),
    (data) => {
      if (selectedId.value === caseId) detail.value = data
    },
  )
}

async function loadHandlers() {
  await handlersScope.run(
    (signal) => getHandlers(signal),
    (data) => {
      handlers.value = data.items
      currentUid.value = data.currentUid
    },
  )
}

async function loadDemo() {
  await demoScope.run(
    (signal) => getDemoStatus(signal),
    (data) => {
      demo.value = data
    },
  )
}

function refreshAll() {
  if (readDenied.value) return
  void loadHandlers()
  void loadDemo()
  void loadList()
  if (selectedId.value) void loadDetail(selectedId.value)
}

/** 筛选状态写回 URL，便于复现；不含 skip，避免旧分页串到新筛选。 */
function syncHash() {
  const next = stateFilter.value ? `#cases?state=${stateFilter.value}` : '#cases'
  if (location.hash !== next) history.replaceState(null, '', next)
}

function onStateChange() {
  const next = changeCaseState(stateFilter.value)
  stateFilter.value = next.state
  skip.value = next.skip
  syncHash()
  void loadList()
}

function pickState(state: CaseState) {
  stateFilter.value = state
  onStateChange()
}

function onFilterChange() {
  skip.value = 0
  void loadList()
}

function toggleMine() {
  assigneeFilter.value = isMineOnly.value ? '' : myUid.value
  skip.value = 0
  void loadList()
}

function ackConflict() {
  conflictLocked.value = false
  writeError.value = ''
}

function goPage(delta: number) {
  const next = skip.value + delta * PAGE_SIZE
  if (next < 0 || next >= total.value) return
  skip.value = next
  void loadList()
}

function selectCase(caseId: string) {
  if (selectedId.value !== caseId) {
    assignForm.assigneeUid = ''
    assignForm.note = ''
    startNote.value = ''
    noteText.value = ''
    dispositionText.value = ''
    writeError.value = ''
    writeNotice.value = ''
  }
  selectedId.value = caseId
  detail.value = null
  void loadDetail(caseId)
}

function writeFailureText(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 403) return '服务端拒绝本次操作（403）：当前身份没有该权限，或该事件未分派给你。'
    if (error.status === 404) return '事件不存在或不在当前可见范围（404），请刷新列表后再决定。'
    if (error.code === 'CSRF_INVALID') return '登录保护校验未通过，请重新登录后再提交。'
    return error.message
  }
  return safeError(error)
}

/**
 * 409 只回读，不重放；表单内容原样保留。
 * 回读成功也要人工确认后才允许手动提交；回读失败则保持锁定。
 */
async function readBackAfterConflict(caseId: string) {
  writeError.value = '服务端判定记录已变化（409）：本次输入不会自动重放，正在回读最新记录…'
  await loadList()
  if (!caseId) {
    conflictLocked.value = true
    return
  }
  const readBack = await detailScope.run(
    (signal) => getCase(caseId, signal),
    (data) => {
      detail.value = data
      selectedId.value = data.id
    },
  )
  const latest = detail.value
  conflictLocked.value = true
  writeError.value =
    readBack && latest
      ? `记录已被其他人更新（409）：已回读到最新 version=${latest.version}、状态 ${stateNames[latest.state] ?? latest.state}。本次输入没有自动重放，请核对后点击“我已核对最新记录”确认，再手动提交。`
      : '记录已被其他人更新（409），但回读最新记录未成功。你的输入仍保留在表单里；回读未确认前保持锁定，请先重新读取详情。'
}

let writeController: AbortController | null = null
async function runWrite(
  kind: WriteKind,
  task: (signal: AbortSignal) => Promise<AlarmDetail>,
): Promise<AlarmDetail | null> {
  if (writeBusy.value) return null
  const actor = store.user?.uid
  if (!actor) {
    writeError.value = '当前没有已确认的身份，写操作未提交。'
    return null
  }
  writeController?.abort()
  writeController = new AbortController()
  writeBusy.value = kind
  writeError.value = ''
  writeNotice.value = ''
  try {
    const updated = await task(writeController.signal)
    if (store.user?.uid !== actor) return null
    detail.value = updated
    selectedId.value = updated.id
    await loadList()
    return updated
  } catch (reason) {
    if (reason instanceof ApiError && reason.status === 401) {
      store.expireSession()
      return null
    }
    if (reason instanceof ApiError && reason.status === 409) {
      await readBackAfterConflict(selectedId.value)
      return null
    }
    writeError.value = writeFailureText(reason)
    return null
  } finally {
    writeBusy.value = null
  }
}

function noteProblem(note: string): string {
  if (!note) return '请填写说明（去掉首尾空格后 1..500 字）。'
  if (note.length > 500) return '说明最多 500 字。'
  return ''
}

async function submitTrigger(scenario: string) {
  if (!canRunDemo.value || demo.value?.enabled !== true || writeBusy.value) return
  const meta = demo.value.scenarios.find((item) => item.id === scenario)
  // 新事件接管详情：先取消旧详情请求，避免迟到结果覆盖或残留旧错误。
  detailScope.cancel()
  const updated = await runWrite('trigger', (signal) => triggerDemo(scenario, store.csrf, signal))
  if (updated) {
    // 不继承上一个事件尚未提交的分派输入。
    assignForm.assigneeUid = ''
    assignForm.note = ''
    startNote.value = ''
    noteText.value = ''
    dispositionText.value = ''
    conflictLocked.value = false
    writeNotice.value = `已创建本地模拟事件「${meta?.name ?? updated.scenario}」（LOCAL_DEMO，非 AIRIOT 实时报警），version=${updated.version}，状态 ${stateNames[updated.state] ?? updated.state}，等待分派。`
  }
}

async function submitAssign() {
  const target = detail.value
  if (!target) {
    writeError.value = '请先在列表中选择一条事件。'
    return
  }
  if (!canAssign.value) {
    writeError.value = '当前身份没有分派能力（页面只隐藏入口，服务端最终判定）。'
    return
  }
  if (!assignForm.assigneeUid) {
    writeError.value = '请选择处理人。'
    return
  }
  const note = assignForm.note.trim()
  const problem = noteProblem(note)
  if (problem) {
    writeError.value = problem
    return
  }
  const updated = await runWrite('assign', (signal) =>
    actOnCase(
      target.id,
      'assign',
      { assigneeUid: assignForm.assigneeUid, note, expectedVersion: target.version },
      store.csrf,
      signal,
    ),
  )
  if (updated) {
    assignForm.note = ''
    writeNotice.value = `已分派给 ${updated.assigneeName ?? updated.assigneeUid ?? '处理人'}，version=${updated.version}；对方需要先“开始处理”。`
  }
}

async function submitStart() {
  const target = detail.value
  if (!target) {
    writeError.value = '请先在列表中选择一条事件。'
    return
  }
  if (target.state !== 'ASSIGNED') {
    writeError.value = `当前业务状态为 ${stateNames[target.state] ?? target.state}，只有已分派的事件可以开始处理。`
    return
  }
  const note = startNote.value.trim()
  const problem = noteProblem(note)
  if (problem) {
    writeError.value = problem
    return
  }
  const updated = await runWrite('start', (signal) =>
    actOnCase(target.id, 'start', { note, expectedVersion: target.version }, store.csrf, signal),
  )
  if (updated) {
    startNote.value = ''
    writeNotice.value = `事件已进入处理中，version=${updated.version}；现在可以填写处理记录。`
  }
}

async function submitNote() {
  const target = detail.value
  if (!target) {
    writeError.value = '请先在列表中选择一条事件。'
    return
  }
  if (target.state !== 'IN_PROGRESS') {
    writeError.value = `当前业务状态为 ${stateNames[target.state] ?? target.state}，先“开始处理”再填写处理记录。`
    return
  }
  const note = noteText.value.trim()
  const problem = noteProblem(note)
  if (problem) {
    writeError.value = problem
    return
  }
  const updated = await runWrite('note', (signal) =>
    actOnCase(target.id, 'notes', { note, expectedVersion: target.version }, store.csrf, signal),
  )
  if (updated) {
    noteText.value = ''
    writeNotice.value = `处理记录已保存，业务状态仍为 ${stateNames[updated.state] ?? updated.state}，version=${updated.version}。`
  }
}

/** 恢复只写来源事实，业务状态保持 IN_PROGRESS，也不产生核实结论。 */
async function submitRecover() {
  const target = detail.value
  if (!target) {
    writeError.value = '请先在列表中选择一条事件。'
    return
  }
  if (!canAdmin.value) {
    writeError.value = '恢复演练来源只允许 ADMIN（页面只隐藏入口，服务端最终判定）。'
    return
  }
  if (target.state === 'CLOSED') {
    writeError.value = '事件已关闭，不能恢复来源。'
    return
  }
  if (target.sourceState === 'RECOVERED') {
    writeError.value = '该事件的演练来源已恢复，不需要重复恢复。'
    return
  }
  if (demo.value?.enabled !== true) {
    writeError.value = '演练开关未开启或状态尚未读取，本次恢复未提交。'
    return
  }
  const updated = await runWrite('recover', (signal) =>
    actOnCase(target.id, 'recover', { expectedVersion: target.version }, store.csrf, signal),
  )
  if (updated) {
    writeNotice.value = `服务端已记录演练源恢复（DEMO_RECOVER）：sourceState=${updated.sourceState}、核实=${updated.sourceCheckOutcome}；业务状态仍为 ${stateNames[updated.state] ?? updated.state}，恢复不会自动关闭，请继续服务端核实。`
  }
}

async function submitVerify() {
  const target = detail.value
  if (!target) {
    writeError.value = '请先在列表中选择一条事件。'
    return
  }
  if (!canAct.value) {
    writeError.value = '当前身份不能核实该事件：仅 ADMIN 或本人被分派的管理员可以核实。'
    return
  }
  if (target.state === 'CLOSED') {
    writeError.value = '事件已关闭，不能再核实来源。'
    return
  }
  if (target.sourceState !== 'RECOVERED') {
    writeError.value = '来源尚未恢复，服务端核实不会通过；请先完成恢复。'
    return
  }
  const updated = await runWrite('verify', (signal) =>
    actOnCase(target.id, 'verify-recovery', { expectedVersion: target.version }, store.csrf, signal),
  )
  if (updated) {
    const pass = updated.sourceCheckOutcome === 'PASS'
    writeNotice.value = pass
      ? `服务端独立核实 PASS（sourceVerifiedAt=${timeText(updated.sourceVerifiedAt)}）；业务状态仍为 ${stateNames[updated.state] ?? updated.state}，还需填写结论后才能关闭。`
      : `服务端核实未通过（${updated.sourceCheckOutcome}）；业务状态仍为 ${stateNames[updated.state] ?? updated.state}，请核对来源恢复后重试。`
  }
}

/** 关闭成功后独立回读，确认为 CLOSED；失败不清空已提交的结论。 */
async function submitClose() {
  const target = detail.value
  if (!target) {
    writeError.value = '请先在列表中选择一条事件。'
    return
  }
  if (!canAct.value) {
    writeError.value = '当前身份不能关闭该事件：仅 ADMIN 或本人被分派的管理员可以关闭。'
    return
  }
  if (target.state === 'CLOSED') {
    writeError.value = '事件已关闭，不能重复关闭。'
    return
  }
  if (dispositionProblem.value) {
    writeError.value = dispositionProblem.value
    return
  }
  const missing = closeBlockers(target)
  if (missing.length > 0) {
    writeError.value = `关闭前置条件未满足：${missing.join('、')}。`
    return
  }
  const text = disposition.value
  const updated = await runWrite('close', (signal) =>
    actOnCase(
      target.id,
      'close',
      { disposition: text, expectedVersion: target.version },
      store.csrf,
      signal,
    ),
  )
  if (!updated) return
  dispositionText.value = ''
  const confirmed = await detailScope.run(
    (signal) => getCase(updated.id, signal),
    (data) => {
      if (selectedId.value === updated.id) detail.value = data
    },
  )
  const latest = detail.value
  writeNotice.value =
    confirmed && latest?.state === 'CLOSED'
      ? `关闭已确认（独立回读）：state=CLOSED、version=${latest.version}、closedAt=${timeText(latest.closedAt)}、结论「${latest.disposition ?? ''}」。`
      : `服务端已返回关闭（version=${updated.version}），但独立回读未确认；请手动重新读取详情核对。`
}

/** 身份变化即清空该身份看到的事件、详情与输入，避免跨身份残留。 */
watch(
  () => store.user?.uid ?? '',
  (uid) => {
    cases.value = []
    total.value = 0
    observedAt.value = null
    hasList.value = false
    selectedId.value = ''
    detail.value = null
    handlers.value = []
    currentUid.value = uid
    skip.value = 0
    assigneeFilter.value = ''
    readDenied.value = false
    conflictLocked.value = false
    writeBusy.value = null
    writeError.value = ''
    writeNotice.value = ''
    dispositionText.value = ''
    if (!uid) return
    void loadHandlers()
    void loadDemo()
    void loadList()
  },
  { immediate: true },
)
</script>

<template>
  <section class="workspace full-page" data-testid="cases-view">
    <header class="page-heading">
      <div>
        <p class="eyebrow">第08站 · 事件接收与处理</p>
        <h1>让一件事有人接手</h1>
        <p class="muted">
          本地演练事件（DEMO / LOCAL_DEMO / simulated=true）不是 AIRIOT 实时报警，也不改动原始报警。
          业务状态按 NEW → ASSIGNED → IN_PROGRESS 记录；每次写请求都带 expectedVersion，409 只回读并保留输入，不自动重放。
        </p>
      </div>
      <button type="button" class="button subtle" :disabled="listBusy" @click="refreshAll">
        {{ listBusy ? '正在读取…' : '重新读取' }}
      </button>
    </header>

    <SourceBanner :business="true" />

    <div v-if="!store.user" class="notice" role="status">
      <strong>需要已确认的身份</strong>
      <p>列表、处理人与写操作都按服务端身份判定；请先用顶部登录，本页不保留上一次身份的事件与输入。</p>
    </div>

    <div v-if="readDenied" class="notice error" role="alert" data-testid="case-read-denied">
      <strong>事件列表读取被拒绝（403）</strong>
      <p>
        已清除本页已选详情、输入与写入口；请在顶部重新登录后再读取。重新登录前不会自动重发请求，也不会沿用上一次身份的详情。
      </p>
    </div>

    <section class="panel">
      <div class="section-heading">
        <h2>本地模拟场景</h2>
        <span v-if="demo">
          {{ demo.label }} · 演练开关{{ demo.enabled ? '已开启' : '已关闭' }} · 触发能力{{
            canRunDemo ? '允许' : '不据此授权'
          }}
        </span>
        <span v-else>尚未读取场景状态</span>
      </div>
      <ReadStatus :busy="demoBusy" :error="demoError" :has-data="demo !== null" />
      <div v-if="!readDenied && canRunDemo && demo && demo.scenarios.length > 0" class="scenario-grid">
        <article v-for="scenario in demo.scenarios" :key="scenario.id" class="scenario-card">
          <h3>{{ scenario.name }}</h3>
          <p class="tiny muted">{{ scenario.description }}</p>
          <code>{{ scenario.id }} · {{ scenario.deviceId }}</code>
          <button
            type="button"
            class="button primary"
            data-testid="trigger-demo"
            :disabled="!canRunDemo || demo.enabled !== true || writeBusy !== null || readDenied"
            @click="submitTrigger(scenario.id)"
          >
            {{ writeBusy === 'trigger' ? '正在触发…' : `触发「${scenario.name}」` }}
          </button>
        </article>
      </div>
      <p v-else-if="demo && !readDenied" class="tiny muted">
        {{
          demo.scenarios.length === 0
            ? '服务端未返回可用场景。'
            : '当前身份不显示演练触发入口（页面只隐藏入口，服务端最终判定）。'
        }}
      </p>
      <ul v-if="demo && demo.limitations.length > 0" class="limitations">
        <li v-for="limitation in demo.limitations" :key="limitation">{{ limitation }}</li>
      </ul>
    </section>

    <div class="case-layout">
      <section class="panel">
        <div class="section-heading">
          <h2>事件列表</h2>
          <span>共 {{ total }} 条</span>
        </div>
        <div class="query-bar compact">
          <label for="case-state">
            <span>业务状态</span>
            <select id="case-state" data-testid="case-state" v-model="stateFilter" @change="onStateChange">
              <option value="">全部状态</option>
              <option v-for="state in caseStates" :key="state" :value="state">
                {{ stateNames[state] }}（{{ state }}）
              </option>
            </select>
          </label>
          <label for="case-handler-filter">
            <span>处理人</span>
            <select
              id="case-handler-filter"
              data-testid="case-handler-filter"
              v-model="assigneeFilter"
              @change="onFilterChange"
            >
              <option value="">全部处理人</option>
              <option v-for="handler in handlers" :key="handler.uid" :value="handler.uid">
                {{ handler.displayName }}（{{ handler.uid }}）
              </option>
            </select>
          </label>
          <button
            type="button"
            class="button subtle"
            :aria-pressed="isMineOnly"
            :disabled="!myUid"
            @click="toggleMine"
          >
            {{ isMineOnly ? '只看分派给我：开' : '只看分派给我：关' }}
          </button>
        </div>
        <div class="state-counts">
          <button
            v-for="state in caseStates"
            :key="state"
            type="button"
            class="button subtle"
            :data-testid="`case-state-count-${state}`"
            :aria-pressed="stateFilter === state"
            @click="pickState(state)"
          >
            {{ stateNames[state] }} {{ stateCounts[state] }}
          </button>
        </div>
        <p class="tiny muted">
          以上为按本页 {{ cases.length }} 条计数，不代表全库；处理人筛选使用 assigneeUid={{
            assigneeFilter || '（全部）'
          }}，每次切换状态都回到第 1 页。
          <template v-if="observedAt !== null">读取时间 {{ timeText(observedAt) }}。</template>
        </p>
        <ReadStatus :busy="listBusy" :error="listError" :has-data="hasList" />
        <div v-if="hasList && cases.length === 0" class="notice" role="status">
          <strong>当前筛选下 0 条事件</strong>
          <p>这是读取成功后的空结果，与读取失败不同；可清空状态筛选或关闭“只看分派给我”。</p>
        </div>
        <div v-if="cases.length > 0" class="case-list">
          <button
            v-for="item in cases"
            :key="item.id"
            type="button"
            class="case-row"
            :class="{ selected: item.id === selectedId }"
            :data-testid="`case-${item.id}`"
            :aria-current="item.id === selectedId ? 'true' : undefined"
            @click="selectCase(item.id)"
          >
            <span class="case-row-head">
              <strong>{{ item.scenario }}</strong>
              <span class="state-badge" :class="badgeClass(item.state)">
                {{ stateNames[item.state] ?? item.state }}
              </span>
            </span>
            <span>{{ item.deviceName }}</span>
            <small>
              处理人：{{ item.assigneeName ?? '未分派' }} · 发生：{{ timeText(item.occurredAt) }}
            </small>
            <code>version {{ item.version }} · {{ item.id }}</code>
          </button>
        </div>
        <div class="pagination">
          <button
            type="button"
            class="button subtle"
            :disabled="listBusy || skip === 0"
            @click="goPage(-1)"
          >
            上一页
          </button>
          <span>第 {{ pageNo }} / {{ pageCount }} 页 · 每页 {{ PAGE_SIZE }} 条</span>
          <button
            type="button"
            class="button subtle"
            :disabled="listBusy || skip + PAGE_SIZE >= total"
            @click="goPage(1)"
          >
            下一页
          </button>
        </div>
      </section>

      <div>
        <p v-if="!detail && detailBusy" class="muted" role="status">正在读取事件详情…</p>
        <div v-else-if="!detail && detailError" class="notice error" role="alert">
          <strong>事件详情读取失败</strong>
          <p>{{ detailError }}</p>
        </div>
        <div v-else-if="!detail" class="notice" role="status">
          <strong>尚未选择事件</strong>
          <p>在列表点一条事件读取详情与时间线；列表和详情是两次独立读取。</p>
        </div>

        <section v-if="detail" class="panel case-detail" data-testid="case-detail">
          <div class="section-heading">
            <h2>事件详情</h2>
            <span data-testid="case-version">v{{ detail.version }}</span>
            <span>来源状态与业务状态分列</span>
          </div>
          <ReadStatus :busy="detailBusy" :error="detailError" :has-data="true" />
          <p v-if="!selectedInList" class="tiny muted">
            该事件已不在当前筛选的列表中，以下内容以本次回读的服务端记录为准。
          </p>
          <dl class="detail-grid">
            <div>
              <dt>场景与说明</dt>
              <dd>{{ detail.scenario }}<br />{{ detail.message }}</dd>
            </div>
            <div>
              <dt>设备</dt>
              <dd>{{ detail.deviceName }}（<code>{{ detail.deviceId }}</code>）</dd>
            </div>
            <div>
              <dt>业务状态</dt>
              <dd>{{ stateNames[detail.state] ?? detail.state }}（{{ detail.state }}）</dd>
            </div>
            <div>
              <dt>处理人</dt>
              <dd>
                {{ detail.assigneeName ?? '未分派' }}
                <template v-if="detail.assigneeUid"> · <code>{{ detail.assigneeUid }}</code></template>
              </dd>
            </div>
            <div>
              <dt>演练来源</dt>
              <dd>{{ detail.sourceType }} / {{ detail.sourceScope }} · 级别 {{ detail.level }}</dd>
            </div>
            <div>
              <dt>来源状态（只读）</dt>
              <dd>
                {{ sourceStateNames[detail.sourceState] ?? detail.sourceState }}（{{ detail.sourceState }}）
                · 核实 {{ detail.sourceCheckOutcome }}
              </dd>
            </div>
            <div>
              <dt>发生时间</dt>
              <dd>{{ timeText(detail.occurredAt) }}</dd>
            </div>
            <div>
              <dt>最近更新</dt>
              <dd>{{ timeText(detail.updatedAt) }}</dd>
            </div>
            <div>
              <dt>关闭信息</dt>
              <dd>
                {{ detail.disposition ?? '未关闭' }}
                <template v-if="detail.closedAt"> · {{ timeText(detail.closedAt) }}</template>
              </dd>
            </div>
          </dl>

          <div class="timeline-heading">
            <h3>处理时间线</h3>
            <span class="tiny muted">每条记录带 caseVersion；服务端操作时间，不使用浏览器时钟。</span>
          </div>
          <p v-if="detail.timeline.length === 0" class="tiny muted">时间线为空。</p>
          <ol v-else class="timeline">
            <li v-for="item in detail.timeline" :key="item.id">
              <div>
                <strong>{{ actionNames[item.action] ?? item.action }}</strong>
                <span>{{ item.actorName }}（{{ item.actorUid }}） · {{ timeText(item.createdAt) }} · v{{ item.caseVersion }}</span>
              </div>
              <p>
                {{ item.fromState ?? '—' }} → {{ item.toState }} · 来源状态 {{ item.sourceState }}
              </p>
              <p v-if="item.note">{{ item.note }}</p>
            </li>
          </ol>

          <div v-if="conflictLocked" class="notice error" role="alert" data-testid="case-conflict">
            <strong>版本冲突（409）：需人工确认后才可重新提交</strong>
            <p>{{ writeError }}</p>
            <p class="tiny muted">
              回读成功也只把最新 version 与状态显示给你；写入口保持锁定，直到你确认已核对。
            </p>
            <div class="action-buttons">
              <button
                type="button"
                class="button subtle"
                data-testid="ack-case-conflict"
                @click="ackConflict"
              >
                我已核对最新记录，允许手动重新提交
              </button>
            </div>
          </div>
          <div v-else-if="writeError" class="notice error" role="alert">
            <strong>本次写请求未完成</strong>
            <p>{{ writeError }}</p>
          </div>
          <div v-if="writeNotice" class="notice" role="status">
            <strong>服务端已确认</strong>
            <p>{{ writeNotice }}</p>
          </div>

          <div v-if="canAssign" class="action-panel">
            <h3>分派</h3>
            <p class="tiny muted">
              分派后业务状态为 ASSIGNED、version 加 1；处理人来自 GET /api/campus/alarm-cases/handlers。
              能力：{{ canAssign ? '允许' : '不据此授权' }}。
            </p>
            <ReadStatus :busy="handlersBusy" :error="handlersError" :has-data="handlers.length > 0" />
            <label for="assign-handler">
              处理人
              <select
                id="assign-handler"
                data-testid="case-assignee"
                v-model="assignForm.assigneeUid"
                :disabled="!canAssign || writeBusy !== null"
              >
                <option value="">请选择处理人</option>
                <option v-for="handler in handlers" :key="handler.uid" :value="handler.uid">
                  {{ handler.displayName }}（{{ handler.uid }}）
                </option>
              </select>
            </label>
            <label for="assign-note">
              分派说明（1..500 字）
              <textarea
                id="assign-note"
                v-model="assignForm.note"
                rows="3"
                maxlength="500"
                :disabled="!canAssign || writeBusy !== null"
              />
            </label>
            <div class="action-buttons">
              <button
                type="button"
                class="button primary"
                data-testid="assign-case"
                :disabled="!canAssign || writeBusy !== null"
                @click="submitAssign"
              >
                {{ writeBusy === 'assign' ? '正在分派…' : `分派（expectedVersion=${detail.version}）` }}
              </button>
            </div>
          </div>

          <div v-if="canHandle" class="action-panel">
            <h3>开始处理</h3>
            <p class="tiny muted">
              仅 ASSIGNED 可开始；成功后为 IN_PROGRESS、version 加 1。能力：{{
                canHandle ? '允许' : '不据此授权'
              }}，仅限本人被分派的事件或管理员能力。
            </p>
            <label for="start-note">
              开始说明（1..500 字）
              <textarea
                id="start-note"
                v-model="startNote"
                rows="3"
                maxlength="500"
                :disabled="!canStart || writeBusy !== null"
              />
            </label>
            <div class="action-buttons">
              <button
                type="button"
                class="button primary"
                data-testid="start-case"
                :disabled="!canStart || writeBusy !== null"
                @click="submitStart"
              >
                {{ writeBusy === 'start' ? '正在提交…' : `开始处理（expectedVersion=${detail.version}）` }}
              </button>
            </div>
          </div>

          <div v-if="canHandle" class="action-panel">
            <h3>处理记录 NOTE</h3>
            <p class="tiny muted">
              仅 IN_PROGRESS 可记录；业务状态不变、version 加 1、时间线新增一条。能力：{{
                canHandle ? '允许' : '不据此授权'
              }}。
            </p>
            <label for="case-note">
              记录内容（1..500 字）
              <textarea
                id="case-note"
                data-testid="case-note"
                v-model="noteText"
                rows="3"
                maxlength="500"
                :disabled="!canNote || writeBusy !== null || conflictLocked"
              />
            </label>
            <div class="action-buttons">
              <button
                type="button"
                class="button primary"
                data-testid="note-case"
                :disabled="!canNote || writeBusy !== null || conflictLocked"
                @click="submitNote"
              >
                {{ writeBusy === 'note' ? '正在保存…' : `保存记录（expectedVersion=${detail.version}）` }}
              </button>
            </div>
          </div>

          <p class="tiny muted">
            原始报警 GET /api/campus/alarms 保持只读，本页不替换、不关闭、不改写上游恢复状态。
          </p>
        </section>

        <template v-if="closurePanel">
          <template v-if="detail">
            <component :is="closurePanel" :detail="detail" />

            <div v-if="canRecover || canVerify" class="action-panel">
              <h3>来源恢复与服务端核实</h3>
              <p class="tiny muted">
                恢复只把来源置为 RECOVERED（核实 PENDING），业务状态保持
                {{ stateNames[detail.state] ?? detail.state }}；核实由服务端独立判定，两者都不会自动关闭。
                恢复能力：{{ canAdmin ? 'ADMIN' : '不据此授权' }}；核实能力：{{ canAct ? '允许' : '不据此授权' }}。
                演练开关：{{ demo ? (demo.enabled ? '已开启' : '已关闭') : '尚未读取' }}。
              </p>
              <div class="action-buttons">
                <button
                  type="button"
                  class="button subtle"
                  data-testid="recover-case"
                  :disabled="!canRecover || writeBusy !== null"
                  @click="submitRecover"
                >
                  {{ writeBusy === 'recover' ? '正在恢复…' : `恢复演练来源（expectedVersion=${detail.version}）` }}
                </button>
                <button
                  type="button"
                  class="button primary"
                  data-testid="verify-case"
                  :disabled="!canVerify || writeBusy !== null"
                  @click="submitVerify"
                >
                  {{ writeBusy === 'verify' ? '正在核实…' : `服务端核实恢复（expectedVersion=${detail.version}）` }}
                </button>
              </div>
            </div>

            <div v-if="canAct" class="action-panel">
              <h3>关闭结论</h3>
              <p class="tiny muted">
                关闭要求处理中、至少一条人工 NOTE、来源已恢复、服务端核实 PASS 和 1..2000 字结论。
                当前缺项：{{ missingClose.join('、') || '无' }}。请求携带点击时的 expectedVersion={{ detail.version }}；409 只回读，不自动重放。
              </p>
              <label for="close-disposition">
                关闭结论（1..2000 字）
                <textarea
                  id="close-disposition"
                  v-model="dispositionText"
                  rows="4"
                  maxlength="2000"
                  :disabled="!canAct || detail.state === 'CLOSED' || writeBusy !== null"
                />
              </label>
              <p v-if="dispositionProblem" class="tiny muted">{{ dispositionProblem }}</p>
              <div class="action-buttons">
                <button
                  type="button"
                  class="button primary"
                  data-testid="close-case"
                  :disabled="!closeReady || writeBusy !== null || conflictLocked"
                  @click="submitClose"
                >
                  {{ writeBusy === 'close' ? '正在关闭…' : `关闭事件（expectedVersion=${detail.version}）` }}
                </button>
              </div>
              <p class="tiny muted">
                按钮禁用只是提示；是否可关闭由服务端按权限、版本和 requireClosable 最终判定，关闭成功后独立回读详情。
              </p>
            </div>
          </template>
          <p v-else class="tiny muted">选择一条事件后显示恢复、核实与关闭检查。</p>
        </template>
      </div>
    </div>
  </section>
</template>

<style scoped>
.scenario-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
  margin-top: 18px;
}
.scenario-card {
  display: flex;
  flex-direction: column;
  gap: 9px;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 16px;
}
.scenario-card h3 {
  margin: 0;
  font-size: 0.92rem;
}
.scenario-card p {
  margin: 0;
  line-height: 1.7;
}
.scenario-card code {
  font-size: 0.7rem;
  color: var(--muted);
  overflow-wrap: anywhere;
}
.scenario-card .button {
  margin-top: auto;
}
.limitations {
  margin: 16px 0 0;
  padding-left: 20px;
  font-size: 0.76rem;
  line-height: 1.8;
  color: var(--muted);
}
.case-layout .query-bar {
  align-items: flex-end;
}
.case-layout .timeline-heading h3,
.case-layout .action-panel h3 {
  font-size: 0.95rem;
  margin: 0 0 6px;
}
</style>
