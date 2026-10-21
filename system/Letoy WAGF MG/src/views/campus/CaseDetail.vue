<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { addAlarmCaseNote, assignAlarmCase, closeAlarmCase, getAlarmCase, getAlarmHandlers, recoverDemoEvent, startAlarmCase, verifyAlarmCaseRecovery } from '@/api/campus'
import type { AlarmCaseDetail, AlarmCaseState } from '@/types/campus'
import { useResource } from '@/composables/useResource'
import { useCampusStore } from '@/store/campus'
import { caseActionLabels, caseStateLabels, caseStates, isConflict, operationError, sourceStateLabels } from '@/utils/operations'
import { timeLabel } from '@/utils/campus'
import ResourceState from '@/components/campus/ResourceState.vue'
import RingGauge from '@/components/viz/RingGauge.vue'

defineOptions({ name: 'CampusCaseDetail' })
const route = useRoute()
const campus = useCampusStore()
const id = String(route.params.id || '')
const detail = useResource(() => getAlarmCase(id))
const handlers = useResource(getAlarmHandlers)
const item = computed(() => detail.data.value)
const assigneeUid = ref('')
const assignNote = ref('')
const startNote = ref('')
const treatmentNote = ref('')
const disposition = ref('')
const saving = ref(false)
const savingAction = ref('')
const writeError = ref('')
const success = ref('')
let initialized = false
watch(item, value => { if (value && !initialized) { assigneeUid.value = value.assigneeUid || ''; initialized = true } })
const canAssign = computed(() => campus.capabilities?.canAssignAlarms === true && item.value?.state !== 'CLOSED')
const canHandle = computed(() => campus.capabilities?.canHandleAlarms === true && !!item.value && item.value.state !== 'CLOSED' && (campus.capabilities.canAssignAlarms === true || item.value.assigneeUid === handlers.data.value?.currentUid))
const locked = computed(() => saving.value || detail.loading.value || !!detail.error.value || !item.value)
const hasTreatment = computed(() => item.value?.timeline.some(entry => entry.action === 'NOTE') === true)
const isRecovered = computed(() => item.value?.sourceState === 'RECOVERED')
const verified = computed(() => isRecovered.value && !!item.value && item.value.sourceRawStatus === 'DEMO_RECOVERED' && item.value.sourceCheckOutcome === 'PASS' && item.value.sourceVerifiedAt !== null && item.value.sourceRecoveredAt !== null && item.value.sourceVerifiedAt >= item.value.sourceRecoveredAt)
const canClose = computed(() => canHandle.value && item.value?.state === 'IN_PROGRESS' && hasTreatment.value && verified.value)
const currentStep = computed(() => item.value ? caseStates.indexOf(item.value.state) : -1)
const progress = computed(() => (currentStep.value < 0 ? 0 : currentStep.value / (caseStates.length - 1)))
const checks = computed(() => [
  { label: '已开始处理', done: item.value?.state === 'IN_PROGRESS' },
  { label: '已有处置记录', done: hasTreatment.value },
  { label: '模拟来源已恢复', done: isRecovered.value },
  { label: '恢复核实通过', done: verified.value },
])
const checksDone = computed(() => checks.value.filter(check => check.done).length)
const stateName = (value: string | null) => value && value in caseStateLabels ? caseStateLabels[value as AlarmCaseState] : value || '未提供'
const actionName = (value: string) => caseActionLabels[value] || value
const stepIcons: Record<string, string> = { NEW: 'ri-inbox-unarchive-line', ASSIGNED: 'ri-user-shared-line', IN_PROGRESS: 'ri-tools-line', CLOSED: 'ri-checkbox-circle-line' }
const actionIcons: Record<string, string> = { DEMO_TRIGGER: 'ri-flashlight-line', ASSIGN: 'ri-user-shared-line', START: 'ri-play-line', NOTE: 'ri-edit-2-line', DEMO_RECOVER: 'ri-restart-line', VERIFY_RECOVERY: 'ri-shield-check-line', CLOSE: 'ri-lock-line' }

