import { marked } from 'marked'
import DOMPurify from 'dompurify'

/**
 * 将 Markdown 字符串安全地转换为 HTML
 * @param md Markdown 文本
 */
export function renderMarkdown(md: string): string {
  if (!md) return ''
  
  // 配置 marked 选项（如支持换行符等）
  marked.setOptions({
    breaks: true,
    gfm: true
  })

  const rawHtml = marked.parse(md) as string
  return DOMPurify.sanitize(rawHtml)
}
