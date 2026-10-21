import { getAccessToken } from '@/utils/token'

export interface ChatRequest {
  message: string
  systemPrompt?: string
}

/**
 * 发送消息给 AI 助手 (普通请求)
 */
export function sendChatMessage(data: ChatRequest) {
  // 这里可以继续使用 axios 实例
  const service = import('@/utils/request').then(m => m.default)
  return service.then(s => s.post('/ai/chat', data))
}

/**
 * 发送流式消息 (SSE)
 * @param data 请求参数
 * @param onDelta 接收增量内容的回调
 * @param onError 错误回调
 * @param onDone 完成回调
 */
export async function streamChatMessage(
  data: ChatRequest,
  onDelta: (content: string) => void,
  onError: (err: any) => void,
  onDone: () => void
) {
  const baseURL = import.meta.env.VITE_API_BASE_URL || '/api'
  const token = getAccessToken()

  try {
    const response = await fetch(`${baseURL}/ai/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token || ''
      },
      body: JSON.stringify(data)
    })

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()

    if (!reader) throw new Error('ReadableStream not supported')

    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      
      // SSE 格式解析逻辑
      // 后端发送格式通常为: 
      // event: delta
      // data: 内容
      
      const lines = buffer.split('\n')
      buffer = lines.pop() || '' // 剩余不完整的行留在 buffer

      let currentEvent = ''
      for (const line of lines) {
        const l = line.trim()
        if (l.startsWith('event:')) {
          currentEvent = l.replace('event:', '').trim()
        } else if (l.startsWith('data:')) {
          const dataContent = l.replace('data:', '').trim()
          
          if (currentEvent === 'delta') {
            onDelta(dataContent)
          } else if (currentEvent === 'error') {
            onError(new Error(dataContent))
          } else if (currentEvent === 'done' || dataContent === '[DONE]') {
            onDone()
            return
          }
        }
      }
    }
  } catch (err) {
    onError(err)
  }
}
