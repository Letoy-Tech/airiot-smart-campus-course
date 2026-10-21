<template>
  <teleport to="body">
    <transition name="msgbox-fade">
      <div v-if="visible" class="v-msgbox-mask" @pointerdown="handleMaskPointerDown" @click.self="handleMaskClick">
        <transition name="msgbox-zoom">
          <div v-if="visible" class="v-msgbox-container" @click.stop>
            <div class="v-msgbox-body">
              <div class="v-msgbox-icon" :class="type">
                <i :class="iconClass"></i>
              </div>
              <div class="v-msgbox-content">
                <h3 class="v-msgbox-title">{{ title }}</h3>
                <p class="v-msgbox-message">{{ displayMessage }}</p>
                <input
                  v-if="showInput"
                  v-model="inputText"
                  class="v-msgbox-input"
                  :placeholder="inputPlaceholder"
                  @keydown.enter="handleConfirm"
                />
              </div>
            </div>
            <div class="v-msgbox-footer">
              <AppButton v-if="showCancel" type="ghost" size="sm" @click="handleCancel">{{ cancelText }}</AppButton>
              <AppButton size="sm" :type="type === 'danger' ? 'danger' : 'primary'" @click="handleConfirm">{{ confirmText }}</AppButton>
            </div>
          </div>
        </transition>
      </div>
    </transition>
  </teleport>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted } from 'vue'
import AppButton from './AppButton.vue'

const props = defineProps({
  title: { type: String, default: '提示' },
  message: { type: String, default: '' },
  content: { type: String, default: '' },
  type: { type: String, default: 'info' }, // info, success, warning, danger
  confirmText: { type: String, default: '确定' },
  cancelText: { type: String, default: '取消' },
  showCancel: { type: Boolean, default: true },
  showInput: { type: Boolean, default: false },
  inputValue: { type: String, default: '' },
  inputPlaceholder: { type: String, default: '' },
  onConfirm: Function,
  onCancel: Function
})

const visible = ref(false)
const inputText = ref(props.inputValue)
const displayMessage = computed(() => props.message || props.content)
const maskPressStarted = ref(false)

const iconClass = computed(() => {
  switch (props.type) {
    case 'success': return 'ri-checkbox-circle-fill'
    case 'warning': return 'ri-alert-fill'
    case 'danger': return 'ri-error-warning-fill'
    default: return 'ri-information-fill'
  }
})

const handleConfirm = () => {
  visible.value = false
  setTimeout(() => props.onConfirm?.(inputText.value), 200)
}

const handleCancel = () => {
  maskPressStarted.value = false
  visible.value = false
  setTimeout(() => props.onCancel?.(), 200)
}

const handleMaskPointerDown = (event: PointerEvent) => {
  maskPressStarted.value = event.target === event.currentTarget
}

const handleMaskClick = () => {
  if (!maskPressStarted.value) {
    maskPressStarted.value = false
    return
  }
  handleCancel()
}

onMounted(() => {
  visible.value = true
  if (props.showInput) {
    void nextTick(() => {
      const input = document.querySelector<HTMLInputElement>('.v-msgbox-input')
      input?.focus()
      input?.select()
    })
  }
})
</script>

<style scoped>
.v-msgbox-mask {
  position: fixed;
  inset: 0;
  background-color: var(--bg-mask);
  backdrop-filter: blur(4px);
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
  /* 窄屏留出左右安全边距，弹窗不再贴边 */
  padding: 20px calc(20px + var(--safe-left)) calc(20px + var(--safe-bottom)) calc(20px + var(--safe-right));
}

.v-msgbox-container {
  width: 100%;
  max-width: 400px;
  background-color: var(--surface-raised);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-float);
  overflow: hidden;
  border: 1px solid var(--border-light);
}

.v-msgbox-body {
  padding: 32px 24px 24px;
  display: flex;
  gap: 20px;
}

.v-msgbox-icon {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  flex-shrink: 0;
}

.v-msgbox-icon.info { background-color: var(--primary-light); color: var(--primary-color); }
.v-msgbox-icon.success { background-color: #ecfdf5; color: var(--success-color); }
.v-msgbox-icon.warning { background-color: #fffbeb; color: var(--warning-color); }
.v-msgbox-icon.danger { background-color: #fff1f2; color: var(--error-color); }

.v-msgbox-content { flex: 1; }
.v-msgbox-title { font-size: 18px; font-weight: 800; color: var(--text-main); margin-bottom: 8px; }
.v-msgbox-message { font-size: 14px; color: var(--text-secondary); line-height: 1.6; }
.v-msgbox-input {
  width: 100%;
  margin-top: 16px;
  padding: 10px 12px;
  border: 1px solid var(--border-base);
  border-radius: 10px;
  color: var(--text-main);
  font-size: 14px;
  outline: none;
  transition: all 0.2s;
}
.v-msgbox-input:focus {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.12);
}

.v-msgbox-footer {
  padding: 16px 24px;
  background-color: var(--surface-inset);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  border-top: 1px solid var(--border-base);
}

@media (max-width: 768px) {
  .v-msgbox-body {
    padding: 24px 20px 20px;
    gap: 16px;
    /* 窄屏改为纵向：图标 + 标题横排会把正文挤成一列窄字 */
    flex-direction: column;
    align-items: flex-start;
  }
  .v-msgbox-icon { width: 44px; height: 44px; font-size: 22px; }
  .v-msgbox-title { font-size: 17px; }
  .v-msgbox-footer {
    padding: 14px 20px;
    padding-bottom: max(14px, var(--safe-bottom));
  }
  /* 确认/取消等宽，避免右下角误触 */
  .v-msgbox-footer :deep(.app-button) { flex: 1; min-height: var(--tap-target-lg); font-size: 14px; }
  .v-msgbox-input { min-height: var(--tap-target-lg); font-size: var(--font-size-input-mobile); }
}

/* Animations */
.msgbox-fade-enter-active, .msgbox-fade-leave-active { transition: opacity 0.3s; }
.msgbox-fade-enter-from, .msgbox-fade-leave-to { opacity: 0; }

.msgbox-zoom-enter-active { transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
.msgbox-zoom-leave-active { transition: transform 0.2s ease-in; }
.msgbox-zoom-enter-from { transform: scale(0.9); }
.msgbox-zoom-leave-to { transform: scale(1.05); opacity: 0; }
</style>
