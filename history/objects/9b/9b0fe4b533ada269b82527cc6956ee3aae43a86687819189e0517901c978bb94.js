// 校园值班台 · 数据服务（第10课第4步）
// 设备基本信息与空间位置读取同源 MySQL 接口（GET /api/devices、GET /api/spaces），
// 空间保存走 PUT /api/spaces/{id}；连接后端时不使用 mockCampus，也不读浏览器里的旧空间位置。
// 浏览器演示仍以 mockCampus 为起点；空间位置、责任只在本次页面内存里，刷新回到练习数据。
// 演练事件与审计自第11课起只从本机 MySQL 读写，不再读写 localStorage 的 campus-v2-demo。
// 页面统一通过这里取业务数据，不要直接导入 mock-data.js。

import { mockCampus } from "./mock-data.js";

// ---------- 登录会话令牌（第09课） ----------
// 令牌只存在这个模块的内存变量里：不写 localStorage / sessionStorage，不放进 URL，
// 也不交给页面其他文件保存。刷新页面即丢失，必须重新登录。
// 顶部“数据方式”偏好另存 localStorage，那只表示数据来源，不代表身份。
let sessionToken = null;

/** 只清本机内存令牌：不访问网络，也不删除后端的其他会话。 */
export function clearSessionToken() {
  sessionToken = null;
}

// 每次返回独立副本，调用方改动结果不会影响当前数据。
function copy(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

// 浏览器演示用的空间数据：只复制原始练习数据，不读写 localStorage 里的旧位置。
// 第10课第4步起空间位置由后端 /api/spaces 保存；连接后端时不走这里。
let currentSpaces = null;

function getCurrentSpaces() {
  if (currentSpaces) return currentSpaces;
  currentSpaces = copy(mockCampus.spaces);
  return currentSpaces;
}

// 浏览器演示用的练习读数集合：只给仍未接后端的页面（设备详情的点位、历史、原始报警）使用。
// 概览页与能源页已改读 getOverviewFromServer()，读取失败也不会用这里的练习数据顶替。
export async function getOverview() {
  return {
    spaces: copy(getCurrentSpaces()),
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
  return copy(getCurrentSpaces());
}

// 接入状态：第06课固定返回教学模拟，不连接真实设备，也不发外部通知。
// 字段与后端约定保持一致：source=TEACHING_MOCK、simulated=true、
// controlEnabled=false、notificationsEnabled=false，便于第07课起原样替换。
export async function getIntegration() {
  return {
    source: "TEACHING_MOCK",
    simulated: true,
    controlEnabled: false,
    notificationsEnabled: false,
  };
}

// 浏览器演示用的责任记录：第10课第5步起不再从 localStorage 读取，
// 只在本次页面内存里有效；连接后端时走 getOwnersFromServer()。
let currentOwners = [];

export async function getOwners() {
  return copy(currentOwners);
}

// 浏览器演示专用：只修改本次页面内存里的楼栋与楼层。
// 第10课第4步起空间位置由后端保存（见文末 updateSpaceLocationFromServer），
// 这里不再写 localStorage、也不再追加 space.update 审计：刷新后回到练习数据。
export async function saveSpace(id, { building, floor } = {}) {
  const space = getCurrentSpaces().find((item) => item.id === id);
  if (!space) {
    throw new Error("找不到该空间");
  }

  const nextBuilding = typeof building === "string" ? building.trim() : "";
  const nextFloor = typeof floor === "string" ? floor.trim() : "";

  if (nextBuilding === "") {
    throw new Error("楼栋不能为空");
  }
  if (nextFloor === "") {
    throw new Error("楼层不能为空");
  }

  space.building = nextBuilding;
  space.floor = nextFloor;

  return copy(space);
}

// 浏览器演示专用：只在本次页面内存里登记负责人，不写 localStorage、不写数据库。
// 版本语义与后端一致：没有记录时为 0，首次登记为 1，之后每次成功修改 +1；
// 版本不一致时抛 VERSION_CONFLICT，由页面读取新记录后让学生重新决定，不自动重试。
export async function saveOwner(deviceId, { username, note, expectedVersion } = {}) {
  if (typeof deviceId !== "string" || deviceId === "") {
    throw new Error("缺少设备编号");
  }

  const nextUsername = typeof username === "string" ? username.trim() : "";
  const nextNote = typeof note === "string" ? note.trim() : "";

  if (nextUsername === "") {
    throw new Error("负责人不能为空");
  }
  if (nextNote === "") {
    throw new Error("备注不能为空");
  }

  if (!Number.isInteger(expectedVersion) || expectedVersion < 0) {
    throw new Error("负责人版本无效，请重新读取后再登记");
  }
  const expected = expectedVersion;

  const existing = currentOwners.find(
    (owner) => owner && owner.deviceId === deviceId
  );
  const currentVersion =
    existing && Number.isInteger(existing.version) && existing.version >= 0
      ? existing.version
      : 0;

  if (currentVersion !== expected) {
    const conflict = new Error(
      "负责人记录已更新，请重新读取后再决定是否保存"
    );
    conflict.code = "VERSION_CONFLICT";
    throw conflict;
  }

  const nextOwner = {
    deviceId,
    username: nextUsername,
    note: nextNote,
    version: currentVersion + 1,
  };

  currentOwners = currentOwners.some(
    (owner) => owner && owner.deviceId === deviceId
  )
    ? currentOwners.map((owner) =>
        owner && owner.deviceId === deviceId ? nextOwner : owner
      )
    : [...currentOwners, nextOwner];

  return copy(nextOwner);
}

// ---------- 后端连接检查（第07课） ----------
// 只请求同源的 /api/health，确认后端是否启动；不读取设备、空间、事件等业务数据，
// 也不改动上面的演示数据。5 秒没有响应就中止并抛出超时错误。
const HEALTH_URL = "/api/health";
const HEALTH_TIMEOUT_MS = 5000;

function healthError(message, { timeout = false } = {}) {
  const error = new Error(message);
  error.name = "HealthCheckError";
  error.timeout = timeout;
  return error;
}

export async function checkHealth() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);

  try {
    let response;
    try {
      response = await fetch(HEALTH_URL, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
      });
    } catch (error) {
      if (error && error.name === "AbortError") {
        throw healthError("等待 5 秒没有响应", { timeout: true });
      }
      throw healthError("请求没有发出去（后端未启动或网络不通）");
    }

    if (!response.ok) {
      throw healthError(`后端返回 HTTP ${response.status}`);
    }

    let body;
    try {
      body = await response.json();
    } catch (error) {
      if (error && error.name === "AbortError") {
        throw healthError("等待 5 秒没有响应", { timeout: true });
      }
      throw healthError("后端返回的不是合法 JSON");
    }

    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      throw healthError("后端返回格式不是 {code,message,data}");
    }

    return body;
  } finally {
    clearTimeout(timer);
  }
}

// ---------- 设备台账（第08课）：同源 GET /api/devices ----------
// 只给设备页和详情里的设备基本信息使用；空间、点位、历史、责任人仍走上面的演示数据。
// 读取失败一律抛错，由页面显示错误或保留上次结果，绝不回退成 mockCampus.devices。
const DEVICES_URL = "/api/devices";
const DEVICES_TIMEOUT_MS = 5000;

function devicesError(message, { timeout = false, unauthorized = false, forbidden = false } = {}) {
  const error = new Error(message);
  error.name = "DevicesApiError";
  error.timeout = timeout;
  error.unauthorized = unauthorized;
  error.forbidden = forbidden;
  return error;
}

