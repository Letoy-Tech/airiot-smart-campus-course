<template>
  <div class="groups-page">
    <div class="groups-layout">
      <!-- Left: Tree View (Exquisite Sidebar) -->
      <AppCard title="组织架构" class="tree-sidebar" tag-color="var(--primary-color)" :no-padding="true">
        <template #extra>
          <AppButton type="text" size="sm" @click="fetchGroups">
            <template #icon><i class="ri-refresh-line"></i></template>
          </AppButton>
        </template>
        <div class="tree-container">
          <div class="tree-search">
            <AppInput v-model="treeSearch" placeholder="快速过滤组织..." size="sm">
              <template #prefix><i class="ri-filter-2-line"></i></template>
            </AppInput>
          </div>
          <div class="tree-scroll-area">
            <VTree
              :data="groupTree"
              node-key="groupId"
              label-key="groupName"
              :selected-key="selectedGroupId || undefined"
              :expanded-keys="expandedKeys"
              @node-click="handleNodeClick"
              @update:expanded-keys="expandedKeys = $event"
            />
            <div v-if="groupTree.length === 0" class="empty-tree">
              <i class="ri-organization-chart"></i>
              <p>暂无组织架构</p>
              <AppButton size="sm" type="ghost" @click="resetForm">创建根组织</AppButton>
            </div>
          </div>
        </div>
      </AppCard>

      <!-- Right: Details / Editor -->
      <div class="details-area">
        <transition name="page-fade" mode="out-in">
          <AppCard 
            :key="selectedGroupId || 'new'"
            :title="selectedGroup ? `编辑：${selectedGroup.groupName}` : '创建新组织'" 
            class="editor-card"
            tag-color="var(--success-color)"
          >
            <template #extra v-if="selectedGroup">
              <AppButton type="text" size="sm" @click="handleDelete" :style="{ color: 'var(--error-color)' }">
                <template #icon><i class="ri-delete-bin-line"></i></template>
                删除此组织
              </AppButton>
            </template>

            <form class="group-form" @submit.prevent="saveGroup">
              <div class="form-grid">
                <AppInput
                  v-model="groupForm.groupName"
                  label="组织名称"
                  placeholder="显示名称"
                  required
                  :error-msg="errors.groupName"
                >
                  <template #prefix><i class="ri-font-size"></i></template>
                </AppInput>
                <AppInput
                  v-model="groupForm.parentGroupName"
                  label="上级组织"
                  placeholder="顶级组织无上级"
                  :disabled="true"
                >
                  <template #prefix><i class="ri-node-tree"></i></template>
                </AppInput>
                <AppInput
                  v-model="groupForm.groupDescription"
                  class="span-full"
                  label="职能描述"
                  placeholder="简要说明该组织的职责"
                >
                  <template #prefix><i class="ri-text-snippet"></i></template>
                </AppInput>
              </div>

              <div class="form-footer">
                <div class="tip" v-if="!selectedGroup">
                  <i class="ri-information-line"></i>
                  正在创建一个新的组织单元
                </div>
                <div class="tip" v-else>
                  <i class="ri-time-line"></i>
                  最后更新于：{{ formatSmartDateTime(selectedGroup?.updateTime, nowTick, '未知') }}
                </div>
                <div class="actions">
                  <AppButton type="ghost" @click="resetForm">重置/取消</AppButton>
                  <AppButton :loading="saving" @click="saveGroup">
                    <template #icon><i class="ri-save-line"></i></template>
                    {{ selectedGroup ? '保存变更' : '立即创建' }}
                  </AppButton>
                </div>
              </div>
            </form>

            <div v-if="selectedGroup" class="quick-tools">
              <div class="section-title">快速工具</div>
              <div class="tool-btns">
                <AppButton type="secondary" size="sm" @click="addChild">
                  <template #icon><i class="ri-add-box-line"></i></template>
                  在该组下添加子组织
                </AppButton>
                <AppButton type="ghost" size="sm">
                  <template #icon><i class="ri-user-follow-line"></i></template>
                  查看该组所有成员
                </AppButton>
              </div>
            </div>
          </AppCard>
        </transition>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import AppCard from '@/components/common/AppCard.vue'
