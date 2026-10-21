/**
 * 后端标识 → 可读名称 的统一翻译规则。
 *
 * 管理端用户不应看到任何后端维护的标识（组织 ID、角色编码、枚举常量等）。
 * 以往的写法 `map[id] || id` 在字典未加载完或数据不一致时会把原始 ID 直接露出来，
 * 这里统一约定：
 *  - 字典尚未就绪：返回空数组，不渲染（避免先闪一下 ID 再变成名称）
 *  - 字典已就绪但查不到：显示占位名，绝不回退为原始 ID
 */

export const UNKNOWN_GROUP = '未知组织'
export const UNKNOWN_ROLE = '未知角色'

/** 把后端逗号分隔的字符串拆成数组（CSV → string[]） */
export function splitCsv(value?: string | null): string[] {
  return value ? value.split(',').map((s) => s.trim()).filter(Boolean) : []
}

/**
 * 批量翻译标识为名称。
 * @param keys      后端标识列表
 * @param dict      标识 → 名称 字典
 * @param ready     字典是否已加载完成
 * @param unknown   查不到时的占位名
 */
export function resolveLabels(
  keys: string[],
  dict: Record<string, string>,
  ready: boolean,
  unknown: string,
): string[] {
  if (!ready) return []
  // 多个无法识别的标识只显示一次占位名，避免出现一排“未知组织”
  return [...new Set(keys.map((key) => dict[key] || unknown))]
}

/** 单个标识翻译；字典未就绪时返回空串 */
export function resolveLabel(
  key: string | null | undefined,
  dict: Record<string, string>,
  ready: boolean,
  unknown: string,
): string {
  if (!key || !ready) return ''
  return dict[key] || unknown
}

/**
 * 生成业务标识。
 *
 * 后端要求新建组织 / 角色时由调用方提供唯一标识（groupId / roleCode 均为 @NotBlank），
 * 但这类标识对管理员没有意义，因此由前端静默生成。约束来自后端表结构：
 *  - 长度 <= 64；groupId 会逐级拼进 path VARCHAR(255)，越短越好
 *  - 不得包含 "/"（path 分隔符）和 ","（group_ids 等字段以逗号拼接存储）
 * 这里生成 `前缀_时间戳36进制+4位随机`，形如 GRP_M1K2P9XA7F3Q，约 16 个字符。
 */
export function generateBusinessKey(prefix: string): string {
  const time = Date.now().toString(36).toUpperCase()
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase().padEnd(4, '0')
  return `${prefix}_${time}${rand}`
}
