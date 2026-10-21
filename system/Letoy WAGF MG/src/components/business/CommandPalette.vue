<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { getOverview } from '@/api/campus'
import type { Device } from '@/types/campus'
import { categoryLabels } from '@/utils/campus'
import { theme, toggleTheme } from '@/utils/theme'

export interface PaletteGroup { title: string; items: { to: string; label: string; icon: string }[] }
const props = defineProps<{ open: boolean; groups: PaletteGroup[]; canRead: boolean }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()
const router = useRouter()
const query = ref('')
const active = ref(0)
const input = ref<HTMLInputElement | null>(null)
const list = ref<HTMLElement | null>(null)
const devices = ref<Device[]>([])
const deviceState = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
let fetchedAt = 0

const categoryIcons: Record<string, string> = { environment: 'ri-leaf-line', energy: 'ri-flashlight-line', facility: 'ri-building-2-line', lighting: 'ri-lightbulb-line' }

async function loadDevices() {
  if (!props.canRead || deviceState.value === 'loading' || Date.now() - fetchedAt < 30000) return
  deviceState.value = 'loading'
  try { devices.value = (await getOverview()).devices; fetchedAt = Date.now(); deviceState.value = 'ready' }
  catch { deviceState.value = 'error' }
}

interface Entry { id: string; label: string; hint: string; icon: string; section: string; run: () => void }
const close = () => emit('update:open', false)
const go = (to: string) => { close(); void router.push(to) }
const toggleFullscreen = () => { close(); if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen?.() }

const entries = computed<Entry[]>(() => {
  const text = query.value.trim().toLowerCase()
  const match = (...parts: (string | null | undefined)[]) => !text || parts.some(part => part?.toLowerCase().includes(text))
  const pages = props.groups.flatMap(group => group.items.filter(item => match(item.label, group.title)).map(item => ({ id: `page:${item.to}`, label: item.label, hint: group.title, icon: item.icon, section: '页面', run: () => go(item.to) })))
  const deviceEntries = text ? devices.value.filter(device => match(device.name, device.id, device.spaceName)).slice(0, 8).map(device => ({ id: `device:${device.id}`, label: device.name, hint: `${categoryLabels[device.category]} · ${device.spaceName || '未关联空间'}`, icon: categoryIcons[device.category] || 'ri-cpu-line', section: '设备', run: () => go(`/campus/devices/${encodeURIComponent(device.id)}`) })) : []
  const actions = [
    { id: 'action:theme', label: theme.value === 'dark' ? '切换到浅色主题' : '切换到深色主题', hint: '外观', icon: theme.value === 'dark' ? 'ri-sun-line' : 'ri-moon-line', section: '操作', run: () => { close(); toggleTheme() } },
    { id: 'action:fullscreen', label: '全屏展示模式', hint: '适合投屏讲解', icon: 'ri-fullscreen-line', section: '操作', run: toggleFullscreen },
  ].filter(item => match(item.label, item.hint))
  return [...pages, ...deviceEntries, ...actions]
})
const sections = computed(() => {
  const map = new Map<string, { entry: Entry; index: number }[]>()
  entries.value.forEach((entry, index) => { if (!map.has(entry.section)) map.set(entry.section, []); map.get(entry.section)!.push({ entry, index }) })
  return [...map]
})

watch(() => props.open, async value => {
  if (!value) return
  query.value = ''; active.value = 0
  void loadDevices()
  await nextTick(); input.value?.focus()
})
watch(query, () => { active.value = 0 })

