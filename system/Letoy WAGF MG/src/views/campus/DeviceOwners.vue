<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { getAlarmHandlers, getDeviceOwner, getDeviceOwners, getOverview, saveDeviceOwner } from '@/api/campus'
import type { DeviceCategory, DeviceOwner } from '@/types/campus'
import { useResource } from '@/composables/useResource'
import { useCampusStore } from '@/store/campus'
import { categoryLabels, timeLabel } from '@/utils/campus'
import { isConflict, operationError } from '@/utils/operations'
import ResourceState from '@/components/campus/ResourceState.vue'
import KpiCard from '@/components/viz/KpiCard.vue'
import LivePulse from '@/components/viz/LivePulse.vue'

defineOptions({ name: 'CampusDeviceOwners' })
const campus = useCampusStore()
const overview = useResource(getOverview, 30000)
const owners = useResource(getDeviceOwners, 30000)
const handlers = useResource(getAlarmHandlers)
const query = ref('')
const assignment = ref('')
const ownerUidFilter = ref('')
const categoryIcons: Record<DeviceCategory, string> = { environment: 'ri-leaf-line', energy: 'ri-flashlight-line', facility: 'ri-building-2-line', lighting: 'ri-lightbulb-line' }
const rows = computed(() => (overview.data.value?.devices || []).map(device => ({ device, owner: owners.data.value?.items.find(item => item.deviceId === device.id) })))
const assigned = computed(() => rows.value.filter(row => !!row.owner?.ownerUid).length)
const unassigned = computed(() => rows.value.filter(row => row.owner && !row.owner.ownerUid).length)
const missing = computed(() => rows.value.filter(row => !row.owner).length)
const filtered = computed(() => {
  const text = query.value.trim().toLocaleLowerCase()
  return rows.value.filter(({ device, owner }) => (!text || `${device.name} ${device.id} ${device.spaceName || ''} ${owner?.ownerName || ''}`.toLocaleLowerCase().includes(text)) && (!assignment.value || (assignment.value === 'assigned' ? !!owner?.ownerUid : assignment.value === 'unassigned' ? !!owner && !owner.ownerUid : !owner)) && (!ownerUidFilter.value || owner?.ownerUid === ownerUidFilter.value))
})
const selectedDeviceId = ref('')
const selectedDevice = computed(() => overview.data.value?.devices.find(device => device.id === selectedDeviceId.value))
const editorRecord = ref<DeviceOwner | null>(null)
const ownerUid = ref('')
const note = ref('')
const editorLoading = ref(false)
const saving = ref(false)
const writeError = ref('')
const success = ref('')
const editor = ref<HTMLElement | null>(null)
const locked = computed(() => saving.value || editorLoading.value || !editorRecord.value || !!overview.error.value || !!owners.error.value || campus.capabilities?.canAdmin !== true)
const refresh = () => { if (saving.value) return; void overview.load(); void owners.load(); void handlers.load() }
const edit = async (deviceId: string) => {
  if (saving.value || editorLoading.value || campus.capabilities?.canAdmin !== true || overview.error.value || owners.error.value) return
  const keepInput = selectedDeviceId.value === deviceId
  selectedDeviceId.value = deviceId; editorRecord.value = null; writeError.value = ''; success.value = ''; editorLoading.value = true
  try { const value = await getDeviceOwner(deviceId); editorRecord.value = value; if (!keepInput) { ownerUid.value = value.ownerUid || ''; note.value = '' } }
  catch (error) { writeError.value = operationError(error) }
  finally { editorLoading.value = false; await nextTick(); editor.value?.scrollIntoView({ block: 'start', behavior: 'instant' }) }
}
const save = async () => {
  if (locked.value || !editorRecord.value || !ownerUid.value || !note.value.trim()) return
  const previous = editorRecord.value
  const uid = ownerUid.value
  saving.value = true; writeError.value = ''; success.value = ''
  try {
    const submitted = await saveDeviceOwner(previous.deviceId, uid, note.value.trim(), previous.version)
    const confirmed = await getDeviceOwner(previous.deviceId)
    if (confirmed.deviceId === previous.deviceId) editorRecord.value = confirmed
    if (submitted.version <= previous.version || confirmed.version < submitted.version || confirmed.deviceId !== previous.deviceId || confirmed.ownerUid !== uid) throw new Error('责任记录已提交，但回读未确认。请刷新核对后继续。')
    editorRecord.value = confirmed
    note.value = ''
    success.value = `设备责任人已保存并回读，当前版本 ${confirmed.version}。`
    await owners.load()
  } catch (error) {
    if (isConflict(error)) {
      try { editorRecord.value = await getDeviceOwner(previous.deviceId); writeError.value = '责任记录已被其他操作更新，已重新读取最新版本。输入已保留，请核对当前负责人后再次提交。' }
      catch { editorRecord.value = null; writeError.value = '责任记录已被其他操作更新，最新状态读取失败。输入已保留，请刷新后核对。' }
    } else { writeError.value = operationError(error) }
  } finally { saving.value = false }
}
const handlerName = (uid: string | null) => handlers.data.value?.items.find(item => item.uid === uid)?.displayName || uid || '未登记'
const initial = (name: string | null | undefined) => (name || '').trim().charAt(0) || '?'
const hue = (seed: string) => [...seed].reduce((sum, c) => sum + c.charCodeAt(0), 0) % 360
const workload = computed(() => {
  const map = new Map<string, { uid: string; name: string; count: number }>()
  for (const row of rows.value) {
    const uid = row.owner?.ownerUid
    if (!uid) continue
    const entry = map.get(uid) ?? { uid, name: row.owner?.ownerName || handlerName(uid), count: 0 }
    entry.count++
    map.set(uid, entry)
  }
  return [...map.values()].sort((a, b) => b.count - a.count)
})
const maxLoad = computed(() => Math.max(1, ...workload.value.map(item => item.count)))
const filterOwner = (uid: string) => { ownerUidFilter.value = ownerUidFilter.value === uid ? '' : uid }
</script>

