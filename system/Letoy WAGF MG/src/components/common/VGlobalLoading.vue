<template>
  <teleport to="body">
    <div class="v-global-loading">
      <!-- 顶部进度条 (Web) -->
      <transition name="fade">
        <div v-if="appStore.isGlobalLoading" class="top-progress-bar">
          <div class="progress-inner"></div>
        </div>
      </transition>

      <!-- 全屏遮罩 (H5 或 强提示) -->
      <transition name="fade">
        <div v-if="appStore.isGlobalLoading && isMobile" class="full-loading-mask">
          <div class="spinner-container">
            <div class="spinner"></div>
            <p>正在同步数据...</p>
          </div>
        </div>
      </transition>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useAppStore } from '@/store/app'

const appStore = useAppStore()
const isMobile = ref(false)

const checkMobile = () => { isMobile.value = window.innerWidth <= 768 }

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
})
onUnmounted(() => window.removeEventListener('resize', checkMobile))
</script>

<style scoped>
.v-global-loading {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 999999; /* 绝对置顶 */
}

/* 顶部进度条样式 */
.top-progress-bar {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 3px;
  background-color: var(--primary-light);
  overflow: hidden;
}

.progress-inner {
  height: 100%;
  width: 100%;
  background: linear-gradient(90deg, 
    var(--primary-color) 0%, 
    #0ea5e9 50%, 
    var(--primary-color) 100%
  );
  animation: progress-slide 1.5s infinite ease-in-out;
  transform-origin: 0% 50%;
}

@keyframes progress-slide {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

/* 移动端遮罩样式 */
.full-loading-mask {
  position: absolute;
  inset: 0;
  background: color-mix(in srgb, var(--bg-page) 45%, transparent);
  backdrop-filter: blur(4px);
  pointer-events: auto; /* 遮罩开启时禁止点击背景 */
  display: flex;
  align-items: center;
  justify-content: center;
}

.spinner-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.spinner {
  width: 44px;
  height: 44px;
  border: 4px solid var(--primary-light);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  box-shadow: 0 0 15px rgba(14, 165, 233, 0.2);
}

.spinner-container p {
  font-size: 13px;
  font-weight: 700;
  color: var(--primary-color);
  letter-spacing: 1px;
}

@keyframes spin { to { transform: rotate(360deg); } }

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
