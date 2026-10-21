import axios, { type AxiosInstance, type InternalAxiosRequestConfig, type AxiosResponse } from 'axios'
import { getAccessToken, getRefreshToken, setAccessToken, clearTokens } from './token'
import { useAppStore } from '@/store/app'

declare module 'axios' {
  interface AxiosRequestConfig { silent?: boolean; _authRetried?: boolean }
}

export class AuthExpiredError extends Error {
  constructor(message = '登录已失效，请重新登录') {
    super(message)
    this.name = 'AuthExpiredError'
  }
}

export class NetworkUnavailableError extends Error {
  constructor(message = '后端服务暂时不可用，请稍后再试') {
    super(message)
    this.name = 'NetworkUnavailableError'
  }
}

export class HttpRequestError extends Error {
  constructor(message: string, public readonly status: number, public readonly code?: number) {
    super(message)
    this.name = 'HttpRequestError'
  }
}

const service: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 10000,
})

let isRefreshing = false
let isRedirectingToLogin = false
let requests: Array<{
  resolve: (token: string) => void
  reject: (error: unknown) => void
}> = []

const redirectToLogin = () => {
  const loginPath = `${import.meta.env.BASE_URL}login`
  if (isRedirectingToLogin || window.location.pathname === loginPath) return
  isRedirectingToLogin = true
  clearTokens()
  window.location.replace(loginPath)
}

const rejectQueuedRequests = (error: unknown) => {
  requests.forEach(({ reject }) => reject(error))
  requests = []
}

// 请求拦截
service.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // 动态获取 Store 实例
    const appStore = useAppStore()
    if (!config.silent) appStore.startLoading()

    const token = getAccessToken()
    if (token) {
      config.headers['Authorization'] = token
    }
    return config
  },
  (error) => {
    const appStore = useAppStore()
    appStore.stopLoading()
    return Promise.reject(error)
  }
)

// 响应拦截
service.interceptors.response.use(
  (response: AxiosResponse) => {
    const appStore = useAppStore()
    // 延迟 200ms 关闭，防止网络太快导致 Loading 闪烁
    if (!response.config.silent) setTimeout(() => appStore.stopLoading(), 200)

    const res = response.data
    if (res.code === undefined) return res
    if (res.code === 0) {
      return res.data
    } else {
      const errorMsg = res.message || '系统业务异常'
      return Promise.reject(new HttpRequestError(errorMsg, response.status, res.code))
    }
  },
  async (error) => {
    const appStore = useAppStore()
    if (!error.config?.silent) appStore.stopLoading()

    const { response, config } = error
    if (response && response.status === 401) {
      if (config?._authRetried || config?.url === '/auth/login') {
        if (config?.url !== '/auth/login') redirectToLogin()
        return Promise.reject(new AuthExpiredError(response.data?.message || '登录认证失败'))
      }
      config._authRetried = true
      if (!isRefreshing) {
        isRefreshing = true
        const refreshToken = getRefreshToken()
        if (refreshToken) {
          try {
            const refreshRes = await axios.post(
              (import.meta.env.VITE_API_BASE_URL || '/api') + '/auth/refresh',
              { refreshToken }
            )
            if (refreshRes.data.code === 0) {
              const { accessToken } = refreshRes.data.data
              setAccessToken(accessToken)
              requests.forEach(({ resolve }) => resolve(accessToken))
              requests = []
              return service(config)
            }
            const authError = new AuthExpiredError(refreshRes.data.message)
            rejectQueuedRequests(authError)
            redirectToLogin()
            return Promise.reject(authError)
          } catch (e) {
            const refreshError = axios.isAxiosError(e) && !e.response
              ? new NetworkUnavailableError(e.code === 'ECONNABORTED' ? '后端服务响应超时，请稍后再试' : '后端服务暂时不可用，请稍后再试')
              : new AuthExpiredError(axios.isAxiosError(e) ? e.response?.data?.message : undefined)
            rejectQueuedRequests(refreshError)
            if (refreshError instanceof AuthExpiredError) redirectToLogin()
            return Promise.reject(refreshError)
          } finally {
            isRefreshing = false
          }
        } else {
          const authError = new AuthExpiredError()
          rejectQueuedRequests(authError)
          redirectToLogin()
          return Promise.reject(authError)
        }
      } else {
        return new Promise((resolve, reject) => {
          requests.push({
            resolve: (token: string) => {
            config.headers['Authorization'] = token
            resolve(service(config))
            },
            reject,
          })
        })
      }
    }

    if (!response) {
      const message = error.code === 'ECONNABORTED' ? '后端服务响应超时，请稍后再试' : '后端服务暂时不可用，请稍后再试'
      return Promise.reject(new NetworkUnavailableError(message))
    }

    const message = response?.data?.message || error.message || '网络请求错误'
    return Promise.reject(new HttpRequestError(message, response.status, response.data?.code))
  }
)

export default service
