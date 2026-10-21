<template>
  <div class="users-list-page">
    <!-- Filter Card -->
    <AppCard class="filter-card" :no-padding="true" :hover="false">
      <!-- 移动端：筛选条件默认折叠，让首屏直接呈现数据而不是搜索表单 -->
      <button v-if="isMobile" class="filter-toggle" @click="filterOpen = !filterOpen">
        <i class="ri-equalizer-line"></i>
        <span>筛选条件</span>
        <span v-if="activeFilterCount" class="filter-count">{{ activeFilterCount }}</span>
        <i class="ri-arrow-down-s-line chevron" :class="{ 'is-open': filterOpen }"></i>
      </button>

      <div v-show="!isMobile || filterOpen" class="filter-inner">
        <div class="filter-grid">
          <AppInput v-model="queryParams.username" label="用户名" placeholder="搜索用户名">
            <template #prefix><i class="ri-user-search-line"></i></template>
          </AppInput>
          <AppInput v-model="queryParams.nickname" label="昵称" placeholder="搜索昵称">
            <template #prefix><i class="ri-contacts-line"></i></template>
          </AppInput>
          <AppInput v-model="queryParams.phoneNumber" label="手机号" placeholder="搜索手机号">
            <template #prefix><i class="ri-phone-line"></i></template>
          </AppInput>
        </div>
        <div class="filter-footer">
          <div class="filter-tip"><i class="ri-information-line"></i> 提示：支持模糊匹配搜索</div>
          <div class="filter-actions">
            <AppButton type="ghost" size="sm" @click="resetQuery">重置</AppButton>
            <AppButton size="sm" @click="handleQuery">开始查询</AppButton>
          </div>
        </div>
      </div>
    </AppCard>

    <!-- Table Card -->
    <AppCard title="用户成员" class="table-card" tag-color="var(--primary-color)" :no-padding="true">
      <template #extra>
        <AppButton size="sm" @click="handleAdd">
          <template #icon><i class="ri-user-add-line"></i></template>新增成员
        </AppButton>
      </template>

      <!-- 桌面端：表格 -->
      <div v-if="!isMobile" class="table-container">
        <table class="v-table">
          <thead>
            <tr>
              <th>成员信息</th>
              <th>联系方式</th>
              <th>所属组织</th>
              <th>系统角色</th>
              <th>当前状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in userList" :key="user.uid">
              <td>
                <div class="user-cell">
                  <div class="user-avatar" :style="{ backgroundColor: getAvatarColor(user.username) }">
                    {{ (user.nickname || user.username).charAt(0).toUpperCase() }}
                  </div>
                  <div class="user-info">
                    <div class="user-nickname">{{ user.nickname || user.username }}</div>
                    <div class="user-uid">@{{ user.username }}</div>
                  </div>
                </div>
              </td>
              <td>
                <div class="contact-cell">
                  <div class="main-text">{{ user.phoneNumber || '-' }}</div>
                  <div class="sub-text">{{ user.email || '-' }}</div>
                </div>
              </td>
              <td>
                <div class="group-tags">
                  <StatusTag v-for="name in groupLabels(user.groupIds)" :key="name" type="info" size="sm">
                    {{ name }}
                  </StatusTag>
                  <span v-if="!user.groupIds" class="none-text">未分配</span>
                </div>
              </td>
              <td>
                <div class="role-tags">
                  <StatusTag v-for="name in roleLabels(user.roles)" :key="name" type="primary" :round="true">
                    {{ name }}
                  </StatusTag>
                </div>
              </td>
              <td>
                <div class="status-cell">
                  <div class="status-dot" :class="{ active: user.active }"></div>
                  <span :style="{ color: user.active ? 'var(--success-color)' : 'var(--text-tertiary)' }">
                    {{ user.active ? '正常运行' : '已禁用' }}
                  </span>
                </div>
              </td>
              <td>
                <div class="row-actions">
                  <AppButton type="text" size="sm" @click="handleEdit(user)"><i class="ri-edit-line"></i>编辑</AppButton>
                  <AppButton type="text" size="sm" @click="toggleStatus(user)" :style="{ color: user.active ? 'var(--error-color)' : 'var(--success-color)' }">
                    {{ user.active ? '禁用' : '启用' }}
                  </AppButton>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="userList.length === 0" class="empty-state">
          <i class="ri-user-search-line"></i>
          <p>没有匹配的成员</p>
        </div>
      </div>

      <!-- 移动端：卡片列表（表格最小宽度 900px，横向滚动在手机上几乎不可用） -->
      <div v-else class="mobile-list">
        <article v-for="user in userList" :key="user.uid" class="m-card">
          <header class="m-card__head">
            <div class="user-avatar" :style="{ backgroundColor: getAvatarColor(user.username) }">
              {{ (user.nickname || user.username).charAt(0).toUpperCase() }}
            </div>
            <div class="m-card__ident">
              <div class="user-nickname text-ellipsis">{{ user.nickname || user.username }}</div>
              <div class="user-uid text-ellipsis">@{{ user.username }}</div>
            </div>
            <div class="status-cell">
              <div class="status-dot" :class="{ active: user.active }"></div>
              <span :style="{ color: user.active ? 'var(--success-color)' : 'var(--text-tertiary)' }">
                {{ user.active ? '正常' : '已禁用' }}
              </span>
            </div>
          </header>

          <dl class="m-card__meta">
            <div class="m-row">
              <dt><i class="ri-phone-line"></i></dt>
              <dd class="text-break">{{ user.phoneNumber || '未填写手机号' }}</dd>
            </div>
            <div class="m-row">
              <dt><i class="ri-mail-line"></i></dt>
              <dd class="text-break">{{ user.email || '未填写邮箱' }}</dd>
            </div>
            <div class="m-row">
              <dt><i class="ri-node-tree"></i></dt>
              <dd>
                <div class="group-tags">
                  <StatusTag v-for="name in groupLabels(user.groupIds)" :key="name" type="info" size="sm">
                    {{ name }}
                  </StatusTag>
                  <span v-if="!user.groupIds" class="none-text">未分配组织</span>
                </div>
              </dd>
            </div>
            <div class="m-row">
              <dt><i class="ri-admin-line"></i></dt>
              <dd>
                <div class="role-tags">
                  <StatusTag v-for="name in roleLabels(user.roles)" :key="name" type="primary" :round="true">
                    {{ name }}
                  </StatusTag>
                  <span v-if="!user.roles" class="none-text">未分配角色</span>
                </div>
              </dd>
            </div>
          </dl>

          <footer class="m-card__actions">
            <AppButton type="ghost" size="sm" block @click="handleEdit(user)">
              <template #icon><i class="ri-edit-line"></i></template>编辑
            </AppButton>
            <AppButton
              :type="user.active ? 'ghost' : 'secondary'"
              size="sm"
              block
              :style="user.active ? { color: 'var(--error-color)' } : {}"
              @click="toggleStatus(user)"
            >
              {{ user.active ? '禁用' : '启用' }}
            </AppButton>
          </footer>
        </article>

        <div v-if="userList.length === 0" class="empty-state">
          <i class="ri-user-search-line"></i>
          <p>没有匹配的成员</p>
        </div>
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

    <!-- User Edit Drawer -->
    <VDrawer v-model="drawerVisible" :title="userForm.uid ? '编辑成员' : '新增成员'" @close="resetForm">
      <form @submit.prevent="submitUser">
        <AppInput v-model="userForm.username" label="用户名" :required="true" :disabled="!!userForm.uid" />
        <AppInput v-if="!userForm.uid" v-model="userForm.password" label="初始密码" type="password" :required="true" />
        <AppInput v-model="userForm.nickname" label="昵称" :required="true" />
        <AppInput v-model="userForm.phoneNumber" label="手机号" />
        <AppInput v-model="userForm.email" label="邮箱" />
        <AppSelect
          v-model="selectedGroupIds"
          label="所属组织"
          placeholder="请选择所属组织"
          :multiple="true"
          :options="groupOptions"
        />
        <AppSelect
          v-if="userForm.uid"
          v-model="selectedRoleCodes"
          label="账户角色"
          placeholder="分配已有角色"
          :multiple="true"
          :disabled="!authStore.roleDefinitionsLoaded || submitting"
          :options="roleOptions"
        />
        <p class="campus-footnote">{{ userForm.uid ? '校园权限由 BE 的内置角色策略决定。角色名称或自定义角色不会自动获得校园操作权限。' : '新账户保存后，编辑该账户分配已有校园角色。' }}</p>
      </form>
      <template #footer>
        <AppButton type="ghost" @click="drawerVisible = false">取消</AppButton>
        <AppButton :loading="submitting" @click="submitUser">保存成员</AppButton>
      </template>
    </VDrawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { queryUsers, saveUser, updateUserStatus } from '@/api/users'
