import { describe, it, expect } from 'vitest'
import { catalogHash, historyHash, qualityMatrix, readCatalogFilter } from '../domain/read-models'
import type { Device, Space } from '../types/campus'
import type { Point } from '../types/full'
const space: Space = { id: 's1', name: '一号', type: null, campusId: null, buildingId: null, floor: null }
const device: Device = { id: 'd1', name: '设备', tableId: 't', category: 'energy', spaceId: 's1', spaceName: '一号', online: null, communicationTime: null, simulated: true, switchOn: null, tags: [] }
describe('监测导航与服务端质量统计', () => {
  it('空间类型联合钻取写入hash，未知在线条件不会扩大为离线', () => {
    const hash = catalogHash({ spaceId: 's1', category: 'energy', online: 'unknown', keyword: 'A & B' })
    expect(readCatalogFilter(hash)).toEqual({ spaceId: 's1', category: 'energy', online: 'unknown', keyword: 'A & B' })
    expect(readCatalogFilter('#devices?online=no&category=bad').online).toBe('all')
    expect(historyHash('d/1', 'power')).toBe('#history?deviceId=d%2F1&tagId=power')
  })
  it('质量矩阵按点位统计，零值fresh与null missing不混合，空空间仍有一行', () => {
    const points: Point[] = [
      { deviceId: 'd1', tableId: 't', tagId: 'power', value: 0, time: 1, unit: 'kW', quality: 'fresh' },
      { deviceId: 'd1', tableId: 't', tagId: 'voltage', value: null, time: null, unit: 'V', quality: 'missing' },
    ]
    const rows = qualityMatrix([space, { ...space, id: 'empty' }], [device], points)
    expect(rows.map(({ devices, points, fresh, missing }) => ({ devices, points, fresh, missing }))).toEqual([
      { devices: 1, points: 2, fresh: 1, missing: 1 }, { devices: 0, points: 0, fresh: 0, missing: 0 },
    ])
  })
})