import AppInput from '@/components/common/AppInput.vue'
import AppButton from '@/components/common/AppButton.vue'
import VTree from '@/components/common/VTree.vue'
import { formatSmartDateTime } from '@/utils/datetime'
import { messageBox } from '@/utils/messageBox'
import { toast } from '@/utils/toast'
import { generateBusinessKey, UNKNOWN_GROUP } from '@/utils/label'
import {
  getAllGroups,
  createRootGroup,
  createChildGroup,
  updateGroup,
  deleteGroup,
  type GroupInfo,
  type GroupPayload,
} from '@/api/groups'

type GroupTreeNode = GroupInfo & { children: GroupTreeNode[] }

const groupTree = ref<GroupTreeNode[]>([])
const selectedGroupId = ref<string | null>(null)
const selectedGroup = ref<GroupTreeNode | null>(null)
const expandedKeys = ref<Set<string>>(new Set())
const treeSearch = ref('')
const saving = ref(false)
const loading = ref(false)
const nowTick = ref(Date.now())
const groupNameMap = reactive<Record<string, string>>({})

const errors = reactive({ groupName: '' })

const groupForm = reactive({
  groupId: '',
  groupName: '',
  parentGroupId: '',
  parentGroupName: '',
  groupDescription: ''
})

const buildGroupTree = (groups: GroupInfo[]): GroupTreeNode[] => {
  const nodeMap = new Map<string, GroupTreeNode>()

  groups.forEach((group) => {
    nodeMap.set(group.groupId, {
      ...group,
      children: [],
    })
  })

  const roots: GroupTreeNode[] = []
  nodeMap.forEach((node) => {
    if (node.parentGroupId && nodeMap.has(node.parentGroupId)) {
      nodeMap.get(node.parentGroupId)!.children.push(node)
    } else {
      roots.push(node)
    }
  })

  const sortNodes = (nodes: GroupTreeNode[]) => {
    nodes.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    nodes.forEach((node) => sortNodes(node.children))
  }

  sortNodes(roots)
  return roots
}

const collectExpandedKeys = (nodes: GroupTreeNode[]) => {
  const keys = new Set<string>()
  const walk = (items: GroupTreeNode[]) => {
    items.forEach((item) => {
      keys.add(item.groupId)
      if (item.children.length > 0) walk(item.children)
    })
  }
  walk(nodes)
  return keys
}

const findGroupNode = (nodes: GroupTreeNode[], groupId: string): GroupTreeNode | null => {
  for (const node of nodes) {
    if (node.groupId === groupId) return node
    const child = findGroupNode(node.children, groupId)
    if (child) return child
  }
  return null
}

const syncFormFromGroup = (node: GroupTreeNode) => {
  errors.groupName = ''
  Object.assign(groupForm, {
    groupId: node.groupId,
    groupName: node.groupName,
    parentGroupId: node.parentGroupId || '',
    parentGroupName: node.parentGroupId ? (groupNameMap[node.parentGroupId] || UNKNOWN_GROUP) : '',
    groupDescription: node.groupDescription || '',
  })
}

const buildPayload = (): GroupPayload => ({
  // 编辑时沿用已有标识；新建时由前端生成，管理员无需感知
  groupId: groupForm.groupId.trim() || generateBusinessKey('GRP'),
  groupName: groupForm.groupName.trim(),
  groupDescription: groupForm.groupDescription.trim(),
  parentGroupId: groupForm.parentGroupId.trim() || null,
})

const fetchGroups = async () => {
  loading.value = true
  try {
    const data = await getAllGroups()
    Object.keys(groupNameMap).forEach((key) => delete groupNameMap[key])
    ;(data as unknown as GroupInfo[]).forEach((group) => {
      groupNameMap[group.groupId] = group.groupName
    })
    const tree = buildGroupTree((data as unknown as GroupInfo[]) || [])
    groupTree.value = tree
    expandedKeys.value = collectExpandedKeys(tree)

    if (selectedGroupId.value) {
      const latestNode = findGroupNode(tree, selectedGroupId.value)
      selectedGroup.value = latestNode
      if (latestNode) {
        syncFormFromGroup(latestNode)
      } else {
        resetForm()
      }
    }
  } catch (e: any) {
    toast.error('加载组织列表失败: ' + (e.message || '未知错误'))
    console.error(e)
  } finally {
    loading.value = false
  }
}

const handleNodeClick = (node: GroupTreeNode) => {
  selectedGroupId.value = node.groupId
  selectedGroup.value = node
  syncFormFromGroup(node)
}

