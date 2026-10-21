<script setup lang="ts">
import { communicationLabel } from '../domain/journey-exercises'
const devices = [
  { id: 'teaching_env_01', name: '环境传感器01（模拟）', online: true },
  { id: 'teaching_energy_01', name: '电能监测器01（模拟）', online: null },
]
</script>
<template>
  <section class="workspace full-page" data-testid="static-devices">
    <p class="eyebrow">第01站 · 静态页面</p><h1>先看见两台设备</h1>
    <p class="source-pill">TEACHING_MOCK · 这里只显示教学样例，尚未发送HTTP请求</p>
    <table class="data-table"><thead><tr><th>设备</th><th>编号</th><th>通信状态</th></tr></thead>
      <tbody><tr v-for="device in devices" :key="device.id"><td>{{ device.name }}</td><td>{{ device.id }}</td><td>{{ communicationLabel(device.online) }}</td></tr></tbody>
    </table><p>未知不等于离线。下一站再把静态列表接到后端。</p>
  </section>
</template>
