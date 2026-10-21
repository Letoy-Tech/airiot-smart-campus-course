<template>
  <div class="api-rules-page">
    <!-- Header Summary Section -->
    <div class="header-summary">
      <div class="summary-content">
        <h1>安全访问控制</h1>
        <p>动态配置接口路径的访问策略，系统将根据优先级实时匹配规则。</p>
      </div>
      <div class="summary-actions">
        <AppButton type="secondary" @click="handleRebuildCache" :loading="rebuilding">
          <template #icon><i class="ri-refresh-line"></i></template>重建缓存
        </AppButton>
        <AppButton @click="handleAdd">
          <template #icon><i class="ri-add-line"></i></template>新增规则
        </AppButton>
      </div>
    </div>

    <!-- Filter Section -->
    <AppCard class="filter-card" :no-padding="true">
      <!-- 移动端：筛选条件默认折叠，首屏直接呈现规则列表 -->
      <button v-if="isMobile" class="filter-toggle" @click="filterOpen = !filterOpen">
        <i class="ri-equalizer-line"></i>
        <span>筛选条件</span>
        <span v-if="activeFilterCount" class="filter-count">{{ activeFilterCount }}</span>
        <i class="ri-arrow-down-s-line chevron" :class="{ 'is-open': filterOpen }"></i>
      </button>

      <div v-show="!isMobile || filterOpen" class="filter-body">
        <div class="filter-grid">
          <AppInput v-model="queryParams.pathPattern" label="路径模式" placeholder="例如: /users/**">
            <template #prefix><i class="ri-route-line"></i></template>
          </AppInput>
          <AppSelect
            v-model="queryParams.groupPolicy"
            label="权限策略"
            placeholder="筛选权限策略"
            :options="filterPolicyOptions"
          />
        </div>
        <div class="filter-actions">
          <AppButton type="ghost" size="sm" @click="resetQuery">重置条件</AppButton>
          <AppButton size="sm" @click="handleQuery">开始过滤</AppButton>
        </div>
      </div>
    </AppCard>

    <!-- Table Section -->
    <AppCard class="table-card" :no-padding="true" tag-color="var(--primary-color)">
      <!-- 桌面端：表格 -->
      <div v-if="!isMobile" class="table-wrapper">
        <table class="v-table">
          <thead>
            <tr>
              <th width="80">优先级</th>
              <th>规则名称与路径</th>
              <th>方法</th>
              <th>策略</th>
              <th>限定组</th>
              <th width="120">状态</th>
              <th width="100">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="rule in ruleList" :key="rule.id">
              <td><div class="priority-badge">{{ rule.priority }}</div></td>
              <td>
                <div class="rule-path-cell">
                  <div class="rule-name">{{ rule.name }}</div>
                  <code class="path-text">{{ rule.pattern }}</code>
                </div>
              </td>
              <td>
                <div class="methods-cell">
                  <span v-for="m in formatMethods(rule.methods)" :key="m" class="method-tag" :class="m.toLowerCase()">{{ m }}</span>
                </div>
              </td>
              <td><StatusTag :type="getPolicyColor(rule.groupPolicy)" :round="true">{{ policyLabel(rule.groupPolicy) }}</StatusTag></td>
              <td>
                <div class="groups-list">
                  <StatusTag v-for="name in groupLabels(rule.allowedGroupIds)" :key="name" type="info" size="sm">{{ name }}</StatusTag>
                  <span v-if="!rule.allowedGroupIds" class="none-text">——</span>
                </div>
              </td>
              <td>
                <div class="status-toggle" @click="toggleEnabled(rule)">
                  <div class="v-switch" :class="{ checked: rule.enabled, loading: toggleLoading[rule.id] }">
                    <div class="v-switch-handle"></div>
                  </div>
                  <span class="status-label" :class="{ active: rule.enabled }">{{ rule.enabled ? '运行中' : '已禁用' }}</span>
                </div>
              </td>
              <td>
                <div class="row-ops">
                  <button class="icon-op-btn edit" @click="handleEdit(rule)"><i class="ri-edit-box-line"></i></button>
                  <button class="icon-op-btn delete" @click="handleDelete(rule)"><i class="ri-delete-bin-7-line"></i></button>
                </div>
              </td>
            </tr>
            <tr v-if="ruleList.length === 0">
              <td colspan="7">
                <div class="empty-state">暂无安全规则数据</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 移动端：卡片列表（表格最小宽度 1000px，手机上横向滚动无法使用） -->
      <div v-else class="mobile-list">
        <article v-for="rule in ruleList" :key="rule.id" class="m-rule">
          <header class="m-rule__head">
            <div class="priority-badge">{{ rule.priority }}</div>
            <div class="m-rule__title">
              <div class="rule-name text-ellipsis">{{ rule.name }}</div>
              <code class="path-text text-break">{{ rule.pattern }}</code>
            </div>
          </header>

          <div class="m-rule__body">
            <div class="m-rule__row">
              <span class="m-rule__key">方法</span>
              <div class="methods-cell">
                <span v-for="m in formatMethods(rule.methods)" :key="m" class="method-tag" :class="m.toLowerCase()">{{ m }}</span>
                <span v-if="!rule.methods" class="none-text">全部</span>
              </div>
            </div>
            <div class="m-rule__row">
              <span class="m-rule__key">策略</span>
              <StatusTag :type="getPolicyColor(rule.groupPolicy)" :round="true">{{ policyLabel(rule.groupPolicy) }}</StatusTag>
            </div>
            <div class="m-rule__row">
              <span class="m-rule__key">限定组</span>
              <div class="groups-list">
                <StatusTag v-for="name in groupLabels(rule.allowedGroupIds)" :key="name" type="info" size="sm">{{ name }}</StatusTag>
                <span v-if="!rule.allowedGroupIds" class="none-text">——</span>
              </div>
            </div>
          </div>

          <footer class="m-rule__foot">
            <div class="status-toggle" @click="toggleEnabled(rule)">
              <div class="v-switch" :class="{ checked: rule.enabled, loading: toggleLoading[rule.id] }">
                <div class="v-switch-handle"></div>
              </div>
              <span class="status-label" :class="{ active: rule.enabled }">{{ rule.enabled ? '运行中' : '已禁用' }}</span>
            </div>
            <div class="row-ops">
              <button class="icon-op-btn edit" aria-label="编辑规则" @click="handleEdit(rule)"><i class="ri-edit-box-line"></i></button>
              <button class="icon-op-btn delete" aria-label="删除规则" @click="handleDelete(rule)"><i class="ri-delete-bin-7-line"></i></button>
            </div>
          </footer>
        </article>

        <div v-if="ruleList.length === 0" class="empty-state">暂无安全规则数据</div>
      </div>

      <!-- Pagination -->
      <VPagination
        v-model="queryParams.pageNum"
        :total="total"
        :page-size="queryParams.pageSize"
        @change="handleQuery"
        @size-change="handleSizeChange"
      />
    </AppCard>

    <!-- Rule Editor Drawer -->
    <VDrawer v-model="drawerVisible" :title="ruleForm.id ? '编辑安全规则' : '定义新安全规则'">
      <form class="rule-form" @submit.prevent="submitRule">
        <AppInput 
          v-model="ruleForm.name" 
          label="规则友好名称" 
          placeholder="描述此规则的用途"
          required
          :error-msg="errorMsgs.name"
        >
          <template #prefix><i class="ri-text"></i></template>
        </AppInput>
        <AppInput 
          v-model="ruleForm.pattern" 
          label="路径模式" 
          placeholder="例如: /api/v1/users/**"
          required
          :error-msg="errorMsgs.pattern"
        >
          <template #prefix><i class="ri-route-line"></i></template>
        </AppInput>
        <AppInput v-model="ruleForm.methods" label="HTTP 方法 (逗号分隔)" placeholder="例如: GET,POST,PUT">
          <template #prefix><i class="ri-code-line"></i></template>
        </AppInput>
        <AppSelect
          v-model="ruleForm.groupPolicy"
          label="权限策略"
          placeholder="请选择权限策略"
          :options="drawerPolicyOptions"
        />
        <AppSelect
          v-if="ruleForm.groupPolicy === 'BY_USER_GROUP'"
          v-model="selectedGroupIds"
          label="限定组"
          placeholder="请选择允许访问的组"
          :multiple="true"
          :options="groupOptions"
          @change="ruleForm.allowedGroupIds = $event.join(',')"
        />
        <AppInput v-model.number="ruleForm.priority" type="number" label="匹配优先级 (数字越小越优先)" placeholder="100">
          <template #prefix><i class="ri-sort-asc"></i></template>
        </AppInput>
      </form>
      <template #footer>
        <AppButton type="ghost" @click="drawerVisible = false">取消</AppButton>
        <AppButton :loading="submitting" @click="submitRule">保存并同步</AppButton>
      </template>
    </VDrawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed, watch } from 'vue'
