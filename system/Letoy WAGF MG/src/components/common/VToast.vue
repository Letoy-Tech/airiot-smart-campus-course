<template>
  <transition name="toast-fade">
    <div v-if="visible" class="v-toast" :class="`v-toast--${type}`">
      <div class="v-toast-icon-box">
        <i :class="iconClass"></i>
      </div>
      <span class="v-toast-message">{{ message }}</span>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

const props = defineProps({
  message: { type: String, default: '' },
  type: { type: String, default: 'info' },
  duration: { type: Number, default: 3000 },
  onDestroy: Function
})

const visible = ref(false)

const iconClass = computed(() => {
  switch (props.type) {
    case 'success': return 'ri-checkbox-circle-fill'
    case 'error': return 'ri-error-warning-fill'
    case 'warning': return 'ri-alert-fill'
    default: return 'ri-information-fill'
  }
})

onMounted(() => {
  visible.value = true
  setTimeout(() => {
    visible.value = false
    setTimeout(() => {
      props.onDestroy?.()
    }, 300)
  }, props.duration)
})
</script>

<style scoped>
.v-toast {
  position: fixed;
  /* 避开 iOS 状态栏 / 灵动岛 */
  top: calc(var(--safe-top) + 16px);
  left: 50%;
  transform: translateX(-50%);
  max-width: calc(100vw - 32px);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  padding-right: 24px;
  border-radius: 14px;
  background-color: var(--surface-raised);
  box-shadow: var(--shadow-float);
  z-index: 9999;
  border: 1px solid var(--border-light);
  pointer-events: none;
}

.v-toast-icon-box {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

.v-toast--success .v-toast-icon-box { background-color: #ecfdf5; color: var(--success-color); }
.v-toast--error .v-toast-icon-box { background-color: #fff1f2; color: var(--error-color); }
.v-toast--warning .v-toast-icon-box { background-color: #fffbeb; color: var(--warning-color); }
.v-toast--info .v-toast-icon-box { background-color: var(--primary-light); color: var(--primary-color); }

.v-toast-message {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-main);
  /* 窄屏下长错误信息必须换行，nowrap 会被裁掉看不见 */
  line-height: 1.5;
  overflow-wrap: anywhere;
}

@media (min-width: 769px) {
  .v-toast-message { white-space: nowrap; }
}

@media (max-width: 768px) {
  .v-toast {
    top: calc(var(--safe-top) + 10px);
    padding: 10px 16px;
    max-width: calc(100vw - 24px);
  }
  .v-toast-icon-box { flex-shrink: 0; }
}

.toast-fade-enter-active { transition: all 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.28); }
.toast-fade-leave-active { transition: all 0.3s ease; }
.toast-fade-enter-from { opacity: 0; transform: translate(-50%, -40px); }
.toast-fade-leave-to { opacity: 0; transform: translate(-50%, -20px); }
</style>