function readNonEmptyString(source, field, where) {
  const value = source[field];
  if (typeof value !== "string" || value.trim() === "") {
    throw devicesError(`${where} 的 ${field} 不是非空字符串，已拒绝本次数据`);
  }
  return value;
}

// online 只接受 true / false / null；缺字段、数字、"true" 都算格式错误，
// 避免驱动或序列化问题把"未知"悄悄变成 false。
function readOnline(source, where) {
  if (!Object.prototype.hasOwnProperty.call(source, "online")) {
    throw devicesError(`${where} 缺少 online 字段（未知应为 null），已拒绝本次数据`);
  }
  const value = source.online;
  if (value === null || typeof value === "boolean") return value;
  throw devicesError(`${where} 的 online 只能是 true / false / null，已拒绝本次数据`);
}

function readDevice(item, index) {
  if (item === null || typeof item !== "object" || Array.isArray(item)) {
    throw devicesError(`第 ${index + 1} 台设备不是对象，已拒绝本次数据`);
  }

  const where = `第 ${index + 1} 台设备`;
  if (typeof item.simulated !== "boolean") {
    throw devicesError(`${where} 的 simulated 不是布尔值，已拒绝本次数据`);
  }

  return {
    id: readNonEmptyString(item, "id", where),
    name: readNonEmptyString(item, "name", where),
    category: readNonEmptyString(item, "category", where),
    spaceId: readNonEmptyString(item, "spaceId", where),
    online: readOnline(item, where),
    simulated: item.simulated,
  };
}

// 只接受 {code:0,message,data:[]}；任何一项不符都整批拒绝，不做"能显示几条算几条"。
function readDevicesBody(body) {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw devicesError("后端返回格式不是 {code,message,data}");
  }
  if (body.code !== 0) {
    const message =
      typeof body.message === "string" && body.message !== ""
        ? body.message
        : "未知错误";
    throw devicesError(`后端返回失败（code=${body.code}）：${message}`);
  }
  if (!Array.isArray(body.data)) {
    throw devicesError("后端返回的 data 不是设备数组");
  }

  const devices = body.data.map(readDevice);
  const seenIds = new Set();
  for (const device of devices) {
    if (seenIds.has(device.id)) {
      throw devicesError(`后端返回了重复的设备编号 ${device.id}，已拒绝本次数据`);
    }
    seenIds.add(device.id);
  }
  return devices;
}

export async function getDevicesFromServer() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEVICES_TIMEOUT_MS);

  try {
    let response;
    try {
      response = await fetch(DEVICES_URL, {
        method: "GET",
        headers: authHeaders(),
        cache: "no-store",
        signal: controller.signal,
      });
    } catch (error) {
      if (error && error.name === "AbortError") {
        throw devicesError("等待 5 秒没有响应", { timeout: true });
      }
      throw devicesError("请求没有发出去（后端未启动或网络不通）");
    }

    // 401：会话缺失或已过期，先清掉本机内存令牌，由页面回到登录。
    if (response.status === 401) {
      sessionToken = null;
      throw devicesError("未登录或登录已过期（HTTP 401），请重新登录", {
        unauthorized: true,
      });
    }

    // 403：已登录但当前账号无权读取，明确显示，不改成成功。
    if (response.status === 403) {
      throw devicesError("后端拒绝访问（HTTP 403）：当前账号无权读取设备", {
        forbidden: true,
      });
    }

    if (!response.ok) {
      throw devicesError(`后端返回 HTTP ${response.status}`);
    }

    let body;
    try {
      body = await response.json();
    } catch (error) {
      if (error && error.name === "AbortError") {
        throw devicesError("等待 5 秒没有响应", { timeout: true });
      }
      throw devicesError("后端返回的不是合法 JSON");
    }

    return readDevicesBody(body);
  } finally {
    clearTimeout(timer);
  }
}

// ---------- 概览读数集合（第10课）：同源 GET /api/overview ----------
// 概览页与能源页只认这一份读数集合：五部分全部来自本机 MySQL（需登录），
// 字段名与约定卡、练习数据一致。读取失败一律抛错，由页面保留上次成功快照并标出失败，
// 绝不回退到 mockCampus：mock 只属于仍在“浏览器演示”的页面。
// null 与 0 必须分开：value 为 null 表示没有读数，0 表示有效读到 0；unit 按点位原值保留。
const OVERVIEW_URL = "/api/overview";
const OVERVIEW_TIMEOUT_MS = 5000;
const OVERVIEW_QUALITIES = ["fresh", "stale", "missing", "invalid"];

function overviewError(
  message,
  { timeout = false, unauthorized = false, forbidden = false } = {}
) {
  const error = new Error(message);
  error.name = "OverviewApiError";
  error.timeout = timeout;
  error.unauthorized = unauthorized;
  error.forbidden = forbidden;
  return error;
}

function readOverviewText(source, field, where) {
  const value = source[field];
  if (typeof value !== "string" || value.trim() === "") {
    throw overviewError(`${where} 的 ${field} 不是非空字符串，已拒绝本次数据`);
  }
  return value;
}

// 允许空字符串（状态量没有单位），但不允许缺字段或非字符串。
function readOverviewUnit(source, where) {
  if (!Object.prototype.hasOwnProperty.call(source, "unit")) {
    throw overviewError(`${where} 缺少 unit 字段，已拒绝本次数据`);
  }
  if (typeof source.unit !== "string") {
    throw overviewError(`${where} 的 unit 不是字符串，已拒绝本次数据`);
  }
  return source.unit;
}