import AppCard from '@/components/common/AppCard.vue'
import AppInput from '@/components/common/AppInput.vue'
import AppButton from '@/components/common/AppButton.vue'
import StatusTag from '@/components/common/StatusTag.vue'
import VDrawer from '@/components/common/VDrawer.vue'
import AppSelect from '@/components/common/AppSelect.vue'
import VPagination from '@/components/common/VPagination.vue'
import { messageBox } from '@/utils/messageBox'
import { queryApiRules, rebuildApiCache, updateRuleStatus, deleteRule, saveRule } from '@/api/apiRules'
import { getAllGroups } from '@/api/groups'
import { toast } from '@/utils/toast'
import { useIsMobile } from '@/utils/responsive'
import { resolveLabels, splitCsv, UNKNOWN_GROUP } from '@/utils/label'

const isMobile = useIsMobile()
const filterOpen = ref(false)
const ruleList = ref<any[]>([])
const groupList = ref<any[]>([])
const total = ref(0)
const rebuilding = ref(false)
const drawerVisible = ref(false)
const submitting = ref(false)
const loading = ref(false)
const toggleLoading = reactive<Record<number, boolean>>({})

const selectedGroupIds = ref<string[]>([])
const groupsReady = ref(false)

const groupNameMap = computed(() => {
  const map: Record<string, string> = {}
  const walk = (groups: any[]) => {
    groups.forEach((g: any) => {
      if (g.groupName) map[g.groupId] = g.groupName
      if (Array.isArray(g.children)) walk(g.children)
    })
  }
  walk(groupList.value)
  return map
})

