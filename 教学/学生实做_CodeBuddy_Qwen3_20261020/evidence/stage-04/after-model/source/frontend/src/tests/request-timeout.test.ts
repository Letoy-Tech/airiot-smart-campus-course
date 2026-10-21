import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { requestEnvelope, REQUEST_TIMEOUT_MS } from '../api/http'
import { useCampusStore } from '../stores/campus'

beforeEach(() => { vi.useFakeTimers(); setActivePinia(createPinia()) })
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
const json = (data: unknown) => new Response(JSON.stringify({ code: 0, message: 'ok', data }), { headers: { 'Content-Type': 'application/json' } })

describe('统一请求期限与取消', () => {
  it('无响应15秒后明确超时，终止底层请求且不自动重试', async () => {
    const fetcher = vi.fn().mockReturnValue(new Promise(() => {}))
    vi.stubGlobal('fetch', fetcher)
    const pending = requestEnvelope('/campus/devices')
    const assertion = expect(pending).rejects.toMatchObject({ code: 'REQUEST_TIMEOUT', status: 0 })
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS)
    await assertion
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher.mock.calls[0]?.[1].signal.aborted).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('响应头已返回但JSON体悬挂，也受同一期限限制', async () => {
    const response = json(null)
    vi.spyOn(response, 'json').mockReturnValue(new Promise(() => {}))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))
    const assertion = expect(requestEnvelope('/campus/devices')).rejects.toMatchObject({ code: 'REQUEST_TIMEOUT' })
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS)
    await assertion
    expect(vi.getTimerCount()).toBe(0)
  })

  it('调用者取消会结束请求、移除监听和清计时器，不误报超时', async () => {
    const caller = new AbortController()
    const remove = vi.spyOn(caller.signal, 'removeEventListener')
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})))
    const assertion = expect(requestEnvelope('/campus/devices', { signal: caller.signal })).rejects.toMatchObject({ code: 'REQUEST_ABORTED' })
    caller.abort()
    await assertion
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function))
    expect(vi.getTimerCount()).toBe(0)
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('成功响应清理计时器和调用者监听，随后取消不影响已确认结果', async () => {
    const caller = new AbortController()
    const remove = vi.spyOn(caller.signal, 'removeEventListener')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ items: [] })))
    const value = await requestEnvelope('/campus/devices', { signal: caller.signal })
    expect(value.data).toEqual({ items: [] })
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function))
    expect(vi.getTimerCount()).toBe(0)
    caller.abort()
    expect(value.code).toBe(0)
  })

  it('目录更新超时保留旧成功快照和观察时刻，并结束加载', async () => {
    const store = useCampusStore()
    store.user = { uid: 'a', username: 'a', displayName: '甲', roles: ['ADMIN'], source: 'TEACHING_MOCK' }
    store.capabilities = { roles: ['ADMIN'], canRead: true, canAdmin: true, canAudit: true, canControl: false, canHandleAlarms: true, canAssignAlarms: true, canRunDemoScenarios: true }
    const device = { id: 'saved-device', tableId: 'table', name: '既有设备', category: 'energy', spaceId: null, spaceName: null, online: null, communicationTime: null, simulated: true, switchOn: null, tags: [] }
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => Promise.resolve(json({ items: url.endsWith('/devices') ? [device] : [], observedAt: 100 }))))
    await store.refreshDevices()
    expect(store.hasSucceeded).toBe(true)
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})))
    const refresh = store.refreshDevices()
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS)
    await refresh
    expect(store.devices[0]?.id).toBe('saved-device')
    expect(store.observedAt).toBe(100)
    expect(store.hasSucceeded).toBe(true)
    expect(store.loading).toBe(false)
    expect(store.readError).toContain('超过15秒')
    expect(vi.getTimerCount()).toBe(0)
  })
})
