<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { theme } from '@/utils/theme'

/** 装饰性网络动画：节点缓慢漂移并在近距离连线，指针附近节点被轻微吸引。不承载任何数据。 */
const canvas = ref<HTMLCanvasElement | null>(null)
interface Node { x: number; y: number; vx: number; vy: number; r: number; hue: number }
let nodes: Node[] = []
let frame = 0
let ctx: CanvasRenderingContext2D | null = null
let observer: ResizeObserver | undefined
let width = 0
let height = 0
const pointer = { x: -9999, y: -9999 }
const reduced = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return true } }

function seed() {
  const count = Math.round(Math.min(90, Math.max(28, (width * height) / 9000)))
  nodes = Array.from({ length: count }, () => ({ x: Math.random() * width, y: Math.random() * height, vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35, r: Math.random() * 1.8 + 0.8, hue: 190 + Math.random() * 90 }))
}
function resize() {
  const el = canvas.value
  if (!el || !el.parentElement) return
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  width = el.parentElement.clientWidth
  height = el.parentElement.clientHeight
  el.width = width * dpr; el.height = height * dpr
  el.style.width = `${width}px`; el.style.height = `${height}px`
  ctx = el.getContext('2d')
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
  seed()
  if (reduced()) draw(false)
}
function draw(move = true) {
  if (!ctx) return
  const dark = theme.value === 'dark'
  ctx.clearRect(0, 0, width, height)
  const max = 130
  for (const n of nodes) {
    if (move) {
      const dx = pointer.x - n.x
      const dy = pointer.y - n.y
      const d = Math.hypot(dx, dy)
      if (d < 160) { n.vx += (dx / d) * 0.01; n.vy += (dy / d) * 0.01 }
      n.vx *= 0.995; n.vy *= 0.995
      n.x += n.vx; n.y += n.vy
      if (n.x < 0 || n.x > width) n.vx *= -1
      if (n.y < 0 || n.y > height) n.vy *= -1
    }
  }
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i]!
    for (let j = i + 1; j < nodes.length; j++) {
      const b = nodes[j]!
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      if (d < max) {
        ctx.strokeStyle = `hsla(${(a.hue + b.hue) / 2}, 90%, ${dark ? 70 : 60}%, ${(1 - d / max) * (dark ? 0.32 : 0.4)})`
        ctx.lineWidth = 0.8
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
      }
    }
  }
  for (const n of nodes) {
    ctx.fillStyle = `hsla(${n.hue}, 95%, ${dark ? 72 : 96}%, ${dark ? 0.9 : 0.95})`
    ctx.shadowColor = `hsla(${n.hue}, 95%, 65%, .9)`
    ctx.shadowBlur = 8
    ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fill()
  }
  ctx.shadowBlur = 0
}
function loop() { draw(); frame = requestAnimationFrame(loop) }
function start() { if (!frame && !reduced()) loop() }
function stop() { cancelAnimationFrame(frame); frame = 0 }
const onVisibility = () => (document.hidden ? stop() : start())
const onMove = (event: PointerEvent) => { const rect = canvas.value?.getBoundingClientRect(); if (rect) { pointer.x = event.clientX - rect.left; pointer.y = event.clientY - rect.top } }
const onLeave = () => { pointer.x = -9999; pointer.y = -9999 }
onMounted(() => {
  resize()
  if (typeof ResizeObserver !== 'undefined' && canvas.value?.parentElement) { observer = new ResizeObserver(resize); observer.observe(canvas.value.parentElement) }
  canvas.value?.parentElement?.addEventListener('pointermove', onMove)
  canvas.value?.parentElement?.addEventListener('pointerleave', onLeave)
  document.addEventListener('visibilitychange', onVisibility)
  start()
})
onUnmounted(() => {
  stop(); observer?.disconnect()
  canvas.value?.parentElement?.removeEventListener('pointermove', onMove)
  canvas.value?.parentElement?.removeEventListener('pointerleave', onLeave)
  document.removeEventListener('visibilitychange', onVisibility)
})
</script>

<template><canvas ref="canvas" class="network-canvas" aria-hidden="true"></canvas></template>

<style scoped>.network-canvas{position:absolute;inset:0;pointer-events:none}</style>
