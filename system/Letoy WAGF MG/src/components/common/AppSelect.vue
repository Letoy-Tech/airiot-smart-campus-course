<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import type { CSSProperties, PropType } from 'vue'
import { useIsMobile } from '@/utils/responsive'
import { setBodyScrollLock, unlockBodyScroll } from '@/utils/scrollLock'

type SelectValue = any

interface Option {
  label: string
  value: SelectValue
  disabled?: boolean
}

const props = defineProps({
  modelValue: [String, Number, Boolean, Array, Object],
  options: {
    type: Array as PropType<Option[]>,
    default: () => []
  },
  label: String,
  placeholder: {
    type: String,
    default: '请选择'
  },
  disabled: Boolean,
  block: {
    type: Boolean,
    default: true
  },
  multiple: Boolean,
  required: Boolean
})

const emit = defineEmits(['update:modelValue', 'change'])

const isOpen = ref(false)
const isMobile = useIsMobile()
const triggerRef = ref<HTMLElement | null>(null)
const dropdownRef = ref<HTMLElement | null>(null)
const dropdownStyle = ref<CSSProperties>({
  top: '0px',
  left: '0px',
  width: '0px'
})

const selectedValues = computed<SelectValue[]>(() => {
  if (props.multiple && Array.isArray(props.modelValue)) {
    return props.modelValue
  }
  return []
})

const singleValue = computed<SelectValue | undefined>(() => {
  if (!Array.isArray(props.modelValue)) {
    return props.modelValue
  }
  return undefined
})

const hasSingleValue = computed(() => {
  if (props.multiple) return false
  return singleValue.value !== undefined && singleValue.value !== null && singleValue.value !== ''
})

const DROPDOWN_MAX_HEIGHT = 272
const VIEWPORT_MARGIN = 8

const updatePosition = () => {
  // 移动端走底部选择器，无需计算浮层坐标
  if (!isOpen.value || !triggerRef.value || isMobile.value) return

  const rect = triggerRef.value.getBoundingClientRect()
  const scrollY = window.scrollY || window.pageYOffset
  const scrollX = window.scrollX || window.pageXOffset

  const spaceBelow = window.innerHeight - rect.bottom
  const spaceAbove = rect.top
  // 下方空间不足且上方更宽裕时向上翻转，避免浮层被挤出视口
  const flipUp = spaceBelow < DROPDOWN_MAX_HEIGHT + VIEWPORT_MARGIN && spaceAbove > spaceBelow
  const available = Math.max(120, (flipUp ? spaceAbove : spaceBelow) - VIEWPORT_MARGIN * 2)

  const width = rect.width
  // 横向收边，右侧不溢出视口
  const left = Math.min(
    Math.max(VIEWPORT_MARGIN, rect.left),
    Math.max(VIEWPORT_MARGIN, window.innerWidth - width - VIEWPORT_MARGIN),
  )

  dropdownStyle.value = flipUp
    ? {
        top: `${rect.top + scrollY - Math.min(DROPDOWN_MAX_HEIGHT, available) - VIEWPORT_MARGIN}px`,
        left: `${left + scrollX}px`,
        width: `${width}px`,
        maxHeight: `${Math.min(DROPDOWN_MAX_HEIGHT, available)}px`,
      }
    : {
        top: `${rect.bottom + scrollY + VIEWPORT_MARGIN}px`,
        left: `${left + scrollX}px`,
        width: `${width}px`,
        maxHeight: `${Math.min(DROPDOWN_MAX_HEIGHT, available)}px`,
      }
}

const toggle = async () => {
  if (props.disabled) return

  isOpen.value = !isOpen.value
  if (isOpen.value) {
    await nextTick()
    updatePosition()
  }
}

const close = () => {
  isOpen.value = false
}

// 移动端选择器展开时锁定背景滚动
let scrollLockHeld = false
watch([isOpen, isMobile], ([open, mobile]) => {
  scrollLockHeld = setBodyScrollLock(Boolean(open && mobile), scrollLockHeld)
})

onUnmounted(() => {
  if (scrollLockHeld) {
    unlockBodyScroll()
    scrollLockHeld = false
  }
})

const getOptionLabel = (value?: SelectValue) => {
  if (value === undefined) return ''
  const found = props.options.find((option) => option.value === value)
  return found ? found.label : String(value)
}

const isSelected = (value: SelectValue) => {
  if (props.multiple) {
    return selectedValues.value.includes(value)
  }
  return singleValue.value === value
}

const select = (option: Option) => {
  if (option.disabled) return

  if (props.multiple) {
    const current = [...selectedValues.value]
    const index = current.indexOf(option.value)

    if (index > -1) {
      current.splice(index, 1)
    } else {
      current.push(option.value)
    }

    emit('update:modelValue', current)
    emit('change', current)
    return
  }

  emit('update:modelValue', option.value)
  emit('change', option.value)
  close()
}

