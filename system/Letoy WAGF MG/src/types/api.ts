export interface ApiResponse<T> {
  timestamp: string
  status: number
  code: number
  message: string
  data: T
  path?: string
  traceId?: string
}

export interface PageResponse<T> {
  list: T[]
  total: number
  pageNum: number
  pageSize: number
  pages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export interface TokenResponse {
  accessToken: string
  tokenType: string
  expiresIn: number
}
