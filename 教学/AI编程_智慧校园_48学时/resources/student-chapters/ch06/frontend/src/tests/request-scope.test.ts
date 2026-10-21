import { effectScope } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { useRequestScope, useCompletionPolling } from '../composables/useRequestScope'
import { useCampusStore } from '../stores/campus'
import { ApiError } from '../api/http'
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
beforeEach(() => {
  setActivePinia(createPinia())
  useCampusStore().user = {
    uid: 'test-a',
    username: 'a',
    displayName: '测试',
    source: 'TEACHING_MOCK',
    roles: ['ADMIN'],
  }
})
afterEach(() => vi.useRealTimers())
describe('跨章节请求生命周期', () => {
  it('新请求开始后旧失败与 finally 不能关闭新加载或覆盖错误', async () => {
    const scope = effectScope()
    const request = scope.run(useRequestScope)!,
      first = deferred<string>(),
      second = deferred<string>(),
      commit = vi.fn()
    const p1 = request.run(() => first.promise, commit),
      p2 = request.run(() => second.promise, commit)
    first.reject(new ApiError('old', 401))
    await p1
    expect(request.busy.value).toBe(true)
    expect(request.error.value).toBe('')
    expect(useCampusStore().user?.uid).toBe('test-a')
    second.resolve('new')
    await p2
    expect(commit).toHaveBeenCalledExactlyOnceWith('new')
    scope.stop()
  })
  it('会话变化与页面卸载拒绝旧成功、失败和 finally', async () => {
    const scope = effectScope(),
      request = scope.run(useRequestScope)!,
      pending = deferred<string>(),
      commit = vi.fn(),
      failed = vi.fn()
    const promise = request.run(() => pending.promise, commit, failed)
    useCampusStore().beginSessionChange()
    useCampusStore().user = {
      uid: 'test-b',
      username: 'b',
      displayName: '乙',
      source: 'TEACHING_MOCK',
      roles: ['ADMIN'],
    }
    pending.resolve('old-user-data')
    await promise
    expect(commit).not.toHaveBeenCalled()
    expect(request.busy.value).toBe(false)
    const late = deferred<string>(),
      later = request.run(() => late.promise, commit, failed)
    scope.stop()
    late.reject(new ApiError('late'))
    await later
    expect(failed).not.toHaveBeenCalled()
  })
  it('401 清会话，403 只报告拒绝而不伪装为登出成功', async () => {
    const scope = effectScope(),
      request = scope.run(useRequestScope)!
    await request.run(() => Promise.reject(new ApiError('权限拒绝', 403)), vi.fn())
    expect(useCampusStore().user).not.toBeNull()
    expect(request.error.value).toBe('权限拒绝')
    await request.run(() => Promise.reject(new ApiError('过期', 401)), vi.fn())
    expect(useCampusStore().user).toBeNull()
    scope.stop()
  })
  it('监测等待完成后满15秒再读，pending期间不重叠，离页取消下一次轮询', async () => {
    vi.useFakeTimers()
    const scope = effectScope(),
      pending = deferred<void>(),
      refresh = vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValue(undefined)
    scope.run(() => useCompletionPolling(refresh, () => false))
    expect(refresh).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(45000)
    expect(refresh).toHaveBeenCalledTimes(1)
    pending.resolve()
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(14999)
    expect(refresh).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(refresh).toHaveBeenCalledTimes(2)
    scope.stop()
    await vi.advanceTimersByTimeAsync(60000)
    expect(refresh).toHaveBeenCalledTimes(2)
  })
  it('监测请求未结束时离页，完成后也不再创建定时器', async () => {
    vi.useFakeTimers()
    const scope = effectScope(),
      pending = deferred<void>(),
      refresh = vi.fn(() => pending.promise)
    scope.run(() => useCompletionPolling(refresh, () => false))
    scope.stop()
    pending.resolve()
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(60000)
    expect(refresh).toHaveBeenCalledTimes(1)
  })
})