import { updateUserRoles } from '@/api/roles'
import { getAllGroups } from '@/api/groups'
import { useAuthStore } from '@/store/auth'
import { useCampusStore } from '@/store/campus'
import { useRouter } from 'vue-router'
import { toast } from '@/utils/toast'
import AppCard from '@/components/common/AppCard.vue'
import AppInput from '@/components/common/AppInput.vue'
import AppButton from '@/components/common/AppButton.vue'
import StatusTag from '@/components/common/StatusTag.vue'
import VDrawer from '@/components/common/VDrawer.vue'
import AppSelect from '@/components/common/AppSelect.vue'
import VPagination from '@/components/common/VPagination.vue'
import { useIsMobile } from '@/utils/responsive'
import { resolveLabels, splitCsv, UNKNOWN_GROUP, UNKNOWN_ROLE } from '@/utils/label'

const isMobile = useIsMobile()
const filterOpen = ref(false)
const userList = ref<any[]>([])
const groupList = ref<any[]>([])
const groupMap = reactive<Record<string, string>>({})
const groupsReady = ref(false)
const authStore = useAuthStore()
const campusStore = useCampusStore()
const router = useRouter()
const selectedGroupIds = ref<string[]>([])
const selectedRoleCodes = ref<string[]>([])
const total = ref(0)
const drawerVisible = ref(false)
const submitting = ref(false)