// 读数只接受数字或 null：null 表示没有读数，0 是有效读数，字符串 "0" 也算格式错误。
function readOverviewValue(source, where) {
  if (!Object.prototype.hasOwnProperty.call(source, "value")) {
    throw overviewError(`${where} 缺少 value 字段（没有读数应为 null），已拒绝本次数据`);
  }
  const value = source.value;
  if (value === null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  throw overviewError(`${where} 的 value 只能是数字或 null，已拒绝本次数据`);
}

// 原采样时间：数字或 null，绝不在这里补成“现在”。
function readOverviewTime(source, where) {
  if (!Object.prototype.hasOwnProperty.call(source, "time")) {
    throw overviewError(`${where} 缺少 time 字段（没有采样时间应为 null），已拒绝本次数据`);
  }
  const time = source.time;
  if (time === null) return null;
  if (typeof time === "number" && Number.isFinite(time)) return time;
  throw overviewError(`${where} 的 time 只能是数字或 null，已拒绝本次数据`);
}

function readOverviewSpace(item, index) {
  if (item === null || typeof item !== "object" || Array.isArray(item)) {
    throw overviewError(`第 ${index + 1} 个空间不是对象，已拒绝本次数据`);
  }
  const where = `第 ${index + 1} 个空间`;
  return {
    id: readOverviewText(item, "id", where),
    name: readOverviewText(item, "name", where),
    building: readOverviewText(item, "building", where),
    floor: readOverviewText(item, "floor", where),
  };
}

function readOverviewPoint(item, index) {
  if (item === null || typeof item !== "object" || Array.isArray(item)) {
    throw overviewError(`第 ${index + 1} 个点位不是对象，已拒绝本次数据`);
  }
  const where = `第 ${index + 1} 个点位`;
  const quality = item.quality;
  if (typeof quality !== "string" || !OVERVIEW_QUALITIES.includes(quality)) {
    throw overviewError(`${where} 的 quality 不是约定值，已拒绝本次数据`);
  }
  return {
    deviceId: readOverviewText(item, "deviceId", where),
    tagId: readOverviewText(item, "tagId", where),
    value: readOverviewValue(item, where),
    unit: readOverviewUnit(item, where),
    time: readOverviewTime(item, where),
    quality,
  };
}

function readOverviewSample(item, where) {
  if (item === null || typeof item !== "object" || Array.isArray(item)) {
    throw overviewError(`${where} 的样本不是对象，已拒绝本次数据`);
  }
  if (typeof item.time !== "number" || !Number.isFinite(item.time)) {
    throw overviewError(`${where} 的样本 time 不是数字，已拒绝本次数据`);
  }
  if (!Object.prototype.hasOwnProperty.call(item, "value")) {
    throw overviewError(`${where} 的样本缺少 value 字段，已拒绝本次数据`);
  }
  const value = item.value;
  if (value !== null && (typeof value !== "number" || !Number.isFinite(value))) {
    throw overviewError(`${where} 的样本 value 只能是数字或 null，已拒绝本次数据`);
  }
  return { time: item.time, value };
}

function readOverviewHistory(item, index) {
  if (item === null || typeof item !== "object" || Array.isArray(item)) {
    throw overviewError(`第 ${index + 1} 组历史不是对象，已拒绝本次数据`);
  }
  const where = `第 ${index + 1} 组历史`;
  if (!Array.isArray(item.samples)) {
    throw overviewError(`${where} 的 samples 不是数组，已拒绝本次数据`);
  }

  const samples = item.samples.map((sample, sampleIndex) =>
    readOverviewSample(sample, `${where} 第 ${sampleIndex + 1} 条`)
  );

  // 历史必须按样本时间升序；顺序不对说明后端拼装有问题，整批拒绝而不是自行重排。
  for (let i = 1; i < samples.length; i += 1) {
    if (samples[i].time < samples[i - 1].time) {
      throw overviewError(`${where} 的样本没有按时间排序，已拒绝本次数据`);
    }
  }

  return {
    deviceId: readOverviewText(item, "deviceId", where),
    tagId: readOverviewText(item, "tagId", where),
    unit: readOverviewUnit(item, where),
    samples,
  };
}

function readOverviewAlarm(item, index) {
  if (item === null || typeof item !== "object" || Array.isArray(item)) {
    throw overviewError(`第 ${index + 1} 条报警不是对象，已拒绝本次数据`);
  }
  const where = `第 ${index + 1} 条报警`;
  if (typeof item.time !== "number" || !Number.isFinite(item.time)) {
    throw overviewError(`${where} 的 time 不是数字，已拒绝本次数据`);
  }
  if (typeof item.simulated !== "boolean") {
    throw overviewError(`${where} 的 simulated 不是布尔值，已拒绝本次数据`);
  }
  return {
    id: readOverviewText(item, "id", where),
    deviceId: readOverviewText(item, "deviceId", where),
    message: readOverviewText(item, "message", where),
    status: readOverviewText(item, "status", where),
    level: readOverviewText(item, "level", where),
    time: item.time,
    simulated: item.simulated,
  };
}

function pointKey(deviceId, tagId) {
  return `${deviceId}\u0000${tagId}`;
}

// 只接受 {code:0,message,data:{spaces,devices,points,history,alarms}}；
// 任何一项不符都整批拒绝，不做“能显示几条算几条”，也不拿练习数据补齐。
function readOverviewBody(body) {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw overviewError("后端返回格式不是 {code,message,data}");
  }
  if (body.code !== 0) {
    const message =
      typeof body.message === "string" && body.message !== ""
        ? body.message
        : "未知错误";
    throw overviewError(`后端返回失败（code=${body.code}）：${message}`);
  }

  const data = body.data;
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw overviewError("后端返回的 data 不是对象");
  }

  for (const key of ["spaces", "devices", "points", "history", "alarms"]) {
    if (!Array.isArray(data[key])) {
      throw overviewError(`后端返回的 data.${key} 不是数组，已拒绝本次数据`);
    }
  }

  const spaces = data.spaces.map(readOverviewSpace);
  const devices = data.devices.map(readDevice);
  const points = data.points.map(readOverviewPoint);
  const history = data.history.map(readOverviewHistory);
  const alarms = data.alarms.map(readOverviewAlarm);

  const seenDeviceIds = new Set();
  for (const device of devices) {
    if (seenDeviceIds.has(device.id)) {
      throw overviewError(`后端返回了重复的设备编号 ${device.id}，已拒绝本次数据`);
    }
    seenDeviceIds.add(device.id);
  }

  const unitByPoint = new Map();
  for (const point of points) {
    const key = pointKey(point.deviceId, point.tagId);
    if (unitByPoint.has(key)) {
      throw overviewError(
        `后端返回了重复的点位 ${point.deviceId}/${point.tagId}，已拒绝本次数据`
      );
    }
    unitByPoint.set(key, point.unit);
  }

  // 历史单位必须与同一点位一致：两条不同单位的数据不能混着画一张图。
  const seenHistoryKeys = new Set();
  for (const entry of history) {
    const key = pointKey(entry.deviceId, entry.tagId);
    if (seenHistoryKeys.has(key)) {
      throw overviewError(
        `后端返回了重复的历史点位 ${entry.deviceId}/${entry.tagId}，已拒绝本次数据`
      );
    }
    seenHistoryKeys.add(key);

    if (!unitByPoint.has(key)) {
      throw overviewError(
        `历史点位 ${entry.deviceId}/${entry.tagId} 没有对应的点位读数，已拒绝本次数据`
      );
    }
    if (unitByPoint.get(key) !== entry.unit) {
      throw overviewError(
        `历史点位 ${entry.deviceId}/${entry.tagId} 的单位与点位单位不一致，已拒绝本次数据`
      );
    }
  }

  return { spaces, devices, points, history, alarms };
}

/** 需登录：带上内存令牌读取 /api/overview；失败抛错，不由本函数回退 mock。 */
export async function getOverviewFromServer() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OVERVIEW_TIMEOUT_MS);

  try {
    let response;
    try {
      response = await fetch(OVERVIEW_URL, {
        method: "GET",
        headers: authHeaders(),
        cache: "no-store",
        signal: controller.signal,
      });
    } catch (error) {
      if (error && error.name === "AbortError") {
        throw overviewError("等待 5 秒没有响应", { timeout: true });
      }
      throw overviewError("请求没有发出去（后端未启动或网络不通）");
    }

    // 401：会话缺失或已过期，先清掉本机内存令牌，由页面回到登录。
    if (response.status === 401) {
      sessionToken = null;
      throw overviewError("未登录或登录已过期（HTTP 401），请重新登录", {
        unauthorized: true,
      });
    }

    // 403：已登录但当前账号无权读取，明确显示，不改成成功。
    if (response.status === 403) {
      throw overviewError("后端拒绝访问（HTTP 403）：当前账号无权读取概览", {
        forbidden: true,
      });
    }

    if (!response.ok) {
      throw overviewError(`后端返回 HTTP ${response.status}`);
    }

    let body;
    try {
      body = await response.json();
    } catch (error) {
      if (error && error.name === "AbortError") {
        throw overviewError("等待 5 秒没有响应", { timeout: true });
      }
      throw overviewError("后端返回的不是合法 JSON");
    }

    return readOverviewBody(body);
  } finally {
    clearTimeout(timer);
  }
}