<template>
  <div class="campus-page device-owners-page">
    <header class="campus-page-head"><div><p class="campus-eyebrow">校园资产 · 责任登记</p><h1>设备<span class="gradient-text">责任人</span></h1><p>把设备与可处理事件的账户关联，明确日常巡查责任。事件分派保留独立记录。</p></div><div class="campus-page-actions"><LivePulse :loading="owners.loading.value" :error="owners.error.value" :last-success="owners.lastSuccess.value" :next-at="owners.nextRefreshAt.value" :interval="30000" label="BE" /><button class="campus-button secondary" :class="{ 'is-loading': overview.loading.value || owners.loading.value }" :disabled="saving || overview.loading.value || owners.loading.value" @click="refresh"><i class="ri-refresh-line" aria-hidden="true"></i>刷新</button></div></header>
    <p class="campus-source"><i class="ri-database-2-line" aria-hidden="true"></i> 设备：AIRIOT 模拟项目 · 责任记录：BE 本地保存 · 登记由管理员操作</p>
    <ResourceState :loading="overview.loading.value" :error="overview.error.value" :has-data="!!overview.data.value" :last-success="overview.lastSuccess.value" @retry="overview.load" />
    <ResourceState :loading="owners.loading.value" :error="owners.error.value" :has-data="!!owners.data.value" :last-success="owners.lastSuccess.value" compact @retry="owners.load" />
    <ResourceState :loading="handlers.loading.value" :error="handlers.error.value" :has-data="!!handlers.data.value" :last-success="handlers.lastSuccess.value" compact @retry="handlers.load" />
    <template v-if="overview.data.value && owners.data.value">
      <div class="campus-kpi-grid">
        <KpiCard :index="0" label="当前读取设备" icon="ri-cpu-line" tone="blue" :value="rows.length" unit="台" hint="来自 AIRIOT 模拟项目" />
        <KpiCard :index="1" label="已登记责任人" icon="ri-user-star-line" tone="emerald" :value="assigned" unit="台" :ratio="rows.length ? assigned / rows.length : null" ratio-label="责任登记覆盖率" hint="责任覆盖率" />
        <KpiCard :index="2" label="尚未登记" icon="ri-user-unfollow-line" tone="amber" :value="unassigned" unit="台" :hint="unassigned ? '需要管理员登记' : '全部已登记'" :warn="unassigned > 0" />
        <KpiCard :index="3" label="责任记录未读取" icon="ri-question-line" tone="rose" :value="missing" unit="台" :hint="missing ? '刷新后核对' : '记录完整'" :warn="missing > 0" />
      </div>
      <section v-if="workload.length" class="campus-panel owner-workload" aria-labelledby="workload-title">
        <div class="campus-panel-head"><div><h2 id="workload-title"><i class="ri-team-line" aria-hidden="true"></i>责任分布</h2><p>按责任人统计当前读取设备，点击筛选台账，再次点击取消。</p></div></div>
        <div class="workload-list">
          <button v-for="item in workload" :key="item.uid" type="button" class="workload-item fx-spotlight" :aria-pressed="ownerUidFilter === item.uid" :style="{ '--h': hue(item.uid), '--w': `${(item.count / maxLoad) * 100}%` }" @click="filterOwner(item.uid)">
            <span class="owner-avatar" aria-hidden="true">{{ initial(item.name) }}</span>
            <span class="workload-copy"><strong>{{ item.name }}</strong><span class="workload-bar" aria-hidden="true"><span></span></span></span>
            <span class="workload-count">{{ item.count }}<small> 台</small></span>
          </button>
        </div>
      </section>
      <section v-if="selectedDeviceId && campus.capabilities?.canAdmin === true" ref="editor" class="owner-editor campus-panel" aria-labelledby="owner-editor-title"><div class="campus-panel-head"><div><h2 id="owner-editor-title"><i class="ri-edit-2-line" aria-hidden="true"></i>登记 {{ selectedDevice?.name || selectedDeviceId }} 的责任人</h2><p>{{ selectedDeviceId }} · {{ selectedDevice?.spaceName || '未关联空间' }}</p></div><button type="button" class="campus-button secondary" :disabled="saving || editorLoading" @click="selectedDeviceId = ''"><i class="ri-close-line" aria-hidden="true"></i>收起</button></div><p v-if="editorLoading" class="campus-muted" role="status">正在读取责任记录…</p><template v-if="editorRecord"><p class="owner-current"><span class="owner-avatar sm" aria-hidden="true">{{ initial(editorRecord.ownerName || handlerName(editorRecord.ownerUid)) }}</span>当前负责人：<strong>{{ editorRecord.ownerName || handlerName(editorRecord.ownerUid) }}</strong><span>版本 {{ editorRecord.version }} · 更新 {{ timeLabel(editorRecord.updatedAt) }}</span></p><form class="owner-form" @submit.prevent="save"><label>责任人<select v-model="ownerUid" required :disabled="locked || !handlers.data.value || !!handlers.error.value"><option value="" disabled>选择已授权的处置账户</option><option v-for="handler in handlers.data.value?.items || []" :key="handler.uid" :value="handler.uid">{{ handler.displayName }}</option></select></label><label>登记说明<textarea v-model="note" required maxlength="500" rows="2" :disabled="locked" placeholder="说明责任分工或调整原因" /></label><button type="submit" class="campus-button" :class="{ 'is-loading': saving }" :disabled="locked || !ownerUid || !note.trim() || !handlers.data.value || !!handlers.error.value"><i :class="saving ? 'ri-loader-4-line' : 'ri-save-3-line'" aria-hidden="true"></i>{{ saving ? '保存并回读中…' : '保存责任登记' }}</button></form><details v-if="editorRecord.timeline?.length" class="owner-history"><summary>责任变更记录（{{ editorRecord.timeline.length }} 条）</summary><ol><li v-for="entry in editorRecord.timeline" :key="entry.id"><strong>{{ entry.actorName || entry.actorUid }}</strong><time>{{ timeLabel(entry.createdAt) }}</time><p>{{ handlerName(entry.previousOwnerUid) }} → {{ handlerName(entry.ownerUid) }} · 版本 {{ entry.version }}</p><p>{{ entry.note }}</p></li></ol></details></template><p v-if="writeError" class="campus-notice error" role="alert">{{ writeError }}</p><p v-if="success" class="campus-notice success" role="status">{{ success }}</p><button v-if="!editorRecord && !editorLoading" type="button" class="campus-button secondary" @click="edit(selectedDeviceId)">重新读取责任记录</button></section>
      <form class="owner-filters campus-panel" @submit.prevent><label class="owner-search">搜索设备、空间或负责人<span class="owner-search-box"><i class="ri-search-2-line" aria-hidden="true"></i><input v-model="query" type="search" placeholder="输入名称或设备 ID" /></span></label><label>登记状态<select v-model="assignment"><option value="">全部状态</option><option value="assigned">已登记</option><option value="unassigned">尚未登记</option><option value="missing">未读取记录</option></select></label><label>责任人<select v-model="ownerUidFilter" :disabled="!handlers.data.value || !!handlers.error.value"><option value="">全部责任人</option><option v-for="handler in handlers.data.value?.items || []" :key="handler.uid" :value="handler.uid">{{ handler.displayName }}</option></select></label><button type="button" class="campus-button secondary" :disabled="!query && !assignment && !ownerUidFilter" @click="query = ''; assignment = ''; ownerUidFilter = ''"><i class="ri-filter-off-line" aria-hidden="true"></i>清空</button></form>
      <div class="owner-results-head"><h2>责任台账 <span>{{ filtered.length }} / {{ rows.length }} 台</span></h2><router-link to="/campus/operations">演示运营 <i class="ri-arrow-right-line" aria-hidden="true"></i></router-link></div>
      <p class="campus-source">设备读取 {{ timeLabel(overview.data.value.observedAt) }} · 责任记录读取 {{ timeLabel(owners.data.value.observedAt) }}</p>
      <div v-if="filtered.length" class="owner-list fx-stagger"><article v-for="row in filtered" :key="row.device.id" class="owner-row" :class="[`category-${row.device.category}`, { selected: selectedDeviceId === row.device.id }]"><span class="owner-device-icon" aria-hidden="true"><i :class="categoryIcons[row.device.category]"></i></span><div class="owner-device"><router-link :to="`/campus/devices/${encodeURIComponent(row.device.id)}`">{{ row.device.name }}</router-link><small>{{ categoryLabels[row.device.category] }} · {{ row.device.spaceName || '未关联空间' }} · {{ row.device.id }}</small></div><div class="owner-assignee" :class="{ empty: !row.owner?.ownerUid }"><span class="owner-avatar sm" :style="row.owner?.ownerUid ? { '--h': hue(row.owner.ownerUid) } : undefined" aria-hidden="true">{{ row.owner?.ownerUid ? initial(row.owner.ownerName || handlerName(row.owner.ownerUid)) : '–' }}</span><div><strong>{{ row.owner ? row.owner.ownerName || handlerName(row.owner.ownerUid) : '责任记录未读取' }}</strong><small>{{ row.owner?.updatedAt ? `更新 ${timeLabel(row.owner.updatedAt)}` : row.owner ? '尚无责任登记时间' : '刷新后核对' }}</small></div></div><button v-if="campus.capabilities?.canAdmin === true" type="button" class="campus-link-button" :disabled="saving || editorLoading || !!overview.error.value || !!owners.error.value" :aria-label="`登记${row.device.name}的责任人`" @click="edit(row.device.id)">{{ row.owner?.ownerUid ? '调整责任人' : '登记责任人' }}</button><span v-else class="owner-readonly">只读</span></article></div>
      <p v-else class="campus-empty">当前条件未返回设备。可清空筛选，或刷新核对设备接入。</p>
      <ul v-if="overview.data.value.issues.length" class="campus-notice warning"><li v-for="(issue, index) in overview.data.value.issues" :key="index">{{ issue.message }}</li></ul>
    </template>
  </div>
