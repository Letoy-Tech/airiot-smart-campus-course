<script setup lang="ts">
import { timeText } from '../domain/course'
defineProps<{ time?: number | null; business?: boolean }>()
</script>
<template>
  <aside class="source-banner">
    <div>
      <span class="source-pill"><span></span>TEACHING_MOCK</span
      ><strong>教学模拟数据 · simulated=true</strong><span>远端控制与外部通知关闭</span>
    </div>
    <p>
      <span class="clock-label">{{
        business ? '业务记录使用服务端操作时间' : `固定教学采样时刻：${timeText(time)}`
      }}</span
      >{{
        business
          ? '仅本地 DEMO 事件；与 AIRIOT 原始报警分开。'
          : '质量标签采用服务端结果；刷新只重新读取样本，不代表设备实时运行。'
      }}
    </p>
  </aside>
</template>