const mutate = async (action: string, operation: (value: AlarmCaseDetail) => Promise<AlarmCaseDetail>, confirmed: (value: AlarmCaseDetail) => boolean, clear?: () => void) => {
  if (locked.value || !item.value) return
  const before = item.value
  saving.value = true; savingAction.value = action; writeError.value = ''; success.value = ''
  try {
    const submitted = await operation(before)
    await detail.load()
    const readback = item.value
    if (detail.error.value || !readback || readback.id !== before.id || submitted.version <= before.version || readback.version < submitted.version || !confirmed(readback)) throw new Error('操作已提交，但最新状态回读未确认。请刷新核对时间线后继续。')
    clear?.()
    success.value = `${action}已保存并回读，当前版本 ${readback.version}。`
  } catch (error) {
    if (isConflict(error)) {
      await detail.load()
      writeError.value = detail.error.value ? '事件已被其他操作更新，最新状态读取失败。输入已保留，请先刷新核对。' : '事件已被其他操作更新，已重新读取最新版本。输入已保留，请核对状态后再次提交。'
    } else { writeError.value = operationError(error) }
  } finally { saving.value = false; savingAction.value = '' }
}
const assign = () => { if (!canAssign.value || !assigneeUid.value || !assignNote.value.trim()) return; const uid = assigneeUid.value; void mutate('分派负责人', value => assignAlarmCase(value.id, uid, assignNote.value.trim(), value.version), value => value.assigneeUid === uid && value.state === 'ASSIGNED', () => { assignNote.value = '' }) }
const start = () => { if (!canHandle.value || item.value?.state !== 'ASSIGNED' || !startNote.value.trim()) return; void mutate('开始处理', value => startAlarmCase(value.id, startNote.value.trim(), value.version), value => value.state === 'IN_PROGRESS', () => { startNote.value = '' }) }
const addNote = () => { if (!canHandle.value || item.value?.state !== 'IN_PROGRESS' || !treatmentNote.value.trim()) return; const note = treatmentNote.value.trim(); void mutate('处置记录', value => addAlarmCaseNote(value.id, note, value.version), value => value.timeline.some(entry => entry.action === 'NOTE' && entry.note === note), () => { treatmentNote.value = '' }) }
const recover = () => { if (campus.capabilities?.canRunDemoScenarios !== true || item.value?.state === 'CLOSED' || item.value?.sourceType !== 'DEMO' || isRecovered.value) return; void mutate('模拟来源恢复', value => recoverDemoEvent(value.id, value.version), value => value.sourceState === 'RECOVERED') }
const verify = () => { if (!canHandle.value || item.value?.state !== 'IN_PROGRESS' || !isRecovered.value) return; void mutate('恢复核实', value => verifyAlarmCaseRecovery(value.id, value.version), value => value.sourceCheckOutcome === 'PASS' && value.sourceVerifiedAt !== null && value.sourceState === 'RECOVERED') }
const close = () => { if (!canClose.value || !disposition.value.trim()) return; void mutate('事件关闭', value => closeAlarmCase(value.id, disposition.value.trim(), value.version), value => value.state === 'CLOSED', () => { disposition.value = '' }) }
</script>

