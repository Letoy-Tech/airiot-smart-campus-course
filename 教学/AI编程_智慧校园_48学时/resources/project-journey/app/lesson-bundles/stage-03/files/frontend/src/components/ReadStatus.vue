<script setup lang="ts">
defineProps<{ busy: boolean; error: string; hasData: boolean }>()
</script>
<template>
  <div v-if="error" class="notice error" role="alert">
    <strong>{{
      hasData ? '本次更新失败，以下仍是上次成功快照' : '本次读取失败，尚无成功数据'
    }}</strong>
    <p>{{ error }}</p>
  </div>
  <p v-else-if="busy" class="muted" role="status">{{ hasData ? '正在更新…' : '正在读取…' }}</p>
</template>
