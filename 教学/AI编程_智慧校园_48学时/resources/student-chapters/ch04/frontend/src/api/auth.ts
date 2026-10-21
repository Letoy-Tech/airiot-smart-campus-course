import { strictCapability } from '../domain/course'
import type { Capabilities, CampusRole, CsrfToken, SessionUser } from '../types/campus'
import { assertBusinessSuccess, contractError, isRecord, isText, requestEnvelope } from './http'

function roles(value: unknown): CampusRole[] {
  const allowed = ['ADMIN', 'CAMPUS_MANAGER', 'CAMPUS_VIEWER']
  if (!Array.isArray(value) || !value.every((role) => isText(role) && allowed.includes(role))) contractError()
  return value as CampusRole[]
}

export async function getCsrf(): Promise<CsrfToken> {
  const response = await requestEnvelope('/auth/csrf')
  assertBusinessSuccess(response)
  const data = response.data
  if (!isRecord(data) || !isText(data.token) || !data.token || !isText(data.headerName) || !/^[A-Za-z0-9-]+$/.test(data.headerName)) contractError()
  return { token: data.token, headerName: data.headerName }
}

export async function login(username: string, password: string, csrf: CsrfToken): Promise<void> {
  const response = await requestEnvelope('/auth/login', {
    method: 'POST', headers: { [csrf.headerName]: csrf.token },
    body: new URLSearchParams({ username, password }),
  })
  assertBusinessSuccess(response)
}

export async function logout(csrf: CsrfToken): Promise<void> {
  const response = await requestEnvelope('/auth/logout', { method: 'POST', headers: { [csrf.headerName]: csrf.token } })
  assertBusinessSuccess(response)
}

export async function getMe(): Promise<SessionUser> {
  const response = await requestEnvelope('/auth/me')
  assertBusinessSuccess(response)
  const data = response.data
  if (!isRecord(data) || !isText(data.uid) || !data.uid || !isText(data.username) || !isText(data.displayName) || data.source !== 'TEACHING_MOCK') contractError()
  return { uid: data.uid, username: data.username, displayName: data.displayName, roles: roles(data.roles), source: 'TEACHING_MOCK' }
}

export async function getCapabilities(): Promise<Capabilities> {
  const response = await requestEnvelope('/campus/capabilities')
  assertBusinessSuccess(response)
  const data = response.data
  if (!isRecord(data)) contractError()
  // 只有 Boolean true 授权，缺失、数字和字符串均不授予能力。
  return {
    roles: roles(data.roles), canRead: strictCapability(data.canRead), canControl: strictCapability(data.canControl),
    canAdmin: strictCapability(data.canAdmin), canAudit: strictCapability(data.canAudit),
    canHandleAlarms: strictCapability(data.canHandleAlarms), canAssignAlarms: strictCapability(data.canAssignAlarms),
    canRunDemoScenarios: strictCapability(data.canRunDemoScenarios),
  }
}