const groupLabels = (groupIds?: string) =>
  resolveLabels(splitCsv(groupIds), groupNameMap.value, groupsReady.value, UNKNOWN_GROUP)

// 策略枚举值由后端维护，界面只展示中文含义
const POLICY_LABELS: Record<string, string> = {
  ANY: '公开访问',
  BY_USER_GROUP: '按组授权',
  ALLOWLIST: '仅管理员',
  DIRECT_PATH: '直接路径',
}
const policyLabel = (policy?: string) => (policy && POLICY_LABELS[policy]) || '未知策略'

const policyOptions = Object.entries(POLICY_LABELS).map(([value, label]) => ({ label, value }))

const filterPolicyOptions = [
  { label: '全部策略', value: '' },
  ...policyOptions
]

const drawerPolicyOptions = policyOptions.filter(opt => opt.value !== 'DIRECT_PATH')

const groupOptions = computed(() => {
  const flatten = (groups: any[], level = 0): any[] => {
    return groups.flatMap((g: any) => {
      const current = {
        label: `${'　'.repeat(level)}${g.groupName}`,
        value: g.groupId
      }
      const children = Array.isArray(g.children) ? flatten(g.children, level + 1) : []
      return [current, ...children]
    })
  }
  return flatten(groupList.value)
})

const queryParams = reactive({ pageNum: 1, pageSize: 10, pathPattern: '', groupPolicy: '', enabled: undefined })

const activeFilterCount = computed(
  () => [queryParams.pathPattern, queryParams.groupPolicy].filter(Boolean).length,
)

const ruleForm = reactive<any>({ id: null, name: '', pattern: '', methods: '', groupPolicy: 'ANY', allowedGroupIds: '', priority: 100, enabled: true })

watch(() => ruleForm.allowedGroupIds, (newVal) => {
  selectedGroupIds.value = newVal ? newVal.split(',').filter(Boolean) : []
}, { immediate: true })

const fetchGroups = async () => {
  try {
    const data = await getAllGroups()
    groupList.value = data as unknown as any[]
  } catch (e) { console.error('Fetch groups failed', e) }
  finally { groupsReady.value = true }
}

const errorMsgs = reactive({
  name: '',
  pattern: ''
})

const handleQuery = async () => {
  loading.value = true
  try {
    const res = await queryApiRules(queryParams)
    ruleList.value = res.list
    total.value = res.total
  } catch (e: any) {
    toast.error('加载规则列表失败: ' + (e.message || '未知错误'))
    console.error(e)
  } finally {
    loading.value = false
  }
}