<template>
  <div class="campus-page case-detail-page">
    <router-link class="campus-back" to="/campus/operations"><i class="ri-arrow-left-line" aria-hidden="true"></i>演示运营</router-link>
    <header class="campus-page-head case-hero campus-panel" :class="item ? `state-${item.state}` : ''">
      <div>
        <p class="campus-eyebrow">DEMO · 本地演练事件</p>
        <h1>{{ item?.message || '事件详情' }}</h1>
        <p>分派、处置、模拟来源恢复和恢复核实均留下独立记录。</p>
        <div v-if="item" class="case-hero-chips"><span class="case-state" :class="item.state">{{ caseStateLabels[item.state] }}</span><span class="campus-chip">等级 · {{ item.level }}</span><span class="campus-chip">版本 {{ item.version }}</span></div>
      </div>
      <button class="campus-button secondary" :class="{ 'is-loading': detail.loading.value }" :disabled="saving || detail.loading.value" @click="detail.load"><i class="ri-refresh-line" aria-hidden="true"></i>刷新事件</button>
    </header>
    <ResourceState :loading="detail.loading.value" :error="detail.error.value" :has-data="!!item" :last-success="detail.lastSuccess.value" @retry="detail.load" />
    <template v-if="item">
      <div class="case-evidence" role="note"><i class="ri-flask-line" aria-hidden="true"></i><strong>本地演练 · 模拟设备</strong><span>此事件属于 {{ item.sourceType }}，来源范围 {{ item.sourceScope }}。采集值仍从 AIRIOT 模拟项目读取。</span><router-link :to="`/campus/devices/${encodeURIComponent(item.deviceId)}`"><i class="ri-cpu-line" aria-hidden="true"></i>{{ item.deviceName || item.deviceId }} <i class="ri-arrow-right-line" aria-hidden="true"></i></router-link></div>
      <ol class="case-progress" aria-label="事件处置流程" :style="{ '--p': progress }">
        <li v-for="(value, index) in caseStates" :key="value" :class="{ current: item.state === value, complete: index < currentStep }" :aria-current="item.state === value ? 'step' : undefined">
          <span class="step-node"><i :class="index < currentStep ? 'ri-check-line' : stepIcons[value]" aria-hidden="true"></i><span class="sr-only">{{ index < currentStep ? '已完成' : String(index + 1).padStart(2, '0') }}</span></span>
          <strong>{{ caseStateLabels[value] }}</strong>
          <small>{{ String(index + 1).padStart(2, '0') }}</small>
        </li>
      </ol>
      <dl class="case-facts">
        <div><dt><i class="ri-user-star-line" aria-hidden="true"></i>负责人</dt><dd>{{ item.assigneeName || '未分派' }}</dd></div>
        <div><dt><i class="ri-git-merge-line" aria-hidden="true"></i>演练来源</dt><dd :class="`source-${item.sourceState}`">{{ sourceStateLabels[item.sourceState] }}</dd></div>
        <div><dt><i class="ri-shield-check-line" aria-hidden="true"></i>恢复核实</dt><dd>{{ item.sourceCheckOutcome === 'PASS' && item.sourceVerifiedAt !== null ? '已核实' : item.sourceCheckOutcome === 'UNKNOWN' ? '核实结果未知' : '尚未核实' }}</dd></div>
        <div><dt><i class="ri-time-line" aria-hidden="true"></i>发生时间</dt><dd>{{ timeLabel(item.occurredAt) }}</dd></div>
      </dl>
      <p v-if="writeError" class="campus-notice error" role="alert">{{ writeError }}</p><p v-if="success" class="campus-notice success" role="status">{{ success }}</p>
      <div class="case-columns">
        <div class="case-work">
          <section class="campus-panel" aria-labelledby="responsibility-title"><div class="campus-panel-head"><div><h2 id="responsibility-title"><i class="ri-user-shared-line" aria-hidden="true"></i>责任分派</h2><p>{{ item.assigneeName ? `当前负责人：${item.assigneeName}` : '先分派负责人，再开始处理。' }}</p></div><span class="case-state" :class="item.state">{{ caseStateLabels[item.state] }}</span></div>
            <ResourceState :loading="handlers.loading.value" :error="handlers.error.value" :has-data="!!handlers.data.value" :last-success="handlers.lastSuccess.value" compact @retry="handlers.load" />
            <form v-if="canAssign" class="case-form" @submit.prevent="assign"><label>负责人<select v-model="assigneeUid" required :disabled="locked || !handlers.data.value || !!handlers.error.value"><option value="" disabled>选择可处理事件的账户</option><option v-for="handler in handlers.data.value?.items || []" :key="handler.uid" :value="handler.uid">{{ handler.displayName }}</option></select></label><label>分派说明<textarea v-model="assignNote" rows="2" maxlength="500" required :disabled="locked" placeholder="说明责任分工或本次演练安排" /></label><p v-if="item.state === 'IN_PROGRESS'" class="campus-muted">重新分派会回到待处理状态，新的负责人需要重新开始处理。</p><button type="submit" class="campus-button secondary" :disabled="locked || !assigneeUid || !assignNote.trim() || !handlers.data.value || !!handlers.error.value">{{ savingAction === '分派负责人' ? '保存并回读中…' : item.assigneeUid ? '重新分派负责人' : '保存负责人分派' }}</button></form>
            <p v-else class="campus-muted">{{ item.state === 'CLOSED' ? '事件已关闭，责任记录保留。' : '负责人分派由管理员操作。' }}</p>
          </section>
          <section v-if="item.state !== 'CLOSED'" class="campus-panel" aria-labelledby="treatment-title"><div class="campus-panel-head"><div><h2 id="treatment-title"><i class="ri-edit-2-line" aria-hidden="true"></i>处理与记录</h2><p>处理说明进入时间线，输入在失败时保留。</p></div></div>
            <form v-if="canHandle && item.state === 'ASSIGNED'" class="case-form" @submit.prevent="start"><label>开始处理说明<textarea v-model="startNote" rows="2" maxlength="500" required :disabled="locked" placeholder="说明接手本次演练的处理安排" /></label><button type="submit" class="campus-button" :disabled="locked || !startNote.trim()">{{ savingAction === '开始处理' ? '保存并回读中…' : '开始处理' }}</button></form>
            <form v-else-if="canHandle && item.state === 'IN_PROGRESS'" class="case-form" @submit.prevent="addNote"><label>处置记录<textarea v-model="treatmentNote" rows="3" maxlength="500" required :disabled="locked" placeholder="记录检查过程、原因和处理结果" /></label><button type="submit" class="campus-button" :disabled="locked || !treatmentNote.trim()">{{ savingAction === '处置记录' ? '保存并回读中…' : '保存处置记录' }}</button></form>
            <p v-else class="campus-muted">{{ item.state === 'NEW' ? '等待管理员分派负责人。' : campus.capabilities?.canHandleAlarms === true ? '校园管理人员处理分派给自己的事件。' : '当前账户只读，可查看处置时间线。' }}</p>
          </section>
          <section class="campus-panel" aria-labelledby="recovery-title"><div class="campus-panel-head"><div><h2 id="recovery-title"><i class="ri-restart-line" aria-hidden="true"></i>来源恢复与核实</h2><p>先改变本地演练来源，再独立核实，保留两个步骤的时间。</p></div></div>
            <dl class="recovery-facts"><div><dt>来源状态</dt><dd :class="`source-${item.sourceState}`">{{ sourceStateLabels[item.sourceState] }}</dd></div><div><dt>来源恢复</dt><dd>{{ timeLabel(item.sourceRecoveredAt) }}</dd></div><div><dt>来源读取</dt><dd>{{ timeLabel(item.sourceObservedAt) }}</dd></div><div><dt>恢复核实</dt><dd>{{ timeLabel(item.sourceVerifiedAt) }}</dd></div></dl>
            <div v-if="item.state !== 'CLOSED'" class="recovery-actions"><button v-if="campus.capabilities?.canRunDemoScenarios === true && item.sourceType === 'DEMO'" type="button" class="campus-button secondary" :disabled="locked || isRecovered" @click="recover">{{ savingAction === '模拟来源恢复' ? '模拟并回读中…' : isRecovered ? '模拟来源已恢复' : '模拟演练来源恢复' }}</button><button v-if="canHandle" type="button" class="campus-button secondary" :disabled="locked || item.state !== 'IN_PROGRESS' || !isRecovered || verified" @click="verify">{{ savingAction === '恢复核实' ? '核实并回读中…' : verified ? '恢复已核实' : '核实来源恢复' }}</button></div>
            <p v-if="item.state !== 'CLOSED' && !isRecovered" class="campus-muted recovery-tip"><i class="ri-error-warning-line" aria-hidden="true"></i>来源仍处于演练异常状态，尚不具备关闭条件。</p>
          </section>
          <section class="campus-panel case-close" aria-labelledby="close-title"><div class="campus-panel-head"><div><h2 id="close-title"><i class="ri-lock-line" aria-hidden="true"></i>关闭事件</h2><p>核对处置记录及来源恢复，再保存最终结论。</p></div></div>
            <template v-if="item.state === 'CLOSED'"><div class="closed-banner"><i class="ri-checkbox-circle-fill" aria-hidden="true"></i><div><p class="closed-disposition">{{ item.disposition || '未提供关闭结论' }}</p><p class="campus-muted">关闭时间 {{ timeLabel(item.closedAt) }} · 记录已锁定</p></div></div></template>
            <template v-else>
              <div class="close-readiness">
                <RingGauge :ratio="checksDone / checks.length" :size="92" :stroke="9" from="#34d399" to="#10b981" :label="`关闭条件已满足 ${checksDone} / ${checks.length}`"><strong class="close-count">{{ checksDone }}<small>/{{ checks.length }}</small></strong></RingGauge>
                <ul class="close-checks"><li v-for="check in checks" :key="check.label" :class="{ done: check.done }"><span aria-hidden="true"><i :class="check.done ? 'ri-checkbox-circle-fill' : 'ri-checkbox-blank-circle-line'"></i></span>{{ check.label }}</li></ul>
              </div>
              <form v-if="canHandle" class="case-form" @submit.prevent="close"><label>关闭结论<textarea v-model="disposition" rows="2" maxlength="2000" required :disabled="locked" placeholder="说明本次演练的处置结论" /></label><button type="submit" class="campus-button" :disabled="locked || !canClose || !disposition.trim()">{{ savingAction === '事件关闭' ? '关闭并回读中…' : '保存结论并关闭事件' }}</button></form><p v-else class="campus-muted">关闭由具备处置权限的负责人完成。</p>
            </template>
          </section>
        </div>
        <section class="case-timeline campus-panel" aria-labelledby="timeline-title"><div class="campus-panel-head"><div><h2 id="timeline-title"><i class="ri-history-line" aria-hidden="true"></i>处置时间线</h2><p>当前版本 {{ item.version }} · 更新 {{ timeLabel(item.updatedAt) }}</p></div><span class="campus-chip info">{{ item.timeline.length }} 条</span></div><ol v-if="item.timeline.length" class="fx-stagger"><li v-for="entry in item.timeline" :key="entry.id" :class="`action-${entry.action}`"><span class="timeline-dot" aria-hidden="true"><i :class="actionIcons[entry.action] || 'ri-record-circle-line'"></i></span><div class="timeline-entry"><div class="timeline-entry-head"><strong>{{ actionName(entry.action) }}</strong><small>{{ timeLabel(entry.createdAt) }}</small></div><p class="timeline-actor">{{ entry.actorName || entry.actorUid || '未提供操作人' }} · 版本 {{ entry.caseVersion }}</p><p v-if="entry.note" class="timeline-note">{{ entry.note }}</p><p v-if="entry.fromState !== entry.toState && entry.toState" class="timeline-state"><span>{{ stateName(entry.fromState) }}</span><i class="ri-arrow-right-line" aria-hidden="true"></i><span>{{ stateName(entry.toState) }}</span></p></div></li></ol><p v-else class="campus-empty">本次读取未返回时间线，请刷新核对。</p><details class="case-identifiers"><summary><i class="ri-fingerprint-line" aria-hidden="true"></i>事件来源与标识</summary><dl><dt>事件 ID</dt><dd>{{ item.id }}</dd><dt>演练来源 ID</dt><dd>{{ item.sourceId }}</dd><dt>场景 ID</dt><dd>{{ item.scenario }}</dd><dt>原始来源状态</dt><dd>{{ item.sourceRawStatus }}</dd><dt>创建时间</dt><dd>{{ timeLabel(item.createdAt) }}</dd></dl></details></section>
      </div>
    </template>
  </div>
