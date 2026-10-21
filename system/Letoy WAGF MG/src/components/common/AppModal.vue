<script setup lang="ts">
import { ref } from 'vue'

interface Props {
  modelValue: boolean
  title?: string
  subtitle?: string
  width?: string
  closeOnMaskClick?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  subtitle: '',
  width: '520px',
  closeOnMaskClick: true
})

const emit = defineEmits(['update:modelValue', 'close'])
const maskPressStarted = ref(false)

const handleClose = () => {
  maskPressStarted.value = false
  emit('update:modelValue', false)
  emit('close')
}

const handleBackdropPointerDown = (event: PointerEvent) => {
  maskPressStarted.value = event.target === event.currentTarget
}

const handleBackdropClick = () => {
  if (!props.closeOnMaskClick || !maskPressStarted.value) {
    maskPressStarted.value = false
    return
  }
  handleClose()
}
</script>

<template>
  <transition name="app-modal-fade">
    <div v-if="modelValue" class="app-modal-backdrop" @pointerdown="handleBackdropPointerDown" @click.self="handleBackdropClick">
      <transition name="app-modal-zoom">
        <div class="app-modal-card" :style="{ maxWidth: width }">
          <header class="app-modal-header">
            <div class="app-modal-title-group">
              <h3>{{ title }}</h3>
              <p v-if="subtitle">{{ subtitle }}</p>
            </div>
            <button class="app-modal-close" @click="handleClose">
              <i class="ri-close-line"></i>
            </button>
          </header>
          
          <div class="app-modal-body">
            <slot />
          </div>

          <footer v-if="$slots.footer" class="app-modal-footer">
            <slot name="footer" />
          </footer>
        </div>
      </transition>
    </div>
  </transition>
</template>

<style scoped>
.app-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.3);
  backdrop-filter: blur(8px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.app-modal-card {
  width: 100%;
  background: var(--surface-raised);
  border-radius: 20px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.app-modal-header {
  padding: 24px 32px;
  border-bottom: 1px solid var(--color-border-base);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-shrink: 0;
}

.app-modal-title-group h3 {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.app-modal-title-group p {
  font-size: 13px;
  color: var(--color-text-tertiary);
  margin-top: 4px;
}

.app-modal-close {
  width: var(--tap-target);
  height: var(--tap-target);
  flex-shrink: 0;
  border-radius: 8px;
  border: 0;
  background: var(--color-bg-soft);
  color: var(--color-text-tertiary);
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: all 0.2s;
}

.app-modal-close:hover {
  background: #fee2e2;
  color: var(--color-error);
}

.app-modal-body {
  padding: 32px;
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  max-height: 70vh;
}

.app-modal-footer {
  padding: 20px 32px;
  background: var(--surface-inset);
  border-top: 1px solid var(--color-border-base);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  flex-shrink: 0;
}

@media (max-width: 768px) {
  /* 手机上贴底展示：拇指可达，且键盘弹出时不会把弹窗顶出视口 */
  .app-modal-backdrop {
    align-items: flex-end;
    padding: 0;
  }

  .app-modal-card {
    max-width: 100% !important;
    border-radius: 20px 20px 0 0;
    max-height: 92vh;
  }

  .app-modal-header { padding: 18px 20px; }
  .app-modal-body { padding: 20px; max-height: none; }
  .app-modal-footer {
    padding: 14px 20px;
    padding-bottom: max(14px, var(--safe-bottom));
  }
  .app-modal-footer :deep(.app-button) { flex: 1; min-height: var(--tap-target-lg); }
}

@supports (max-height: 92dvh) {
  @media (max-width: 768px) {
    .app-modal-card { max-height: 92dvh; }
  }
}

/* Transitions */
.app-modal-fade-enter-active, .app-modal-fade-leave-active { transition: opacity 0.2s ease; }
.app-modal-fade-enter-from, .app-modal-fade-leave-to { opacity: 0; }

.app-modal-zoom-enter-active, .app-modal-zoom-leave-active { transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
.app-modal-zoom-enter-from, .app-modal-zoom-leave-to { opacity: 0; transform: scale(0.9); }
</style>
