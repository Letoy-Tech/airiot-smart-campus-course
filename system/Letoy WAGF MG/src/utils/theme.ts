import { ref } from 'vue'

export type ThemeMode = 'light' | 'dark'

const STORAGE_KEY = 'campus-theme'

function readStored(): ThemeMode | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    return null
  }
}

function systemPrefersDark() {
  try {
    return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches
  } catch {
    return false
  }
}

/** 当前主题。图表等无法读取 CSS 变量的组件依赖它重新取色。 */
export const theme = ref<ThemeMode>(readStored() ?? (systemPrefersDark() ? 'dark' : 'light'))

function apply(mode: ThemeMode) {
  const root = document.documentElement
  root.dataset.theme = mode
  root.style.colorScheme = mode
  const meta = document.querySelector('meta[name="theme-color"]')
  meta?.setAttribute('content', mode === 'dark' ? '#070b14' : '#f3f6fb')
}

export function initTheme() {
  apply(theme.value)
}

export function setTheme(mode: ThemeMode) {
  theme.value = mode
  apply(mode)
  try { localStorage.setItem(STORAGE_KEY, mode) } catch { /* 隐私模式下不记忆偏好 */ }
}

const reducedMotion = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return true }
}

/**
 * 切换主题。支持 View Transitions 的浏览器以点击位置为圆心做揭幕动画，
 * 不支持或减少动态效果时直接切换。
 */
export function toggleTheme(event?: MouseEvent) {
  const next: ThemeMode = theme.value === 'dark' ? 'light' : 'dark'
  const doc = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } }
  if (!doc.startViewTransition || reducedMotion()) { setTheme(next); return }
  const x = event?.clientX ?? window.innerWidth - 80
  const y = event?.clientY ?? 32
  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
  const transition = doc.startViewTransition(() => setTheme(next))
  transition.ready.then(() => {
    document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      { duration: 560, easing: 'cubic-bezier(.22,.8,.24,1)', pseudoElement: '::view-transition-new(root)' },
    )
  }).catch(() => {})
}
