<script setup lang="ts">
import type { Point } from '@/types/campus'
import { pointLabel, qualityLabels, timeLabel } from '@/utils/campus'
defineProps<{ point?: Point }>()
</script>
<template><div class="campus-point"><strong>{{ pointLabel(point) }}</strong><span class="campus-muted"><span class="quality" :class="point?.quality || 'missing'">{{ qualityLabels[point?.quality || 'missing'] }}</span> · {{ timeLabel(point?.time) }}</span></div></template>