const resetForm = () => {
  errors.groupName = ''
  selectedGroupId.value = null
  selectedGroup.value = null
  Object.assign(groupForm, {
    groupId: '',
    groupName: '',
    parentGroupId: '',
    parentGroupName: '',
    groupDescription: ''
  })
}

const addChild = () => {
  const parentId = groupForm.groupId
  const parentName = groupForm.groupName
  resetForm()
  groupForm.parentGroupId = parentId
  groupForm.parentGroupName = parentName
}

const saveGroup = async () => {
  errors.groupName = !groupForm.groupName.trim() ? '请输入组织名称' : ''
  if (errors.groupName) return
  saving.value = true
  try {
    const payload = buildPayload()
    if (selectedGroup.value) {
      await updateGroup(groupForm.groupId, payload)
      toast.success('组织信息已更新')
    } else {
      payload.parentGroupId ? await createChildGroup(payload) : await createRootGroup(payload)
      toast.success('新组织创建成功')
    }
    await fetchGroups()
    if (!selectedGroup.value) resetForm()
  } catch (e: any) {
    toast.error('操作失败: ' + (e.message || '未知错误'))
    console.error(e)
  } finally {
    saving.value = false
  }
}

const handleDelete = async () => {
  if (!selectedGroupId.value || !selectedGroup.value) return
  try {
    await messageBox.danger(`确定删除 ${selectedGroup.value.groupName} 吗？此操作不可恢复。`)
    await deleteGroup(selectedGroupId.value)
    toast.success('组织已删除')
    resetForm()
    await fetchGroups()
  } catch (e: any) {
    if (e?.message !== 'cancel') {
      toast.error('删除失败: ' + (e.message || '未知错误'))
      console.error(e)
    }
  }
}

let nowTimer: number | undefined

onMounted(() => {
  fetchGroups()
  nowTimer = window.setInterval(() => {
    nowTick.value = Date.now()
  }, 30000)
})

onUnmounted(() => {
  if (nowTimer) window.clearInterval(nowTimer)
})
</script>

<style scoped>
.groups-layout {
  display: grid;
  grid-template-columns: 340px 1fr;
  gap: 24px;
  height: calc(100vh - var(--header-height) - 48px);
}

.tree-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.tree-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.tree-search {
  padding: 16px;
  border-bottom: 1px solid var(--border-base);
}

.tree-scroll-area {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.empty-tree {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-tertiary);
}

.empty-tree i { font-size: 40px; opacity: 0.2; }

.details-area {
  height: 100%;
}

.group-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.form-grid .span-full { grid-column: 1 / -1; }

.form-footer {
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid var(--border-base);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.form-footer .tip {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-tertiary);
}

.actions {
  display: flex;
  gap: 12px;
}

.quick-tools {
  margin-top: 40px;
  padding: 24px;
  background-color: var(--bg-page);
  border-radius: var(--radius-lg);
}

.section-title {
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
  color: var(--text-tertiary);
  margin-bottom: 16px;
  letter-spacing: 1px;
}

.tool-btns {
  display: flex;
  gap: 12px;
}

@media (max-width: 1024px) {
  .groups-layout { grid-template-columns: 1fr; height: auto; }
  .form-grid { grid-template-columns: 1fr; }
}

@media (max-width: 768px) {
  .groups-layout { gap: 16px; }
  /*
   * 堆叠后树容器高度塌陷（父级 height:auto，flex:1 失去参照），
   * 给出显式上限，组织树自身滚动，编辑区不会被推到很远的下方。
   */
  .tree-sidebar { height: auto; }
  .tree-scroll-area { max-height: 40vh; padding: 8px; }
  .tree-search { padding: 12px; }

  .group-form { gap: 16px; }
  .form-footer {
    margin-top: 20px;
    padding-top: 20px;
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
  }
  .form-footer .tip { order: 2; justify-content: center; font-size: 12px; }
  .actions { order: 1; }
  .actions > * { flex: 1; }

  .quick-tools { margin-top: 24px; padding: 16px; }
  /* 两个长文案按钮并排会被压成两行，改为纵向铺满 */
  .tool-btns { flex-direction: column; }
}

.page-fade-enter-active, .page-fade-leave-active {
  transition: all 0.3s ease;
}
.page-fade-enter-from, .page-fade-leave-to {
  opacity: 0;
  transform: translateX(20px);
}
</style>
