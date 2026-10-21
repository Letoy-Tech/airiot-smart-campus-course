/**
 * 全局指针动效：
 * - .fx-spotlight：跟随指针的光斑与边框高光（写入 --mx / --my）
 * - .fx-tilt：轻微 3D 倾斜（写入 --rx / --ry）
 * - .campus-button / .fx-ripple：点击涟漪
 * 采用事件委托，组件只需加类名，不需要注册指令；触屏与减少动态效果时不启用倾斜。
 */
let installed = false

const reduced = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return true }
}
const finePointer = () => {
  try { return window.matchMedia('(hover: hover) and (pointer: fine)').matches } catch { return false }
}

let tilted: HTMLElement | null = null
let frame = 0
let lastEvent: PointerEvent | null = null

function resetTilt(el: HTMLElement | null) {
  if (!el) return
  el.style.setProperty('--rx', '0deg')
  el.style.setProperty('--ry', '0deg')
}

function onMove() {
  frame = 0
  const event = lastEvent
  if (!event) return
  const target = event.target instanceof Element ? event.target : null
  const spot = target?.closest<HTMLElement>('.fx-spotlight')
  if (spot) {
    const rect = spot.getBoundingClientRect()
    spot.style.setProperty('--mx', `${event.clientX - rect.left}px`)
    spot.style.setProperty('--my', `${event.clientY - rect.top}px`)
  }
  const tilt = target?.closest<HTMLElement>('.fx-tilt') ?? null
  if (tilt !== tilted) { resetTilt(tilted); tilted = tilt }
  if (tilt && finePointer() && !reduced()) {
    const rect = tilt.getBoundingClientRect()
    const px = (event.clientX - rect.left) / rect.width - 0.5
    const py = (event.clientY - rect.top) / rect.height - 0.5
    tilt.style.setProperty('--rx', `${(-py * 5).toFixed(2)}deg`)
    tilt.style.setProperty('--ry', `${(px * 6).toFixed(2)}deg`)
  }
}

function onPointerMove(event: PointerEvent) {
  if (event.pointerType !== 'mouse') return
  lastEvent = event
  if (!frame) frame = requestAnimationFrame(onMove)
}

function onPointerDown(event: PointerEvent) {
  if (reduced()) return
  const target = event.target instanceof Element ? event.target : null
  const host = target?.closest<HTMLElement>('.campus-button, .fx-ripple')
  if (!host || (host as HTMLButtonElement).disabled) return
  const rect = host.getBoundingClientRect()
  const size = Math.max(rect.width, rect.height) * 2
  const ripple = document.createElement('span')
  ripple.className = 'fx-ripple-wave'
  ripple.style.width = ripple.style.height = `${size}px`
  ripple.style.left = `${event.clientX - rect.left - size / 2}px`
  ripple.style.top = `${event.clientY - rect.top - size / 2}px`
  host.appendChild(ripple)
  ripple.addEventListener('animationend', () => ripple.remove(), { once: true })
}

export function installPointerFx() {
  if (installed || typeof window === 'undefined') return
  installed = true
  document.addEventListener('pointermove', onPointerMove, { passive: true })
  document.addEventListener('pointerdown', onPointerDown, { passive: true })
  document.addEventListener('pointerleave', () => { resetTilt(tilted); tilted = null }, { passive: true })
}
