<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import ReadStatus from '../components/ReadStatus.vue'
import SourceBanner from '../components/SourceBanner.vue'
import { getHandlers, getOwner, getOwners, saveOwner } from '../api/full'
import { ApiError, safeError } from '../api/http'
import { useRequestScope } from '../composables/useRequestScope'
import { strictCapability, timeText } from '../domain/course'
import { useCampusStore } from '../stores/campus'
import type { Handler, Owner, OwnerDetail } from '../types/full'

const store = useCampusStore()

const owners = ref<Owner[]>([])
const observedAt = ref<number | null>(null)
const hasList = ref(false)
const keyword = ref('')
const selectedId = ref('')
const detail = ref<OwnerDetail | null>(null)
const handlers = ref<Handler[]>([])

const form = reactive({ ownerUid: '', note: '' })
const writeBusy = ref(false)
const writeError = ref('')
const writeNotice = ref('')

const listScope = useRequestScope()
const detailScope = useRequestScope()
const handlersScope = useRequestScope()
const listBusy = listScope.busy
const listError = listScope.error
const detailBusy = detailScope.busy
const detailError = detailScope.error
const handlersBusy = handlersScope.busy
const handlersError = handlersScope.error

/** 能力只认服务端布尔 true；roles 只用于显示。 */
const canAdmin = computed(() => strictCapability(store.capabilities?.canAdmin))

/** 设备名来自台账读取结果，未读取时只显示 deviceId，不拼造名称。 */
const deviceNames = computed(() => new Map(store.devices.map((item) => [item.id, item.name])))
function deviceLabel(deviceId: string): string {
  const name = deviceNames.value.get(deviceId)
  return name ? `${name}（${deviceId}）` : deviceId
}

const filtered = computed(() => {
  const text = keyword.value.trim().toLocaleLowerCase()
  if (!text) return owners.value
  return owners.value.filter((item) =>
    `${item.deviceId} ${deviceNames.value.get(item.deviceId) ?? ''}`.toLocaleLowerCase().includes(text),
  )
})
const selectedInList = computed(
  () => detail.value !== null && owners.value.some((item) => item.deviceId === detail.value?.deviceId),
)
/** 当前责任人可能已无处理资格，因而不在可选处理人列表里。 */
const currentOwnerNotEligible = computed(
  () =>
    detail.value?.ownerUid != null &&
    detail.value.ownerUid !== '' &&
    !handlers.value.some((item) => item.uid === detail.value?.ownerUid),
)

async function loadOwners() {
  await listScope.run(
    (signal) => getOwners(signal),
    (data) => {
      owners.value = data.items
      observedAt.value = data.observedAt
      hasList.value = true
    },
  )
}

async function loadDetail(deviceId: string) {
  await detailScope.run(
    (signal) => getOwner(deviceId, signal),
    (data) => {
      if (selectedId.value !== deviceId) return
      detail.value = data
      if (!form.ownerUid) form.ownerUid = data.ownerUid ?? ''
    },
  )
}

async function loadHandlers() {
  await handlersScope.run(
    (signal) => getHandlers(signal),
    (data) => {
      handlers.value = data.items
    },
  )
}

function refreshAll() {
  void loadHandlers()
  void loadOwners()
  if (selectedId.value) void loadDetail(selectedId.value)
}

function selectDevice(deviceId: string) {
  if (selectedId.value !== deviceId) {
    form.ownerUid = ''
    form.note = ''
    writeError.value = ''
    writeNotice.value = ''
  }
  selectedId.value = deviceId
  detail.value = null
  void loadDetail(deviceId)
}

function writeFailureText(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 403) {
      if (error.code === 'CSRF_INVALID') return '登录保护校验未通过，请重新登录后再提交。'
      return '服务端拒绝本次操作（403）：仅 ADMIN 可修改责任人，页面入口只作提示。'
    }
    if (error.status === 404) return '设备或责任记录不存在（404），请重新读取清单后再决定。'
    return error.message
  }
  return safeError(error)
}

