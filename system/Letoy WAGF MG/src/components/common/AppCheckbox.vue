<script setup lang="ts">
const props = withDefaults(defineProps<{
  modelValue: boolean
  label?: string
  disabled?: boolean
}>(), {
  disabled: false
})

const emit = defineEmits(['update:modelValue', 'change'])

const toggle = () => {
  if (props.disabled) return
  const newValue = !props.modelValue
  emit('update:modelValue', newValue)
  emit('change', newValue)
}
</script>

<template>
  <label 
    class="app-checkbox" 
    :class="{ 'is-checked': modelValue, 'is-disabled': disabled }"
    @click.prevent="toggle"
  >
    <div class="app-checkbox__box">
      <transition name="app-checkbox-check">
        <i v-if="modelValue" class="ri-check-line"></i>
      </transition>
    </div>
    <span v-if="label" class="app-checkbox__label">{{ label }}</span>
    <input 
      type="checkbox" 
      class="app-checkbox__input" 
      :checked="modelValue" 
      :disabled="disabled"
      tabindex="-1"
    />
  </label>
</template>

<style scoped>
.app-checkbox {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  user-select: none;
  vertical-align: middle;
  transition: all var(--transition-base);
}

.app-checkbox.is-disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.app-checkbox__box {
  width: 22px;
  height: 22px;
  background: var(--surface-raised);
  border: 2px solid var(--color-border-strong);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-smooth);
  color: #fff;
  font-size: 16px;
  position: relative;
  overflow: hidden;
}

.app-checkbox:hover:not(.is-disabled) .app-checkbox__box {
  border-color: var(--color-primary);
  background: var(--color-primary-glass);
}

.is-checked .app-checkbox__box {
  background: var(--color-primary);
  border-color: var(--color-primary);
  box-shadow: 0 4px 12px -4px rgba(6, 95, 70, 0.4);
}

.app-checkbox__label {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-secondary);
  transition: color 0.2s;
}

.is-checked .app-checkbox__label {
  color: var(--color-text-primary);
}

.app-checkbox__input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
  pointer-events: none;
}

/* 勾選動畫 */
.app-checkbox-check-enter-active {
  animation: check-bounce 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes check-bounce {
  0% {
    transform: scale(0) rotate(-10deg);
    opacity: 0;
  }
  70% {
    transform: scale(1.2) rotate(5deg);
  }
  100% {
    transform: scale(1) rotate(0);
    opacity: 1;
  }
}

@media (max-width: 768px) {
  /* 22px 的方框远低于最小可点面积，用内边距扩大命中区 */
  .app-checkbox {
    min-height: var(--tap-target);
    padding: 10px 4px;
    margin: -10px -4px;
  }
}
</style>