// ---------- 登录会话（第09课）：POST /api/login、GET /api/me、POST /api/logout ----------
// 口令只在 login() 的一次请求里使用：不保存、不写日志、不放进 URL。
// 令牌只写在上面的 sessionToken 变量；后端返回的账号与角色只用于本次页面显示。
const LOGIN_URL = "/api/login";
const ME_URL = "/api/me";
const LOGOUT_URL = "/api/logout";
const AUTH_TIMEOUT_MS = 5000;
const KNOWN_ROLES = ["ADMIN", "MANAGER", "VIEWER"];

function authError(
  message,
  { status = 0, code = null, unauthorized = false, forbidden = false, unavailable = false, timeout = false } = {}
) {
  const error = new Error(message);
  error.name = "AuthApiError";
  error.status = status;
  error.code = code;
  error.unauthorized = unauthorized;
  error.forbidden = forbidden;
  error.unavailable = unavailable;
  error.timeout = timeout;
  return error;
}

// 公共请求头：总是接受 JSON；只有存在内存令牌时才加 Authorization，绝不下发空 Bearer。
function authHeaders() {
  const headers = { Accept: "application/json" };
  if (sessionToken !== null) {
    headers.Authorization = `Bearer ${sessionToken}`;
  }
  return headers;
}

// 用户对象只接受 {username, role}，role 必须是三个课程角色之一。
function isUserView(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof value.username === "string" &&
    value.username.trim() !== "" &&
    typeof value.role === "string" &&
    KNOWN_ROLES.includes(value.role)
  );
}

// 统一处理会话类接口：401 / 403 / 503 分别带标记抛出，供页面区分。
async function requestAuthApi(url, { method, payload } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AUTH_TIMEOUT_MS);

  try {
    let response;
    try {
      response = await fetch(url, {
        method,
        headers:
          payload === undefined
            ? authHeaders()
            : { ...authHeaders(), "Content-Type": "application/json" },
        body: payload === undefined ? undefined : JSON.stringify(payload),
        cache: "no-store",
        signal: controller.signal,
      });
    } catch (error) {
      if (error && error.name === "AbortError") {
        throw authError("等待 5 秒没有响应", { timeout: true });
      }
      throw authError("请求没有发出去（后端未启动或网络不通）");
    }

    let body = null;
    try {
      body = await response.json();
    } catch (error) {
      body = null;
    }

    const serverMessage =
      body && typeof body.message === "string" && body.message !== ""
        ? body.message
        : null;

    if (response.status === 401) {
      sessionToken = null;
      throw authError(serverMessage ?? "未登录或登录已过期", {
        status: 401,
        unauthorized: true,
      });
    }

    if (response.status === 403) {
      throw authError(serverMessage ?? "已登录但无权执行该操作", {
        status: 403,
        forbidden: true,
      });
    }

    if (response.status === 503) {
      throw authError(serverMessage ?? "会话服务暂时不可用，请稍后重试", {
        status: 503,
        unavailable: true,
      });
    }

    if (!response.ok) {
      throw authError(serverMessage ?? `后端返回 HTTP ${response.status}`, {
        status: response.status,
      });
    }

    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      throw authError("后端返回格式不是 {code,message,data}");
    }

    if (body.code !== 0) {
      throw authError(serverMessage ?? `后端返回失败（code=${body.code}）`, {
        status: response.status,
        code: body.code,
      });
    }

    return body.data;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 登录：口令只用这一次，成功后本模块只记住令牌；返回后端给的规范账号与角色。
 * 用户名与角色来自 /api/login 响应，不采用输入框里的写法作为身份。
 */
export async function login(username, password) {
  const data = await requestAuthApi(LOGIN_URL, {
    method: "POST",
    payload: { username, password },
  });

  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw authError("登录响应缺少 data，未按登录成功处理");
  }
  if (typeof data.token !== "string" || data.token.trim() === "") {
    throw authError("登录响应缺少令牌，未按登录成功处理");
  }
  if (!isUserView(data.user)) {
    throw authError("登录响应缺少用户名或角色，未按登录成功处理");
  }

  // 令牌只写内存；不返回给页面，也不落到任何浏览器存储。
  sessionToken = data.token;
  return { username: data.user.username, role: data.user.role };
}

/** 当前用户：必须带着内存令牌调用；401 会清令牌并抛出，由页面回到登录。 */
export async function fetchMe() {
  if (sessionToken === null) {
    throw authError("尚未登录", { status: 401, unauthorized: true });
  }

  const data = await requestAuthApi(ME_URL, { method: "GET" });
  if (!isUserView(data)) {
    throw authError("当前用户响应缺少用户名或角色");
  }
  return { username: data.username, role: data.role };
}

/**
 * 退出：先清本机内存令牌，再尽力通知后端删除会话。
 * 返回值说明后端是否确认删除，页面据此如实显示，不把失败说成成功。
 */
export async function logout() {
  const token = sessionToken;
  sessionToken = null;

  if (token === null) {
    return { hadSession: false, serverConfirmed: true };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AUTH_TIMEOUT_MS);

  try {
    const response = await fetch(LOGOUT_URL, {
      method: "POST",
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: controller.signal,
    });
    // 401 表示该会话本来就不存在，也算已退出。
    return { hadSession: true, serverConfirmed: response.ok || response.status === 401 };
  } catch (error) {
    return { hadSession: true, serverConfirmed: false };
  } finally {
    clearTimeout(timer);
  }
}

// ---------- 空间（第10课第4步）：GET /api/spaces、PUT /api/spaces/{id} ----------
// 三个登录角色都能读；只有 ADMIN 能改。权限由后端按会话判断，
// 请求体只带 building 与 floor，绝不下发 role/username：前端隐藏按钮不是权限保护。
const SPACES_URL = "/api/spaces";
const SPACES_TIMEOUT_MS = 5000;

function spaceApiError(
  message,
  { status = 0, code = null, unauthorized = false, forbidden = false,
    notFound = false, validation = false, unavailable = false, timeout = false } = {}
) {
  const error = new Error(message);
  error.name = "SpaceApiError";
  error.status = status;
  error.code = code;
  error.unauthorized = unauthorized;
  error.forbidden = forbidden;
  error.notFound = notFound;
  error.validation = validation;
  error.unavailable = unavailable;
  error.timeout = timeout;
  return error;
}

// 一条空间记录必须是 {id,name,building,floor} 四个非空字符串，缺一项就整批拒绝。
function readSpaceItem(item, where) {
  if (item === null || typeof item !== "object" || Array.isArray(item)) {
    throw spaceApiError(`${where} 不是空间对象，已拒绝本次数据`);
  }
  for (const field of ["id", "name", "building", "floor"]) {
    const value = item[field];
    if (typeof value !== "string" || value.trim() === "") {
      throw spaceApiError(`${where} 的 ${field} 不是非空字符串，已拒绝本次数据`);
    }
  }
  return {
    id: item.id,
    name: item.name,
    building: item.building,
    floor: item.floor,
  };
}

function readSpacesBody(body) {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw spaceApiError("后端返回格式不是 {code,message,data}");
  }
  if (body.code !== 0) {
    const message =
      typeof body.message === "string" && body.message !== ""
        ? body.message
        : "未知错误";
    throw spaceApiError(`后端返回失败（code=${body.code}）：${message}`);
  }
  return readSpacesList(body.data);
}

function readSpacesList(data) {
  if (!Array.isArray(data)) {
    throw spaceApiError("后端返回的 data 不是空间数组");
  }

  const spaces = data.map((item, index) => readSpaceItem(item, `第 ${index + 1} 个空间`));
  const seenIds = new Set();
  for (const space of spaces) {
    if (seenIds.has(space.id)) {
      throw spaceApiError(`后端返回了重复的空间编号 ${space.id}，已拒绝本次数据`);
    }
    seenIds.add(space.id);
  }
  return spaces;
}