function move(step: number) {
  if (!entries.value.length) return
  active.value = (active.value + step + entries.value.length) % entries.value.length
  void nextTick(() => list.value?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }))
}
function onKey(event: KeyboardEvent) {
  if (event.key === 'ArrowDown') { event.preventDefault(); move(1) }
  else if (event.key === 'ArrowUp') { event.preventDefault(); move(-1) }
  else if (event.key === 'Enter') { event.preventDefault(); entries.value[active.value]?.run() }
  else if (event.key === 'Escape') { event.preventDefault(); close() }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="palette">
      <div v-if="open" class="campus-palette-mask" @click.self="close">
        <div class="campus-palette" role="dialog" aria-modal="true" aria-label="快速跳转">
          <div class="palette-search">
            <i class="ri-search-2-line" aria-hidden="true"></i>
            <input ref="input" v-model="query" type="text" role="combobox" aria-expanded="true" aria-controls="palette-list" :aria-activedescendant="entries[active] ? `palette-${active}` : undefined" placeholder="搜索页面、设备名称或空间…" autocomplete="off" @keydown="onKey" />
            <kbd>Esc</kbd>
          </div>
          <div id="palette-list" ref="list" class="palette-list" role="listbox" aria-label="搜索结果">
            <template v-for="[section, items] in sections" :key="section">
              <p class="palette-section">{{ section }}</p>
              <div v-for="{ entry, index } in items" :id="`palette-${index}`" :key="entry.id" class="palette-item" role="option" :aria-selected="index === active" @mouseenter="active = index" @click="entry.run()">
                <span class="palette-icon" aria-hidden="true"><i :class="entry.icon"></i></span>
                <span class="palette-label">{{ entry.label }}</span>
                <span class="palette-hint">{{ entry.hint }}</span>
                <i class="ri-corner-down-left-line palette-enter" aria-hidden="true"></i>
              </div>
            </template>
            <p v-if="!entries.length" class="palette-empty">没有匹配的页面或设备</p>
            <p v-if="query.trim() && deviceState === 'loading'" class="palette-note">正在读取设备列表…</p>
            <p v-else-if="query.trim() && deviceState === 'error'" class="palette-note">设备列表读取失败，仅搜索页面</p>
          </div>
          <footer class="palette-foot"><span><kbd>↑</kbd><kbd>↓</kbd> 选择</span><span><kbd>Enter</kbd> 打开</span><span class="palette-brand">智慧校园 · 快速跳转</span></footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.campus-palette-mask{position:fixed;inset:0;z-index:1000;display:flex;justify-content:center;align-items:flex-start;padding:12vh 16px 16px;background:var(--bg-mask);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
.campus-palette{width:100%;max-width:620px;border-radius:22px;background:var(--surface-raised);border:1px solid var(--border-strong);box-shadow:var(--shadow-pop),0 0 0 1px color-mix(in srgb,var(--brand-2) 10%,transparent);overflow:hidden}
.palette-search{display:flex;align-items:center;gap:12px;padding:16px 18px;border-bottom:1px solid var(--border-base)}
.palette-search>i{font-size:20px;color:var(--brand-2)}
.palette-search input{flex:1;border:0!important;box-shadow:none!important;background:transparent!important;padding:4px 0!important;font-size:16px!important;min-height:32px!important;color:var(--text-main);outline:none!important}
kbd{font-family:inherit;font-size:11px;padding:2px 7px;border-radius:6px;border:1px solid var(--border-strong);background:var(--surface-inset);color:var(--text-secondary)}
.palette-list{max-height:min(52vh,440px);overflow-y:auto;padding:8px}
.palette-section{font-size:11px;font-weight:700;letter-spacing:.12em;color:var(--text-tertiary);padding:10px 12px 6px}
.palette-item{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:12px;cursor:pointer;min-height:48px;transition:background .15s}
.palette-item[aria-selected="true"]{background:linear-gradient(90deg,color-mix(in srgb,var(--brand-2) 14%,transparent),color-mix(in srgb,var(--brand-3) 6%,transparent))}
.palette-icon{width:32px;height:32px;border-radius:10px;display:grid;place-items:center;background:var(--surface-inset);color:var(--text-secondary);font-size:16px;flex-shrink:0;transition:all .2s}
.palette-item[aria-selected="true"] .palette-icon{background:var(--brand-gradient);color:#fff;box-shadow:0 6px 14px -6px var(--brand-glow)}
.palette-label{font-size:14px;font-weight:600;color:var(--text-main);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.palette-hint{margin-left:auto;font-size:12px;color:var(--text-tertiary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:45%}
.palette-enter{color:var(--text-tertiary);opacity:0;transition:opacity .15s}
.palette-item[aria-selected="true"] .palette-enter{opacity:1}
.palette-empty,.palette-note{padding:22px;text-align:center;color:var(--text-tertiary);font-size:13px}
.palette-note{padding:8px 12px 12px}
.palette-foot{display:flex;gap:16px;align-items:center;padding:10px 18px;border-top:1px solid var(--border-base);font-size:12px;color:var(--text-tertiary);background:var(--surface-inset)}
.palette-foot kbd{margin-right:3px}
.palette-brand{margin-left:auto}
.palette-enter-active{transition:opacity .2s ease}.palette-leave-active{transition:opacity .15s ease}
.palette-enter-active .campus-palette{animation:palette-pop .32s cubic-bezier(.34,1.4,.5,1)}
.palette-enter-from,.palette-leave-to{opacity:0}
@keyframes palette-pop{from{transform:translateY(-8px) scale(.96);opacity:0}to{transform:none;opacity:1}}
@media(max-width:560px){.campus-palette-mask{padding-top:8vh}.palette-foot span:not(.palette-brand){display:none}.palette-hint{display:none}}
</style>