/** 409 只回读，不重放；表单输入原样保留，由操作者核对后手动重新提交。 */
async function readBackAfterConflict(deviceId: string) {
  writeError.value = '服务端判定责任记录已变化（409）：本次输入不会自动重放，正在回读最新记录…'
  await loadOwners()
  const readBack = await detailScope.run(
    (signal) => getOwner(deviceId, signal),
    (data) => {
      detail.value = data
      selectedId.value = data.deviceId
    },
  )
  const latest = detail.value
  writeError.value =
    readBack && latest
      ? `责任记录已被其他人更新（409）：已回读到最新 version=${latest.version}、当前责任人 ${latest.ownerName ?? latest.ownerUid ?? '未指定'}。你的输入仍保留在表单里，请核对后手动重新提交。`
      : '责任记录已被其他人更新（409），但回读最新记录未成功。你的输入仍保留在表单里，请刷新后再决定。'
}

function noteProblem(note: string): string {
  if (!note) return '请填写变更说明（去掉首尾空格后 1..500 字）。'
  if (note.length > 500) return '变更说明最多 500 字。'
  return ''
}

/** 保存成功必须独立回读确认；确认不了就不显示成功。 */
async function submitChange() {
  const target = detail.value
  if (!target) {
    writeError.value = '请先在清单中选择一台设备。'
    return
  }
  if (!canAdmin.value) {
    writeError.value = '当前身份没有修改责任人的能力（页面只隐藏入口，服务端最终判定）。'
    return
  }
  if (!form.ownerUid) {
    writeError.value = '请选择新的责任人。'
    return
  }
  if (form.ownerUid === target.ownerUid) {
    writeError.value = '所选责任人就是当前责任人，本次未提交。'
    return
  }
  const note = form.note.trim()
  const problem = noteProblem(note)
  if (problem) {
    writeError.value = problem
    return
  }
  if (writeBusy.value) return
  const actor = store.user?.uid
  if (!actor) {
    writeError.value = '当前没有已确认的身份，写操作未提交。'
    return
  }
  writeBusy.value = true
  writeError.value = ''
  writeNotice.value = ''
  const deviceId = target.deviceId
  const beforeVersion = target.version
  try {
    const saved = await saveOwner(deviceId, form.ownerUid, note, beforeVersion, store.csrf)
    if (store.user?.uid !== actor) return
    const confirmed = await detailScope.run(
      (signal) => getOwner(saved.deviceId, signal),
      (data) => {
        if (selectedId.value === saved.deviceId) detail.value = data
      },
    )
    const latest = detail.value
    const same = confirmed && latest !== null && latest.version === saved.version && latest.ownerUid === saved.ownerUid
    if (same && latest) {
      form.note = ''
      writeNotice.value = `已保存并独立回读确认：${deviceId} 的责任人 ${target.ownerName ?? target.ownerUid ?? '未指定'} → ${latest.ownerName ?? latest.ownerUid ?? '未指定'}，version ${beforeVersion} → ${latest.version}。旧事件仍保留原处理人、不会改派；此后新建的事件才跟随新责任人。`
      await loadOwners()
    } else {
      writeError.value = `服务端已返回保存（version=${saved.version}），但独立回读未确认最新记录；请手动重新读取核对，本次输入未清空。`
    }
  } catch (reason) {
    if (reason instanceof ApiError && reason.status === 401) {
      store.expireSession()
      return
    }
    if (reason instanceof ApiError && reason.status === 409) {
      await readBackAfterConflict(deviceId)
      return
    }
    writeError.value = writeFailureText(reason)
  } finally {
    writeBusy.value = false
  }
}

/** 身份变化即清空该身份看到的清单、详情与输入，避免跨身份残留。 */
watch(
  () => store.user?.uid ?? '',
  (uid) => {
    owners.value = []
    observedAt.value = null
    hasList.value = false
    keyword.value = ''
    selectedId.value = ''
    detail.value = null
    handlers.value = []
    form.ownerUid = ''
    form.note = ''
    writeBusy.value = false
    writeError.value = ''
    writeNotice.value = ''
    if (!uid) return
    void loadHandlers()
    void loadOwners()
  },
  { immediate: true },
)
</script>

