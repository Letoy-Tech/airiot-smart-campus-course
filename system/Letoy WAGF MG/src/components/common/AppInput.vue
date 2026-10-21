<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import AppDatePicker from './AppDatePicker.vue'
import AppTextarea from './AppTextarea.vue'
import AppTimePicker from './AppTimePicker.vue'

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(
  defineProps<{
    modelValue?: any
    label?: string
    placeholder?: string
    type?: string
    error?: string
    errorMsg?: string
    disabled?: boolean
    readonly?: boolean
    required?: boolean
    rows?: number
    size?: 'sm' | 'md'
  }>(),
  {
    label: '',
    placeholder: '',
    type: 'text',
    error: '',
    errorMsg: '',
    disabled: false,
    readonly: false,
    required: false,
    rows: 4,
    size: 'md',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: any]
  blur: [event: FocusEvent]
  focus: [event: FocusEvent]
}>()

const attrs = useAttrs()
const rootAttrs = computed(() => ({
  class: attrs.class,
  style: attrs.style,
}))
const inputAttrs = computed(() => {
  const { class: _class, style: _style, ...rest } = attrs
  return rest
})

const resolvedError = computed(() => props.error || props.errorMsg)
</script>

<template>
  <AppDatePicker
    v-if="type === 'date'"
    v-bind="rootAttrs"
    :model-value="String(modelValue)"
    :label="label"
    :placeholder="placeholder"
    :disabled="disabled"
    :error="resolvedError"
    @update:model-value="emit('update:modelValue', $event)"
  />
  <AppTimePicker
    v-else-if="type === 'time'"
    v-bind="rootAttrs"
    :model-value="String(modelValue)"
    :label="label"
    :placeholder="placeholder"
    :disabled="disabled"
    :error="resolvedError"
    @update:model-value="emit('update:modelValue', $event)"
  />
  <AppTextarea
    v-else-if="type === 'textarea'"
    v-bind="rootAttrs"
    :model-value="modelValue"
    :label="label"
    :placeholder="placeholder"
    :error="resolvedError"
    :rows="rows"
    :disabled="disabled"
    :readonly="readonly"
    @update:model-value="emit('update:modelValue', $event)"
  />
  <label v-else class="app-input" v-bind="rootAttrs">
    <span v-if="label" class="app-input__label">{{ label }}<span v-if="required" class="app-input__required">*</span></span>
    <div
      class="app-input__wrapper"
      :class="{
        'app-input__wrapper--error': resolvedError,
        'app-input__wrapper--disabled': disabled,
        'app-input__wrapper--readonly': readonly,
        'app-input__wrapper--sm': size === 'sm',
      }"
    >
      <div v-if="$slots.prefix" class="app-input__prefix">
        <slot name="prefix" />
      </div>
      <input
        class="app-input__field"
        v-bind="inputAttrs"
        :value="modelValue"
        :type="type"
        :placeholder="placeholder"
        :disabled="disabled"
        :readonly="readonly"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
        @blur="emit('blur', $event as FocusEvent)"
        @focus="emit('focus', $event as FocusEvent)"
      />
      <div v-if="$slots.suffix" class="app-input__suffix">
        <slot name="suffix" />
      </div>
    </div>
    <small v-if="resolvedError" class="app-input__error">{{ resolvedError }}</small>
  </label>
</template>

<style scoped>
.app-input {
  display: grid;
  gap: 12px;
}

.app-input__label {
  color: var(--color-text-secondary);
  font-size: 13px;
  font-weight: 700;
}

.app-input__required {
  margin-left: 4px;
  color: var(--color-error);
}

.app-input__wrapper {
  display: flex;
  align-items: center;
  min-height: 44px;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  background: var(--surface-raised);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  padding: 0 14px;
  gap: 10px;
}

.app-input__wrapper:focus-within {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 4px var(--color-primary-soft);
}

.app-input__wrapper--error {
  border-color: #e11d48;
  box-shadow: 0 0 0 3px rgba(225, 29, 72, 0.08);
}

.app-input__wrapper--disabled,
.app-input__wrapper--readonly {
  background: var(--surface-inset);
}

.app-input__wrapper--sm {
  min-height: 36px;
  padding: 0 12px;
}

.app-input__prefix,
.app-input__suffix {
  display: flex;
  align-items: center;
  color: var(--color-text-tertiary);
  font-size: 18px;
  flex-shrink: 0;
}

.app-input__field {
  flex: 1;
  border: 0;
  background: transparent;
  color: var(--color-text-primary);
  height: 100%;
  padding: 0;
  font-size: 14px;
}

.app-input__field:focus {
  outline: none;
}

.app-input__field:disabled {
  cursor: not-allowed;
}

.app-input__error {
  color: #be123c;
  font-size: 12px;
  line-height: 1.5;
}

@media (max-width: 768px) {
  .app-input { gap: 8px; }
  .app-input__wrapper { min-height: var(--tap-target-lg); }
  .app-input__wrapper--sm { min-height: var(--tap-target); }
  /*
   * iOS Safari 会在聚焦 font-size < 16px 的输入框时强制放大整个页面，
   * 且失焦后不会自动还原，因此移动端必须保证 >= 16px。
   */
  .app-input__field { font-size: var(--font-size-input-mobile); }
}
</style>