</template>

<style scoped>
.case-hero{--sc:var(--brand-2);align-items:center;padding:24px;margin-bottom:16px;background:radial-gradient(700px 240px at 0% 0%,color-mix(in srgb,var(--sc) 15%,transparent),transparent 70%),var(--surface-1)}
.state-NEW{--sc:var(--warn)}.state-ASSIGNED{--sc:#3b82f6}.state-IN_PROGRESS{--sc:#a855f7}.state-CLOSED{--sc:var(--ok)}
.case-hero h1{font-size:26px}
.case-hero-chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px}
.case-evidence{display:flex;align-items:center;gap:9px 14px;flex-wrap:wrap;border:1px solid color-mix(in srgb,var(--brand-2) 22%,transparent);background:linear-gradient(100deg,color-mix(in srgb,var(--brand-1) 10%,transparent),color-mix(in srgb,var(--brand-3) 8%,transparent));border-radius:16px;padding:12px 16px;font-size:13px;line-height:1.7}
.case-evidence>i{font-size:18px;color:var(--brand-2)}
.case-evidence strong{color:var(--text-main)}
.case-evidence>span{flex:1;min-width:250px;color:var(--text-secondary)}
.case-evidence>a{font-weight:600;min-height:32px;display:inline-flex;align-items:center;gap:4px}
.case-progress{position:relative;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));margin:28px 0 24px;padding:0 4px}
.case-progress::before,.case-progress::after{content:'';position:absolute;top:21px;left:12.5%;height:4px;border-radius:4px}
.case-progress::before{right:12.5%;background:var(--ring-track)}
.case-progress::after{width:calc(75% * var(--p));background:var(--brand-gradient);box-shadow:0 0 14px var(--brand-glow);transition:width 1s cubic-bezier(.22,.8,.24,1);animation:rail-grow 1.2s cubic-bezier(.22,.8,.24,1) both}
@keyframes rail-grow{from{width:0}}
.case-progress li{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;gap:8px;color:var(--text-tertiary);text-align:center}
.step-node{position:relative;width:46px;height:46px;display:grid;place-items:center;border-radius:50%;font-size:19px;background:var(--surface-raised);border:2px solid var(--border-strong);transition:all .4s}
.case-progress strong{font-size:13.5px;font-weight:600}
.case-progress small{font-size:11px;font-family:var(--font-number);letter-spacing:.1em}
.case-progress li.complete{color:var(--text-secondary)}
.case-progress li.complete .step-node{color:#fff;border-color:transparent;background:linear-gradient(135deg,#34d399,#10b981);box-shadow:0 8px 18px -8px #10b981}
.case-progress li.current{color:var(--text-main)}
.case-progress li.current .step-node{color:#fff;border-color:transparent;background:var(--brand-gradient);box-shadow:0 10px 24px -8px var(--brand-glow)}
.case-progress li.current .step-node::after{content:'';position:absolute;inset:-6px;border-radius:50%;border:2px solid var(--brand-2);animation:fx-ping 2.2s cubic-bezier(0,0,.2,1) infinite;opacity:.6}
.case-progress li.current strong{font-weight:700}
.case-facts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:0 0 20px}
.case-facts>div{padding:14px 16px;border-radius:16px;background:var(--surface-1);border:1px solid var(--border-base)}
.case-facts dt{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text-tertiary);margin-bottom:6px}
.case-facts dd{font-size:14px;font-weight:650;line-height:1.6;font-variant-numeric:tabular-nums}
.source-ACTIVE{color:var(--warn-text)}.source-RECOVERED{color:var(--ok-text)}
.case-columns{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);gap:20px;align-items:start}
.case-work{display:flex;flex-direction:column;gap:16px;min-width:0}
.case-form{display:flex;flex-direction:column;gap:14px}
.case-form label{display:flex;flex-direction:column;gap:8px;font-size:12.5px;font-weight:600;color:var(--text-secondary)}
.case-form .campus-button{align-self:flex-start}
.case-state{display:inline-flex;align-items:center;font-size:12px;font-weight:650;padding:3px 11px;border-radius:999px;white-space:nowrap;color:var(--sc,var(--text-secondary));background:color-mix(in srgb,var(--sc,var(--text-tertiary)) 14%,transparent)}
.case-state.NEW{--sc:var(--warn)}.case-state.ASSIGNED{--sc:#3b82f6}.case-state.IN_PROGRESS{--sc:#a855f7}.case-state.CLOSED{--sc:var(--ok)}
.recovery-facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;font-size:12.5px;margin-bottom:16px}
.recovery-facts>div{padding:10px 12px;border-radius:12px;background:var(--surface-inset)}
.recovery-facts dt{color:var(--text-tertiary);font-size:11.5px;margin-bottom:4px}
.recovery-facts dd{font-variant-numeric:tabular-nums;line-height:1.6;font-weight:600}
.recovery-actions{display:flex;gap:10px;flex-wrap:wrap}
.recovery-tip{display:flex;gap:6px;align-items:center;margin-top:12px;color:var(--warn-text)}
.close-readiness{display:flex;align-items:center;gap:20px;margin-bottom:16px}
.close-count{font-size:24px;font-weight:750;font-family:var(--font-number);color:var(--text-main)}
.close-count small{font-size:13px;color:var(--text-tertiary);font-weight:600}
.close-checks{flex:1;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;font-size:12.5px;color:var(--text-secondary)}
.close-checks li{display:flex;gap:8px;align-items:center;padding:9px 11px;border-radius:12px;background:var(--surface-inset);border:1px solid var(--border-base);transition:all .3s}
.close-checks li span{font-size:17px;line-height:1;color:var(--text-disabled)}
.close-checks .done{color:var(--ok-text);border-color:color-mix(in srgb,var(--ok) 30%,transparent);background:var(--ok-soft)}
.close-checks .done span{color:var(--ok)}
.closed-banner{display:flex;gap:14px;align-items:flex-start;padding:16px;border-radius:16px;background:var(--ok-soft);border:1px solid color-mix(in srgb,var(--ok) 30%,transparent)}
.closed-banner>i{font-size:28px;color:var(--ok)}
.closed-disposition{font-size:14px;line-height:1.8;white-space:pre-wrap;margin-bottom:6px;color:var(--text-main)}
.case-timeline{position:sticky;top:0}
.case-timeline>ol{margin:6px 0 20px}
.case-timeline>ol>li{position:relative;display:flex;gap:14px;padding-bottom:20px}
.case-timeline>ol>li:not(:last-child)::after{content:'';position:absolute;left:16px;top:36px;bottom:2px;width:2px;border-radius:2px;background:linear-gradient(var(--brand-2),color-mix(in srgb,var(--brand-3) 30%,transparent))}
.timeline-dot{width:34px;height:34px;flex-shrink:0;display:grid;place-items:center;border-radius:12px;font-size:16px;color:var(--brand-2);background:var(--info-soft);border:1px solid color-mix(in srgb,var(--brand-2) 25%,transparent);z-index:1}
.action-CLOSE .timeline-dot,.action-VERIFY_RECOVERY .timeline-dot{color:var(--ok);background:var(--ok-soft);border-color:color-mix(in srgb,var(--ok) 25%,transparent)}
.action-DEMO_TRIGGER .timeline-dot{color:var(--warn);background:var(--warn-soft);border-color:color-mix(in srgb,var(--warn) 25%,transparent)}
.timeline-entry{flex:1;min-width:0;padding-top:4px}
.timeline-entry-head{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:baseline}
.timeline-entry-head strong{font-size:14px;font-weight:650}
.timeline-entry-head small{font-size:11px;color:var(--text-tertiary);font-variant-numeric:tabular-nums;line-height:1.6}
.timeline-actor{font-size:12px;color:var(--text-tertiary);margin-top:4px}
.timeline-note{font-size:13px;line-height:1.75;white-space:pre-wrap;margin-top:8px;background:var(--surface-inset);border:1px solid var(--border-base);padding:10px 12px;border-radius:12px}
.timeline-state{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;color:var(--text-secondary);margin-top:8px;padding:3px 10px;border-radius:999px;background:var(--surface-inset)}
.case-identifiers{border-top:1px solid var(--border-base);padding-top:12px;font-size:12px;color:var(--text-tertiary)}
.case-identifiers summary{cursor:pointer;min-height:32px;display:inline-flex;align-items:center;gap:6px;font-weight:600}
.case-identifiers dl{display:grid;grid-template-columns:96px minmax(0,1fr);gap:10px;margin-top:12px;line-height:1.7}
.case-identifiers dd{overflow-wrap:anywhere;font-variant-numeric:tabular-nums;color:var(--text-secondary)}
@media(max-width:1050px){.case-columns{grid-template-columns:minmax(0,1fr);gap:16px}.case-timeline{order:-1;position:static}.case-timeline>ol{max-height:460px;overflow:auto}.case-facts{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:768px){.case-hero{padding:18px 16px}.case-hero h1{font-size:22px}.case-evidence{padding:12px 14px}.case-evidence>span{min-width:100%}.case-evidence>a{min-height:44px}.case-progress{margin:22px 0 18px}.step-node{width:38px;height:38px;font-size:16px}.case-progress::before,.case-progress::after{top:17px}.case-progress strong{font-size:12px}.case-facts{gap:10px}.case-facts dd{font-size:13px}.case-timeline>ol{max-height:340px}.case-identifiers summary{min-height:44px}.case-form .campus-button{align-self:stretch}.recovery-actions{flex-direction:column}.recovery-actions button{width:100%}.close-readiness{flex-direction:column;align-items:stretch}.close-readiness .ring-gauge{align-self:center}.close-checks{grid-template-columns:1fr 1fr}.timeline-entry-head{flex-direction:column;gap:3px}}
</style>
