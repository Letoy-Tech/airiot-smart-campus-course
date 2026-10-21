// 校园值班台 · 数据服务（第02课第1步）
// 目前只读取浏览器内的练习数据（TEACHING_MOCK），不请求后端。
// 页面统一通过这里取业务数据，不要直接导入 mock-data.js。

import { mockCampus } from "./mock-data.js";

// 每次返回独立副本，调用方改动结果不会影响原始数据。
function copy(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

// 概览：与后端 /api/overview 的约定保持一致，返回五项完整练习数据。
export async function getOverview() {
  return {
    spaces: copy(mockCampus.spaces),
    devices: copy(mockCampus.devices),
    points: copy(mockCampus.points),
    history: copy(mockCampus.history),
    alarms: copy(mockCampus.alarms),
  };
}

export async function getDevices() {
  return copy(mockCampus.devices);
}

export async function getSpaces() {
  return copy(mockCampus.spaces);
}
