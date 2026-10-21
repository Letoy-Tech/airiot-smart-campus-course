import { onMounted, onUnmounted, ref } from 'vue'

/** 与 vars.css / 各组件媒体查询保持一致的断点 */
export const MOBILE_BREAKPOINT = 768
export const TABLET_BREAKPOINT = 1024

/**
 * 响应式断点钩子
 *
 * 使用 matchMedia 而非监听 resize：
 * 1. 只在跨越断点时触发回调，避免拖动窗口 / 移动端地址栏收起时的高频重渲染；
 * 2. 移动端软键盘弹出会改变视口高度并触发 resize，用 resize 判断宽度容易误判。
 *
 * @param query 标准 CSS 媒体查询字符串
 */
export function useMediaQuery(query: string) {
  const matches = ref(false)
  let mql: MediaQueryList | null = null

  const onChange = (e: MediaQueryListEvent) => {
    matches.value = e.matches
  }

  onMounted(() => {
    mql = window.matchMedia(query)
    matches.value = mql.matches
    mql.addEventListener('change', onChange)
  })

  onUnmounted(() => {
    mql?.removeEventListener('change', onChange)
    mql = null
  })

  return matches
}

/** 是否为移动端视口（<= 768px） */
export function useIsMobile() {
  return useMediaQuery(`(max-width: ${MOBILE_BREAKPOINT}px)`)
}

/** 是否为平板及以下视口（<= 1024px） */
export function useIsTablet() {
  return useMediaQuery(`(max-width: ${TABLET_BREAKPOINT}px)`)
}

/** 是否为粗指针（触屏）设备，用于区分 hover 与 tap 交互 */
export function useIsTouch() {
  return useMediaQuery('(pointer: coarse)')
}