// 统一处理空间接口：401 清内存令牌；403/404/400/503 分别带标记抛出，供页面区分。
async function requestSpacesApi(url, { method, payload } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SPACES_TIMEOUT_MS);

  try {
    let response;
    try {
      response = await fetch(url, {
        method,
        headers:
          payload === undefined
            ? authHeaders()
            : { ...authHeaders(), "Content-Type": "application/json" },
        body: payload === undefined ? undefined : JSON.stringify(payload),
        cache: "no-store",
        signal: controller.signal,
      });
    } catch (error) {
      if (error && error.name === "AbortError") {
        throw spaceApiError("等待 5 秒没有响应", { timeout: true });
      }
      throw spaceApiError("请求没有发出去（后端未启动或网络不通）");
    }

    let body = null;
    try {
      body = await response.json();
    } catch (error) {
      body = null;
    }

    const serverMessage =
      body && typeof body.message === "string" && body.message.trim() !== ""
        ? body.message
        : null;

    if (response.status === 401) {
      sessionToken = null;
      throw spaceApiError(serverMessage ?? "未登录或登录已过期，请重新登录", {
        status: 401,
        unauthorized: true,
      });
    }
    if (response.status === 403) {
      throw spaceApiError(serverMessage ?? "已登录但无权修改空间位置", {
        status: 403,
        forbidden: true,
      });
    }
    if (response.status === 404) {
      throw spaceApiError(serverMessage ?? "找不到该空间", {
        status: 404,
        notFound: true,
      });
    }
    if (response.status === 400) {
      throw spaceApiError(serverMessage ?? "空间位置填写不正确", {
        status: 400,
        validation: true,
      });
    }
    if (response.status === 503) {
      throw spaceApiError(serverMessage ?? "会话服务暂时不可用，请稍后重试", {
        status: 503,
        unavailable: true,
      });
    }
    if (!response.ok) {
      throw spaceApiError(serverMessage ?? `后端返回 HTTP ${response.status}`, {
        status: response.status,
      });
    }
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      throw spaceApiError("后端返回格式不是 {code,message,data}");
    }
    if (body.code !== 0) {
      throw spaceApiError(serverMessage ?? `后端返回失败（code=${body.code}）`, {
        status: response.status,
        code: body.code,
      });
    }

    return body.data;
  } finally {
    clearTimeout(timer);
  }
}

/** 需登录：读取 GET /api/spaces；失败一律抛错，不回退浏览器演示数据。 */
export async function getSpacesFromServer() {
  const data = await requestSpacesApi(SPACES_URL, { method: "GET" });
  return readSpacesList(data);
}

/**
 * 仅 ADMIN：PUT /api/spaces/{id} 保存楼栋与楼层。
 * 成功后必须独立再 GET 一次 /api/spaces 回读，返回服务器真正保存的结果；
 * PUT 的响应体不作为页面最终显示依据。
 */
export async function updateSpaceLocationFromServer(id, { building, floor } = {}) {
  if (typeof id !== "string" || id === "") {
    throw spaceApiError("缺少空间编号", { status: 400, validation: true });
  }

  const nextBuilding = typeof building === "string" ? building.trim() : "";
  const nextFloor = typeof floor === "string" ? floor.trim() : "";

  if (nextBuilding === "") {
    throw spaceApiError("楼栋不能为空", { status: 400, validation: true });
  }
  if (nextFloor === "") {
    throw spaceApiError("楼层不能为空", { status: 400, validation: true });
  }

  // 只发业务字段：身份与角色由后端会话决定，请求体里没有 role。
  await requestSpacesApi(`${SPACES_URL}/${encodeURIComponent(id)}`, {
    method: "PUT",
    payload: { building: nextBuilding, floor: nextFloor },
  });

  // 独立回读：页面只展示再次从 MySQL 读到的空间列表。
  return getSpacesFromServer();
}

// ---------- 设备责任（第10课第5步）：GET /api/owners、PUT /api/owners/{deviceId} ----------
// 三种登录角色都能读；只有 ADMIN 能登记。版本由后端比对：
// 没有记录时当前版本为 0，写成功 +1；版本落后返回 409，后端不会覆盖新记录。
const OWNERS_URL = "/api/owners";
const OWNERS_TIMEOUT_MS = 5000;

function ownerApiError(
  message,
  { status = 0, code = null, unauthorized = false, forbidden = false,
    notFound = false, validation = false, conflict = false,
    unavailable = false, timeout = false } = {}
) {
  const error = new Error(message);
  error.name = "OwnerApiError";
  error.status = status;
  error.code = code;
  error.unauthorized = unauthorized;
  error.forbidden = forbidden;
  error.notFound = notFound;
  error.validation = validation;
  error.conflict = conflict;
  error.unavailable = unavailable;
  error.timeout = timeout;
  return error;
}

// 一条责任记录：deviceId、username 必须是非空字符串，note 必须是字符串（可以为空串），
// version 必须是非负整数。任何一项不符都整批拒绝，不做“能显示几条算几条”。
function readOwnerItem(item, where) {
  if (item === null || typeof item !== "object" || Array.isArray(item)) {
    throw ownerApiError(`${where} 不是责任对象，已拒绝本次数据`);
  }

  for (const field of ["deviceId", "username"]) {
    const value = item[field];
    if (typeof value !== "string" || value.trim() === "") {
      throw ownerApiError(`${where} 的 ${field} 不是非空字符串，已拒绝本次数据`);
    }
  }

  if (typeof item.note !== "string") {
    throw ownerApiError(`${where} 的 note 不是字符串，已拒绝本次数据`);
  }

  if (!Number.isInteger(item.version) || item.version < 0) {
    throw ownerApiError(`${where} 的 version 不是非负整数，已拒绝本次数据`);
  }

  return {
    deviceId: item.deviceId,
    username: item.username,
    note: item.note,
    version: item.version,
  };
}

function readOwnersList(data) {
  if (!Array.isArray(data)) {
    throw ownerApiError("后端返回的 data 不是责任数组");
  }

  const owners = data.map((item, index) => readOwnerItem(item, `第 ${index + 1} 条责任记录`));
  const seenDeviceIds = new Set();
  for (const owner of owners) {
    if (seenDeviceIds.has(owner.deviceId)) {
      throw ownerApiError(`后端返回了重复的设备责任 ${owner.deviceId}，已拒绝本次数据`);
    }
    seenDeviceIds.add(owner.deviceId);
  }
  return owners;
}

