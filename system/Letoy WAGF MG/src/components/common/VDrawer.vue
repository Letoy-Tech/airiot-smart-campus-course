<template>
  <teleport to="body">
    <transition name="drawer-fade">
      <div
        v-if="modelValue"
        class="v-drawer-mask"
        :class="{ 'is-sheet': isMobile }"
        @pointerdown="handleMaskPointerDown"
        @click.self="handleMaskClick"
      >
        <transition :name="isMobile ? 'sheet-slide' : 'drawer-slide'">
          <div
            v-if="modelValue"
            class="v-drawer-content"
            :class="{ 'is-sheet': isMobile }"
            :style="isMobile ? undefined : { width: size }"
            role="dialog"
            aria-modal="true"
            @click.stop
          >
            <!-- 移动端底部抽屉的抓手，提示可下滑关闭 -->
            <div v-if="isMobile" class="v-drawer-grabber" @click="handleClose"></div>

            <div class="v-drawer-header">
              <div class="v-drawer-title">
                <div class="title-tag"></div>
                <span>{{ title }}</span>
              </div>
              <button class="v-drawer-close" aria-label="关闭" @click="handleClose">
                <i class="ri-close-line"></i>
              </button>
            </div>
            <div class="v-drawer-body scroll-y">
              <slot></slot>
            </div>
            <div v-if="$slots.footer" class="v-drawer-footer">
              <slot name="footer"></slot>
            </div>
          </div>
        </transition>
      </div>
    </transition>
  </teleport>
</template>

<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'
import { useIsMobile } from '@/utils/responsive'
import { setBodyScrollLock, unlockBodyScroll } from '@/utils/scrollLock'

const props = defineProps({
  modelValue: Boolean,
  title: { type: String, default: '编辑信息' },
  size: { type: String, default: '480px' },
  closeOnMaskClick: { type: Boolean, default: true }
})

const emit = defineEmits(['update:modelValue', 'close'])
const maskPressStarted = ref(false)
const isMobile = useIsMobile()

const handleClose = () => {
  maskPressStarted.value = false
  emit('update:modelValue', false)
  emit('close')
}

const handleMaskPointerDown = (event: PointerEvent) => {
  maskPressStarted.value = event.target === event.currentTarget
}

const handleMaskClick = () => {
  if (!props.closeOnMaskClick || !maskPressStarted.value) {
    maskPressStarted.value = false
    return
  }
  handleClose()
}

// 打开时锁定 body 滚动，避免移动端背景列表跟着手指一起滚
let scrollLockHeld = false
watch(
  () => props.modelValue,
  (open) => {
    scrollLockHeld = setBodyScrollLock(open, scrollLockHeld)
  },
)

onUnmounted(() => {
  if (scrollLockHeld) {
    unlockBodyScroll()
    scrollLockHeld = false
  }
})
</script>

<style scoped>
.v-drawer-mask {
  position: fixed;
  inset: 0;
  background-color: var(--bg-mask);
  backdrop-filter: blur(4px);
  z-index: 2000;
  display: flex;
  justify-content: flex-end;
}

/* 移动端：从底部升起的 sheet，更贴近原生交互且拇指可达 */
.v-drawer-mask.is-sheet {
  align-items: flex-end;
  justify-content: center;
}

.v-drawer-content {
  height: 100%;
  max-width: 100vw;
  background-color: var(--surface-raised);
  box-shadow: -10px 0 30px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
}

.v-drawer-content.is-sheet {
  width: 100%;
  height: auto;
  max-height: 92vh;
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  box-shadow: 0 -10px 30px rgba(0, 0, 0, 0.12);
}

@supports (max-height: 92dvh) {
  .v-drawer-content.is-sheet { max-height: 92dvh; }
}

.v-drawer-grabber {
  width: 40px;
  height: 4px;
  border-radius: var(--radius-pill);
  background-color: var(--border-strong);
  margin: 10px auto 0;
  flex-shrink: 0;
  cursor: pointer;
}

.v-drawer-header {
  padding: 24px;
  border-bottom: 1px solid var(--border-base);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.v-drawer-title {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 18px;
  font-weight: 800;
  color: var(--text-main);
  min-width: 0;
}

.v-drawer-title span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.title-tag {
  width: 4px;
  height: 18px;
  flex-shrink: 0;
  background-color: var(--primary-color);
  border-radius: 4px;
}

.v-drawer-close {
  width: var(--tap-target);
  height: var(--tap-target);
  flex-shrink: 0;
  border: none;
  background: transparent;
  font-size: 24px;
  color: var(--text-tertiary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  transition: color 0.2s;
}

.v-drawer-close:hover { color: var(--error-color); }
.v-drawer-close:active { background-color: var(--bg-page); }

.v-drawer-body {
  flex: 1;
  min-height: 0;
  padding: 24px;
}

.v-drawer-footer {
  padding: 20px 24px;
  border-top: 1px solid var(--border-base);
  background-color: var(--surface-inset);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  flex-shrink: 0;
}

@media (max-width: 768px) {
  .v-drawer-header { padding: 12px 16px 14px; }
  .v-drawer-title { font-size: 16px; }
  .v-drawer-body { padding: 16px; }
  .v-drawer-footer {
    padding: 12px 16px;
    padding-bottom: max(12px, var(--safe-bottom));
  }
  /* 手机上主次按钮各占一半，避免右下角小目标 */
  .v-drawer-footer :deep(.app-button) { flex: 1; min-height: var(--tap-target-lg); }
}

/* Animations */
.drawer-fade-enter-active, .drawer-fade-leave-active { transition: opacity 0.3s; }
.drawer-fade-enter-from, .drawer-fade-leave-to { opacity: 0; }

.drawer-slide-enter-active { transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
.drawer-slide-leave-active { transition: transform 0.2s ease-in; }
.drawer-slide-enter-from, .drawer-slide-leave-to { transform: translateX(100%); }

.sheet-slide-enter-active { transition: transform 0.32s cubic-bezier(0.32, 0.72, 0, 1); }
.sheet-slide-leave-active { transition: transform 0.24s ease-in; }
.sheet-slide-enter-from, .sheet-slide-leave-to { transform: translateY(100%); }
</style>
