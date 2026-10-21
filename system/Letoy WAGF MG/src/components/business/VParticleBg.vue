<template>
  <canvas ref="canvasRef" class="v-particle-bg"></canvas>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const canvasRef = ref<HTMLCanvasElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null
let animationId = 0

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
}

const particles: Particle[] = []
// 连线是 O(n²)：80 个粒子每帧需要 3160 次距离计算，移动端 GPU/电量吃不消，
// 因此按视口宽度下调数量与连线半径。
const isSmallScreen = () => window.innerWidth <= 768
const particleCount = () => (isSmallScreen() ? 32 : 80)
const connectionDistance = () => (isSmallScreen() ? 110 : 150)

const initParticles = (width: number, height: number) => {
  particles.length = 0
  const count = particleCount()
  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      size: Math.random() * 2 + 1
    })
  }
}

const drawFrame = () => {
  if (!canvasRef.value || !ctx) return
  const { width, height } = canvasRef.value

  ctx.clearRect(0, 0, width, height)
  const maxDistance = connectionDistance()
  
  // 1. Update & Draw Particles
  ctx.fillStyle = 'rgba(14, 165, 233, 0.3)'
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i]
    if (!p) continue
    p.x += p.vx
    p.y += p.vy

    if (p.x < 0 || p.x > width) p.vx *= -1
    if (p.y < 0 || p.y > height) p.vy *= -1

    ctx.beginPath()
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
    ctx.fill()

    // 2. Draw Lines
    for (let j = i + 1; j < particles.length; j++) {
      const p2 = particles[j]
      if (!p2) continue
      const dx = p.x - p2.x
      const dy = p.y - p2.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist < maxDistance) {
        ctx.beginPath()
        ctx.strokeStyle = `rgba(14, 165, 233, ${0.15 * (1 - dist / maxDistance)})`
        ctx.lineWidth = 0.8
        ctx.moveTo(p.x, p.y)
        ctx.lineTo(p2.x, p2.y)
        ctx.stroke()
      }
    }
  }

}

const draw = () => {
  drawFrame()
  animationId = requestAnimationFrame(draw)
}

let lastWidth = 0

const handleResize = () => {
  const canvas = canvasRef.value
  if (!canvas) return

  const width = window.innerWidth
  const height = window.innerHeight
  canvas.width = width
  canvas.height = height

  // 移动端地址栏收起 / 软键盘弹出都会触发 resize 但宽度不变。
  // 此时若重新生成粒子，用户点击登录输入框的瞬间背景会整体闪跳，
  // 因此只有宽度真正变化（旋屏、窗口缩放）时才重建粒子。
  if (width !== lastWidth || particles.length === 0) {
    lastWidth = width
    initParticles(width, height)
  }
}

const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

const stop = () => {
  if (animationId) {
    cancelAnimationFrame(animationId)
    animationId = 0
  }
}

const start = () => {
  if (animationId || prefersReducedMotion()) return
  draw()
}

// 页面切到后台时停掉动画，避免手机锁屏 / 切 App 后仍在空转耗电
const handleVisibility = () => {
  if (document.hidden) stop()
  else start()
}

onMounted(() => {
  if (!canvasRef.value) return
  ctx = canvasRef.value.getContext('2d')
  handleResize()

  if (prefersReducedMotion()) {
    // 尊重“减少动态效果”：只绘制一帧静态图，不进入动画循环
    drawFrame()
  } else {
    draw()
  }

  window.addEventListener('resize', handleResize)
  document.addEventListener('visibilitychange', handleVisibility)
})

onUnmounted(() => {
  stop()
  window.removeEventListener('resize', handleResize)
  document.removeEventListener('visibilitychange', handleVisibility)
})
</script>

<style scoped>
.v-particle-bg {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  pointer-events: none;
  background: linear-gradient(to bottom, #f0f9ff, #e0f2fe);
}
</style>
