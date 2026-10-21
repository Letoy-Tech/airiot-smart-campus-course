<script setup lang="ts">
import { computed } from 'vue'
import { strictCapability } from '../domain/course'
import { useCampusStore } from '../stores/campus'
import type { Capabilities } from '../types/campus'

const store = useCampusStore()

type CapabilityKey = Exclude<keyof Capabilities, 'roles'>

const roleNames: Record<string, string> = {
  ADMIN: '管理员',
  CAMPUS_MANAGER: '校园管理人员',
  CAMPUS_VIEWER: '只读查看者',
}

/** 只列布尔能力字段；roles 数组不参与此表，也不能当布尔权限使用。 */
const capabilityDefinitions: { key: CapabilityKey; name: string; entry: string }[] = [
  { key: 'canRead', name: '读取校园数据', entry: 'GET /api/campus/**；401 与 403 分开处理' },
  { key: 'canControl', name: '控制设备', entry: '远端控制与外部通知关闭，服务端恒为 false' },
  { key: 'canAdmin', name: '维护位置', entry: '创建校园/楼栋、绑定空间等写入口' },
  { key: 'canAudit', name: '查看命令审计', entry: 'GET /api/campus/command-audit' },
  { key: 'canHandleAlarms', name: '处理事件', entry: '开始/记录/核实/关闭；CAMPUS_MANAGER 仅限本人被分派的事件' },
  { key: 'canAssignAlarms', name: '分派事件', entry: '把事件分派给处理人' },
  { key: 'canRunDemoScenarios', name: '触发演练场景', entry: '本地 DEMO 演练，仅在演示开启时允许' },
]

const capabilityRows = computed(() =>
  capabilityDefinitions.map((definition) => {
    const value: unknown = store.capabilities ? store.capabilities[definition.key] : undefined
    return { ...definition, value, allowed: strictCapability(value) }
  }),
)

const allowedCount = computed(() => capabilityRows.value.filter((row) => row.allowed).length)

const roleText = computed(
  () =>
    (store.user?.roles ?? [])
      .map((role) => `${roleNames[role] ?? '未知角色'}（${role}）`)
      .join(' / ') || '无角色',
)

/** 能力接口自带的 roles 只回显服务端原文，不据此推出任何布尔权限。 */
const capabilityRoleText = computed(() => store.capabilities?.roles.join('、') || '未返回')

function valueText(value: unknown): string {
  if (value === undefined) return '未返回（undefined）'
  if (value === null) return 'null'
  return JSON.stringify(value) ?? String(value)
}

async function reloadIdentity() {
  if (store.authBusy) return
  await store.initialize()
}
</script>

