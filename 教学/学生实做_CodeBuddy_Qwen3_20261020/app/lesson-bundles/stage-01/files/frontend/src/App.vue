<script setup lang="ts">
import StaticDevices from './views/StaticDevices.vue'
import { projectSettings } from './project-settings'
</script>
<template><header class="topbar"><strong>{{ projectSettings.projectTitle }}</strong><span>第01站 · 尚无后台业务</span></header><main><StaticDevices /></main></template>