// 统一处理责任接口：401 清内存令牌；409 单独标记为冲突，绝不自动重试。
async function requestOwnersApi(url, { method, payload } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OWNERS_TIMEOUT_MS);

  try {
    let response;
    try {
      response = await fetch(url, {
        method,
        headers:
          payload === undefined
            ? authHeaders()
            : { ...authHeaders(), "Content-Type": "application/json" },
        body: payload === undefined ? undefined : JSON.stringify(payload),
        cache: "no-store",
        signal: controller.signal,
      });
    } catch (error) {
      if (error && error.name === "AbortError") {
        throw ownerApiError("等待 5 秒没有响应", { timeout: true });
      }
      throw ownerApiError("请求没有发出去（后端未启动或网络不通）");
    }

    let body = null;
    try {
      body = await response.json();
    } catch (error) {
      body = null;
    }

    const serverMessage =
      body && typeof body.message === "string" && body.message.trim() !== ""
        ? body.message
        : null;

    if (response.status === 401) {
      sessionToken = null;
      throw ownerApiError(serverMessage ?? "未登录或登录已过期，请重新登录", {
        status: 401,
        unauthorized: true,
      });
    }
    if (response.status === 403) {
      throw ownerApiError(serverMessage ?? "已登录但无权登记设备责任", {
        status: 403,
        forbidden: true,
      });
    }
    if (response.status === 404) {
      throw ownerApiError(serverMessage ?? "找不到该设备", {
        status: 404,
        notFound: true,
      });
    }
    if (response.status === 409) {
      // 版本落后：只把冲突交给页面，由页面重新读取后让学生自己决定，不自动重发。
      throw ownerApiError(serverMessage ?? "负责人记录已更新，请重新读取后再决定", {
        status: 409,
        conflict: true,
      });
    }
    if (response.status === 400) {
      throw ownerApiError(serverMessage ?? "责任登记内容不正确", {
        status: 400,
        validation: true,
      });
    }
    if (response.status === 503) {
      throw ownerApiError(serverMessage ?? "会话服务暂时不可用，请稍后重试", {
        status: 503,
        unavailable: true,
      });
    }
    if (!response.ok) {
      throw ownerApiError(serverMessage ?? `后端返回 HTTP ${response.status}`, {
        status: response.status,
      });
    }
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      throw ownerApiError("后端返回格式不是 {code,message,data}");
    }
    if (body.code !== 0) {
      throw ownerApiError(serverMessage ?? `后端返回失败（code=${body.code}）`, {
        status: response.status,
        code: body.code,
      });
    }

    return body.data;
  } finally {
    clearTimeout(timer);
  }
}

/** 需登录：读取 GET /api/owners；失败一律抛错，不回退浏览器演示数据。 */
export async function getOwnersFromServer() {
  const data = await requestOwnersApi(OWNERS_URL, { method: "GET" });
  return readOwnersList(data);
}

/**
 * 仅 ADMIN：PUT /api/owners/{deviceId}，带上提交时看到的 expectedVersion。
 * 成功后再独立 GET /api/owners 回读，返回服务器真正保存的结果。
 * 409 直接抛出 conflict 错误，由页面读取新记录后让学生重新决定；本函数不重试。
 */
export async function saveOwnerToServer(deviceId, { username, note, expectedVersion } = {}) {
  if (typeof deviceId !== "string" || deviceId === "") {
    throw ownerApiError("缺少设备编号", { status: 400, validation: true });
  }

  const nextUsername = typeof username === "string" ? username.trim() : "";
  const nextNote = typeof note === "string" ? note.trim() : "";

  if (nextUsername === "") {
    throw ownerApiError("负责人不能为空", { status: 400, validation: true });
  }
  if (nextNote === "") {
    throw ownerApiError("备注不能为空", { status: 400, validation: true });
  }

  // 只接受真正的非负整数：不做 Number("0") 这类隐式转换，字符串/小数在本地就拒绝。
  if (!Number.isInteger(expectedVersion) || expectedVersion < 0) {
    throw ownerApiError("负责人版本无效，请重新读取后再登记", {
      status: 400,
      validation: true,
    });
  }
  const expected = expectedVersion;

  // 只发业务字段：权限由后端会话决定，请求体里没有 role。
  await requestOwnersApi(`${OWNERS_URL}/${encodeURIComponent(deviceId)}`, {
    method: "PUT",
    payload: { username: nextUsername, note: nextNote, expectedVersion: expected },
  });

  // 独立回读：页面只展示再次从 MySQL 读到的责任列表。
  try {
    return await getOwnersFromServer();
  } catch (error) {
    // PUT 已经成功，回读失败不能被说成“保存失败”：标记后由页面提示重新读取确认。
    error.readBackFailed = true;
    throw error;
  }
}

// ---------- 演练事件（第11课）：GET /api/cases、POST /api/cases ----------
// 三个登录角色都能读；只有 ADMIN 能创建。编号、创建时间、版本、状态由服务端生成，
// POST 只发送 deviceId 与 message：不发送 assignee、state、createdAt，也不能伪造处理人。
// 本步只接通创建与列表，不实现分派、处置、恢复、核实、关闭等后续动作。
// 事件的页面数据只来自 MySQL；这里不写 localStorage 的 campus-v2-demo。
const CASES_URL = "/api/cases";
const CASES_TIMEOUT_MS = 5000;
const CASE_STATES = ["NEW", "ASSIGNED", "IN_PROGRESS", "CLOSED"];
const CASE_SOURCE_STATES = ["ACTIVE", "RECOVERED"];
const CASE_TIMELINE_ACTIONS = [
  "create",
  "assign",
  "start",
  "note",
  "recover",
  "verify",
  "close",
];
const CASE_MESSAGE_MAX_LENGTH = 500;

function caseApiError(
  message,
  { status = 0, code = null, unauthorized = false, forbidden = false,
    notFound = false, validation = false, conflict = false,
    unavailable = false, timeout = false, readBackFailed = false } = {}
) {
  const error = new Error(message);
  error.name = "CaseApiError";
  error.status = status;
  error.code = code;
  error.unauthorized = unauthorized;
  error.forbidden = forbidden;
  error.notFound = notFound;
  error.validation = validation;
  error.conflict = conflict;
  error.unavailable = unavailable;
  error.timeout = timeout;
  error.readBackFailed = readBackFailed;
  return error;
}

function readCaseText(source, field, where) {
  const value = source[field];
  if (typeof value !== "string" || value.trim() === "") {
    throw caseApiError(`${where} 的 ${field} 不是非空字符串，已拒绝本次数据`);
  }
  return value;
}

// note、conclusion 允许空字符串，但不允许缺字段或非字符串。
function readCasePlainString(source, field, where) {
  if (!Object.prototype.hasOwnProperty.call(source, field)) {
    throw caseApiError(`${where} 缺少 ${field} 字段，已拒绝本次数据`);
  }
  if (typeof source[field] !== "string") {
    throw caseApiError(`${where} 的 ${field} 不是字符串，已拒绝本次数据`);
  }
  return source[field];
}

function readCaseTimelineEntry(item, where) {
  if (item === null || typeof item !== "object" || Array.isArray(item)) {
    throw caseApiError(`${where} 不是时间线条目对象，已拒绝本次数据`);
  }
  if (typeof item.time !== "number" || !Number.isFinite(item.time)) {
    throw caseApiError(`${where} 的 time 不是数字，已拒绝本次数据`);
  }
  if (typeof item.action !== "string" || !CASE_TIMELINE_ACTIONS.includes(item.action)) {
    throw caseApiError(`${where} 的 action 不是约定动作，已拒绝本次数据`);
  }
  return {
    time: item.time,
    action: item.action,
    actor: readCaseText(item, "actor", where),
    note: readCasePlainString(item, "note", where),
  };
}