<template>
  <section class="workspace full-page" data-testid="owners-view">
    <header class="page-heading">
      <div>
        <p class="eyebrow">第10站 · 责任、审计与接入</p>
        <h1>换负责人，不改旧事件</h1>
        <p class="muted">
          责任记录有自己的 version，与事件版本互相独立。改责任人不批量改写已存在的事件处理人；
          新事件在创建时才读取当时的责任人。保存必须带 expectedVersion，409 只回读并保留输入，不自动重放。
        </p>
      </div>
      <button type="button" class="button subtle" :disabled="listBusy" @click="refreshAll">
        {{ listBusy ? '正在读取…' : '重新读取' }}
      </button>
    </header>

    <SourceBanner :business="true" />

    <div v-if="!store.user" class="notice" role="status">
      <strong>需要已确认的身份</strong>
      <p>读取责任人需要校园身份；修改责任人仅 ADMIN，且由服务端最终判定。请先用顶部登录。</p>
    </div>

    <section class="panel">
      <div class="section-heading">
        <h2>责任归属规则</h2>
        <span>责任版本与事件版本分开计数</span>
      </div>
      <ul class="owner-rules">
        <li><strong>旧事件不追改</strong>：A→B 之后，A 名下已存在的事件仍记 A，A 仍可按原权限办理，不会自动改派给 B。</li>
        <li><strong>新事件跟当时责任人</strong>：只在创建事件时读取当前责任人；B 无有效处理资格时保持待分派，不回头找 A。</li>
        <li><strong>同时修改</strong>：两人带同一 expectedVersion 提交，后者得到 409；须回读最新 version 后人工重判，不覆盖前一次成功结果。</li>
      </ul>
    </section>

    <div class="case-layout">
      <section class="panel">
        <div class="section-heading">
          <h2>设备责任清单</h2>
          <span>共 {{ owners.length }} 台 · 显示 {{ filtered.length }} 台</span>
        </div>
        <div class="query-bar compact">
          <label for="owner-keyword">
            <span>按设备名称或 ID 过滤</span>
            <input id="owner-keyword" v-model="keyword" type="search" placeholder="例如 device 或 空调" />
          </label>
        </div>
        <p class="tiny muted">
          清单由 GET /api/campus/device-owners 读取，按 deviceId 排序；责任人不含名称时只显示 uid。
          <template v-if="observedAt !== null">读取时间 {{ timeText(observedAt) }}。</template>
        </p>
        <ReadStatus :busy="listBusy" :error="listError" :has-data="hasList" />
        <div v-if="hasList && filtered.length === 0" class="notice" role="status">
          <strong>当前筛选下 0 台设备</strong>
          <p>这是读取成功后的空结果，与读取失败不同；可清空关键词重新查看。</p>
        </div>
        <div v-if="filtered.length > 0" class="case-list">
          <button
            v-for="item in filtered"
            :key="item.deviceId"
            type="button"
            class="case-row"
            :class="{ selected: item.deviceId === selectedId }"
            :aria-current="item.deviceId === selectedId ? 'true' : undefined"
            @click="selectDevice(item.deviceId)"
          >
            <span class="case-row-head">
              <strong>{{ deviceLabel(item.deviceId) }}</strong>
              <span class="state-badge">{{ item.ownerName ?? '未指定' }}</span>
            </span>
            <span>
              责任人：{{ item.ownerName ?? item.ownerUid ?? '未指定' }}
              <template v-if="item.ownerUid"> · <code>{{ item.ownerUid }}</code></template>
            </span>
            <small>责任 version {{ item.version }} · 更新 {{ timeText(item.updatedAt) }}</small>
            <code>{{ item.deviceId }}</code>
          </button>
        </div>
      </section>

      <div>
        <p v-if="!detail && detailBusy" class="muted" role="status">正在读取责任详情…</p>
        <div v-else-if="!detail && detailError" class="notice error" role="alert">
          <strong>责任详情读取失败</strong>
          <p>{{ detailError }}</p>
        </div>
        <div v-else-if="!detail" class="notice" role="status">
          <strong>尚未选择设备</strong>
          <p>在左侧清单点一台设备，读取当前责任人与责任时间线；清单和详情是两次独立读取。</p>
        </div>

        <section v-if="detail" class="panel" data-testid="owner-detail">
          <div class="section-heading">
            <h2>责任详情</h2>
            <span>责任 version {{ detail.version }} · 与事件 version 独立</span>
          </div>
          <ReadStatus :busy="detailBusy" :error="detailError" :has-data="true" />
          <p v-if="!selectedInList" class="tiny muted">
            该设备已不在当前清单中，以下内容以本次回读的服务端记录为准。
          </p>
          <dl class="detail-grid">
            <div>
              <dt>设备</dt>
              <dd>{{ deviceLabel(detail.deviceId) }}</dd>
            </div>
            <div>
              <dt>当前责任人</dt>
              <dd>
                {{ detail.ownerName ?? '未指定' }}
                <template v-if="detail.ownerUid"> · <code>{{ detail.ownerUid }}</code></template>
              </dd>
            </div>
            <div>
              <dt>责任版本</dt>
              <dd>version {{ detail.version }}</dd>
            </div>
            <div>
              <dt>最近更新</dt>
              <dd>{{ timeText(detail.updatedAt) }}</dd>
            </div>
            <div>
              <dt>当前身份</dt>
              <dd>{{ store.user?.displayName ?? '未登录' }} · <code>{{ store.user?.uid ?? '—' }}</code></dd>
            </div>
            <div>
              <dt>保存能力</dt>
              <dd>{{ canAdmin ? 'ADMIN（页面入口可见）' : '不显示入口，服务端最终判定' }}</dd>
            </div>
          </dl>

          <div class="timeline-heading">
            <h3>责任时间线</h3>
            <span class="tiny muted">每条记录带责任 version；时间取服务端操作时间，不使用浏览器时钟。</span>
          </div>
          <p v-if="detail.timeline.length === 0" class="tiny muted">尚无责任变更记录。</p>
          <ol v-else class="timeline">
            <li v-for="item in detail.timeline" :key="item.id">
              <div>
                <strong>{{ item.previousOwnerUid ?? '未指定' }} → {{ item.ownerUid }}</strong>
                <span>{{ item.actorName }}（{{ item.actorUid }}） · {{ timeText(item.createdAt) }} · v{{ item.version }}</span>
              </div>
              <p v-if="item.note">{{ item.note }}</p>
            </li>
          </ol>

          <div v-if="writeError" class="notice error" role="alert">
            <strong>本次保存未确认成功</strong>
            <p>{{ writeError }}</p>
          </div>
          <div v-if="writeNotice" class="notice" role="status">
            <strong>服务端已确认（已独立回读）</strong>
            <p>{{ writeNotice }}</p>
          </div>

          <div class="action-panel">
            <h3>变更责任人</h3>
            <p class="tiny muted">
              仅 ADMIN 可保存；请求携带点击时的 expectedVersion={{ detail.version }}，成功后责任 version 加 1，
              旧事件的处理人保持不变。能力：{{ canAdmin ? '允许' : '不据此授权' }}。
            </p>
            <ReadStatus :busy="handlersBusy" :error="handlersError" :has-data="handlers.length > 0" />
            <label for="owner-person">
              新责任人
              <select
                id="owner-person"
                v-model="form.ownerUid"
                :disabled="!canAdmin || writeBusy"
              >
                <option value="">请选择处理人</option>
                <option v-for="handler in handlers" :key="handler.uid" :value="handler.uid">
                  {{ handler.displayName }}（{{ handler.uid }}）
                </option>
              </select>
            </label>
            <p v-if="currentOwnerNotEligible" class="tiny muted">
              当前责任人不在可选处理人列表里，说明已无有效处理资格；这种状态下新建事件不会自动指派，也不会回退给旧责任人。
            </p>
            <label for="owner-note">
              变更说明（1..500 字）
              <textarea
                id="owner-note"
                v-model="form.note"
                rows="3"
                maxlength="500"
                :disabled="!canAdmin || writeBusy"
              />
            </label>
            <div class="action-buttons">
              <button
                type="button"
                class="button primary"
                :disabled="!canAdmin || writeBusy"
                @click="submitChange"
              >
                {{ writeBusy ? '正在保存…' : `保存责任人（expectedVersion=${detail.version}）` }}
              </button>
            </div>
            <p class="tiny muted">
              保存成功后独立回读确认；409 只回读最新记录并保留本次输入，不自动重放。保存失败不会显示为成功。
            </p>
          </div>

          <p class="tiny muted">
            审计与接入状态在各自页面只读查看；本页不提供远端控制或外部通知入口，也不伪造真实 AIRIOT 成功。
          </p>
        </section>
      </div>
    </div>
  </section>
</template>

<style scoped>
.owner-rules {
  margin: 0;
  padding-left: 20px;
  font-size: 0.82rem;
  line-height: 1.9;
  color: var(--ink);
}
.owner-rules strong {
  font-weight: 600;
}
.timeline-heading h3,
.action-panel h3 {
  font-size: 0.95rem;
  margin: 0 0 6px;
}
</style>
