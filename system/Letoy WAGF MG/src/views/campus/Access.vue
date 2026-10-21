<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useCampusStore } from '@/store/campus'
defineOptions({ name: 'CampusAccess' })
const campus = useCampusStore(); const router = useRouter(); const loading = ref(false)
const retry = async () => { loading.value = true; try { await campus.ensureCapabilities(true); if (campus.capabilities?.canRead) await router.replace('/campus/overview') } catch {} finally { loading.value = false } }
</script>
<template><div class="campus-page campus-access"><i :class="campus.error ? 'ri-cloud-off-line' : 'ri-shield-keyhole-line'" aria-hidden="true"></i><h1>{{ campus.error ? '权限服务暂不可用' : '当前账户无权访问此页面' }}</h1><p>{{ campus.error || '请由管理员核对校园角色与操作范围。' }}</p><button class="campus-button" :class="{ 'is-loading': loading }" :disabled="loading" @click="retry"><i class="ri-refresh-line" aria-hidden="true"></i>重新读取权限</button><div class="campus-access-links"><router-link v-if="campus.capabilities?.canRead" to="/campus/overview">返回校园概览</router-link><router-link to="/profile">账户信息</router-link></div></div></template>
