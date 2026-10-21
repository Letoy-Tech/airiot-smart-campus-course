import type { Device, ReadResult, Space } from '../types/campus'
import { ApiError, assertBusinessSuccess, contractError, isNullableText, isRecord, isText, isTimestamp, requestEnvelope, type ApiEnvelope } from './http'

const nullableBoolean = (value: unknown) => value === null || typeof value === 'boolean'
function validDevice(value: unknown): value is Device {
  if (!isRecord(value)) return false
  return isText(value.id) && isText(value.tableId) && isText(value.name)
    && ['environment', 'energy', 'facility', 'lighting'].includes(String(value.category))
    && isNullableText(value.spaceId) && isNullableText(value.spaceName) && nullableBoolean(value.online)
    && (value.communicationTime === null || isTimestamp(value.communicationTime))
    && value.simulated === true && nullableBoolean(value.switchOn)
    && Array.isArray(value.tags) && value.tags.every((tag) => isRecord(tag) && isText(tag.id) && isText(tag.name) && isNullableText(tag.unit))
}
function validSpace(value: unknown): value is Space {
  return isRecord(value) && isText(value.id) && isText(value.name) && isNullableText(value.type)
    && isNullableText(value.campusId) && isNullableText(value.buildingId) && isNullableText(value.floor)
}
function validList<T>(value: unknown, guard: (item: unknown) => item is T): value is ReadResult<T> {
  return isRecord(value) && Array.isArray(value.items) && value.items.every(guard) && isTimestamp(value.observedAt)
}

/** 教师框架先校验外层和成功数据形状；学生 TODO 只关注业务成功与解包。 */
export function validateDeviceResponse(response: ApiEnvelope): ApiEnvelope & { data: ReadResult<Device> } {
  if (response.code === 0 && !validList(response.data, validDevice)) contractError()
  return response as ApiEnvelope & { data: ReadResult<Device> }
}

export function extractFirstRead(response: ApiEnvelope & { data: ReadResult<Device> }): ReadResult<Device> {
  // STUDENT_TODO_A_BEGIN：检查业务 code，再解包同一批列表与观察时间。
  throw new ApiError('TODO-A：先核对业务code，再返回items与observedAt。')
  // STUDENT_TODO_A_END
}

export async function getDevices(): Promise<ReadResult<Device>> {
  const response = validateDeviceResponse(await requestEnvelope('/campus/devices'))
  return extractFirstRead(response)
}

export async function getSpaces(): Promise<ReadResult<Space>> {
  const response = await requestEnvelope('/campus/spaces')
  assertBusinessSuccess(response)
  if (!validList(response.data, validSpace)) contractError()
  return response.data
}
