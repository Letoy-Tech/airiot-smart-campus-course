<script setup lang="ts">
import { communicationLabel } from '../domain/journey-exercises'

const platformName = '我的校园值班台'

type DeviceOnline = boolean | null

const devices: Array<{ id: string; name: string; online: DeviceOnline }> = [
  { id: 'teaching_env_01', name: '环境传感器01（模拟）', online: true },
  { id: 'teaching_energy_01', name: '电能监测器01（模拟）', online: null },
]

function statusKey(value: DeviceOnline): 'online' | 'offline' | 'unknown' {
  if (value === true) return 'online'
  if (value === false) return 'offline'
  return 'unknown'
}
</script>

<template>
  <section class="workspace full-page" data-testid="static-devices">
    <header class="page-heading">
      <div>
        <p class="eyebrow">第01站 · 静态设备页</p>
        <h1>{{ platformName }}</h1>
        <p class="muted">值班老师先看设备清单和通信状态，下一站再看读数。</p>
      </div>
    </header>

    <div class="source-banner">
      <div>
        <strong>TEACHING_MOCK</strong>
        <span>两台教学模拟设备，尚未发送 HTTP 请求</span>
      </div>
      <p>在线为 true，离线为 false，未知为 null；用严格比较区分，未知不等于离线。</p>
    </div>

    <div class="ledger">
      <div class="table-scroll">
        <table class="data-table">
          <caption>教学样例设备（共 {{ devices.length }} 台）</caption>
          <thead>
            <tr>
              <th scope="col">设备名称</th>
              <th scope="col">设备编号</th>
              <th scope="col">通信状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="device in devices" :key="device.id">
              <td>
                <strong>{{ device.name }}</strong>
                <small>模拟设备 · 不连真实 AIRIOT</small>
              </td>
              <td><code>{{ device.id }}</code></td>
              <td>
                <span class="status" :class="statusKey(device.online)">
                  <span class="dot" :class="statusKey(device.online)"></span>
                  {{ communicationLabel(device.online) }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>
