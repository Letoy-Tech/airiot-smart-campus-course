<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useCampusStore } from '../stores/campus'
import { pages, components, defaultPage } from '../journey/registry'
const store = useCampusStore()
const visiblePages = computed(() => pages.filter(([key]) => String(key) !== 'audit' || (store.capabilities?.canAdmin === true && store.capabilities?.canAudit === true)))
const hash = ref(location.hash)
const page = computed(() => { const name = hash.value.slice(1).split('?')[0] ?? ''; return name in components ? name : defaultPage })
function changed() { hash.value = location.hash }
window.addEventListener('hashchange', changed)
onBeforeUnmount(() => window.removeEventListener('hashchange', changed))
</script>
<template>
  <nav class="workspace-nav" aria-label="已制作的校园模块"><a v-for="[key,label,stage] in visiblePages" :key="key" :href="'#'+key" :data-testid="'nav-'+key" :aria-current="page===key?'page':undefined"><span>{{ stage }}</span>{{ label }}</a></nav>
  <div v-if="store.capabilities?.canRead !== true" class="workspace"><p class="notice error" role="alert">当前身份没有校园读取权限。请退出后核对身份。</p></div>
  <component v-else :is="components[page]" :key="page" />
</template>