</template>

<style scoped>
.category-environment{--c:var(--viz-environment)}.category-energy{--c:var(--viz-energy)}.category-facility{--c:var(--viz-facility)}.category-lighting{--c:var(--viz-lighting)}
.owner-avatar{--h:220;width:38px;height:38px;border-radius:13px;flex-shrink:0;display:grid;place-items:center;font-weight:700;font-size:15px;color:#fff;background:linear-gradient(135deg,hsl(var(--h) 85% 62%),hsl(calc(var(--h) + 40) 80% 52%));box-shadow:0 8px 18px -10px hsl(var(--h) 80% 50%)}
.owner-avatar.sm{width:30px;height:30px;border-radius:10px;font-size:13px}
.owner-workload{margin-bottom:20px}
.workload-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px}
.workload-item{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:16px;text-align:left;cursor:pointer;color:var(--text-main);background:var(--surface-inset);border:1.5px solid var(--border-base);transition:all .22s}
@media(hover:hover){.workload-item:hover{transform:translateY(-2px);border-color:color-mix(in srgb,var(--brand-2) 40%,transparent)}}
.workload-item[aria-pressed="true"]{border-color:var(--brand-2);background:color-mix(in srgb,var(--brand-2) 9%,var(--surface-raised));box-shadow:0 0 0 4px color-mix(in srgb,var(--brand-2) 12%,transparent)}
.workload-copy{flex:1;min-width:0;display:flex;flex-direction:column;gap:7px}
.workload-copy strong{font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.workload-bar{height:6px;border-radius:6px;background:var(--ring-track);overflow:hidden}
.workload-bar span{display:block;height:100%;width:var(--w);border-radius:inherit;background:linear-gradient(90deg,hsl(var(--h) 85% 62%),hsl(calc(var(--h) + 40) 80% 52%));animation:bar-grow 1s cubic-bezier(.22,.8,.24,1) both}
@keyframes bar-grow{from{width:0}}
.workload-count{font-size:22px;font-weight:750;font-family:var(--font-number);white-space:nowrap}
.workload-count small{font-size:12px;font-weight:500;color:var(--text-tertiary);font-family:var(--font-family)}
.owner-editor{margin:0 0 20px;scroll-margin-top:20px;border-color:color-mix(in srgb,var(--brand-2) 35%,transparent);box-shadow:var(--shadow-hover)}
.owner-current{display:flex;gap:8px 12px;align-items:center;flex-wrap:wrap;font-size:13px;margin-bottom:16px}
.owner-current>span:last-child{color:var(--text-tertiary);font-size:12px}
.owner-form{display:grid;grid-template-columns:minmax(180px,.8fr) minmax(240px,1.2fr) auto;gap:14px;align-items:end}
.owner-form label{display:flex;flex-direction:column;gap:8px;font-size:12.5px;font-weight:600;color:var(--text-secondary)}
.owner-history{margin-top:18px;border-top:1px solid var(--border-base);padding-top:12px;font-size:12.5px;color:var(--text-secondary)}
.owner-history summary{min-height:32px;cursor:pointer;display:list-item;font-weight:600}
.owner-history ol{margin-top:8px;max-height:280px;overflow:auto}
.owner-history li{padding:12px 0;border-bottom:1px solid var(--border-base);line-height:1.7}
.owner-history strong{font-weight:600;color:var(--text-main)}
.owner-history time{margin-left:14px;font-size:11.5px;font-variant-numeric:tabular-nums}
.owner-history p{margin-top:4px;white-space:pre-wrap}
.owner-filters{display:grid;grid-template-columns:minmax(220px,1.4fr) minmax(130px,.7fr) minmax(150px,.8fr) auto;gap:14px;align-items:end;margin:0 0 20px;padding:16px 18px}
.owner-filters label{display:flex;flex-direction:column;gap:8px;font-size:12.5px;font-weight:600;color:var(--text-secondary)}
.owner-search-box{position:relative;display:block}
.owner-search-box i{position:absolute;left:13px;top:50%;transform:translateY(-50%);color:var(--text-tertiary)}
.owner-search-box input{padding-left:38px!important}
.owner-results-head{display:flex;justify-content:space-between;gap:16px;align-items:center}
.owner-results-head h2{font-size:19px;font-weight:650}
.owner-results-head h2 span{font-size:13px;color:var(--text-tertiary);margin-left:8px;font-weight:500}
.owner-results-head a{display:inline-flex;align-items:center;gap:4px;min-height:44px;font-size:12.5px;font-weight:600}
.owner-list{display:flex;flex-direction:column;gap:8px}
.owner-row{position:relative;display:flex;gap:16px;align-items:center;padding:14px 18px;border-radius:16px;background:var(--surface-1);border:1px solid var(--border-base);box-shadow:var(--shadow-card);transition:transform .22s,border-color .22s,box-shadow .22s}
@media(hover:hover){.owner-row:hover{transform:translateX(3px);border-color:color-mix(in srgb,var(--c) 40%,transparent)}}
.owner-row.selected{border-color:var(--brand-2);box-shadow:0 0 0 3px color-mix(in srgb,var(--brand-2) 14%,transparent)}
.owner-device-icon{width:38px;height:38px;border-radius:12px;display:grid;place-items:center;font-size:18px;flex-shrink:0;color:var(--c);background:color-mix(in srgb,var(--c) 14%,transparent)}
.owner-device{flex:1;min-width:0}
.owner-device>a{font-size:14.5px;font-weight:650;display:inline-flex;align-items:center;min-height:30px;color:var(--text-main)}
.owner-device>a:hover{color:var(--brand-2)}
.owner-row small{display:block;color:var(--text-tertiary);font-size:11.5px;line-height:1.6;margin-top:2px}
.owner-assignee{width:240px;min-width:0;display:flex;align-items:center;gap:10px}
.owner-assignee>div{min-width:0}
.owner-assignee strong{font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block}
.owner-assignee.empty .owner-avatar{background:var(--surface-inset);color:var(--text-tertiary);box-shadow:inset 0 0 0 1px var(--border-strong)}
.owner-assignee.empty strong{color:var(--warn-text)}
.owner-row .campus-link-button{font-size:12.5px;min-width:84px;text-align:right}
.owner-readonly{min-width:50px;font-size:11.5px;color:var(--text-tertiary)}
@media(max-width:1050px){.owner-form{grid-template-columns:1fr 1.4fr}.owner-form>.campus-button{grid-column:1/-1;justify-self:start}.owner-filters{grid-template-columns:repeat(3,minmax(0,1fr))}.owner-search{grid-column:span 2}.owner-assignee{width:200px}}
@media(max-width:768px){.owner-form{grid-template-columns:1fr}.owner-form>.campus-button{justify-self:stretch}.owner-history summary{min-height:44px}.owner-filters{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.owner-search{grid-column:1/-1}.owner-filters>.campus-button{grid-column:1/-1}.owner-results-head{gap:8px;flex-wrap:wrap}.owner-row{flex-wrap:wrap;gap:12px;padding:14px}.owner-device{flex-basis:calc(100% - 52px)}.owner-device>a{min-height:44px}.owner-assignee{flex:1;width:auto}.owner-row .campus-link-button{min-width:90px}.owner-readonly{text-align:right}.owner-current{line-height:1.7}.owner-history time{display:block;margin-left:0;margin-top:4px}}
</style>
