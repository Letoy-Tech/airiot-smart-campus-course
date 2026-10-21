import { computed } from 'vue'
import type { DeviceCategory, PointQuality } from '@/types/campus'
import { theme } from './theme'

/**
 * ECharts 无法读取 CSS 变量，这里维护与 campus.css 同值的图表色板。
 * 四个业务色系保持语义：环境青绿、能源琥珀、设施蓝、照明紫。
 */
const light = {
  text: '#334155',
  subtext: '#64748b',
  axis: '#cbd5e1',
  split: 'rgba(100,116,139,0.14)',
  surface: '#ffffff',
  tooltipBg: 'rgba(255,255,255,0.94)',
  tooltipBorder: 'rgba(15,23,42,0.08)',
  tooltipShadow: 'rgba(15,23,42,0.16)',
  brand: ['#06b6d4', '#3b82f6', '#8b5cf6'],
  category: { environment: '#0d9488', energy: '#d97706', facility: '#2563eb', lighting: '#9333ea' } as Record<DeviceCategory, string>,
  categoryGlow: { environment: '#5eead4', energy: '#fcd34d', facility: '#93c5fd', lighting: '#d8b4fe' } as Record<DeviceCategory, string>,
  quality: { fresh: '#10b981', stale: '#f59e0b', missing: '#94a3b8', invalid: '#f43f5e' } as Record<PointQuality, string>,
  series: ['#0ea5e9', '#8b5cf6', '#f59e0b', '#10b981'],
  state: { NEW: '#f59e0b', ASSIGNED: '#3b82f6', IN_PROGRESS: '#a855f7', CLOSED: '#10b981' } as Record<string, string>,
  online: '#10b981',
  offline: '#f43f5e',
  unknown: '#94a3b8',
}

const dark: typeof light = {
  text: '#cbd5e1',
  subtext: '#8b9ab0',
  axis: 'rgba(148,163,184,0.28)',
  split: 'rgba(148,163,184,0.10)',
  surface: '#0d1424',
  tooltipBg: 'rgba(10,16,30,0.92)',
  tooltipBorder: 'rgba(148,163,184,0.18)',
  tooltipShadow: 'rgba(0,0,0,0.5)',
  brand: ['#22d3ee', '#60a5fa', '#a78bfa'],
  category: { environment: '#2dd4bf', energy: '#fbbf24', facility: '#60a5fa', lighting: '#c084fc' },
  categoryGlow: { environment: '#99f6e4', energy: '#fde68a', facility: '#bfdbfe', lighting: '#e9d5ff' },
  quality: { fresh: '#34d399', stale: '#fbbf24', missing: '#64748b', invalid: '#fb7185' },
  series: ['#38bdf8', '#a78bfa', '#fbbf24', '#34d399'],
  state: { NEW: '#fbbf24', ASSIGNED: '#60a5fa', IN_PROGRESS: '#c084fc', CLOSED: '#34d399' },
  online: '#34d399',
  offline: '#fb7185',
  unknown: '#64748b',
}

export type VizTheme = typeof light & { dark: boolean }

export const vizTheme = computed<VizTheme>(() => (theme.value === 'dark' ? { ...dark, dark: true } : { ...light, dark: false }))

/** 将 #rrggbb 转为带透明度的 rgba */
export function alpha(hex: string, opacity: number) {
  const value = hex.replace('#', '')
  const full = value.length === 3 ? value.split('').map(c => c + c).join('') : value
  const n = Number.parseInt(full, 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${opacity})`
}

/** 纵向或横向线性渐变（ECharts graphic 渐变对象） */
export function gradient(from: string, to: string, horizontal = false) {
  return {
    type: 'linear',
    x: 0, y: 0, x2: horizontal ? 1 : 0, y2: horizontal ? 0 : 1,
    colorStops: [{ offset: 0, color: from }, { offset: 1, color: to }],
  }
}

/** 常用坐标轴样式 */
export function axisStyle(t: VizTheme) {
  return {
    axisLine: { lineStyle: { color: t.axis } },
    axisTick: { show: false },
    axisLabel: { color: t.subtext, fontSize: 11 },
    splitLine: { lineStyle: { color: t.split, type: 'dashed' as const } },
    nameTextStyle: { color: t.subtext, fontSize: 11 },
  }
}