const queryParams = reactive({ pageNum: 1, pageSize: 10, username: '', nickname: '', phoneNumber: '' })
const userForm = reactive<any>({ uid: '', username: '', password: '', nickname: '', phoneNumber: '', email: '', groupIds: '' })

const activeFilterCount = computed(
  () => [queryParams.username, queryParams.nickname, queryParams.phoneNumber].filter(Boolean).length,
)

const groupOptions = computed(() => groupList.value.map(g => ({
  label: g.groupName,
  value: g.groupId
})))
const roleOptions = computed(() => [...new Set([...Object.keys(authStore.roleNameMap), ...selectedRoleCodes.value])].map(value => ({ value, label: authStore.roleNameMap[value] || UNKNOWN_ROLE })))

const flattenGroups = (groups: any[], level = 0): any[] => {
  return groups.flatMap((g: any) => {
    const current = {
      ...g,
      groupName: `${'　'.repeat(level)}${g.groupName}`
    }
    const children = Array.isArray(g.children) ? flattenGroups(g.children, level + 1) : []
    return [current, ...children]
  })
}

const buildGroupMap = (groups: any[]) => {
  groups.forEach((g: any) => {
    groupMap[g.groupId] = g.groupName.replace(/^[　]+/, '')
    if (Array.isArray(g.children) && g.children.length > 0) {
      buildGroupMap(g.children)
    }
  })
}

const fetchGroups = async () => {
  try {
    const data = await getAllGroups()
    groupList.value = flattenGroups(data as unknown as any[])
    buildGroupMap(data as unknown as any[])
  } catch (e) { console.error('Fetch groups failed', e) }
  finally { groupsReady.value = true }
}

// 标识 → 名称：只展示组织名 / 角色名，不向管理员暴露组织 ID 与角色编码
const groupLabels = (groupIds?: string) =>
  resolveLabels(splitCsv(groupIds), groupMap, groupsReady.value, UNKNOWN_GROUP)
const roleLabels = (roleCodes?: string) =>
  resolveLabels(splitCsv(roleCodes), authStore.roleNameMap, authStore.roleDefinitionsLoaded, UNKNOWN_ROLE)

const handleQuery = async () => {
  try {
    const res = await queryUsers(queryParams)
    userList.value = res.list
    total.value = res.total
  } catch (e) { console.error(e) }
}

const handleSizeChange = (size: number) => {
  queryParams.pageSize = size
  queryParams.pageNum = 1
  handleQuery()
}

const handleEdit = (user: any) => {
  Object.assign(userForm, { ...user, password: '' })
  selectedGroupIds.value = splitCsv(user.groupIds)
  selectedRoleCodes.value = splitCsv(user.roles)
  drawerVisible.value = true
}

const handleAdd = () => { resetForm(); drawerVisible.value = true }
const resetForm = () => {
  Object.assign(userForm, { uid: '', username: '', password: '', nickname: '', phoneNumber: '', email: '', groupIds: '' })
  selectedGroupIds.value = []
  selectedRoleCodes.value = []
}

const submitUser = async () => {
  if (!userForm.username || (!userForm.uid && !userForm.password)) return toast.warning('请填写必填项')
  userForm.groupIds = selectedGroupIds.value.join(',')
  submitting.value = true
  let profileSaved = false
  try {
    await saveUser(userForm)
    profileSaved = true
    if (userForm.uid && authStore.roleDefinitionsLoaded) await updateUserRoles(userForm.uid, selectedRoleCodes.value)
    if (userForm.uid === authStore.user?.uid) {
      await authStore.fetchMe()
      await campusStore.ensureCapabilities(true)
      if (!campusStore.capabilities?.canAdmin) await router.replace('/campus/overview')
    }
    toast.success('保存成功')
    drawerVisible.value = false
    handleQuery()
  } catch (e: any) { toast.error((profileSaved ? '用户资料已保存，后续角色或权限回读未完成：' : '保存失败：') + e.message) }
  finally { submitting.value = false }
}

