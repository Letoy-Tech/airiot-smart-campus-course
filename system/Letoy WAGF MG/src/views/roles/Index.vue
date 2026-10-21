<template>
  <div class="roles-page">
    <div class="roles-header">
      <div class="header-text">
        <h1>身份与角色</h1>
        <p>管理角色名称与描述。校园能力由 BE 对内置角色执行固定策略，修改名称不改变权限。</p>
      </div>
      <AppButton @click="handleAddRole">
        <template #icon><i class="ri-shield-user-line"></i></template>
        新增系统角色
      </AppButton>
    </div>

    <!-- Roles Grid -->
    <div class="roles-grid">
      <AppCard 
        v-for="role in roleList" 
        :key="role.roleCode" 
        class="role-item-card"
        tag-color="var(--primary-color)"
      >
        <div class="role-card-body">
          <div class="role-icon"><i :class="getRoleIcon(role)"></i></div>
          <div class="role-main">
            <div class="role-name">{{ role.roleName }}</div>
            <p class="role-desc">{{ role.description || '暂无详细职能说明' }}</p>
          </div>
        </div>
        <template #footer>
          <div class="role-card-actions">
            <AppButton type="text" size="sm" @click="handleEditRole(role)">
              <i class="ri-settings-line"></i> 编辑定义
            </AppButton>
            <AppButton type="text" size="sm" @click="handleDeleteRole(role)" :style="{color: 'var(--error-color)'}">
              <i class="ri-delete-bin-7-line"></i> 删除
            </AppButton>
          </div>
        </template>
      </AppCard>

      <div class="add-role-placeholder" @click="handleAddRole">
        <i class="ri-add-circle-line"></i>
        <span>定义新角色</span>
      </div>
    </div>

    <!-- Role Edit Drawer -->
    <VDrawer v-model="drawerVisible" :title="roleForm.isEdit ? '编辑角色定义' : '定义新系统角色'">
      <form class="role-form" @submit.prevent="submitRole">
        <AppInput 
          v-model="roleForm.roleName" 
          label="角色显示名称" 
          placeholder="描述该角色的身份"
          required
          :error-msg="errorMsgs.roleName"
        >
          <template #prefix><i class="ri-font-size"></i></template>
        </AppInput>
        <AppInput v-model="roleForm.description" label="职能详细描述" placeholder="说明该角色拥有的业务权限范围">
          <template #prefix><i class="ri-text-snippet"></i></template>
        </AppInput>
      </form>
      <template #footer>
        <AppButton type="ghost" @click="drawerVisible = false">取消</AppButton>
        <AppButton :loading="submitting" @click="submitRole">
          <template #icon><i class="ri-save-line"></i></template>保存定义
        </AppButton>
      </template>
    </VDrawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import AppCard from '@/components/common/AppCard.vue'
import AppButton from '@/components/common/AppButton.vue'
import AppInput from '@/components/common/AppInput.vue'
import VDrawer from '@/components/common/VDrawer.vue'
import { messageBox } from '@/utils/messageBox'
import { getAllRoles, deleteRole, createRole, updateRole } from '@/api/roles'
import { toast } from '@/utils/toast'
import { generateBusinessKey } from '@/utils/label'

const roleList = ref<any[]>([])
const drawerVisible = ref(false)
const submitting = ref(false)
const loading = ref(false)

const roleForm = reactive({
  roleCode: '',
  roleName: '',
  description: '',
  isEdit: false
})

const errorMsgs = reactive({
  roleName: ''
})

const fetchRoles = async () => {
  loading.value = true
  try {
    const data = await getAllRoles()
    roleList.value = data
  } catch (e: any) {
    toast.error('获取角色列表失败: ' + (e.message || '未知错误'))
    console.error(e)
  } finally {
    loading.value = false
  }
}

const handleAddRole = () => {
  Object.assign(roleForm, {
    roleCode: '',
    roleName: '',
    description: '',
    isEdit: false
  })
  errorMsgs.roleName = ''
  drawerVisible.value = true
}

const handleEditRole = (role: any) => {
  Object.assign(roleForm, {
    roleCode: role.roleCode,
    roleName: role.roleName,
    description: role.description,
    isEdit: true
  })
  errorMsgs.roleName = ''
  drawerVisible.value = true
}