const handleSizeChange = (size: number) => {
  queryParams.pageSize = size
  queryParams.pageNum = 1
  handleQuery()
}

const handleAdd = () => {
  Object.assign(ruleForm, {
    id: null,
    name: '',
    pattern: '',
    methods: 'GET',
    groupPolicy: 'ANY',
    allowedGroupIds: '',
    priority: 100,
    enabled: true
  })
  errorMsgs.name = ''
  errorMsgs.pattern = ''
  drawerVisible.value = true
}

const handleEdit = (rule: any) => {
  Object.assign(ruleForm, { ...rule })
  errorMsgs.name = ''
  errorMsgs.pattern = ''
  drawerVisible.value = true
}

const submitRule = async () => {
  errorMsgs.name = !ruleForm.name ? '请输入规则名称' : ''
  errorMsgs.pattern = !ruleForm.pattern ? '请输入路径模式' : ''
  
  if (errorMsgs.name || errorMsgs.pattern) return
  
  submitting.value = true
  try {
    await saveRule(ruleForm)
    toast.success('安全规则已保存')
    drawerVisible.value = false
    handleQuery()
  } catch (e: any) {
    toast.error('保存失败: ' + (e.message || '未知错误'))
    console.error(e)
  } finally {
    submitting.value = false
  }
}

const handleRebuildCache = async () => {
  rebuilding.value = true
  try { 
    await rebuildApiCache()
    toast.success('缓存同步成功')
  } catch (e: any) {
    toast.error('缓存同步失败: ' + (e.message || '未知错误'))
  }
  finally { rebuilding.value = false }
}

const toggleEnabled = async (rule: any) => {
  if (toggleLoading[rule.id]) return
  toggleLoading[rule.id] = true
  try {
    await updateRuleStatus(rule.id, !rule.enabled)
    rule.enabled = !rule.enabled
    toast.success(`规则已${rule.enabled ? '启用' : '禁用'}`)
  } catch (e: any) {
    toast.error('状态更新失败: ' + (e.message || '未知错误'))
    console.error(e)
  } finally {
    toggleLoading[rule.id] = false
  }
}

const handleDelete = async (rule: any) => {
  try {
    await messageBox.danger(`确定删除规则 [${rule.name}] 吗？此操作不可恢复。`)
    await deleteRule(rule.id)
    toast.success('规则已删除')
    handleQuery()
  } catch (e: any) {
    if (e?.message !== 'cancel') {
      toast.error('删除失败: ' + (e.message || '未知错误'))
      console.error(e)
    }
  }
}

const resetQuery = () => {
  Object.assign(queryParams, {
    pathPattern: '',
    groupPolicy: '',
    pageNum: 1
  })
  handleQuery()
}
const formatMethods = (s: string) => s ? s.split(',').filter(Boolean) : []
const getPolicyColor = (p: string) => ({ ANY: 'warning', BY_USER_GROUP: 'primary', ALLOWLIST: 'success' }[p] || 'info')

onMounted(() => {
  fetchGroups()
  handleQuery()
})
</script>