const toggleStatus = async (user: any) => {
  try {
    await updateUserStatus(user.uid, !user.active)
    user.active = !user.active
    toast.success('状态已更新')
  } catch (e) { console.error(e) }
}

const resetQuery = () => { Object.assign(queryParams, { pageNum: 1, username: '', nickname: '', phoneNumber: '' }); handleQuery() }
const getAvatarColor = (name: string) => {
  const colors = ['#0ea5e9', '#10b981', '#f59e0b', '#6366f1', '#f43f5e']
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

onMounted(() => {
  void authStore.ensureRoleDefinitions()
  fetchGroups()
  handleQuery()
})
</script>

<style scoped>
.users-list-page { display: flex; flex-direction: column; gap: 24px; }
.filter-inner { padding: 24px; }
.filter-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px; }
.filter-footer { margin-top: 20px; display: flex; justify-content: space-between; align-items: center; padding-top: 20px; border-top: 1px solid var(--border-base); }
.filter-tip { font-size: 13px; color: var(--text-tertiary); }
.filter-actions { display: flex; gap: 12px; }
.table-container { overflow-x: auto; }
.v-table { width: 100%; border-collapse: collapse; min-width: 900px; }
.v-table th { background-color: #fafafa; text-align: left; padding: 16px 20px; font-size: 11px; font-weight: 800; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid var(--border-base); }
.v-table td { padding: 20px; border-bottom: 1px solid var(--border-base); vertical-align: middle; }
.v-table tr:hover td { background-color: #fcfdfe; }
.user-cell { display: flex; align-items: center; gap: 14px; }
.user-avatar { width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white; font-weight: 800; font-size: 16px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
.user-nickname { font-weight: 700; color: var(--text-main); font-size: 15px; }
.user-uid { font-size: 12px; color: var(--text-tertiary); }
.contact-cell .main-text { font-weight: 600; font-size: 14px; color: var(--text-main); }
.contact-cell .sub-text { font-size: 12px; color: var(--text-tertiary); }
.group-tags { display: flex; flex-wrap: wrap; gap: 4px; }
.status-cell { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; }
.status-dot { width: 8px; height: 8px; border-radius: 50%; background-color: var(--text-disabled); }
.status-dot.active { background-color: var(--success-color); box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15); animation: pulse 2s infinite; }
@keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); } 70% { box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); } 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); } }
.role-tags { display: flex; flex-wrap: wrap; gap: 6px; }
.row-actions { display: flex; gap: 12px; }
.v-label { font-size: 13px; font-weight: 700; color: var(--text-secondary); margin-bottom: 8px; display: block; }
.none-text { color: var(--text-tertiary); font-size: 12px; }

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

.empty-state { padding: 56px 24px; text-align: center; color: var(--text-tertiary); }
.empty-state i { font-size: 40px; opacity: 0.35; display: block; margin-bottom: 12px; }
.empty-state p { font-size: 14px; }

/* ---------------- 移动端卡片列表 ---------------- */
.mobile-list { display: flex; flex-direction: column; gap: 12px; padding: 12px; }

.m-card {
  border: 1px solid var(--border-base);
  border-radius: var(--radius-lg);
  background: var(--bg-card);
  overflow: hidden;
}

.m-card__head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-base);
}

.m-card__ident { flex: 1; min-width: 0; }

.m-card__meta { padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; }

.m-row { display: flex; align-items: flex-start; gap: 10px; }
.m-row dt { color: var(--text-tertiary); font-size: 16px; line-height: 20px; flex-shrink: 0; width: 20px; }
.m-row dd { flex: 1; min-width: 0; font-size: 13px; color: var(--text-secondary); line-height: 20px; }

.m-card__actions {
  display: flex;
  gap: 10px;
  padding: 12px 16px;
  background: #fafbfc;
  border-top: 1px solid var(--border-base);
}

@media (max-width: 768px) {
  .users-list-page { gap: 16px; }
  .filter-inner { padding: 4px 16px 16px; border-top: 1px solid var(--border-base); }
  .filter-grid { grid-template-columns: 1fr; gap: 14px; }
  .filter-footer {
    margin-top: 16px;
    padding-top: 16px;
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  /* 提示文案在窄屏属于次要信息，优先保证操作按钮的可点面积 */
  .filter-tip { order: 2; text-align: center; font-size: 12px; }
  .filter-actions { order: 1; }
  .filter-actions > * { flex: 1; }
  .user-avatar { width: 44px; height: 44px; font-size: 17px; }
  .status-cell { font-size: 12px; flex-shrink: 0; }
}
</style>
