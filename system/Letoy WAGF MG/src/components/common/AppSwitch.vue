<script setup lang="ts">
const props = defineProps<{
  modelValue: boolean
  label?: string
  disabled?: boolean
}>()

const emit = defineEmits(['update:modelValue', 'change'])

const toggle = () => {
  emit('update:modelValue', !props.modelValue)
  emit('change', !props.modelValue)
}
</script>

<script lang="ts">
export default {
  inheritAttrs: false
}
</script>

<template>
  <label class="app-switch" :class="{ 'is-disabled': disabled }">
    <input
      type="checkbox"
      class="app-switch__input"
      :checked="modelValue"
      :disabled="disabled"
      @change="$emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
    />
    <span class="app-switch__slider"></span>
    <span v-if="label" class="app-switch__label">{{ label }}</span>
  </label>
</template>

<style scoped>
.app-switch {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
  vertical-align: middle;
}

.app-switch.is-disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.app-switch__input {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
}

.app-switch__slider {
  position: relative;
  width: 36px;
  height: 20px;
  background-color: var(--color-border-strong);
  border-radius: var(--radius-pill);
  transition: var(--transition-base);
}

.app-switch__slider::before {
  content: '';
  position: absolute;
  width: 16px;
  height: 16px;
  left: 2px;
  bottom: 2px;
  background-color: #fff;
  border-radius: 50%;
  transition: var(--transition-smooth);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.app-switch__input:checked + .app-switch__slider {
  background-color: var(--color-primary);
}

.app-switch__input:checked + .app-switch__slider::before {
  transform: translateX(16px);
}

.app-switch__label {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary);
}

.app-switch:hover .app-switch__slider {
  opacity: 0.9;
}

@media (max-width: 768px) {
  /* 滑块本体只有 36x20，低于最小可点面积，用内边距扩大命中区 */
  .app-switch {
    min-height: var(--tap-target);
    padding: 12px 4px;
    margin: -12px -4px;
  }
  .app-switch__slider { width: 44px; height: 26px; }
  .app-switch__slider::before { width: 22px; height: 22px; }
  .app-switch__input:checked + .app-switch__slider::before { transform: translateX(18px); }
  .app-switch__label { font-size: 14px; }
}
</style>