<template>
  <section class="workspace full-page" data-testid="access-view">
    <header class="page-heading">
      <div>
        <p class="eyebrow">第07站 · 身份与权限验证</p>
        <h1>换一个人登录，权限也要换</h1>
        <p class="muted">
          身份来自 GET /api/auth/me，能力来自 GET /api/campus/capabilities。
          只有 JSON Boolean true 才显示“允许”；roles 只用于显示，不能当布尔权限。
          页面只解释权限，最终判定始终在服务端。
        </p>
      </div>
      <button type="button" class="button subtle" :disabled="store.authBusy" @click="reloadIdentity">
        {{ store.authBusy ? '正在读取…' : '重新读取身份' }}
      </button>
    </header>

    <div v-if="store.authError" class="notice error" role="alert">
      <strong>当前会话读取失败</strong>
      <p>{{ store.authError }}</p>
    </div>

    <div v-if="!store.user" class="notice" role="status">
      <strong>当前没有已确认的身份</strong>
      <p>
        未登录或会话已失效（401 不是 403）。用顶部“退出 / 切换身份”重新登录后，
        本页会显示新的用户名、角色与服务端能力，旧身份数据不会保留。
      </p>
    </div>

    <div class="metric-strip">
      <div>
        <strong>{{ store.user?.displayName ?? '未登录' }}</strong>
        <span>当前用户（服务端 /api/auth/me）</span>
      </div>
      <div>
        <strong>{{ store.user?.username ?? '—' }}</strong>
        <span>登录账号</span>
      </div>
      <div>
        <strong>{{ store.user?.roles.length ?? 0 }}</strong>
        <span>角色数（仅显示，不授权）</span>
      </div>
      <div>
        <strong class="numeric">{{ allowedCount }} / {{ capabilityRows.length }}</strong>
        <span>Boolean true 允许 / 能力项</span>
      </div>
    </div>

    <section class="panel">
      <div class="section-heading">
        <h2>当前身份</h2>
        <span>用户名、账号与角色都取自服务端会话；切换身份后需重新读取。</span>
      </div>
      <dl class="identity-list">
        <div>
          <dt>显示名</dt>
          <dd>{{ store.user?.displayName ?? '未登录' }}</dd>
        </div>
        <div>
          <dt>登录账号</dt>
          <dd>{{ store.user?.username ?? '—' }}</dd>
        </div>
        <div>
          <dt>uid</dt>
          <dd><code>{{ store.user?.uid ?? '—' }}</code></dd>
        </div>
        <div>
          <dt>角色（仅中文标签）</dt>
          <dd>{{ roleText }}</dd>
        </div>
        <div>
          <dt>能力接口返回的 roles</dt>
          <dd><code>{{ capabilityRoleText }}</code></dd>
        </div>
        <div>
          <dt>会话来源</dt>
          <dd>{{ store.user?.source ?? '—' }}</dd>
        </div>
      </dl>
    </section>

    <section class="panel">
      <div class="section-heading">
        <h2>服务端返回的每项能力</h2>
        <span>判定函数 strictCapability(value)：value === true 才是“允许”。</span>
      </div>
      <div v-if="!store.capabilities && store.user" class="notice warning" role="status">
        <strong>能力尚未返回</strong>
        <p>本次没有拿到 /api/campus/capabilities 的有效数据，下表所有能力一律按“不据此授权”处理。</p>
      </div>
      <div class="table-scroll">
        <table class="data-table">
          <caption>
            能力值来自服务端响应；字符串 "true"、数字 1、null、undefined 与缺失字段都不是“允许”。
            判定基于字段值本身，与 roles 数组无关。
          </caption>
          <thead>
            <tr>
              <th scope="col">能力</th>
              <th scope="col">字段</th>
              <th scope="col">当前值</th>
              <th scope="col">判定</th>
              <th scope="col">对应入口</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in capabilityRows" :key="row.key">
              <td><strong>{{ row.name }}</strong></td>
              <td><code>{{ row.key }}</code></td>
              <td><span class="numeric">{{ valueText(row.value) }}</span></td>
              <td>
                <span class="state-badge" :class="row.allowed ? 'good' : 'warning'">
                  {{ row.allowed ? '允许' : '不据此授权' }}
                </span>
              </td>
              <td>{{ row.entry }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="ledger-footnote">
        能力在 api/auth.ts 边界已用 strictCapability 逐项归一化，本页用同一函数再次判定；
        403 表示服务端按当前角色拒绝，隐藏按钮不能代替 403；401 表示会话失效，需退出后重新登录。
        身份切换时 store 会清空旧 user、capabilities 与设备数据。
      </p>
    </section>
  </section>
</template>

<style scoped>
.identity-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 14px 22px;
  margin: 0;
}
.identity-list > div {
  border-top: 1px solid var(--line);
  padding-top: 12px;
}
.identity-list dt {
  color: var(--muted);
  font-size: 0.72rem;
}
.identity-list dd {
  margin: 6px 0 0;
  font-size: 0.88rem;
  overflow-wrap: anywhere;
}
.identity-list code {
  color: var(--muted);
  font-size: 0.72rem;
}
</style>
