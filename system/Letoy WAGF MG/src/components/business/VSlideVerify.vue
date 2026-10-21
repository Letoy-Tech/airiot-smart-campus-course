<template>
  <div class="v-slide-verify" :style="{ width: width + 'px' }">
    <div class="verify-bar" ref="barRef">
      <div class="verify-text" :class="{ 'is-hidden': moveX > 20 }">向右滑动验证身份</div>
      <div 
        class="verify-progress" 
        :style="{ width: moveX + 'px', transition: isMoving ? 'none' : 'all 0.3s' }"
      ></div>
      <div 
        class="verify-handler"
        :class="{ 'is-success': isSuccess }"
        :style="{ left: moveX + 'px', transition: isMoving ? 'none' : 'all 0.3s' }"
        @mousedown="startMove"
        @touchstart="startMove"
      >
        <i :class="isSuccess ? 'ri-checkbox-circle-fill' : 'ri-arrow-right-s-line'"></i>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  width: { type: Number, default: 320 },
  onSuccess: Function
})

const moveX = ref(0)
const isMoving = ref(false)
const isSuccess = ref(false)
const startX = ref(0)
const barRef = ref<HTMLElement | null>(null)

const getClientX = (e: MouseEvent | TouchEvent) => {
  if (e instanceof MouseEvent) return e.clientX
  return e.touches[0]?.clientX
}

const startMove = (e: MouseEvent | TouchEvent) => {
  if (isSuccess.value) return
  const clientX = getClientX(e)
  if (clientX === undefined) return
  isMoving.value = true
  startX.value = clientX
}

const handleMove = (e: MouseEvent | TouchEvent) => {
  if (!isMoving.value) return
  const currentX = getClientX(e)
  if (currentX === undefined) return
  let delta = currentX - startX.value
  
  const maxMove = props.width - 44 // 44 is handler width
  if (delta < 0) delta = 0
  if (delta > maxMove) delta = maxMove
  
  moveX.value = delta
  
  if (delta >= maxMove) {
    handleSuccess()
  }
}

const stopMove = () => {
  if (!isMoving.value) return
  isMoving.value = false
  if (!isSuccess.value) {
    moveX.value = 0
  }
}

const handleSuccess = () => {
  isSuccess.value = true
  isMoving.value = false
  props.onSuccess?.()
}

onMounted(() => {
  window.addEventListener('mousemove', handleMove)
  window.addEventListener('mouseup', stopMove)
  window.addEventListener('touchmove', handleMove)
  window.addEventListener('touchend', stopMove)
})

onUnmounted(() => {
  window.removeEventListener('mousemove', handleMove)
  window.removeEventListener('mouseup', stopMove)
  window.removeEventListener('touchmove', handleMove)
  window.removeEventListener('touchend', stopMove)
})
</script>

<style scoped>
.v-slide-verify {
  height: 44px;
  background-color: #f1f5f9;
  border-radius: 12px;
  border: 1px solid var(--border-strong);
  position: relative;
  overflow: hidden;
  margin-bottom: 20px;
}

.verify-bar {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.verify-text {
  font-size: 13px;
  color: var(--text-tertiary);
  font-weight: 700;
  user-select: none;
  transition: opacity 0.2s;
}

.verify-text.is-hidden { opacity: 0; }

.verify-progress {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  background-color: var(--primary-light);
  border-radius: 12px 0 0 12px;
}

.verify-handler {
  position: absolute;
  top: 2px;
  width: 40px;
  height: 40px;
  background-color: white;
  border-radius: 10px;
  box-shadow: 0 4px 10px rgba(0,0,0,0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: var(--text-secondary);
  cursor: grab;
  z-index: 2;
  border: 1px solid var(--border-base);
}

.verify-handler:active { cursor: grabbing; }

.verify-handler.is-success {
  background-color: var(--success-color);
  color: white;
  border-color: var(--success-color);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}
</style>
