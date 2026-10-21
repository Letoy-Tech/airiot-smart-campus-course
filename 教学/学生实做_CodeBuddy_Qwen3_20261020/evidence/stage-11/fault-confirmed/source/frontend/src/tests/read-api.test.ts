import { afterEach, describe, expect, it, vi } from 'vitest'
import { getAlarmPage, getAuditPage } from '../api/read-models'
import { getHistory } from '../api/full'
const alarm = { id: 'alarm', deviceId: 'd', deviceName: '设备', tableId: 't', tagId: 'power', message: '教学样本', time: 100, occurredAt: 100, recoveryTime: null, recoveredAt: null, status: 'UNFAMILIAR', level: 'NOTICE', source: 'TEACHING_MOCK', simulated: true }
const audit = { id: 'audit', actorId: 'actor', actorName: '虚构角色', deviceId: 'd', tableId: 't', before: null, requested: false, confirmed: null, outcome: 'FAILED', reason: '历史样本', createdAt: 100, error: '教学失败', source: 'TEACHING_MOCK', simulated: true, sampleKind: 'HISTORICAL_TEACHING_SAMPLE' }
const page = (items: unknown[]) => ({ items, total: items.length, observedAt: 100, queriedAt: 200, source: 'TEACHING_MOCK', simulated: true, issues: [] })
const respond = (data: unknown, status = 200) => vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: status === 200 ? 0 : 503, message: 'MOCK_READ_FAILURE', data }), { status, headers: { 'Content-Type': 'application/json' } })))
afterEach(() => vi.unstubAllGlobals())
describe('只读响应合同校验', () => {
  it('报警分页保留未知原始状态，发送同源GET；来源或时间别名不符拒绝', async () => {
    respond(page([alarm]))
    expect((await getAlarmPage(2, 4, 'normal')).items[0]!.status).toBe('UNFAMILIAR')
    expect(fetch).toHaveBeenCalledWith('/api/campus/alarms?limit=2&skip=4&scenario=normal', expect.objectContaining({ credentials: 'same-origin' }))
    respond(page([{ ...alarm, occurredAt: 99 }]))
    await expect(getAlarmPage(2, 0, 'normal')).rejects.toMatchObject({ code: 'CONTRACT_ERROR' })
    respond({ ...page([alarm]), source: 'AIRIOT' })
    await expect(getAlarmPage(2, 0, 'normal')).rejects.toMatchObject({ code: 'CONTRACT_ERROR' })
  })
  it('审计严格Boolean与历史标识；未知confirmed不变false', async () => {
    respond({ ...page([audit]), sampleKind: 'HISTORICAL_TEACHING_SAMPLE' })
    expect((await getAuditPage(5, 0, 'normal')).items[0]!.confirmed).toBeNull()
    respond({ ...page([{ ...audit, requested: 'false' }]), sampleKind: 'HISTORICAL_TEACHING_SAMPLE' })
    await expect(getAuditPage(5, 0, 'normal')).rejects.toMatchObject({ code: 'CONTRACT_ERROR' })
    respond(page([audit]))
    await expect(getAuditPage(5, 0, 'normal')).rejects.toMatchObject({ code: 'CONTRACT_ERROR' })
  })
  it('503不是成功空数组；历史query时刻非法类型拒绝', async () => {
    respond(null, 503)
    await expect(getAlarmPage(5, 0, 'failure')).rejects.toMatchObject({ status: 503 })
    respond({ source: 'TEACHING_MOCK', deviceId: 'd', tagId: 'power', unit: 'kW', from: 0, to: 100, observedAt: 100, queriedAt: '200', samples: [], truncated: false, issues: [] })
    await expect(getHistory(new URLSearchParams())).rejects.toMatchObject({ code: 'CONTRACT_ERROR' })
  })
})
