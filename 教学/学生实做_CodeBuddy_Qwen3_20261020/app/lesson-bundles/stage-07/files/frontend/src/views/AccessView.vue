<script setup lang="ts">
import { useCampusStore } from '../stores/campus'
const store=useCampusStore()
</script>
<template><section class="workspace full-page"><h1>当前身份与校园能力</h1><p>能力只认布尔true，最终授权仍由后端执行。</p><p>当前账号：{{ store.user?.username }}；角色：{{ store.user?.roles.join('、') }}</p><table class="data-table"><thead><tr><th>能力字段</th><th>服务端值</th><th>页面解释</th></tr></thead><tbody><tr v-for="(value,key) in store.capabilities" :key="key"><td>{{ key }}</td><td>{{ value }}</td><td>{{ value===true?'允许':'不据此授予能力' }}</td></tr></tbody></table><p>用查看者直接请求写入仍应被拒。这里没有重新实现账号、密码或组织管理。</p></section></template>
