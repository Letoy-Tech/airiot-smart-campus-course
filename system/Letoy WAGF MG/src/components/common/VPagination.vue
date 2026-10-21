<template>
  <div class="v-pagination" :class="{ 'is-mobile': isMobile }">
    <!-- Left: Info -->
    <div class="v-pagination__info">
      <span>共 {{ total }} 条记录</span>
      <div class="v-pagination__size" v-if="!isMobile">
        <select :value="pageSize" @change="handleSizeChange">
          <option :value="10">10 条/页</option>
          <option :value="20">20 条/页</option>
          <option :value="50">50 条/页</option>
        </select>
        <i class="ri-arrow-down-s-line"></i>
      </div>
    </div>

    <!-- Right: Controls -->
    <div class="v-pagination__controls">
      <button 
        class="v-pager-btn" 
        :disabled="modelValue <= 1"
        @click="changePage(modelValue - 1)"
      >
        <i class="ri-arrow-left-s-line"></i>
      </button>

      <div class="v-pager-list" v-if="!isMobile">
        <template v-for="p in displayedPages" :key="p">
          <button 
            v-if="p !== '...'"
            class="v-pager-num" 
            :class="{ 'is-active': p === modelValue }"
            @click="changePage(p)"
          >
            {{ p }}
          </button>
          <span v-else class="v-pager-more">•••</span>
        </template>
      </div>
      
      <div class="v-pager-indicator" v-else>
        <span class="curr">{{ modelValue }}</span>
        <span class="total">/ {{ totalPages }}</span>
      </div>

      <button 
        class="v-pager-btn" 
        :disabled="modelValue >= totalPages"
        @click="changePage(modelValue + 1)"
      >
        <i class="ri-arrow-right-s-line"></i>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useIsMobile } from '@/utils/responsive'

const props = defineProps({
  modelValue: { type: Number, default: 1 },
  total: { type: Number, default: 0 },
  pageSize: { type: Number, default: 10 }
})

const emit = defineEmits(['update:modelValue', 'change', 'size-change'])

const totalPages = computed(() => Math.ceil(props.total / props.pageSize) || 1)
const isMobile = useIsMobile()

const changePage = (p: any) => {
  if (p < 1 || p > totalPages.value || p === props.modelValue) return
  emit('update:modelValue', p)
  emit('change', p)
}

const handleSizeChange = (e: any) => {
  emit('size-change', parseInt(e.target.value))
}

const displayedPages = computed(() => {
  const current = props.modelValue
  const total = totalPages.value
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  
  const pages: any[] = [1]
  if (current > 4) pages.push('...')
  
  const start = Math.max(2, current - 2)
  const end = Math.min(total - 1, current + 2)
  
  for (let i = start; i <= end; i++) pages.push(i)
  
  if (current < total - 3) pages.push('...')
  pages.push(total)
  
  return pages
})
</script>

<style scoped>
.v-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background-color: var(--surface-raised);
  border-top: 1px solid var(--border-base);
}

.v-pagination__info {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 13px;
  color: var(--text-tertiary);
  font-weight: 600;
}

.v-pagination__size {
  position: relative;
  display: flex;
  align-items: center;
}

.v-pagination__size select {
  appearance: none;
  background: var(--bg-page);
  border: 1px solid var(--border-strong);
  padding: 4px 28px 4px 12px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-secondary);
  cursor: pointer;
  outline: none;
  transition: all 0.2s;
}

.v-pagination__size select:hover { border-color: var(--primary-color); }

.v-pagination__size i {
  position: absolute;
  right: 8px;
  pointer-events: none;
  font-size: 14px;
}

.v-pagination__controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.v-pager-btn {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: 1px solid var(--border-strong);
  background: var(--surface-raised);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text-secondary);
  transition: all 0.2s;
}

.v-pager-btn:hover:not(:disabled) {
  border-color: var(--primary-color);
  color: var(--primary-color);
  background-color: var(--primary-light);
}

.v-pager-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.v-pager-list {
  display: flex;
  align-items: center;
  gap: 6px;
}

.v-pager-num {
  min-width: 36px;
  height: 36px;
  padding: 0 8px;
  border-radius: 10px;
  border: 1px solid transparent;
  background: transparent;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.v-pager-num:hover {
  background-color: var(--bg-page);
  color: var(--text-main);
}

.v-pager-num.is-active {
  background-color: var(--primary-color);
  color: white;
  box-shadow: 0 6px 12px -4px rgba(14, 165, 233, 0.4);
}

.v-pager-more {
  color: var(--text-tertiary);
  letter-spacing: 1px;
  padding: 0 4px;
}

.v-pager-indicator {
  font-size: 14px;
  font-weight: 800;
  display: flex;
  gap: 4px;
}

.v-pager-indicator .curr { color: var(--primary-color); }
.v-pager-indicator .total { color: var(--text-tertiary); }

@media (max-width: 768px) {
  .v-pagination { padding: 12px 16px; gap: 12px; }
  .v-pagination__info { font-size: 12px; }
  /* 36px 的翻页按钮低于最小可点面积 */
  .v-pager-btn { width: var(--tap-target); height: var(--tap-target); font-size: 20px; }
  .v-pager-indicator { font-size: 15px; }
  .v-pagination__controls { gap: 10px; }
}
</style>
