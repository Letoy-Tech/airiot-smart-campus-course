<script setup lang="ts">
import { computed } from 'vue'
import type { AlarmDetail } from '../types/full'
import { closeBlockers } from '../domain/course'
const props=defineProps<{detail:AlarmDetail}>()
const blockers=computed(()=>closeBlockers(props.detail))
</script>
<template><aside class="notice"><strong>第09站：核对当前事件再关闭</strong><p v-if="blockers.length">还缺：{{ blockers.join('；') }}</p><p v-else>页面可检查的条件已满足；仍须填写结论，由服务器核对来源、时间、权限与版本。</p></aside></template>
