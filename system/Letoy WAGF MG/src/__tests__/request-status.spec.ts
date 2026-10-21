import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { AxiosError, type AxiosResponse } from 'axios'
import service, { HttpRequestError, NetworkUnavailableError } from '@/utils/request'

vi.mock('@/utils/token', () => ({ getAccessToken: () => null, getRefreshToken: () => null, setAccessToken: vi.fn(), clearTokens: vi.fn() }))

const originalAdapter = service.defaults.adapter
beforeEach(() => { vi.stubGlobal('localStorage', window.localStorage); setActivePinia(createPinia()) })
afterEach(() => { service.defaults.adapter = originalAdapter; vi.unstubAllGlobals() })

describe('业务写入错误证据', () => {
  it('保留并发冲突的HTTP409，页面可回读并保留输入', async () => {
    service.defaults.adapter = async config => {
      const response: AxiosResponse = { config, status: 409, statusText: 'Conflict', headers: {}, data: { code: 409, message: '记录已更新，请重新核对' } }
      throw new AxiosError('Conflict', AxiosError.ERR_BAD_REQUEST, config, undefined, response)
    }
    const error = await service.post('/TEST/transition', { expectedVersion: 1 }, { silent: true }).catch(e => e)
    expect(error).toBeInstanceOf(HttpRequestError)
    expect(error.status).toBe(409)
    expect(error.message).toBe('记录已更新，请重新核对')
  })
  it('保留业务失败代码而不把HTTP200当成操作成功', async () => {
    service.defaults.adapter = async config => ({ config, status: 200, statusText: 'OK', headers: {}, data: { code: 403, message: '当前身份不可操作' } })
    const error = await service.post('/TEST/transition', {}, { silent: true }).catch(e => e)
    expect(error).toBeInstanceOf(HttpRequestError)
    expect(error.code).toBe(403)
    expect(error.message).toBe('当前身份不可操作')
  })
  it('网络失败保留不可用类别，不能误报成版本冲突', async () => {
    service.defaults.adapter = async config => { throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config) }
    const error = await service.post('/TEST/transition', {}, { silent: true }).catch(e => e)
    expect(error).toBeInstanceOf(NetworkUnavailableError)
    expect(error).not.toBeInstanceOf(HttpRequestError)
  })
})