const removeValue = (value: SelectValue) => {
  if (!Array.isArray(props.modelValue)) return
  const current = props.modelValue.filter((item) => item !== value)
  emit('update:modelValue', current)
  emit('change', current)
}

const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as Node | null
  if (!target || !isOpen.value || isMobile.value) return

  if (triggerRef.value?.contains(target) || dropdownRef.value?.contains(target)) {
    return
  }

  close()
}

watch(
  () => props.modelValue,
  async () => {
    if (!isOpen.value) return
    await nextTick()
    updatePosition()
  }
)

watch(
  () => props.disabled,
  (disabled) => {
    if (disabled) {
      close()
    }
  }
)

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
  <div 
    class="app-select-container" 
    :class="{ 'is-open': isOpen, 'is-disabled': disabled, 'is-block': block }"
  >
    <label v-if="label" class="app-select-label-row">
      {{ label }} <span v-if="required" class="app-select-required">*</span>
    </label>

    <div ref="triggerRef" class="app-select-trigger" @click="toggle">
      <div class="app-select-value-box">
        <template v-if="multiple && selectedValues.length > 0">
          <span v-for="value in selectedValues" :key="String(value)" class="app-select-tag">
            {{ getOptionLabel(value) }}
            <i class="ri-close-line" @click.stop="removeValue(value)"></i>
          </span>
        </template>
        <span v-else-if="hasSingleValue" class="app-select-label">{{ getOptionLabel(singleValue) }}</span>
        <span v-else class="app-select-placeholder">{{ placeholder }}</span>
      </div>
      <div class="app-select-arrow">
        <i class="ri-arrow-down-s-line"></i>
      </div>
    </div>

    <teleport to="body">
      <!-- 移动端：底部选择器。浮层定位在小屏上容易被键盘 / 视口边界截断，
           且 260px 的滚动区在手机上过窄，改为原生 App 常见的 bottom sheet -->
      <template v-if="isMobile">
        <transition name="app-select-mask">
          <div v-if="isOpen" class="app-select-mask" @click="close"></div>
        </transition>
        <transition name="app-select-sheet">
          <div v-if="isOpen" ref="dropdownRef" class="app-select-sheet" @click.stop>
            <div class="app-select-sheet__grabber"></div>
            <header class="app-select-sheet__head">
              <span class="app-select-sheet__title">{{ label || placeholder }}</span>
              <button type="button" class="app-select-sheet__done" @click="close">
                {{ multiple ? '完成' : '取消' }}
              </button>
            </header>
            <div class="app-select-list app-select-list--sheet">
              <div
                v-for="option in options"
                :key="String(option.value)"
                class="app-select-option"
                :class="{
                  'is-selected': isSelected(option.value),
                  'is-multiple': multiple,
                  'is-disabled': option.disabled,
                }"
                @click="select(option)"
              >
                <div v-if="multiple" class="app-select-checkbox">
                  <i v-if="isSelected(option.value)" class="ri-check-line"></i>
                </div>
                <span class="option-label">{{ option.label }}</span>
                <i v-if="!multiple && isSelected(option.value)" class="ri-check-line select-check"></i>
              </div>
              <div v-if="options.length === 0" class="app-select-empty">
                暂无选项
              </div>
            </div>
          </div>
        </transition>
      </template>

      <transition v-else name="app-select-dropdown">
        <div 
          v-if="isOpen" 
          ref="dropdownRef"
          class="app-select-dropdown"
          :style="dropdownStyle"
          @click.stop
        >
          <div class="app-select-list">
            <div 
              v-for="option in options" 
              :key="String(option.value)"
              class="app-select-option"
              :class="{
                'is-selected': isSelected(option.value),
                'is-multiple': multiple,
                'is-disabled': option.disabled,
              }"
              @click="select(option)"
            >
              <div v-if="multiple" class="app-select-checkbox">
                <i v-if="isSelected(option.value)" class="ri-check-line"></i>
              </div>
              <span class="option-label">{{ option.label }}</span>
              <i v-if="!multiple && isSelected(option.value)" class="ri-check-line select-check"></i>
            </div>
            <div v-if="options.length === 0" class="app-select-empty">
              暂无选项
            </div>
          </div>
        </div>
      </transition>
    </teleport>
  </div>
</template>

<style scoped>
.app-select-container {
  display: inline-flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  user-select: none;
}

.app-select-container.is-block {
  display: flex;
  width: 100%;
}

.app-select-label-row {
  color: var(--color-text-secondary);
  font-size: 13px;
  font-weight: 700;
}

.app-select-required {
  color: var(--color-error);
}

.app-select-trigger {
  min-height: 44px;
  padding: 6px 14px;
  background: var(--surface-raised);
  border: 1px solid var(--color-border-strong);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  transition: all var(--transition-base);
}

.app-select-trigger:hover {
  border-color: var(--color-primary);
  background: var(--color-bg-soft);
}

.is-open .app-select-trigger {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 4px var(--color-primary-glass);
}

