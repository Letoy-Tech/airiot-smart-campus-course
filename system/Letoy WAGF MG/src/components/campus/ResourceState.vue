<script setup lang="ts">
defineProps<{ loading: boolean; error?: string; hasData: boolean; lastSuccess?: number | null; compact?: boolean }>()
defineEmits<{ retry: [] }>()
import { timeLabel } from '@/utils/campus'
</script>
<template>
  <div v-if="error" class="campus-notice error resource-error" role="alert">
    <i class="ri-error-warning-line resource-icon" aria-hidden="true"></i>
    <strong>{{ hasData ? '刷新失败，以下为上次成功数据' : '数据暂不可用' }}</strong>
    <span>{{ error }}</span>
    <span v-if="hasData">上次成功：{{ timeLabel(lastSuccess) }}</span>
    <button class="campus-button secondary" :disabled="loading" @click="$emit('retry')"><i class="ri-refresh-line" aria-hidden="true"></i>重试</button>
  </div>
  <div v-else-if="loading && !hasData" class="campus-skeleton" :class="{ compact }" role="status" aria-label="正在读取真实数据"><span></span><span></span><span></span><template v-if="!compact"><span></span><span></span><span></span></template></div>
</template>
<style scoped>
.resource-icon{font-size:18px}
.campus-skeleton.compact{grid-template-columns:1fr;gap:10px;margin:4px 0 12px}
.campus-skeleton.compact span{height:36px;grid-column:auto;border-radius:12px}
.campus-skeleton.compact span:first-child{height:180px}
</style>
