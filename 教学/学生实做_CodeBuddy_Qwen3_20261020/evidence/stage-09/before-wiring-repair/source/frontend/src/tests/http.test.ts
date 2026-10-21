import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, assertBusinessSuccess, requestEnvelope } from '../api/http'
import { getDevices } from '../api/campus'
import { getCapabilities } from '../api/auth'

afterEach(() => vi.unstubAllGlobals())
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json;charset=UTF-8' } })

describe('统一请求边界', () => {
  it('只给相对合同路径添加一次 /api，并带同源凭据', async () => {
    const fetcher = vi.fn().mockResolvedValue(json({ code: 0, message: 'ok', data: null }))
    vi.stubGlobal('fetch', fetcher)
    await requestEnvelope('/auth/csrf')
    expect(fetcher).toHaveBeenCalledWith('/api/auth/csrf', expect.objectContaining({ credentials: 'same-origin', redirect: 'error' }))
    await expect(requestEnvelope('https://other.invalid/auth/me')).rejects.toThrow('本地教学接口')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('HTTP 200 HTML 不能充当设备数据', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>fallback</html>', { headers: { 'Content-Type': 'text/html' } })))
    await expect(requestEnvelope('/campus/devices')).rejects.toMatchObject({ code: 'INVALID_CONTENT_TYPE' })
  })

  it.each([401, 403, 404, 503])('保留 HTTP %i 状态且不显示服务端内部文本', async (status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ code: 'ERROR', message: 'internal-sensitive-detail', data: null }, status)))
    try {
      await requestEnvelope('/campus/devices')
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError)
      expect(error).toMatchObject({ status })
      expect((error as Error).message).not.toContain('internal-sensitive-detail')
    }
  })

  it('200 与非零业务码仍是失败', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => json({ code: 7, message: 'not accepted', data: null })))
    const response = await requestEnvelope('/campus/devices')
    expect(() => assertBusinessSuccess(response)).toThrow()
    await expect(getDevices()).rejects.toMatchObject({ code: 7 })
  })

  it('成功但缺少合同字段必须失败', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ code: 0, message: 'ok', data: { items: [] } })))
    await expect(getDevices()).rejects.toMatchObject({ code: 'CONTRACT_ERROR' })
  })

  it('成功空数组仍保留后端观察时间', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ code: 0, message: 'ok', data: { items: [], observedAt: 1792281600000 } })))
    await expect(getDevices()).resolves.toEqual({ items: [], observedAt: 1792281600000 })
  })

  it('字符串权限不授权，Boolean true 才授权', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ code: 0, message: 'ok', data: { roles: ['ADMIN'], canRead: 'true', canAdmin: true, canControl: 1 } })))
    await expect(getCapabilities()).resolves.toMatchObject({ canRead: false, canAdmin: true, canControl: false })
  })
})
