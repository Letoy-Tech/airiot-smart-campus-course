<script setup lang="ts">
import { computed, useAttrs } from 'vue'

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(
  defineProps<{
    modelValue: string | number
    label?: string
    placeholder?: string
    error?: string
    rows?: number
    disabled?: boolean
    readonly?: boolean
  }>(),
  {
    label: '',
    placeholder: '',
    error: '',
    rows: 4,
    disabled: false,
    readonly: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const attrs = useAttrs()
const rootAttrs = computed(() => ({
  class: attrs.class,
  style: attrs.style,
}))
const textareaAttrs = computed(() => {
  const { class: _class, style: _style, ...rest } = attrs
  return rest
})
</script>

<template>
  <label class="app-textarea" v-bind="rootAttrs">
    <span v-if="label" class="app-textarea__label">{{ label }}</span>
    <textarea
      class="app-textarea__field"
      :class="{
        'app-textarea__field--error': error,
      }"
      v-bind="textareaAttrs"
      :value="modelValue"
      :placeholder="placeholder"
      :rows="rows"
      :disabled="disabled"
      :readonly="readonly"
      @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    ></textarea>
    <small v-if="error" class="app-textarea__error">{{ error }}</small>
  </label>
</template>

<style scoped>
.app-textarea {
  display: grid;
  gap: 12px;
}

.app-textarea__label {
  color: var(--color-text-secondary);
  font-size: 13px;
  font-weight: 700;
}

.app-textarea__field {
  width: 100%;
  min-height: 96px;
  resize: vertical;
  border: 1px solid var(--color-border-strong);
  border-radius: 12px;
  padding: 12px 14px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--color-text-primary);
  background: var(--surface-raised);
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
}

.app-textarea__field:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 4px var(--color-primary-soft);
}

.app-textarea__field:disabled,
.app-textarea__field:read-only {
  background: var(--surface-inset);
}

.app-textarea__field--error {
  border-color: #e11d48;
  box-shadow: 0 0 0 3px rgba(225, 29, 72, 0.08);
}

.app-textarea__error {
  color: #be123c;
  font-size: 12px;
  line-height: 1.5;
}

@media (max-width: 768px) {
  .app-textarea { gap: 8px; }
  /* 同 AppInput：避免 iOS 聚焦时页面被放大 */
  .app-textarea__field { font-size: var(--font-size-input-mobile); }
}
</style>
