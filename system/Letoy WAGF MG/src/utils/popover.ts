import type { CSSProperties } from 'vue'

export interface DropdownPositionOptions {
  /** 面板期望的最大高度，用于判断上下空间是否足够 */
  maxHeight?: number
  /** 面板宽度；不传则与触发器同宽 */
  width?: number
  /** 面板最小宽度 */
  minWidth?: number
  /** 与触发器 / 视口边缘的间距 */
  gap?: number
}

/**
 * 计算 Teleport 到 body 的下拉面板位置。
 *
 * 相比直接使用 `rect.bottom`，额外处理两件事：
 * 1. 下方空间不足且上方更宽裕时向上翻转，面板不会被挤出视口底部；
 * 2. 左右收边，窄屏上靠近边缘的触发器不会让面板溢出屏幕。
 */
export function computeDropdownPosition(
  trigger: HTMLElement,
  options: DropdownPositionOptions = {},
): CSSProperties {
  const { maxHeight = 280, minWidth = 0, gap = 8 } = options

  const rect = trigger.getBoundingClientRect()
  const scrollY = window.scrollY || window.pageYOffset
  const scrollX = window.scrollX || window.pageXOffset

  const width = Math.min(
    Math.max(options.width ?? rect.width, minWidth),
    window.innerWidth - gap * 2,
  )

  const spaceBelow = window.innerHeight - rect.bottom
  const spaceAbove = rect.top
  const flipUp = spaceBelow < maxHeight + gap && spaceAbove > spaceBelow
  const available = Math.max(120, (flipUp ? spaceAbove : spaceBelow) - gap * 2)
  const height = Math.min(maxHeight, available)

  const left = Math.min(
    Math.max(gap, rect.left),
    Math.max(gap, window.innerWidth - width - gap),
  )

  return {
    top: `${(flipUp ? rect.top - height - gap : rect.bottom + gap) + scrollY}px`,
    left: `${left + scrollX}px`,
    width: `${width}px`,
    maxHeight: `${height}px`,
  }
}
