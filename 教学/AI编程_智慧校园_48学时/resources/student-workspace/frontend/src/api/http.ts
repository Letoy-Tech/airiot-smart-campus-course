export class ApiError extends Error {
  constructor(message: string, public readonly status = 0, public readonly code: number | string = 'CLIENT_ERROR') {
    super(message)
    this.name = 'ApiError'
  }
}

export interface ApiEnvelope { code: number; message: string; data: unknown }
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
export const isText = (value: unknown): value is string => typeof value === 'string'
export const isNullableText = (value: unknown): value is string | null => value === null || isText(value)
export const isTimestamp = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0

export function contractError(): never {
  throw new ApiError('响应不符合教学接口合同，请核对请求与后端版本。', 0, 'CONTRACT_ERROR')
}

function httpMessage(status: number): string {
  if (status === 401) return '登录已失效，请重新登录。'
  if (status === 403) return '当前身份没有执行此操作的权限。'
  if (status === 404) return '读取路径不存在，请检查本次请求。'
  if (status === 409) return '记录已发生变化，请回读后重新决定。'
  if (status >= 500) return '教学服务暂时不可用，请稍后重试。'
  return `请求未成功（HTTP ${status}），请核对输入。`
}

/** 相对业务路径由此统一加 /api；不接受绝对地址，避免会话随请求外发。 */
export async function requestEnvelope(path: string, init: RequestInit = {}): Promise<ApiEnvelope> {
  if (!/^\/(auth|campus)\//.test(path) || path.includes('://')) {
    throw new ApiError('请求路径不属于本地教学接口。')
  }
  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      ...init, credentials: 'same-origin', cache: 'no-store', redirect: 'error',
      headers: { Accept: 'application/json', ...Object.fromEntries(new Headers(init.headers)) },
    })
  } catch {
    throw new ApiError('无法连接教学服务，请检查本组服务与网络后重试。')
  }
  const contentType = response.headers.get('content-type') ?? ''
  if (!/application\/(?:[\w.-]+\+)?json(?:\s*;|$)/i.test(contentType)) {
    throw new ApiError(response.ok ? '收到的不是 JSON 数据，请检查代理路径。' : httpMessage(response.status), response.status, 'INVALID_CONTENT_TYPE')
  }
  let value: unknown
  try { value = await response.json() } catch {
    throw new ApiError('响应不是有效 JSON，请检查教学服务。', response.status, 'INVALID_JSON')
  }
  // HTTP 失败先保留状态语义；不将未知服务端文本、HTML 或内部错误直出页面。
  if (!response.ok) {
    const code = isRecord(value) && (isText(value.code) || typeof value.code === 'number') ? value.code : 'HTTP_ERROR'
    throw new ApiError(httpMessage(response.status), response.status, code)
  }
  if (!isRecord(value) || !Number.isInteger(value.code) || !isText(value.message) || !('data' in value)) contractError()
  return { code: value.code as number, message: value.message, data: value.data }
}

export function assertBusinessSuccess(response: ApiEnvelope): void {
  if (response.code !== 0) throw new ApiError('服务未确认本次操作成功，请核对请求后重试。', 200, response.code)
}

export function safeError(error: unknown): string {
  return error instanceof ApiError ? error.message : '本次操作未完成，请重试并核对课堂记录。'
}