<style scoped>
.api-rules-page { display: flex; flex-direction: column; gap: 24px; }
.header-summary { display: flex; justify-content: space-between; align-items: center; }
.header-summary h1 { font-size: 24px; font-weight: 800; color: var(--text-main); }
.header-summary p { color: var(--text-tertiary); font-size: 14px; margin-top: 4px; }
.summary-actions { display: flex; gap: 12px; }
.filter-body { padding: 24px; }
.filter-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
.filter-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--border-base); }
.table-wrapper { overflow-x: auto; }
.v-table { width: 100%; border-collapse: collapse; min-width: 1000px; }
.v-table th { background-color: #fafafa; text-align: left; padding: 16px 20px; font-size: 11px; font-weight: 800; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid var(--border-base); }
.v-table td { padding: 18px 20px; border-bottom: 1px solid var(--border-base); vertical-align: middle; }
.v-table tr:hover td { background-color: #fcfdfe; }
.priority-badge { width: 32px; height: 32px; background-color: var(--bg-page); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: 800; color: var(--primary-color); border: 1px solid var(--border-strong); }
.rule-path-cell { display: flex; flex-direction: column; gap: 4px; }
.rule-name { font-weight: 700; font-size: 14px; color: var(--text-main); }
.path-text { font-family: monospace; background-color: #f1f5f9; padding: 2px 8px; border-radius: 6px; font-size: 12px; color: #e11d48; width: fit-content; }
.methods-cell { display: flex; flex-wrap: wrap; gap: 4px; }
.method-tag { font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 4px; background-color: #f1f5f9; color: var(--text-secondary); }
.method-tag.get { background-color: #dcfce7; color: #166534; }
.method-tag.post { background-color: #fef9c3; color: #854d0e; }
.method-tag.put { background-color: #dbeafe; color: #1e40af; }
.method-tag.delete { background-color: #fee2e2; color: #991b1b; }
.groups-list { display: flex; flex-wrap: wrap; gap: 4px; }
.status-toggle { display: flex; align-items: center; gap: 10px; cursor: pointer; user-select: none; }
.v-switch { width: 38px; height: 20px; background-color: #e2e8f0; border-radius: 20px; position: relative; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
.v-switch.checked { background-color: var(--success-color); }
.v-switch-handle { width: 14px; height: 14px; background-color: white; border-radius: 50%; position: absolute; top: 3px; left: 3px; transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
.v-switch.checked .v-switch-handle { transform: translateX(18px); }
.status-label { font-size: 12px; font-weight: 700; color: var(--text-tertiary); transition: color 0.2s; }
.status-label.active { color: var(--success-color); }
.row-ops { display: flex; gap: 8px; }
.icon-op-btn { width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--border-base); background: white; display: flex; align-items: center; justify-content: center; font-size: 16px; cursor: pointer; transition: all 0.2s; color: var(--text-secondary); }
.icon-op-btn:hover { background-color: var(--bg-page); color: var(--primary-color); border-color: var(--primary-color); }
.icon-op-btn.delete:hover { color: var(--error-color); border-color: var(--error-color); }
.rule-form { display: flex; flex-direction: column; gap: 4px; }
.empty-state { padding: 48px 24px; text-align: center; color: var(--text-tertiary); font-style: italic; }
.none-text { color: var(--text-tertiary); font-size: 12px; }

/* 折叠式筛选触发器 */
.filter-toggle {
  width: 100%;
  min-height: var(--tap-target-lg);
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 16px;
  border: 0;
  background: transparent;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-main);
  cursor: pointer;
}
.filter-toggle > i:first-child { font-size: 18px; color: var(--primary-color); }
.filter-count {
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: var(--radius-pill);
  background: var(--primary-color);
  color: #fff;
  font-size: 11px;
  font-weight: 800;
  display: grid;
  place-items: center;
}
.filter-toggle .chevron {
  margin-left: auto;
  font-size: 20px;
  color: var(--text-tertiary);
  transition: transform var(--transition-base);
}
.filter-toggle .chevron.is-open { transform: rotate(180deg); }

/* ---------------- 移动端卡片列表 ---------------- */
.mobile-list { display: flex; flex-direction: column; gap: 12px; padding: 12px; }

.m-rule {
  border: 1px solid var(--border-base);
  border-radius: var(--radius-lg);
  background: var(--bg-card);
  overflow: hidden;
}

.m-rule__head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-base);
}
.m-rule__title { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }

.m-rule__body { padding: 14px 16px; display: flex; flex-direction: column; gap: 12px; }
.m-rule__row { display: flex; align-items: flex-start; gap: 12px; }
.m-rule__key {
  width: 52px;
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-tertiary);
  line-height: 22px;
}

.m-rule__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 16px;
  background: #fafbfc;
  border-top: 1px solid var(--border-base);
}

@media (max-width: 768px) {
  .api-rules-page { gap: 16px; }
  .header-summary { flex-direction: column; align-items: stretch; gap: 16px; }
  .header-summary h1 { font-size: 20px; }
  .summary-actions > * { flex: 1; }
  .filter-body { padding: 4px 16px 16px; border-top: 1px solid var(--border-base); }
  .filter-grid { grid-template-columns: 1fr; gap: 14px; }
  .filter-actions { margin-top: 16px; padding-top: 16px; }
  .filter-actions > * { flex: 1; }
  /* 触屏上 32px 的图标按钮低于 44px 最小可点区域 */
  .icon-op-btn { width: var(--tap-target); height: var(--tap-target); font-size: 18px; }
  .status-toggle { padding: 4px 0; }
}
</style>