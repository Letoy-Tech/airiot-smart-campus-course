import type { Device, Space } from '../types/campus'
import type { Point } from '../types/full'
import type { DeviceFilter, OnlineFilter } from './course'
export function catalogHash(filter: Partial<DeviceFilter> & { deviceId?: string }): string {
  const query = new URLSearchParams()
  for (const key of ['spaceId', 'category', 'keyword', 'deviceId'] as const) if (filter[key]) query.set(key, filter[key]!)
  if (filter.online && filter.online !== 'all') query.set('online', filter.online)
  return `#devices${query.size ? `?${query}` : ''}`
}
export function readCatalogFilter(hash: string): DeviceFilter {
  const params = new URLSearchParams(hash.split('?')[1])
  const online = params.get('online') ?? 'all'
  const category = params.get('category') ?? ''
  return { keyword: params.get('keyword') ?? '', spaceId: params.get('spaceId') ?? '',
    category: ['environment', 'energy', 'facility', 'lighting'].includes(category) ? category : '',
    online: ['all', 'online', 'offline', 'unknown'].includes(online) ? online as OnlineFilter : 'all' }
}
export function historyHash(deviceId: string, tagId: string): string {
  return `#history?${new URLSearchParams({ deviceId, tagId })}`
}
export function qualityMatrix(spaces: Space[], devices: Device[], points: Point[]) {
  return spaces.map(space => {
    const ids = new Set(devices.filter(d => d.spaceId === space.id).map(d => d.id))
    const values = points.filter(p => ids.has(p.deviceId))
    return { space, devices: ids.size, points: values.length,
      fresh: values.filter(p => p.quality === 'fresh').length,
      stale: values.filter(p => p.quality === 'stale').length,
      missing: values.filter(p => p.quality === 'missing').length,
      invalid: values.filter(p => p.quality === 'invalid').length }
  })
}