const submitRole = async () => {
  errorMsgs.roleName = !roleForm.roleName.trim() ? '请输入角色名称' : ''
  if (errorMsgs.roleName) return

  submitting.value = true
  try {
    if (roleForm.isEdit) {
      await updateRole(roleForm.roleCode, roleForm as any)
      toast.success('角色定义已更新')
    } else {
      await createRole({ ...roleForm, roleCode: generateBusinessKey('ROLE') } as any)
      toast.success('角色定义已保存')
    }
    drawerVisible.value = false
    fetchRoles()
  } catch (e: any) {
    toast.error('操作失败: ' + (e.message || '未知错误'))
    console.error(e)
  } finally {
    submitting.value = false
  }
}

const handleDeleteRole = async (role: any) => {
  try {
    await messageBox.danger(`确定删除角色 [${role.roleName}] 吗？此操作不可恢复。`)
    await deleteRole(role.roleCode)
    toast.success('角色已成功移除')
    fetchRoles()
  } catch (e: any) {
    if (e?.message !== 'cancel') {
      toast.error('删除失败: ' + (e.message || '未知错误'))
      console.error(e)
    }
  }
}

// 预置角色可从编码识别；新建角色编码为自动生成，需结合名称判断
const getRoleIcon = (role: { roleCode?: string; roleName?: string }) => {
  const code = (role.roleCode || '').toUpperCase()
  const name = role.roleName || ''
  if (code.includes('ADMIN')) return 'ri-admin-fill'
  if (code.includes('AUDIT')) return 'ri-eye-2-fill'
  if (code.includes('USER')) return 'ri-user-3-fill'
  // 自动生成的编码不含语义，按名称兜底；「成员管理员」应归为成员类，故先判断成员再判断管理员
  if (/审计|查看|只读/.test(name)) return 'ri-eye-2-fill'
  if (/成员|用户|员工/.test(name)) return 'ri-user-3-fill'
  if (/管理员|超管/.test(name)) return 'ri-admin-fill'
  return 'ri-shield-star-fill'
}

onMounted(fetchRoles)
</script>

<style scoped>
.roles-page { display: flex; flex-direction: column; gap: 24px; }
.roles-header { display: flex; justify-content: space-between; align-items: center; }
.header-text h1 { font-size: 24px; font-weight: 800; color: var(--text-main); letter-spacing: -0.5px; }
.header-text p { color: var(--text-tertiary); font-size: 14px; margin-top: 4px; }
.roles-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 24px; }
.role-card-body { display: flex; gap: 20px; }
.role-icon { width: 48px; height: 48px; background-color: var(--primary-light); color: var(--primary-color); border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 24px; }
.role-main { flex: 1; }
.role-name { font-size: 16px; font-weight: 800; color: var(--text-main); }
.role-desc { font-size: 13px; color: var(--text-tertiary); line-height: 1.5; margin-top: 6px; }
.role-card-actions { display: flex; justify-content: space-between; width: 100%; }
.add-role-placeholder { border: 2px dashed var(--border-strong); border-radius: var(--radius-lg); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; color: var(--text-tertiary); cursor: pointer; transition: all 0.3s; min-height: 180px; }
.add-role-placeholder i { font-size: 32px; }
.add-role-placeholder span { font-weight: 700; font-size: 14px; }
.add-role-placeholder:hover { border-color: var(--primary-color); color: var(--primary-color); background-color: var(--primary-light); }
.role-form { display: flex; flex-direction: column; gap: 8px; }

@media (max-width: 768px) {
  .roles-page { gap: 16px; }
  /* 顶部标题与主操作在窄屏纵向排列，按钮铺满一行更好点 */
  .roles-header { flex-direction: column; align-items: stretch; gap: 16px; }
  .header-text h1 { font-size: 20px; }
  .header-text p { font-size: 13px; }

  /* minmax(300px) 在 375px 屏上会溢出，改为单列 */
  .roles-grid { grid-template-columns: 1fr; gap: 12px; }
  .role-card-body { gap: 14px; }
  .role-icon { width: 42px; height: 42px; font-size: 21px; border-radius: 12px; }
  .add-role-placeholder { min-height: 110px; }
}
</style>
