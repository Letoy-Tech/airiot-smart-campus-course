<script setup lang="ts">
import { computed } from 'vue'
import { closeBlockers, sourceStateNames, stateNames, timeText } from '../domain/course'
import type { AlarmDetail, CaseTimeline } from '../types/full'

const props = defineProps<{ detail: AlarmDetail }>()

/** 只有人工 action=NOTE 计入；DEMO_RECOVER / VERIFY_RECOVERY 不算。 */
const noteEntries = computed<CaseTimeline[]>(() =>
  props.detail.timeline.filter((item) => item.action === 'NOTE'),
)
const latestNoteAt = computed<number | null>(() =>
  noteEntries.value.length === 0
    ? null
    : Math.max(...noteEntries.value.map((item) => item.createdAt)),
)
/** 缺项以 domain 的 closeBlockers 为准，与后端 requireClosable 的规则一致。 */
const blockers = computed(() => closeBlockers(props.detail))

const stateReady = computed(() => props.detail.state === 'IN_PROGRESS')
const noteReady = computed(() => noteEntries.value.length > 0)
const recoveredReady = computed(
  () =>
    props.detail.sourceState === 'RECOVERED' &&
    props.detail.sourceRecoveredAt !== null &&
    props.detail.sourceRecoveredAt >= props.detail.occurredAt,
)
const verifiedReady = computed(
  () =>
    props.detail.sourceCheckOutcome === 'PASS' &&
    props.detail.sourceRecoveredAt !== null &&
    props.detail.sourceVerifiedAt !== null &&
    props.detail.sourceVerifiedAt >= props.detail.sourceRecoveredAt,
)
</script>

<template>
  <section class="panel" data-testid="close-checklist">
    <div class="section-heading">
      <h2>关闭前检查</h2>
      <span>version {{ detail.version }} · 只读，不在本页改状态</span>
    </div>
    <p class="tiny muted">
      关闭顺序：处理中 → 人工 NOTE → 来源恢复 → 服务端独立核实 PASS → 结论 → 关闭。
      DEMO_RECOVER、VERIFY_RECOVERY 都不算人工 NOTE，也都不会自动关闭事件。
    </p>

    <dl class="detail-grid">
      <div>
        <dt>业务状态</dt>
        <dd>{{ stateNames[detail.state] ?? detail.state }}（{{ detail.state }}）</dd>
      </div>
      <div>
        <dt>人工 NOTE</dt>
        <dd>{{ noteEntries.length }} 条 · 最近 {{ timeText(latestNoteAt) }}</dd>
      </div>
      <div>
        <dt>来源恢复（只读）</dt>
        <dd>
          {{ sourceStateNames[detail.sourceState] ?? detail.sourceState }}（{{ detail.sourceState }}）
          · 恢复 {{ timeText(detail.sourceRecoveredAt) }} · 发生 {{ timeText(detail.occurredAt) }}
        </dd>
      </div>
      <div>
        <dt>核实结果（只读）</dt>
        <dd>{{ detail.sourceCheckOutcome }} · 核实 {{ timeText(detail.sourceVerifiedAt) }}</dd>
      </div>
    </dl>

    <h3>缺少的条件</h3>
    <ul v-if="blockers.length > 0" class="blocker-list" role="alert">
      <li v-for="reason in blockers" :key="reason">{{ reason }}</li>
    </ul>
    <p v-else class="notice" role="status">
      页面可见条件已齐，但这不等于允许关闭：结论、后端权限与版本校验仍由服务端在 close 时判定。
    </p>

    <h3>逐项条件</h3>
    <ul class="check-list">
      <li :class="stateReady ? 'ok' : 'bad'">
        <strong>处理中</strong>
        <span>{{ stateReady ? '已满足' : `当前 ${stateNames[detail.state] ?? detail.state}` }}</span>
      </li>
      <li :class="noteReady ? 'ok' : 'bad'">
        <strong>至少一条人工 NOTE</strong>
        <span>{{ noteReady ? `已满足（${noteEntries.length} 条）` : '恢复与核实记录不计入' }}</span>
      </li>
      <li :class="recoveredReady ? 'ok' : 'bad'">
        <strong>来源已恢复且恢复时刻合法</strong>
        <span>{{ recoveredReady ? '已满足' : '需 RECOVERED 且 recoveredAt ≥ occurredAt' }}</span>
      </li>
      <li :class="verifiedReady ? 'ok' : 'bad'">
        <strong>恢复后由服务端独立核实 PASS</strong>
        <span>{{ verifiedReady ? '已满足' : '需 PASS 且 verifiedAt ≥ recoveredAt' }}</span>
      </li>
    </ul>

    <h3>无缺项时仍需后端检查</h3>
    <ul class="reminder-list">
      <li>结论：disposition 去首尾空格后 1..2000 字；空白或缺失即拒绝。</li>
      <li>权限：ADMIN 或本人为当前 assignee 的 CAMPUS_MANAGER；其他身份 403，本页不据此放行。</li>
      <li>版本：expectedVersion 必须等于当前 {{ detail.version }}；不符 409，只回读，不自动重放。</li>
      <li>关闭成功后独立回读 GET /api/campus/alarm-cases/{{ detail.id }}，确认 CLOSED 与 disposition。</li>
    </ul>
    <p class="tiny muted">
      本组件不发请求、不写事件状态、不判断角色；分派、开始与 NOTE 在事件工作台完成后，回到这里重新读取详情。
    </p>
  </section>
</template>

<style scoped>
.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
  margin: 18px 0 8px;
}
.detail-grid dt {
  font-size: 0.72rem;
  color: var(--muted);
  letter-spacing: 0.04em;
}
.detail-grid dd {
  margin: 4px 0 0;
  line-height: 1.7;
  overflow-wrap: anywhere;
}
h3 {
  margin: 22px 0 8px;
  font-size: 0.95rem;
}
.blocker-list,
.check-list,
.reminder-list {
  margin: 0;
  padding-left: 20px;
  line-height: 1.8;
  font-size: 0.82rem;
}
.blocker-list {
  color: #b3261e;
}
.check-list {
  list-style: none;
  padding-left: 0;
}
.check-list li {
  display: flex;
  gap: 10px;
  align-items: baseline;
  padding: 6px 10px;
  border-left: 3px solid var(--line);
}
.check-list li.ok {
  border-left-color: #1c7c54;
}
.check-list li.bad {
  border-left-color: #b3261e;
}
.check-list li strong {
  min-width: 13em;
}
.check-list li span {
  color: var(--muted);
}
</style>