// 一条事件：字段必须齐全；未分派时 assignee 只能是 null，不能用空串或字符串 "null" 顶替。
function readCaseItem(item, where) {
  if (item === null || typeof item !== "object" || Array.isArray(item)) {
    throw caseApiError(`${where} 不是演练事件对象，已拒绝本次数据`);
  }

  if (!CASE_STATES.includes(item.state)) {
    throw caseApiError(`${where} 的 state 不是约定状态，已拒绝本次数据`);
  }
  if (!CASE_SOURCE_STATES.includes(item.sourceState)) {
    throw caseApiError(`${where} 的 sourceState 不是约定值，已拒绝本次数据`);
  }
  if (typeof item.verified !== "boolean") {
    throw caseApiError(`${where} 的 verified 不是布尔值，已拒绝本次数据`);
  }
  if (!Number.isInteger(item.version) || item.version < 1) {
    throw caseApiError(`${where} 的 version 不是正整数，已拒绝本次数据`);
  }

  let assignee = null;
  if (item.assignee !== null) {
    if (typeof item.assignee !== "string" || item.assignee.trim() === "") {
      throw caseApiError(`${where} 的 assignee 只能是 null 或非空字符串，已拒绝本次数据`);
    }
    assignee = item.assignee;
  }

  if (!Array.isArray(item.timeline)) {
    throw caseApiError(`${where} 的 timeline 不是数组，已拒绝本次数据`);
  }

  const timeline = item.timeline.map((entry, index) =>
    readCaseTimelineEntry(entry, `${where} 的第 ${index + 1} 条时间线`)
  );

  // 时间线按 seq 升序返回，时间不应倒序；倒序说明后端拼装有问题，整批拒绝。
  for (let index = 1; index < timeline.length; index += 1) {
    if (timeline[index].time < timeline[index - 1].time) {
      throw caseApiError(`${where} 的时间线没有按时间排序，已拒绝本次数据`);
    }
  }

  return {
    id: readCaseText(item, "id", where),
    deviceId: readCaseText(item, "deviceId", where),
    message: readCaseText(item, "message", where),
    state: item.state,
    assignee,
    sourceState: item.sourceState,
    verified: item.verified,
    note: readCasePlainString(item, "note", where),
    conclusion: readCasePlainString(item, "conclusion", where),
    version: item.version,
    timeline,
  };
}

function readCasesList(data) {
  if (!Array.isArray(data)) {
    throw caseApiError("后端返回的 data 不是演练事件数组");
  }

  const cases = data.map((item, index) => readCaseItem(item, `第 ${index + 1} 条演练事件`));
  const seenIds = new Set();
  for (const item of cases) {
    if (seenIds.has(item.id)) {
      throw caseApiError(`后端返回了重复的事件编号 ${item.id}，已拒绝本次数据`);
    }
    seenIds.add(item.id);
  }
  return cases;
}

// 统一处理事件接口：401 清内存令牌；403/404/400/503 分别带标记抛出，供页面区分。
async function requestCasesApi(url, { method, payload } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CASES_TIMEOUT_MS);

  try {
    let response;
    try {
      response = await fetch(url, {
        method,
        headers:
          payload === undefined
            ? authHeaders()
            : { ...authHeaders(), "Content-Type": "application/json" },
        body: payload === undefined ? undefined : JSON.stringify(payload),
        cache: "no-store",
        signal: controller.signal,
      });
    } catch (error) {
      if (error && error.name === "AbortError") {
        throw caseApiError("等待 5 秒没有响应", { timeout: true });
      }
      throw caseApiError("请求没有发出去（后端未启动或网络不通）");
    }

    let body = null;
    try {
      body = await response.json();
    } catch (error) {
      body = null;
    }

    const serverMessage =
      body && typeof body.message === "string" && body.message.trim() !== ""
        ? body.message
        : null;

    if (response.status === 401) {
      sessionToken = null;
      throw caseApiError(serverMessage ?? "未登录或登录已过期，请重新登录", {
        status: 401,
        unauthorized: true,
      });
    }
    if (response.status === 403) {
      throw caseApiError(serverMessage ?? "已登录但无权执行该操作", {
        status: 403,
        forbidden: true,
      });
    }
    if (response.status === 404) {
      throw caseApiError(serverMessage ?? "找不到该设备或演练事件", {
        status: 404,
        notFound: true,
      });
    }
    if (response.status === 409) {
      // 版本落后或状态不允许：只刷新并解释，绝不自动重发。
      throw caseApiError(serverMessage ?? "演练事件已被其他人更新，请重新读取后再决定", {
        status: 409,
        conflict: true,
      });
    }
    if (response.status === 400) {
      throw caseApiError(serverMessage ?? "演练事件内容不正确", {
        status: 400,
        validation: true,
      });
    }
    if (response.status === 503) {
      throw caseApiError(serverMessage ?? "会话服务暂时不可用，请稍后重试", {
        status: 503,
        unavailable: true,
      });
    }
    if (!response.ok) {
      throw caseApiError(serverMessage ?? `后端返回 HTTP ${response.status}`, {
        status: response.status,
      });
    }
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      throw caseApiError("后端返回格式不是 {code,message,data}");
    }
    if (body.code !== 0) {
      throw caseApiError(serverMessage ?? `后端返回失败（code=${body.code}）`, {
        status: response.status,
        code: body.code,
      });
    }

    return body.data;
  } finally {
    clearTimeout(timer);
  }
}

/** 需登录：读取 GET /api/cases；三个登录角色都可读，失败不回退浏览器演示数据。 */
export async function getCasesFromServer() {
  const data = await requestCasesApi(CASES_URL, { method: "GET" });
  return readCasesList(data);
}

/**
 * 仅 ADMIN：POST /api/cases，只提交 deviceId 与 message。
 * 服务端生成编号、时间、version=1、sourceState=ACTIVE、verified=false，并按 owners 自动分派。
 * 成功后必须独立再 GET 一次 /api/cases 回读；页面只展示回读到的列表。
 */
export async function createCaseOnServer({ deviceId, message } = {}) {
  const nextDeviceId = typeof deviceId === "string" ? deviceId.trim() : "";
  const nextMessage = typeof message === "string" ? message.trim() : "";

  if (nextDeviceId === "") {
    throw caseApiError("请先选择设备", { status: 400, validation: true });
  }
  if (nextMessage === "") {
    throw caseApiError("请填写这次练习要处理什么", { status: 400, validation: true });
  }
  if (nextMessage.length > CASE_MESSAGE_MAX_LENGTH) {
    throw caseApiError(`事件内容不能超过 ${CASE_MESSAGE_MAX_LENGTH} 个字符`, {
      status: 400,
      validation: true,
    });
  }

  // 只发业务字段：身份由后端会话决定；处理人、状态与创建时间都不由客户端提交。
  const createdData = await requestCasesApi(CASES_URL, {
    method: "POST",
    payload: { deviceId: nextDeviceId, message: nextMessage },
  });
  const created = readCaseItem(createdData, "创建返回的演练事件");

  let cases;
  try {
    cases = await getCasesFromServer();
  } catch (error) {
    // POST 已经成功，回读失败不能被说成“创建失败”：标记后由页面提示重新读取确认。
    error.readBackFailed = true;
    throw error;
  }

  if (!cases.some((item) => item.id === created.id)) {
    throw caseApiError("创建已提交，但独立回读的列表中没有该事件，请重新读取确认", {
      readBackFailed: true,
    });
  }

  return { created, cases };
}

const CASE_ACTION_NAMES = [
  "assign",
  "start",
  "note",
  "recover",
  "verify",
  "close",
];

/**
 * 仅 ADMIN 或本事件的 manager：POST /api/cases/{id}/actions。
 * 请求体只带 action、expectedVersion，以及 assign 的 username、assign/note/close 的 note；
 * recover 与 verify 不发送 sourceState / verified，服务端只读数据库中的事实。
 * 操作人一律由后端会话决定，不发送 actor / role / state / createdAt。
 * 成功后独立再 GET /api/cases 回读；409 只抛 conflict 交给页面刷新，本函数不自动重发。
 */
