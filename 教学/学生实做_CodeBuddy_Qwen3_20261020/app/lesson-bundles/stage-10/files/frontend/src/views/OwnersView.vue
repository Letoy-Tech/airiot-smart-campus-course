<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useCampusStore } from '../stores/campus'
import { useRequestScope } from '../composables/useRequestScope'
import { getOwners, getOwner, getHandlers, saveOwner } from '../api/full'
import type { Owner, OwnerDetail, Handler } from '../types/full'
import { ApiError } from '../api/http'
import { timeText } from '../domain/course'
import SourceBanner from '../components/SourceBanner.vue'
import ReadStatus from '../components/ReadStatus.vue'
const store = useCampusStore(),
  listScope = useRequestScope(),
  detailScope = useRequestScope(),
  write = useRequestScope()
const owners = ref<Owner[] | null>(null),
  detail = ref<OwnerDetail | null>(null),
  handlers = ref<Handler[]>([]),
  deviceId = ref(''),
  ownerUid = ref(''),
  note = ref(''),
  notice = ref(''),
  conflict = ref(false),
  latestReady = ref(false),
  readDenied = ref(false)
function clearDeniedResources() {
  readDenied.value = true
  listScope.cancel()
  detailScope.cancel()
  write.cancel()
  owners.value = null
  detail.value = null
  handlers.value = []
  deviceId.value = ''
  ownerUid.value = ''
  note.value = ''
  notice.value = ''
  conflict.value = false
  latestReady.value = false
  write.error.value = ''
}
function refresh() {
  if (readDenied.value) return Promise.resolve(false)
  return listScope.run(
    async (signal) => ({ owners: await getOwners(signal), handlers: await getHandlers(signal) }),
    (value) => {
      owners.value = value.owners.items
      handlers.value = value.handlers.items
    },
    (error) => {
      if (error instanceof ApiError && error.status === 403) clearDeniedResources()
    },
  )
}
function readDetail() {
  if (!deviceId.value || readDenied.value) return Promise.resolve(false)
  const selected = deviceId.value
  return detailScope.run(
    (signal) => getOwner(selected, signal),
    (value) => {
      detail.value = value
      if (conflict.value) latestReady.value = true
    },
    (error) => {
      if (error instanceof ApiError && error.status === 403) clearDeniedResources()
    },
  )
}
function select(id: string) {
  if (write.busy.value) return
  detailScope.cancel()
  deviceId.value = id
  detail.value = null
  ownerUid.value = ''
  note.value = ''
  notice.value = ''
  conflict.value = false
  latestReady.value = false
  write.error.value = ''
  void readDetail()
}
async function save() {
  if (
    readDenied.value || !detail.value ||
    !ownerUid.value ||
    !note.value.trim() ||
    write.busy.value ||
    detailScope.busy.value ||
    conflict.value ||
    store.capabilities?.canAdmin !== true
  )
    return
  const original = detail.value
  notice.value = ''
  await write.run(
    (signal) =>
      saveOwner(
        original.deviceId,
        ownerUid.value,
        note.value.trim(),
        original.version,
        store.csrf,
        signal,
      ),
    (value) => {
      detail.value = value
      note.value = ''
      notice.value = '责任登记已确认；已有事件的分派保持不变。'
      void refresh()
    },
    (error) => {
      if (error instanceof ApiError && error.status === 409) {
        conflict.value = true
        latestReady.value = false
        void readDetail()
      }
    },
  )
}
function acknowledge() {
  if (!latestReady.value) return
  conflict.value = false
  latestReady.value = false
  write.error.value = ''
}
onMounted(() => {
  void store.refreshDevices()
  void refresh()
})
</script>
<template>
  <section class="workspace full-page" data-testid="owners-page">
    <header class="page-heading">
      <div>
        <p class="eyebrow">10 / 设备责任与审计</p>
        <h1>责任登记</h1>
        <p class="muted">责任变更影响今后新事件，旧事件保留当时的分派。</p>
      </div>
      <button class="button subtle" :disabled="listScope.busy.value" @click="refresh">
        刷新登记
      </button>
    </header>
    <p v-if="readDenied" class="notice error" role="alert" data-testid="owner-read-denied">读取权限已变化，责任记录与操作入口已清除。请重新登录核对身份；不会自动重发请求。</p>
    <SourceBanner business /><ReadStatus
      :busy="listScope.busy.value"
      :error="listScope.error.value"
      :has-data="owners !== null"
    />
    <div class="case-layout">
      <div class="panel case-list">
        <h2>设备责任台账</h2>
        <button
          v-for="owner in owners"
          :key="owner.deviceId"
          class="case-row"
          :class="{ selected: deviceId === owner.deviceId }"
          :disabled="write.busy.value"
          :data-testid="`owner-${owner.deviceId}`"
          @click="select(owner.deviceId)"
        >
          <strong>{{
            store.devices.find((d) => d.id === owner.deviceId)?.name ?? owner.deviceId
          }}</strong
          ><span>{{ owner.ownerName ?? '未登记责任人' }} · v{{ owner.version }}</span
          ><code>{{ owner.deviceId }}</code>
        </button>
      </div>
      <div class="panel">
        <ReadStatus
          :busy="detailScope.busy.value"
          :error="detailScope.error.value"
          :has-data="!!detail"
        />
        <p v-if="!deviceId" class="empty-state">选择设备，查看责任人与变更记录。</p>
        <template v-if="detail"
          ><div class="section-heading">
            <h2>
              {{ store.devices.find((d) => d.id === detail?.deviceId)?.name ?? detail.deviceId }}
            </h2>
            <span class="state-badge" data-testid="owner-version">v{{ detail.version }}</span>
          </div>
          <p>
            当前责任人：<strong>{{ detail.ownerName ?? '未登记' }}</strong>
          </p>
          <p class="muted tiny">最后更新：{{ timeText(detail.updatedAt) }}</p>
          <p v-if="write.error.value" role="alert" class="notice error">{{ write.error.value }}</p>
          <div v-if="conflict" class="notice warning" data-testid="owner-conflict">
            <strong>409：责任记录已变化，原输入已保留。</strong>
            <p>
              {{
                latestReady
                  ? '最新责任与时间线已回读，请重新判断。'
                  : '正在回读；失败可重试，不自动重放原变更。'
              }}
            </p>
            <button
              v-if="latestReady"
              class="button subtle"
              @click="acknowledge"
            >
              已核对最新责任</button
            ><button
              v-else
              class="button subtle"
              :disabled="detailScope.busy.value"
              @click="readDetail"
            >
              重试回读
            </button>
          </div>
          <p v-if="notice" role="status" class="notice">{{ notice }}</p>
          <form
            v-if="store.capabilities?.canAdmin === true"
            class="action-panel"
            @submit.prevent="save"
          >
            <h3>登记新的责任人</h3>
            <label
              >责任人<select v-model="ownerUid" required data-testid="owner-assignee">
                <option value="">请选择</option>
                <option v-for="handler in handlers" :key="handler.uid" :value="handler.uid">
                  {{ handler.displayName }}（{{ handler.uid }}）
                </option>
              </select></label
            ><label
              >变更理由<textarea
                v-model="note"
                rows="3"
                maxlength="500"
                required
                data-testid="owner-note"
              ></textarea></label
            ><button
              class="button primary"
              :disabled="write.busy.value || detailScope.busy.value || conflict"
              data-testid="save-owner"
            >
              提交责任变更
            </button>
          </form>
          <p v-else class="notice">当前身份仅查看责任与审计记录。</p>
          <h3 class="timeline-heading">责任变更时间线</h3>
          <ol class="timeline">
            <li v-for="item in detail.timeline" :key="item.id">
              <div>
                <strong>{{ item.previousOwnerUid ?? '未登记' }} → {{ item.ownerUid }}</strong
                ><span>v{{ item.version }}</span>
              </div>
              <p>{{ item.note }}</p>
              <small
                >{{ item.actorName }}（{{ item.actorUid }}） · {{ timeText(item.createdAt) }}</small
              >
            </li>
          </ol>
          <p v-if="!detail.timeline.length" class="muted tiny">尚无责任变更记录。</p></template
        >
      </div>
    </div>
  </section>
</template>
