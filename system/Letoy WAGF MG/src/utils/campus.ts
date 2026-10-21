import type { CampusCapabilities, Device, Point } from '@/types/campus'
export const categoryLabels = { environment: '环境', energy: '能源', facility: '设施', lighting: '照明' }
export const qualityLabels = { fresh: '有效', stale: '过期', missing: '缺失', invalid: '无效' }
export function timeLabel(time: number | null | undefined) { return typeof time === 'number' && Number.isFinite(time) ? new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(time) : '未提供时间' }
export function switchLabel(value: boolean | null | undefined) { return value === true ? '开启' : value === false ? '关闭' : '未知' }
export function onlineLabel(value: boolean | null | undefined) { return value === true ? '在线' : value === false ? '离线' : '状态未知' }
export function pointLabel(point: Point | undefined) { return point && typeof point.value === 'number' && Number.isFinite(point.value) && point.quality !== 'invalid' && point.quality !== 'missing' ? `${new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 3 }).format(point.value)} ${point.unit || ''}`.trim() : '未取得有效值' }
export function canControlDevice(device: Device | undefined, caps: CampusCapabilities | null) {
  const knownDevice = device && ((device.category === 'facility' && device.tableId === 'campus_facility' && /^facility_demo_0[1-4]$/.test(device.id)) || (device.category === 'lighting' && device.tableId === 'campus_lighting' && /^light_demo_0[1-4]$/.test(device.id)))
  return !!(caps?.canControl === true && knownDevice && typeof device?.switchOn === 'boolean')
}
export function confirmedControl(requested: boolean, result: { requested: boolean; confirmed: boolean }) { return typeof result.confirmed === 'boolean' && result.requested === requested && result.confirmed === requested }
