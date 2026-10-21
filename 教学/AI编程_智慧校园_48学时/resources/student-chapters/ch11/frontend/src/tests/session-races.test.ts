import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as auth from '../api/auth'
import * as api from '../api/campus'
import { ApiError } from '../api/http'
import { useCampusStore } from '../stores/campus'
import type { Capabilities, Device, ReadResult, SessionUser } from '../types/campus'

vi.mock('../api/auth')
vi.mock('../api/campus')

const user: SessionUser = { uid: 'test-a', username: 'class-a', displayName: '教学甲', roles: ['ADMIN'], source: 'TEACHING_MOCK' }
const capabilities: Capabilities = { roles: ['ADMIN'], canRead: true, canControl: false, canAdmin: true, canAudit: true, canHandleAlarms: true, canAssignAlarms: true, canRunDemoScenarios: true }
const result = (id: string, observedAt: number): ReadResult<Device> => ({ items: [{ id, tableId: 'table', name: id, category: 'environment', spaceId: null, spaceName: null, online: true, communicationTime: observedAt, simulated: true, switchOn: null, tags: [] }], observedAt })
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

beforeEach(() => {
  vi.resetAllMocks()
  setActivePinia(createPinia())
  vi.mocked(api.getSpaces).mockResolvedValue({ items: [], observedAt: 100 })
  vi.mocked(auth.getCsrf).mockResolvedValue({ token: 'unit-test-token', headerName: 'X-CSRF-TOKEN' })
  vi.mocked(auth.getMe).mockResolvedValue({ ...user })
  vi.mocked(auth.getCapabilities).mockResolvedValue({ ...capabilities })
})

function signedIn() {
  const store = useCampusStore()
  store.user = { ...user }
  store.capabilities = { ...capabilities }
  return store
}

describe('身份与读取竞态', () => {
  it('登录使用前置 CSRF，成功后重新取得 CSRF 再读身份能力', async () => {
    const store = useCampusStore()
    vi.mocked(auth.getCsrf).mockResolvedValueOnce({ token: 'before', headerName: 'X-CSRF-TOKEN' }).mockResolvedValueOnce({ token: 'after', headerName: 'X-CSRF-TOKEN' })
    expect(await store.signIn('class-a', 'unit-test-password')).toBe(true)
    expect(auth.login).toHaveBeenCalledWith('class-a', 'unit-test-password', { token: 'before', headerName: 'X-CSRF-TOKEN' })
    expect(store.csrf?.token).toBe('after')
    expect(store.user?.uid).toBe('test-a')
  })

  it('较早成功不能覆盖较新请求的成功结果', async () => {
    const store = signedIn()
    const old = deferred<ReadResult<Device>>()
    vi.mocked(api.getDevices).mockReturnValueOnce(old.promise).mockResolvedValueOnce(result('new', 200))
    const first = store.refreshDevices()
    await store.refreshDevices()
    old.resolve(result('old', 100))
    await first
    expect(store.devices[0]?.id).toBe('new')
    expect(store.observedAt).toBe(200)
  })

  it('较早失败与 finally 不能污染新请求的加载状态', async () => {
    const store = signedIn()
    const old = deferred<ReadResult<Device>>()
    const next = deferred<ReadResult<Device>>()
    vi.mocked(api.getDevices).mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise)
    const first = store.refreshDevices()
    const second = store.refreshDevices()
    old.reject(new ApiError('old failure'))
    await first
    expect(store.readError).toBe('')
    expect(store.loading).toBe(true)
    next.resolve(result('new', 200))
    await second
    expect(store.loading).toBe(false)
  })

  it('切换会话立即清空，旧成功不能恢复数据', async () => {
    const store = signedIn()
    const pending = deferred<ReadResult<Device>>()
    vi.mocked(api.getDevices).mockReturnValue(pending.promise)
    const read = store.refreshDevices()
    store.beginSessionChange()
    store.user = { ...user, uid: 'test-b' }
    pending.resolve(result('old-a', 100))
    await read
    expect(store.devices).toEqual([])
    expect(store.hasSucceeded).toBe(false)
    expect(store.user.uid).toBe('test-b')
  })

  it('旧身份的 401 不能退出新身份或显示旧错误', async () => {
    const store = signedIn()
    const pending = deferred<ReadResult<Device>>()
    vi.mocked(api.getDevices).mockReturnValue(pending.promise)
    const read = store.refreshDevices()
    store.beginSessionChange()
    store.user = { ...user, uid: 'test-b' }
    pending.reject(new ApiError('expired-a', 401))
    await read
    expect(store.user.uid).toBe('test-b')
    expect(store.authError).toBe('')
  })

  it('同会话刷新失败保留旧快照、时间与失败说明', async () => {
    const store = signedIn()
    vi.mocked(api.getDevices).mockResolvedValueOnce(result('first', 100)).mockRejectedValueOnce(new ApiError('network issue'))
    await store.refreshDevices()
    await store.refreshDevices()
    expect(store.hasSucceeded).toBe(true)
    expect(store.devices[0]?.id).toBe('first')
    expect(store.observedAt).toBe(100)
    expect(store.readError).toBe('network issue')
  })

  it('首次失败不伪装成已成功的空列表', async () => {
    const store = signedIn()
    vi.mocked(api.getDevices).mockRejectedValue(new ApiError('network issue'))
    await store.refreshDevices()
    expect(store.hasSucceeded).toBe(false)
    expect(store.observedAt).toBeNull()
    expect(store.readError).not.toBe('')
  })

  it('当前请求 401 清身份；403 清资源但保留身份', async () => {
    const store = signedIn()
    vi.mocked(api.getDevices).mockRejectedValueOnce(new ApiError('forbidden', 403))
    await store.refreshDevices()
    expect(store.user?.uid).toBe('test-a')
    expect(store.capabilities?.canRead).toBe(false)
    expect(store.hasSucceeded).toBe(false)
    store.capabilities!.canRead = true
    vi.mocked(api.getDevices).mockRejectedValueOnce(new ApiError('expired', 401))
    await store.refreshDevices()
    expect(store.user).toBeNull()
    expect(store.devices).toEqual([])
  })

  it('退出未被服务端确认时仍清数据并明确保留未确认状态', async () => {
    const store = signedIn()
    store.devices = result('prior', 100).items
    store.hasSucceeded = true
    vi.mocked(auth.logout).mockRejectedValue(new ApiError('network issue'))
    await store.signOut()
    expect(store.user).toBeNull()
    expect(store.devices).toEqual([])
    expect(store.logoutUnconfirmed).toBe(true)
    expect(store.authError).toContain('服务端退出尚未确认')
  })
})
