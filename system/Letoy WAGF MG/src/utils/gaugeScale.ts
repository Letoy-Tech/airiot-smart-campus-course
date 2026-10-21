/**
 * 表盘显示刻度。刻度只决定指针位置，两端数值会在表盘上标出；
 * 实际值超出预设刻度时改为按数据自动扩展，避免指针被截断造成误读。
 */
const presets: Record<string, [number, number]> = {
  temperature_c: [0, 40],
  humidity_pct: [0, 100],
  equipment_temperature_c: [0, 80],
  illuminance_lux: [0, 1000],
  voltage_v: [190, 250],
}

export function niceCeil(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const step = [1, 2, 2.5, 5, 10].find(s => s * magnitude >= value) ?? 10
  return step * magnitude
}

export function gaugeScale(tagId: string, values: (number | null | undefined)[]) {
  const numbers = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
  const preset = presets[tagId]
  if (preset && numbers.every(v => v >= preset[0] && v <= preset[1])) return { min: preset[0], max: preset[1], auto: false }
  const low = numbers.length ? Math.min(0, ...numbers) : 0
  const high = numbers.length ? Math.max(...numbers) : 1
  return { min: low < 0 ? -niceCeil(-low * 1.25) : 0, max: niceCeil(high * 1.25), auto: true }
}
