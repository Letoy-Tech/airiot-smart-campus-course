<script setup lang="ts" generic="T extends string | number">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

/** 分段选择器：滑动高亮块跟随当前项，按钮使用 aria-pressed。 */
const props = defineProps<{ modelValue: T; options: { value: T; label: string; icon?: string; hint?: string }[]; label: string; size?: 'sm' | 'md'; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: T] }>()
const root = ref<HTMLElement | null>(null)
const indicator = ref({ left: 0, width: 0, ready: false })
let observer: ResizeObserver | undefined

function measure() {
  const el = root.value?.querySelector<HTMLElement>('button[aria-pressed="true"]')
  if (!el) { indicator.value = { ...indicator.value, width: 0 }; return }
  indicator.value = { left: el.offsetLeft, width: el.offsetWidth, ready: true }
}
watch(() => [props.modelValue, props.options.length], () => nextTick(measure))
onMounted(() => {
  nextTick(measure)
  if (typeof ResizeObserver !== 'undefined' && root.value) { observer = new ResizeObserver(measure); observer.observe(root.value) }
})
onUnmounted(() => observer?.disconnect())
</script>

<template>
  <div ref="root" class="segment-tabs" :class="size === 'sm' ? 'sm' : ''" role="group" :aria-label="label">
    <span class="segment-indicator" :class="{ ready: indicator.ready }" :style="{ transform: `translateX(${indicator.left}px)`, width: `${indicator.width}px` }" aria-hidden="true"></span>
    <button v-for="option in options" :key="String(option.value)" type="button" :aria-pressed="modelValue === option.value" :disabled="disabled" @click="emit('update:modelValue', option.value)">
      <i v-if="option.icon" :class="option.icon" aria-hidden="true"></i>{{ option.label }}<span v-if="option.hint" class="segment-hint">{{ option.hint }}</span>
    </button>
  </div>
</template>

<style scoped>
.segment-tabs{position:relative;display:inline-flex;align-items:center;gap:2px;padding:4px;border-radius:14px;background:var(--surface-inset);border:1px solid var(--border-base);flex-shrink:0;max-width:100%;overflow-x:auto;scrollbar-width:none}
.segment-tabs::-webkit-scrollbar{display:none}
.segment-indicator{position:absolute;top:4px;bottom:4px;left:0;border-radius:10px;background:var(--surface-raised);box-shadow:0 1px 2px rgba(15,23,42,.08),0 4px 14px -6px var(--brand-glow);border:1px solid var(--border-base);opacity:0;transition:transform .38s cubic-bezier(.34,1.25,.5,1),width .38s cubic-bezier(.34,1.25,.5,1),opacity .2s}
.segment-indicator.ready{opacity:1}
.segment-tabs button{position:relative;z-index:1;display:inline-flex;align-items:center;gap:6px;min-height:34px;padding:6px 14px;border:0;background:transparent;border-radius:10px;font-size:13px;color:var(--text-secondary);cursor:pointer;white-space:nowrap;transition:color .2s}
.segment-tabs button[aria-pressed="true"]{color:var(--text-main);font-weight:600}
.segment-tabs button:disabled{cursor:not-allowed;opacity:.55}
@media(hover:hover){.segment-tabs button:not([aria-pressed="true"]):hover{color:var(--text-main)}}
.segment-tabs button i{font-size:15px}
.segment-tabs button[aria-pressed="true"] i{color:var(--brand-2)}
.segment-hint{font-size:11px;opacity:.7;font-weight:400}
.segment-tabs.sm button{min-height:30px;padding:4px 11px;font-size:12px}
@media(max-width:768px){.segment-tabs button{min-height:40px}.segment-tabs.sm button{min-height:38px}}
</style>
