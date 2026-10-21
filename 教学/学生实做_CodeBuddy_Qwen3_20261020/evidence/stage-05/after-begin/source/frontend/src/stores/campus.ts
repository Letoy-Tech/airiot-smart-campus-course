import { defineStore } from 'pinia'
import * as auth from '../api/auth'
import * as campus from '../api/campus'
import { ApiError, safeError } from '../api/http'
import type { Capabilities, CsrfToken, Device, SessionUser, Space } from '../types/campus'

/** 教师资源层：身份与资源一起清理，所有异步分支均核对 epoch / 序号。 */
export const useCampusStore = defineStore('campus-course', {
  state: () => ({
    user: null as SessionUser | null,
    capabilities: null as Capabilities | null,
    csrf: null as CsrfToken | null,
    sessionEpoch: 0,
    authSeq: 0,
    requestSeq: 0,
    initialized: false,
    authBusy: false,
    authError: '',
    logoutUnconfirmed: false,
    devices: [] as Device[],
    spaces: [] as Space[],
    observedAt: null as number | null,
    hasSucceeded: false,
    loading: false,
    readError: '',
  }),
  actions: {
    clearCatalog() {
      this.requestSeq += 1
      this.devices = []
      this.spaces = []
      this.observedAt = null
      this.hasSucceeded = false
      this.loading = false
      this.readError = ''
    },
    beginSessionChange() {
      this.sessionEpoch += 1
      this.authSeq += 1
      this.user = null
      this.capabilities = null
      this.csrf = null
      this.authError = ''
      this.clearCatalog()
      return { epoch: this.sessionEpoch, seq: this.authSeq }
    },
    authIsCurrent(epoch: number, seq: number) {
      return this.sessionEpoch === epoch && this.authSeq === seq
    },
    expireSession() {
      this.beginSessionChange()
      this.initialized = true
      this.authBusy = false
      this.authError = '登录已失效，请重新登录。'
    },
    async initialize() {
      const { epoch, seq } = this.beginSessionChange()
      this.authBusy = true
      try {
        const csrf = await auth.getCsrf()
        if (!this.authIsCurrent(epoch, seq)) return
        this.csrf = csrf
        const user = await auth.getMe()
        if (!this.authIsCurrent(epoch, seq)) return
        const capabilities = await auth.getCapabilities()
        if (!this.authIsCurrent(epoch, seq)) return
        this.user = user
        this.capabilities = capabilities
      } catch (error) {
        if (!this.authIsCurrent(epoch, seq)) return
        // 匿名访问 me 的 401 是登录页的正常起点。
        if (!(error instanceof ApiError && error.status === 401)) this.authError = safeError(error)
      } finally {
        if (this.authIsCurrent(epoch, seq)) {
          this.initialized = true
          this.authBusy = false
        }
      }
    },
    async signIn(username: string, password: string): Promise<boolean> {
      const { epoch, seq } = this.beginSessionChange()
      this.authBusy = true
      this.logoutUnconfirmed = false
      try {
        const beforeLogin = await auth.getCsrf()
        if (!this.authIsCurrent(epoch, seq)) return false
        await auth.login(username, password, beforeLogin)
        if (!this.authIsCurrent(epoch, seq)) return false
        const csrf = await auth.getCsrf() // 登录建立新会话，旧 CSRF 不再复用。
        if (!this.authIsCurrent(epoch, seq)) return false
        const user = await auth.getMe()
        if (!this.authIsCurrent(epoch, seq)) return false
        const capabilities = await auth.getCapabilities()
        if (!this.authIsCurrent(epoch, seq)) return false
        this.csrf = csrf
        this.user = user
        this.capabilities = capabilities
        return true
      } catch (error) {
        if (!this.authIsCurrent(epoch, seq)) return false
        this.authError = error instanceof ApiError && error.status === 401
          ? '登录未成功，请核对教师分配的账号与密码。' : safeError(error)
        return false
      } finally {
        if (this.authIsCurrent(epoch, seq)) {
          this.initialized = true
          this.authBusy = false
        }
      }
    },
    async signOut() {
      const { epoch, seq } = this.beginSessionChange()
      this.authBusy = true
      this.logoutUnconfirmed = true
      let serverConfirmed = false
      try {
        // 重取当前会话的 CSRF，也支持上次退出失败后明确重试。
        const csrf = await auth.getCsrf()
        if (!this.authIsCurrent(epoch, seq)) return
        await auth.logout(csrf)
        if (!this.authIsCurrent(epoch, seq)) return
        serverConfirmed = true
        this.logoutUnconfirmed = false
        const nextCsrf = await auth.getCsrf()
        if (!this.authIsCurrent(epoch, seq)) return
        this.csrf = nextCsrf
      } catch (error) {
        if (!this.authIsCurrent(epoch, seq)) return
        this.authError = serverConfirmed
          ? '已退出。登录保护初始化暂未完成，可稍后重新连接。'
          : `页面数据已清除，服务端退出尚未确认。${safeError(error)}`
      } finally {
        if (this.authIsCurrent(epoch, seq)) {
          this.initialized = true
          this.authBusy = false
        }
      }
    },
    async refreshDevices() {
      if (!this.user || this.capabilities?.canRead !== true) return
      const epoch = this.sessionEpoch
      const uid = this.user.uid
      const seq = ++this.requestSeq
      const current = () => this.sessionEpoch === epoch && this.user?.uid === uid && this.requestSeq === seq
      this.loading = true
      this.readError = ''
      try {
        const [devices, spaces] = await Promise.all([campus.getDevices(), campus.getSpaces()])
        if (!current()) return
        this.devices = devices.items
        this.spaces = spaces.items
        this.observedAt = devices.observedAt
        this.hasSucceeded = true
      } catch (error) {
        if (!current()) return
        if (error instanceof ApiError && error.status === 401) {
          this.expireSession()
        } else if (error instanceof ApiError && error.status === 403) {
          this.clearCatalog()
          if (this.capabilities) this.capabilities.canRead = false
          this.readError = '当前身份的读取权限已变化，设备数据已清除。请重新登录核对权限。'
        } else {
          this.readError = safeError(error)
        }
      } finally {
        if (current()) this.loading = false
      }
    },
  },
})