.app-select-value-box {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.app-select-label {
  font-size: 14px;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.app-select-placeholder {
  font-size: 14px;
  color: var(--color-text-tertiary);
}

.app-select-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
  color: var(--color-primary);
  background: var(--color-primary-soft);
}

.app-select-tag i {
  cursor: pointer;
  font-size: 14px;
}

.app-select-arrow {
  color: var(--color-text-tertiary);
  font-size: 18px;
  transition: transform 0.3s;
  display: grid;
  place-items: center;
}

.is-open .app-select-arrow {
  transform: rotate(180deg);
  color: var(--color-primary);
}

@media (max-width: 768px) {
  .app-select-trigger { min-height: var(--tap-target-lg); }
  .app-select-label,
  .app-select-placeholder { font-size: var(--font-size-input-mobile); }
}

/* 禁用狀態 */
.app-select-container.is-disabled {
  opacity: 0.6;
  pointer-events: none;
}
.app-select-container.is-disabled .app-select-trigger {
  background: var(--color-bg-soft);
}
</style>

<style>
.app-select-dropdown {
  position: absolute;
  z-index: 9999;
  background: var(--surface-raised);
  border: 1px solid var(--color-border-strong);
  border-radius: 12px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
  overflow: hidden;
  transform-origin: top;
  user-select: none;
}

.app-select-list {
  max-height: 260px;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  padding: 6px;
}

/* ---------------- 移动端底部选择器 ---------------- */
.app-select-mask {
  position: fixed;
  inset: 0;
  z-index: 9998;
  background: var(--bg-mask);
  backdrop-filter: blur(2px);
}

.app-select-sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
  background: var(--surface-raised);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  box-shadow: 0 -10px 30px rgba(0, 0, 0, 0.14);
  display: flex;
  flex-direction: column;
  max-height: 70vh;
  padding-bottom: var(--safe-bottom);
}

@supports (max-height: 70dvh) {
  .app-select-sheet { max-height: 70dvh; }
}

.app-select-sheet__grabber {
  width: 40px;
  height: 4px;
  border-radius: var(--radius-pill);
  background: var(--color-border-strong);
  margin: 10px auto 0;
  flex-shrink: 0;
}

.app-select-sheet__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border-base);
  flex-shrink: 0;
}

.app-select-sheet__title {
  font-size: 15px;
  font-weight: 800;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-select-sheet__done {
  flex-shrink: 0;
  min-height: 36px;
  padding: 0 14px;
  border: 0;
  border-radius: var(--radius-sm);
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.app-select-list--sheet {
  max-height: none;
  flex: 1;
  min-height: 0;
  padding: 8px;
}

/* 选项在触屏上需要更大的可点区域 */
.app-select-list--sheet .app-select-option {
  min-height: var(--tap-target-lg);
  padding: 12px 14px;
  font-size: 15px;
}

.app-select-mask-enter-active, .app-select-mask-leave-active { transition: opacity 0.25s ease; }
.app-select-mask-enter-from, .app-select-mask-leave-to { opacity: 0; }

.app-select-sheet-enter-active { transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1); }
.app-select-sheet-leave-active { transition: transform 0.22s ease-in; }
.app-select-sheet-enter-from, .app-select-sheet-leave-to { transform: translateY(100%); }

/* 滾動條優化 */
.app-select-list::-webkit-scrollbar {
  width: 4px;
}
.app-select-list::-webkit-scrollbar-thumb {
  background: var(--color-border-strong);
  border-radius: 10px;
}

.app-select-option {
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 14px;
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  transition: all 0.2s;
}

.app-select-option:hover {
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.app-select-option.is-disabled {
  color: var(--color-text-tertiary);
  background: transparent;
  cursor: not-allowed;
  opacity: 0.6;
}

.app-select-option.is-disabled:hover {
  background: transparent;
  color: var(--color-text-tertiary);
}

.app-select-option.is-selected {
  background: var(--color-primary-glass);
  color: var(--color-primary);
  font-weight: 600;
}

.app-select-option.is-selected.is-disabled {
  background: rgba(148, 163, 184, 0.14);
  color: var(--color-text-secondary);
}

.app-select-checkbox {
  width: 18px;
  height: 18px;
  border: 2px solid var(--color-border-strong);
  border-radius: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.app-select-option.is-selected .app-select-checkbox {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: #fff;
}

.select-check {
  font-size: 16px;
  margin-left: auto;
}

.app-select-empty {
  padding: 20px;
  text-align: center;
  font-size: 13px;
  color: var(--color-text-tertiary);
}

/* 動畫 */
.app-select-dropdown-enter-active {
  animation: select-dropdown-in 0.2s ease-out;
}
.app-select-dropdown-leave-active {
  animation: select-dropdown-in 0.15s ease-in reverse;
}

@keyframes select-dropdown-in {
  from {
    opacity: 0;
    transform: translateY(-8px) scaleY(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scaleY(1);
  }
}
</style>
