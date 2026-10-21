<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import type { CSSProperties } from 'vue'
import { computeDropdownPosition } from '@/utils/popover'
import AppButton from './AppButton.vue'

const props = withDefaults(defineProps<{
  modelValue: string | null
  label?: string
  placeholder?: string
  disabled?: boolean
  block?: boolean
  error?: string
  required?: boolean
}>(), {
  placeholder: '選擇時間',
  disabled: false,
  block: false,
  error: '',
  required: false
})

const emit = defineEmits(['update:modelValue', 'change'])

const isOpen = ref(false)
const triggerRef = ref<HTMLElement | null>(null)
const dropdownRef = ref<HTMLElement | null>(null)
const dropdownStyle = ref<CSSProperties>({ top: '0px', left: '0px', width: 'auto' })

// 解析時間
const selectedTime = computed(() => {
  if (!props.modelValue) return { hour: '00', minute: '00' }
  const [h, m] = props.modelValue.split(':')
  return { hour: h || '00', minute: m || '00' }
})

const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))

const updatePosition = () => {
  if (!isOpen.value || !triggerRef.value) return
  // 空間不足時自動上翻，並做視口收邊
  dropdownStyle.value = computeDropdownPosition(triggerRef.value, {
    width: 200,
    minWidth: 200,
    maxHeight: 300,
  })
}

const toggle = async () => {
  if (props.disabled) return
  if (!isOpen.value) {
    isOpen.value = true
    await nextTick()
    updatePosition()
    // 滾動到當前選中項
    scrollToSelected()
  } else {
    isOpen.value = false
  }
}

const selectHour = (h: string) => {
  const newValue = `${h}:${selectedTime.value.minute}`
  emit('update:modelValue', newValue)
  emit('change', newValue)
}

const selectMinute = (m: string) => {
  const newValue = `${selectedTime.value.hour}:${m}`
  emit('update:modelValue', newValue)
  emit('change', newValue)
}

const scrollToSelected = () => {
  nextTick(() => {
    const activeHour = dropdownRef.value?.querySelector('.time-column__item.is-selected-hour')
    const activeMinute = dropdownRef.value?.querySelector('.time-column__item.is-selected-minute')
    if (activeHour) activeHour.scrollIntoView({ block: 'center', behavior: 'auto' })
    if (activeMinute) activeMinute.scrollIntoView({ block: 'center', behavior: 'auto' })
  })
}

const handleClickOutside = (event: MouseEvent) => {
  if (isOpen.value && 
      triggerRef.value && !triggerRef.value.contains(event.target as Node) &&
      dropdownRef.value && !dropdownRef.value.contains(event.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => {
  window.addEventListener('scroll', updatePosition, true)
  window.addEventListener('resize', updatePosition)
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  window.removeEventListener('scroll', updatePosition, true)
  window.removeEventListener('resize', updatePosition)
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div class="app-time-picker" :class="{ 'is-disabled': disabled, 'is-block': block, 'has-error': error }">
    <label v-if="label" class="app-time-picker__label">
      {{ label }}
      <span v-if="required" class="app-time-picker__required">*</span>
    </label>
    
    <div ref="triggerRef" class="app-time-picker__trigger" @click="toggle">
      <div class="app-time-picker__content">
        <span v-if="modelValue" class="app-time-picker__value">{{ modelValue }}</span>
        <span v-else class="app-time-picker__placeholder">{{ placeholder }}</span>
      </div>
      <div class="app-time-picker__icon">
        <i class="ri-time-line"></i>
      </div>
    </div>

    <teleport to="body">
      <transition name="app-time-picker-dropdown">
        <div 
          v-if="isOpen" 
          ref="dropdownRef"
          class="app-time-picker__dropdown"
          :style="dropdownStyle"
          @click.stop
        >
          <div class="time-columns">
            <div class="time-column">
              <div 
                v-for="h in hours" 
                :key="h" 
                class="time-column__item"
                :class="{ 'is-selected-hour': h === selectedTime.hour }"
                @click="selectHour(h)"
              >
                {{ h }}
              </div>
            </div>
            <div class="time-column">
              <div 
                v-for="m in minutes" 
                :key="m" 
                class="time-column__item"
                :class="{ 'is-selected-minute': m === selectedTime.minute }"
                @click="selectMinute(m)"
              >
                {{ m }}
              </div>
            </div>
          </div>
          <div class="time-footer">
            <AppButton type="primary" size="sm" @click="isOpen = false">確定</AppButton>
          </div>
        </div>
      </transition>
    </teleport>

    <small v-if="error" class="app-time-picker__error">{{ error }}</small>
  </div>
</template>

<style scoped>
.app-time-picker {
  display: inline-flex;
  flex-direction: column;
  gap: 12px;
  width: 180px;
  user-select: none;
}

.app-time-picker.is-block {
  display: flex;
  width: 100%;
}

.app-time-picker__label {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-secondary);
}

.app-time-picker__required {
  margin-left: 4px;
  color: var(--color-error);
}

.app-time-picker__trigger {
  height: 44px;
  padding: 0 14px;
  background: var(--surface-raised);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  transition: all var(--transition-base);
}

.app-time-picker__trigger:hover {
  border-color: var(--color-primary);
}

.app-time-picker__value {
  font-size: 14px;
  color: var(--color-text-primary);
  font-family: var(--font-family-number);
}

.app-time-picker__placeholder {
  font-size: 14px;
  color: var(--color-text-tertiary);
}

.app-time-picker__icon {
  color: var(--color-text-tertiary);
  font-size: 18px;
}

.is-disabled {
  opacity: 0.6;
  pointer-events: none;
}

.app-time-picker__error {
  color: var(--color-error);
  font-size: 12px;
}
</style>

<style>
.app-time-picker__dropdown {
  position: absolute;
  z-index: 9999;
  background: var(--surface-raised);
  border: 1px solid var(--color-border-strong);
  border-radius: 16px;
  box-shadow: var(--shadow-float);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.time-columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  height: 220px;
}

.time-column {
  overflow-y: auto;
  padding: 8px 0;
}

.time-column::-webkit-scrollbar {
  width: 4px;
}

.time-column::-webkit-scrollbar-thumb {
  background: var(--color-border-base);
  border-radius: 10px;
}

.time-column:first-child {
  border-right: 1px solid var(--color-border-base);
}

.time-column__item {
  padding: 8px 12px;
  font-size: 14px;
  text-align: center;
  cursor: pointer;
  font-family: var(--font-family-number);
  color: var(--color-text-secondary);
  transition: all 0.2s;
}

.time-column__item:hover {
  background: var(--color-bg-soft);
  color: var(--color-primary);
}

.time-column__item.is-selected-hour,
.time-column__item.is-selected-minute {
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-weight: 700;
}

.time-footer {
  padding: 8px;
  border-top: 1px solid var(--color-border-base);
  display: flex;
  justify-content: flex-end;
}

.app-time-picker-dropdown-enter-active {
  animation: picker-dropdown-in 0.2s ease-out;
}
.app-time-picker-dropdown-leave-active {
  animation: picker-dropdown-in 0.15s ease-in reverse;
}

@keyframes picker-dropdown-in {
  from { opacity: 0; transform: translateY(-8px) scaleY(0.95); }
  to { opacity: 1; transform: translateY(0) scaleY(1); }
}
</style>

@media (max-width: 768px) {
  .app-time-picker__trigger { height: var(--tap-target-lg); }
  /* 触屏滚动选择列需要更高的行高才好点中 */
  .time-columns { height: 240px; }
}
