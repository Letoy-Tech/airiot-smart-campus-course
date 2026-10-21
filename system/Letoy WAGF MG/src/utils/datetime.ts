const pad = (value: number) => String(value).padStart(2, '0')

const isDateLike = (value: unknown): value is string | number | Date => {
  return typeof value === 'string' || typeof value === 'number' || value instanceof Date
}

const parseDateValue = (value: string | number | Date): Date | null => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  if (typeof value === 'number') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }

  const trimmed = value.trim()
  if (!trimmed) return null

  const normalized = trimmed.replace(' ', 'T')
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date
}

const formatByPattern = (date: Date, withDate: boolean, withTime: boolean) => {
  const datePart = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  const timePart = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`

  if (withDate && withTime) return `${datePart} ${timePart}`
  if (withDate) return datePart
  return timePart
}

export const formatDateTime = (value?: string | number | Date | null, fallback = '-') => {
  if (!isDateLike(value)) return fallback
  const date = parseDateValue(value)
  return date ? formatByPattern(date, true, true) : fallback
}

export const formatDate = (value?: string | number | Date | null, fallback = '-') => {
  if (!isDateLike(value)) return fallback
  const date = parseDateValue(value)
  return date ? formatByPattern(date, true, false) : fallback
}

export const formatTime = (value?: string | number | Date | null, fallback = '-') => {
  if (!isDateLike(value)) return fallback
  const date = parseDateValue(value)
  return date ? formatByPattern(date, false, true) : fallback
}

export const formatSmartDateTime = (
  value?: string | number | Date | null,
  nowValue: string | number | Date = new Date(),
  fallback = '-'
) => {
  if (!isDateLike(value)) return fallback

  const date = parseDateValue(value)
  const now = parseDateValue(nowValue)

  if (!date || !now) return fallback

  const diff = now.getTime() - date.getTime()
  const minute = 60 * 1000
  const hour = 60 * minute
  const sameDay = formatDate(date) === formatDate(now)

  if (diff >= 0 && diff < minute) return '刚刚'
  if (diff >= minute && diff < hour) return `${Math.floor(diff / minute)}分钟前`
  if (sameDay) return `今天 ${formatTime(date)}`

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (formatDate(date) === formatDate(yesterday)) return `昨天 ${formatTime(date)}`

  if (date.getFullYear() === now.getFullYear()) {
    return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${formatTime(date)}`
  }

  return formatDateTime(date, fallback)
}
