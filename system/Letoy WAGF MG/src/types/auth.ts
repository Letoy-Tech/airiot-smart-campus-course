export interface CurrentUser {
  uid: string
  username: string
  nickname?: string
  phoneNumber?: string
  email?: string
  groupIds: string
  roles: string
  accessToken?: string
  refreshToken?: string
  active: boolean
  accountLocked: boolean
}

export interface CurrentUserViewModel extends Omit<CurrentUser, 'groupIds' | 'roles'> {
  groupIdsRaw: string
  rolesRaw: string
  groupIds: string[]
  roles: string[]
}

export interface LoginResponse extends CurrentUser {
  token: string
  refreshToken: string
}
