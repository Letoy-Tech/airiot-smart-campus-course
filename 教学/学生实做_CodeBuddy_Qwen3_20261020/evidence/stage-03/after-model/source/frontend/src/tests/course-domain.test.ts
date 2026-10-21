import { describe, it, expect } from 'vitest'
import {
  filterDevices,
  strictCapability,
  changeCaseState,
  caseQuery,
  closeBlockers,
  historySeries,
} from '../domain/course'
import { historyGuard } from '../api/full'
import type { Device } from '../types/campus'
import type { AlarmDetail, HistoryResult } from '../types/full'
const device = (id: string, online: boolean | null, spaceId = 's1'): Device => ({
  id,
  name: `教学 ${id}`,
  online,
  spaceId,
  spaceName: '空间',
  tableId: 'table',
  category: 'environment',
  communicationTime: null,
  simulated: true,
  switchOn: null,
  tags: [],
})
const history: HistoryResult = {
  source: 'TEACHING_MOCK',
  deviceId: 'd',
  tagId: 't',
  unit: '°C',
  from: 100,
  to: 400,
  observedAt: 400,
  samples: [
    { time: 100, value: 0 },
    { time: 200, value: null },
    { time: 400, value: 25 },
  ],
  truncated: false,
  issues: [],
}
describe('章节业务小块', () => {
  it('C06 同时按关键词、空间、类型和三态筛选且不修改原数组', () => {
    const devices = [device('A', true), device('B', false), device('C', null, 's2')]
    const filter = {
      keyword: ' 教学 b ',
      online: 'offline' as const,
      spaceId: 's1',
      category: 'environment',
    }
    expect(filterDevices(devices, filter).map((d) => d.id)).toEqual(['B'])
    expect(
      filterDevices(devices, { ...filter, keyword: '', online: 'unknown', spaceId: '' }).map(
        (d) => d.id,
      ),
    ).toEqual(['C'])
    expect(
      filterDevices(devices, { ...filter, keyword: '', online: 'online' }).map((d) => d.id),
    ).toEqual(['A'])
    expect(filterDevices(devices, { ...filter, category: 'lighting' })).toEqual([])
    expect(devices.map((d) => d.id)).toEqual(['A', 'B', 'C'])
  })
  it('C08 仅 Boolean true 授权，字符串数字缺失均不授予能力', () => {
    expect(strictCapability(true)).toBe(true)
    for (const value of [false, 'true', 'false', 1, 0, null, undefined, {}, []])
      expect(strictCapability(value)).toBe(false)
  })
  it('C12 切换和清空 state 都从 skip=0 开始；未知 state 不写入查询', () => {
    for (const state of ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'CLOSED'])
      expect(changeCaseState(state)).toEqual({ state, skip: 0 })
    expect(changeCaseState('')).toEqual({ state: '', skip: 0 })
    expect(changeCaseState('malformed')).toEqual({ state: '', skip: 0 })
    expect(caseQuery('CLOSED', 0, 5, 'teacher')).toBe(
      'limit=5&skip=0&state=CLOSED&assigneeUid=teacher',
    )
  })
  it('历史图使用实际时间并保留 null，0 不是缺失且不生成未观测样本', () => {
    expect(historySeries(history)).toEqual([
      [100, 0],
      [200, null],
      [400, 25],
    ])
    expect(historyGuard(history)).toBe(true)
    expect(historyGuard({ ...history, samples: [{ time: 200, value: '0' }] })).toBe(false)
    expect(historyGuard({ ...history, samples: [{ time: 200, value: NaN }] })).toBe(false)
  })
  it('页面关闭预检同时要求处理中、NOTE、恢复与恢复后的服务端核实', () => {
    const base = {
      state: 'IN_PROGRESS',
      timeline: [{ action: 'NOTE' }],
      sourceState: 'RECOVERED',
      occurredAt: 10,
      sourceRecoveredAt: 20,
      sourceCheckOutcome: 'PASS',
      sourceVerifiedAt: 30,
    } as AlarmDetail
    expect(closeBlockers(base)).toEqual([])
    expect(closeBlockers({ ...base, timeline: [] })).toContain('至少填写一条处理记录')
    expect(closeBlockers({ ...base, sourceVerifiedAt: 19 })).toContain('恢复后须由服务端核实通过')
    expect(closeBlockers({ ...base, sourceState: 'ACTIVE' })).toContain('演练源必须恢复')
    expect(closeBlockers({ ...base, state: 'ASSIGNED' })).toContain('先进入处理中')
  })
})