export async function caseActionOnServer(
  id,
  { action, expectedVersion, note, username } = {}
) {
  const caseId = typeof id === "string" ? id.trim() : "";
  if (caseId === "") {
    throw caseApiError("缺少事件编号", { status: 400, validation: true });
  }
  if (!CASE_ACTION_NAMES.includes(action)) {
    throw caseApiError("不支持的事件动作", { status: 400, validation: true });
  }
  if (!Number.isInteger(expectedVersion) || expectedVersion < 0) {
    throw caseApiError("事件版本无效，请重新读取后再决定", {
      status: 400,
      validation: true,
    });
  }

  const payload = { action, expectedVersion };

  if (action === "assign") {
    const target = typeof username === "string" ? username.trim() : "";
    const reason = typeof note === "string" ? note.trim() : "";
    if (target === "") {
      throw caseApiError("请选择处理人", { status: 400, validation: true });
    }
    if (reason === "") {
      throw caseApiError("请填写分派说明", { status: 400, validation: true });
    }
    payload.username = target;
    payload.note = reason;
  } else if (action === "note") {
    const record = typeof note === "string" ? note.trim() : "";
    if (record === "") {
      throw caseApiError("处置记录不能为空", { status: 400, validation: true });
    }
    payload.note = record;
  } else if (action === "close") {
    const conclusion = typeof note === "string" ? note.trim() : "";
    if (conclusion === "") {
      throw caseApiError("关闭结论不能为空", { status: 400, validation: true });
    }
    payload.note = conclusion;
  }

  const updatedData = await requestCasesApi(
    `${CASES_URL}/${encodeURIComponent(caseId)}/actions`,
    { method: "POST", payload }
  );
  const updated = readCaseItem(updatedData, "动作返回的演练事件");

  let cases;
  try {
    cases = await getCasesFromServer();
  } catch (error) {
    // POST 已经成功，回读失败不能被说成“动作失败”：标记后由页面提示重新读取确认。
    error.readBackFailed = true;
    throw error;
  }

  if (!cases.some((item) => item.id === updated.id)) {
    throw caseApiError("动作已提交，但独立回读的列表中没有该事件，请重新读取确认", {
      readBackFailed: true,
    });
  }

  return { updated, cases };
}

// ---------- 审计与接入状态（第11课第4步）：GET /api/audit、GET /api/integration ----------
// 审计只允许 ADMIN 读取；接入状态三种登录角色都能读（只要求登录）。
// 两者都只认本机后端：失败一律抛错，绝不回退 localStorage 的演示审计，
// 也不把接入状态说成已连接真实校园或 AIRIOT。
const AUDIT_URL = "/api/audit";
const INTEGRATION_URL = "/api/integration";
const ADMIN_READ_TIMEOUT_MS = 5000;

function adminReadError(
  message,
  { status = 0, code = null, unauthorized = false, forbidden = false,
    unavailable = false, timeout = false } = {}
) {
  const error = new Error(message);
  error.name = "AdminReadApiError";
  error.status = status;
  error.code = code;
  error.unauthorized = unauthorized;
  error.forbidden = forbidden;
  error.unavailable = unavailable;
  error.timeout = timeout;
  return error;
}

// 一条审计：time 为数字，actor/action/targetId 为非空字符串，note 为字符串（可为空）。
// 缺字段或类型不对就整批拒绝，不用页面上的旧记录顶替。
function readAuditEntry(item, index) {
  if (item === null || typeof item !== "object" || Array.isArray(item)) {
    throw adminReadError(`第 ${index + 1} 条审计不是对象，已拒绝本次数据`);
  }

  const where = `第 ${index + 1} 条审计`;
  if (typeof item.time !== "number" || !Number.isFinite(item.time)) {
    throw adminReadError(`${where} 的 time 不是数字，已拒绝本次数据`);
  }

  for (const field of ["actor", "action", "targetId"]) {
    const value = item[field];
    if (typeof value !== "string" || value.trim() === "") {
      throw adminReadError(`${where} 的 ${field} 不是非空字符串，已拒绝本次数据`);
    }
  }

  if (typeof item.note !== "string") {
    throw adminReadError(`${where} 的 note 不是字符串，已拒绝本次数据`);
  }

  return {
    time: item.time,
    actor: item.actor,
    action: item.action,
    targetId: item.targetId,
    note: item.note,
  };
}

function readAuditList(data) {
  if (!Array.isArray(data)) {
    throw adminReadError("后端返回的 data 不是审计数组");
  }
  return data.map((item, index) => readAuditEntry(item, index));
}

// 接入状态：source 非空字符串，三个标记必须是真正的布尔值。
// 不在前端改写这些值：后端说 false 就是 false，绝不猜成“未知”。
function readIntegration(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw adminReadError("后端返回的 data 不是接入状态对象");
  }
  if (typeof value.source !== "string" || value.source.trim() === "") {
    throw adminReadError("接入状态的 source 不是非空字符串，已拒绝本次数据");
  }
  for (const field of ["simulated", "controlEnabled", "notificationsEnabled"]) {
    if (!Object.prototype.hasOwnProperty.call(value, field)) {
      throw adminReadError(`接入状态缺少 ${field} 字段，已拒绝本次数据`);
    }
    if (typeof value[field] !== "boolean") {
      throw adminReadError(`接入状态的 ${field} 不是布尔值，已拒绝本次数据`);
    }
  }

  return {
    source: value.source,
    simulated: value.simulated,
    controlEnabled: value.controlEnabled,
    notificationsEnabled: value.notificationsEnabled,
  };
}

// 统一处理管理页的只读接口：401 清内存令牌；403 单独标记，绝不改成成功。
async function requestAdminReadApi(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ADMIN_READ_TIMEOUT_MS);

  try {
    let response;
    try {
      response = await fetch(url, {
        method: "GET",
        headers: authHeaders(),
        cache: "no-store",
        signal: controller.signal,
      });
    } catch (error) {
      if (error && error.name === "AbortError") {
        throw adminReadError("等待 5 秒没有响应", { timeout: true });
      }
      throw adminReadError("请求没有发出去（后端未启动或网络不通）");
    }

    let body = null;
    try {
      body = await response.json();
    } catch (error) {
      body = null;
    }

    const serverMessage =
      body && typeof body.message === "string" && body.message.trim() !== ""
        ? body.message
        : null;

    if (response.status === 401) {
      sessionToken = null;
      throw adminReadError(serverMessage ?? "未登录或登录已过期，请重新登录", {
        status: 401,
        unauthorized: true,
      });
    }
    if (response.status === 403) {
      throw adminReadError(serverMessage ?? "已登录但无权读取该内容", {
        status: 403,
        forbidden: true,
      });
    }
    if (response.status === 503) {
      throw adminReadError(serverMessage ?? "会话服务暂时不可用，请稍后重试", {
        status: 503,
        unavailable: true,
      });
    }
    if (!response.ok) {
      throw adminReadError(serverMessage ?? `后端返回 HTTP ${response.status}`, {
        status: response.status,
      });
    }
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      throw adminReadError("后端返回格式不是 {code,message,data}");
    }
    if (body.code !== 0) {
      throw adminReadError(serverMessage ?? `后端返回失败（code=${body.code}）`, {
        status: response.status,
        code: body.code,
      });
    }

    return body.data;
  } finally {
    clearTimeout(timer);
  }
}

/** 仅 ADMIN：读取 GET /api/audit；失败抛错，不回退 localStorage 里的演示审计。 */
export async function getAuditFromServer() {
  const data = await requestAdminReadApi(AUDIT_URL);
  return readAuditList(data);
}

/** 需登录：读取 GET /api/integration；三种角色都可读，失败不回退固定演示值。 */
export async function getIntegrationFromServer() {
  const data = await requestAdminReadApi(INTEGRATION_URL);
  return readIntegration(data);
}

