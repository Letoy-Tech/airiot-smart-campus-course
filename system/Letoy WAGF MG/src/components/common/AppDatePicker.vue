<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import type { CSSProperties } from 'vue'
import { computeDropdownPosition } from '@/utils/popover'
import dayjs from 'dayjs'

const props = withDefaults(defineProps<{
  modelValue: string | null
  label?: string
  placeholder?: string
  disabled?: boolean
  block?: boolean
  error?: string
  required?: boolean
}>(), {
  placeholder: '選擇日期',
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

const resolveViewDate = (value?: string | null) => {
  const parsed = value ? dayjs(value) : dayjs()
  return parsed.isValid() ? parsed : dayjs()
}

// 內部狀態：當前面板顯示的月份
const viewDate = ref(resolveViewDate(props.modelValue))

// 更新面板位置（空間不足時自動上翻，並做視口收邊）
const updatePosition = () => {
  if (!isOpen.value || !triggerRef.value) return
  dropdownStyle.value = computeDropdownPosition(triggerRef.value, {
    minWidth: 280,
    maxHeight: 380,
  })
}

// 切換面板顯示
const toggle = async () => {
  if (props.disabled) return
  if (!isOpen.value) {
    viewDate.value = resolveViewDate(props.modelValue)
    isOpen.value = true
    await nextTick()
    updatePosition()
  } else {
    isOpen.value = false
  }
}

// 監聽滾動和縮放以更新位置
onMounted(() => {
  window.addEventListener('scroll', updatePosition, true)
  window.addEventListener('resize', updatePosition)
})

onUnmounted(() => {
  window.removeEventListener('scroll', updatePosition, true)
  window.removeEventListener('resize', updatePosition)
})

// 日曆數據計算
const weekDays = ['日', '一', '二', '三', '四', '五', '六']
const monthLabel = computed(() => viewDate.value.format('YYYY年 MM月'))

const calendarDays = computed(() => {
  const startOfMonth = viewDate.value.startOf('month')
  const startDate = startOfMonth.startOf('week')
  const days = []
  let curr = startDate
  for (let i = 0; i < 42; i++) {
    days.push({
      date: curr.format('YYYY-MM-DD'),
      dayNum: curr.date(),
      isCurrentMonth: curr.month() === viewDate.value.month(),
      isToday: curr.isSame(dayjs(), 'day'),
      isSelected: props.modelValue === curr.format('YYYY-MM-DD')
    })
    curr = curr.add(1, 'day')
  }
  return days
})

const prevMonth = () => { viewDate.value = viewDate.value.subtract(1, 'month') }
const nextMonth = () => { viewDate.value = viewDate.value.add(1, 'month') }

const selectDate = (date: string) => {
  emit('update:modelValue', date)
  emit('change', date)
  isOpen.value = false
}

// 點擊外部關閉
const handleClickOutside = (event: MouseEvent) => {
  if (isOpen.value && 
      triggerRef.value && !triggerRef.value.contains(event.target as Node) &&
      dropdownRef.value && !dropdownRef.value.contains(event.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => { document.addEventListener('click', handleClickOutside) })
onUnmounted(() => { document.removeEventListener('click', handleClickOutside) })
</script>

<template>
  <div 
    class="app-date-picker" 
    :class="{ 'is-disabled': disabled, 'is-block': block, 'has-error': error, 'is-open': isOpen }"
  >
    <label v-if="label" class="app-date-picker__label">
      {{ label }}
      <span v-if="required" class="app-date-picker__required">*</span>
    </label>
    
    <div ref="triggerRef" class="app-date-picker__trigger" @click="toggle">
      <div class="app-date-picker__content">
        <span v-if="modelValue" class="app-date-picker__value">{{ modelValue }}</span>
        <span v-else class="app-date-picker__placeholder">{{ placeholder }}</span>
      </div>
      <div class="app-date-picker__icon">
        <i class="ri-calendar-line"></i>
      </div>
    </div>

    <!-- 使用 Teleport 將面板傳送到 body，解決被父容器裁剪的問題 -->
    <teleport to="body">
      <transition name="app-date-picker-dropdown">
        <div 
          v-if="isOpen" 
          ref="dropdownRef"
          class="app-date-picker__dropdown"
          :style="dropdownStyle"
          @click.stop
        >
          <div class="calendar-header">
            <button class="nav-btn" @click.stop="prevMonth"><i class="ri-arrow-left-s-line"></i></button>
            <span class="month-title">{{ monthLabel }}</span>
            <button class="nav-btn" @click.stop="nextMonth"><i class="ri-arrow-right-s-line"></i></button>
          </div>
          
          <div class="calendar-weekdays">
            <span v-for="day in weekDays" :key="day" class="weekday">{{ day }}</span>
          </div>
          
          <div class="calendar-grid">
            <div 
              v-for="item in calendarDays" 
              :key="item.date"
              class="calendar-day"
              :class="{ 
                'is-outside': !item.isCurrentMonth, 
                'is-today': item.isToday, 
                'is-selected': item.isSelected 
              }"
              @click.stop="selectDate(item.date)"
            >
              <span class="day-number">{{ item.dayNum }}</span>
            </div>
          </div>

          <div class="calendar-footer">
            <button class="today-btn" @click.stop="selectDate(dayjs().format('YYYY-MM-DD'))">今天</button>
          </div>
        </div>
      </transition>
    </teleport>

    <small v-if="error" class="app-date-picker__error">{{ error }}</small>
  </div>
</template>

<style scoped>
.app-date-picker {
  display: inline-flex;
  flex-direction: column;
  gap: 12px;
  width: 240px;
  user-select: none;
}

.app-date-picker.is-block {
  display: flex;
  width: 100%;
}

.app-date-picker__label {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-secondary);
}

.app-date-picker__required {
  margin-left: 4px;
  color: var(--color-error);
}

.app-date-picker__trigger {
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

.app-date-picker__trigger:hover {
  border-color: var(--color-primary);
  background: var(--color-bg-soft);
}

.is-open .app-date-picker__trigger {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 4px var(--color-primary-soft);
}

.app-date-picker__value {
  font-size: 14px;
  color: var(--color-text-primary);
  font-family: var(--font-family-number);
}

.app-date-picker__placeholder {
  font-size: 14px;
  color: var(--color-text-tertiary);
}

.app-date-picker__icon {
  color: var(--color-text-tertiary);
  font-size: 18px;
  display: grid;
  place-items: center;
}

.is-open .app-date-picker__icon {
  color: var(--color-primary);
}

.app-date-picker__error {
  color: var(--color-error);
  font-size: 12px;
}

.is-disabled {
  opacity: 0.6;
  pointer-events: none;
}
</style>

<style>
/* 這裡的樣式不能寫在 scoped 裡，因為面板被 Teleport 到了 body */
.app-date-picker__dropdown {
  position: absolute;
  z-index: 9999;
  background: var(--surface-raised);
  border: 1px solid var(--color-border-strong);
  border-radius: 16px;
  box-shadow: var(--shadow-float);
  padding: 16px;
  transform-origin: top;
  user-select: none;
}

.calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.month-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.nav-btn {
  width: 32px;
  height: 32px;
  border: 0;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  color: var(--color-text-secondary);
  display: grid;
  place-items: center;
}

.nav-btn:hover {
  background: var(--color-bg-soft);
  color: var(--color-primary);
}

.calendar-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  margin-bottom: 8px;
}

.weekday {
  text-align: center;
  font-size: 12px;
  font-weight: 700;
  color: var(--color-text-tertiary);
  padding: 4px 0;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}

.calendar-day {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 8px;
  font-size: 13px;
  font-family: var(--font-family-number);
  color: var(--color-text-secondary);
  transition: all 0.2s;
}

.calendar-day:hover:not(.is-selected) {
  background: var(--color-bg-soft);
  color: var(--color-primary);
}

.calendar-day.is-outside {
  color: var(--color-text-tertiary);
  opacity: 0.4;
}

.calendar-day.is-today {
  color: var(--color-primary);
  font-weight: 800;
  position: relative;
}

.calendar-day.is-today::after {
  content: '';
  position: absolute;
  bottom: 4px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--color-primary);
}

.calendar-day.is-selected {
  background: var(--color-primary);
  color: #fff;
  font-weight: 700;
  box-shadow: 0 4px 10px -2px rgba(6, 95, 70, 0.4);
}

.calendar-footer {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--color-border-base);
  display: flex;
  justify-content: center;
}

.today-btn {
  background: transparent;
  border: 0;
  color: var(--color-primary);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  padding: 4px 12px;
  border-radius: 6px;
}

.today-btn:hover {
  background: var(--color-primary-soft);
}

/* 動畫 */
.app-date-picker-dropdown-enter-active {
  animation: picker-dropdown-in 0.2s ease-out;
}
.app-date-picker-dropdown-leave-active {
  animation: picker-dropdown-in 0.15s ease-in reverse;
}

@keyframes picker-dropdown-in {
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

@media (max-width: 768px) {
  .app-date-picker__trigger { height: var(--tap-target-lg); }
  .app-date-picker__dropdown { padding: 12px; overflow-y: auto; overscroll-behavior: contain; }
  /* 触屏上日历格与导航按钮需要更大的可点区域 */
  .nav-btn { width: var(--tap-target); height: var(--tap-target); font-size: 20px; }
  .day-cell { min-height: 40px; }
}
