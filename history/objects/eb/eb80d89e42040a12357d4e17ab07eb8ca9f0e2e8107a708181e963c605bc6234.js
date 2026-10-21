// 校园值班台 · 数据服务（第10课第4步）
// 设备基本信息与空间位置读取同源 MySQL 接口（GET /api/devices、GET /api/spaces），
// 空间保存走 PUT /api/spaces/{id}；连接后端时不使用 mockCampus，也不读浏览器里的旧空间位置。
// 浏览器演示仍以 mockCampus 为起点；责任、事件、审计的演示记录保存在 localStorage 的 campus-v2-demo 中。
// 页面统一通过这里取业务数据，不要直接导入 mock-data.js。

import { mockCampus } from "./mock-data.js";

const STORAGE_KEY = "campus-v2-demo";

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

// 演示记录的空结构；spaces、owners、cases、audit 必须一起保存，写入时互不覆盖。
function createEmptyDemoState() {
  return { spaces: [], owners: [], cases: [], audit: [] };
}

// 读取整个演示记录对象。记录不存在时返回空结构，不代表要立刻写入。
// JSON 损坏或存储被禁止时抛出明确错误，绝不返回空结构覆盖原记录。
function readSavedDemoState() {
  let raw;

  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    throw new Error("浏览器禁止访问本地存储，无法读取演示记录");
  }

  if (raw === null) {
    return createEmptyDemoState();
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error("浏览器中的演示记录已损坏（JSON 无效），未加载也未覆盖");
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("浏览器中的演示记录格式不正确，未加载也未覆盖");
  }

  const spaces = parsed.spaces === undefined ? [] : parsed.spaces;
  const owners = parsed.owners === undefined ? [] : parsed.owners;
  const cases = parsed.cases === undefined ? [] : parsed.cases;
  // 旧记录没有 audit 时按空数组读取，不为历史操作补造审计条目。
  const audit = parsed.audit === undefined ? [] : parsed.audit;

  if (
    !Array.isArray(spaces) ||
    !Array.isArray(owners) ||
    !Array.isArray(cases) ||
    !Array.isArray(audit)
  ) {
    throw new Error(
      "浏览器中的演示记录缺少 spaces、owners、cases、audit 数组，未加载也未覆盖"
    );
  }

  return { ...parsed, spaces, owners, cases, audit };
}

function writeSavedDemoState(state) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    throw new Error("浏览器禁止保存或存储空间不足，本次修改未保存");
  }
}

// 成功的写操作追加一条演示审计：操作者、动作、目标 ID、时间。
// 与业务数据在同一次 localStorage 写入中保存，失败时一起回退。
function appendAudit(saved, { actor, action, targetId, time }) {
  const audit = Array.isArray(saved.audit) ? saved.audit : [];
  const operator =
    typeof actor === "string" && actor.trim() !== "" ? actor.trim() : "admin";

  audit.push({
    time: typeof time === "number" && Number.isFinite(time) ? time : Date.now(),
    actor: operator,
    action,
    targetId,
  });

  return audit;
}

// 浏览器演示用的空间数据：只复制原始练习数据，不再合并 localStorage 里的旧位置。
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

// 演练事件只读取 campus-v2-demo 中的 cases 部分，按保存顺序返回。
export async function getCases() {
  const saved = readSavedDemoState();
  return copy(saved.cases);
}

// 演示操作记录：旧记录没有 audit 时返回空数组，不补造历史条目。
export async function getAudit() {
  const saved = readSavedDemoState();
  return copy(saved.audit);
}

// 演示事件编号形如 case-1、case-2：跳过已被占用的编号，保存后仍可重复读取。
function nextCaseId(cases) {
  const usedIds = new Set(
    cases.map((item) => (item && typeof item.id === "string" ? item.id : ""))
  );

  let index = 1;
  while (usedIds.has(`case-${index}`)) {
    index += 1;
  }
  return `case-${index}`;
}

// 创建设备演练事件：只写浏览器演示记录，不操作设备、不发通知。
// 设备已有责任人时自动填 assignee 并直接进入 ASSIGNED，否则留空等分派（NEW）。
export async function createCase({ deviceId, message, actor } = {}) {
  const actingUser =
    typeof actor === "string" && actor.trim() !== ""
      ? actor.trim()
      : "admin";
  const actingRole = DEMO_ACCOUNT_ROLES[actingUser];

  if (!actingRole) {
    throw new Error("无法识别当前演示身份，不能创建演练事件");
  }
  if (actingRole !== "ADMIN") {
    throw new Error("只有管理员可以创建演练事件");
  }

  const nextDeviceId = typeof deviceId === "string" ? deviceId.trim() : "";
  if (nextDeviceId === "") {
    throw new Error("请先选择设备");
  }

  const device = mockCampus.devices.find((item) => item.id === nextDeviceId);
  if (!device) {
    throw new Error("找不到所选设备，请重新选择");
  }

  const nextMessage = typeof message === "string" ? message.trim() : "";
  if (nextMessage === "") {
    throw new Error("请填写这次练习要处理什么");
  }

  // 每次创建都从存储读取，保留已有 spaces、owners 和其他事件。
  const saved = readSavedDemoState();

  const savedOwner = saved.owners.find(
    (owner) => owner && owner.deviceId === nextDeviceId
  );
  const assignee =
    savedOwner && typeof savedOwner.username === "string"
      ? savedOwner.username.trim()
      : "";
  const assigned = assignee !== "";

  const createdAt = Date.now();

  const nextCase = {
    id: nextCaseId(saved.cases),
    deviceId: nextDeviceId,
    message: nextMessage,
    state: assigned ? "ASSIGNED" : "NEW",
    assignee,
    sourceState: "ACTIVE",
    verified: false,
    note: "",
    conclusion: "",
    version: 1,
    timeline: [
      {
        time: createdAt,
        action: "create",
        actor: actingUser,
        note: assigned
          ? `创建演练事件，按已登记责任人分派给 ${assignee}`
          : "创建演练事件，等待管理员分派",
      },
    ],
  };

  // 创建成功同样写一条审计，并与事件在同一次写入中保存；
  // 只追加本次记录，不追补此前没有审计的旧事件。
  writeSavedDemoState({
    ...saved,
    spaces: saved.spaces,
    owners: saved.owners,
    cases: [...saved.cases, nextCase],
    audit: appendAudit(saved, {
      actor: actingUser,
      action: "case.create",
      targetId: nextCase.id,
      time: createdAt,
    }),
  });

  return copy(nextCase);
}

// 演示账号与角色只用于本地权限检查；第09课起由后端会话与角色替代。
const DEMO_ACCOUNT_ROLES = {
  admin: "ADMIN",
  manager: "MANAGER",
  viewer: "VIEWER",
};

const CASE_ACTION_NAMES = [
  "assign",
  "start",
  "note",
  "recover",
  "verify",
  "close",
];

// 演练事件动作：assign（管理员分派）、start（处理人开始）、note（处理中写处置记录）、
// recover（管理员登记来源恢复）、verify（处理人独立核实）、close（处理人关闭）。
// 版本先比对，匹配才修改；被拒绝的动作不写入存储，也不增加版本。
// actor 是当前演示身份，用于本地权限检查；不传时按动作推断（assign/recover→admin，其余取 username）。
export async function caseAction(
  id,
  { action, expectedVersion, note, username, actor } = {}
) {
  const caseId = typeof id === "string" ? id.trim() : "";
  if (caseId === "") {
    throw new Error("缺少事件编号");
  }

  if (!CASE_ACTION_NAMES.includes(action)) {
    throw new Error("不支持的演练事件动作");
  }

  const expected = Number(expectedVersion);
  if (!Number.isInteger(expected) || expected < 1) {
    throw new Error("事件版本无效，请重新读取后再决定");
  }

  const actingUser =
    typeof actor === "string" && actor.trim() !== ""
      ? actor.trim()
      : action === "assign" || action === "recover"
        ? "admin"
        : typeof username === "string"
          ? username.trim()
          : "";

  const actingRole = DEMO_ACCOUNT_ROLES[actingUser];
  if (!actingRole) {
    throw new Error("无法识别当前演示身份，不能执行动作");
  }

  if (actingRole === "VIEWER") {
    throw new Error("查看者只能查看，不能修改演练事件");
  }

  // 每次动作都从存储读取，按刚读取到的记录比较版本，不自动重试。
  const saved = readSavedDemoState();
  const item = saved.cases.find((entry) => entry && entry.id === caseId);
  if (!item) {
    throw new Error("找不到该演练事件");
  }

  if (item.version !== expected) {
    const conflict = new Error("记录已变化，请重新读取后再决定");
    conflict.code = "VERSION_CONFLICT";
    throw conflict;
  }

  if (item.state === "CLOSED") {
    throw new Error("事件已关闭，不能再修改");
  }

  const target =
    typeof username === "string" ? username.trim() : "";
  let timelineNote = "";

  if (action === "assign") {
    if (actingRole !== "ADMIN") {
      throw new Error("只有管理员可以分派演练事件");
    }
    if (item.state !== "NEW") {
      throw new Error("事件已分派，可直接开始处理，不需要重复分派");
    }

    const reason = typeof note === "string" ? note.trim() : "";
    if (reason === "") {
      throw new Error("请填写分派说明");
    }
    if (target === "") {
      throw new Error("请选择处理人");
    }
    if (target !== "manager") {
      throw new Error("演练事件只能分派给处理人 manager");
    }

    item.state = "ASSIGNED";
    item.assignee = target;
    timelineNote = `分派给 ${target}：${reason}`;
  } else if (action === "start") {
    if (actingRole !== "MANAGER") {
      throw new Error("只有处理人可以开始处理事件");
    }
    if (item.state === "NEW") {
      throw new Error("事件尚未分派，不能开始处理");
    }
    if (item.state !== "ASSIGNED") {
      throw new Error("当前状态不能开始处理");
    }
    if (item.assignee !== actingUser) {
      throw new Error("只能开始已分派给自己的事件");
    }

    item.state = "IN_PROGRESS";
    timelineNote = "开始处理";
  } else if (action === "note") {
    if (actingRole !== "MANAGER") {
      throw new Error("只有处理人可以填写处置记录");
    }
    if (item.state !== "IN_PROGRESS") {
      throw new Error(
        item.state === "ASSIGNED"
          ? "请先开始处理，再填写处置记录"
          : "当前状态不能填写处置记录"
      );
    }
    if (item.assignee !== actingUser) {
      throw new Error("只能填写分派给自己的事件");
    }

    const record = typeof note === "string" ? note.trim() : "";
    if (record === "") {
      throw new Error("处置记录不能为空");
    }

    item.note = record;
    timelineNote = record;
  } else if (action === "recover") {
    if (actingRole !== "ADMIN") {
      throw new Error("只有管理员可以模拟来源恢复");
    }
    if (item.state !== "IN_PROGRESS") {
      throw new Error("只有处理中的事件可以登记来源恢复");
    }

    // 只把来源标记为已恢复，并清掉旧的核实结果；事件保持 IN_PROGRESS。
    item.sourceState = "RECOVERED";
    item.verified = false;
    timelineNote = "模拟来源恢复：来源标记为已恢复，已清除原核实结果";
  } else if (action === "verify") {
    if (actingRole !== "MANAGER") {
      throw new Error("只有处理人可以核实来源恢复");
    }
    if (item.state !== "IN_PROGRESS") {
      throw new Error("只有处理中的事件可以核实");
    }
    if (item.assignee !== actingUser) {
      throw new Error("只能核实分派给自己的事件");
    }
    if (item.sourceState !== "RECOVERED") {
      throw new Error("来源尚未恢复，不能核实");
    }
    if (item.verified === true) {
      throw new Error("事件已核实，不需要重复核实");
    }

    // 这只是独立的演示核实，不代表做过实际设备检测。
    item.verified = true;
    timelineNote = "独立核实：来源已恢复（演示核实，不是实际设备检测）";
  } else {
    if (actingRole !== "MANAGER") {
      throw new Error("只有处理人可以关闭事件");
    }
    if (item.assignee !== actingUser) {
      throw new Error("只能关闭分派给自己的事件");
    }

    // 关闭前一次列出全部缺失条件，不只报第一条，也不自动补齐。
    const missing = [];
    const existingNote =
      typeof item.note === "string" ? item.note.trim() : "";
    const conclusion = typeof note === "string" ? note.trim() : "";

    if (item.state !== "IN_PROGRESS") {
      missing.push(`事件状态不是处理中（当前 ${item.state ?? "未知"}）`);
    }
    if (existingNote === "") {
      missing.push("缺少非空处置记录");
    }
    if (item.sourceState !== "RECOVERED") {
      missing.push(`来源尚未恢复（当前 ${item.sourceState ?? "未知"}）`);
    }
    if (item.verified !== true) {
      missing.push("来源尚未核实");
    }
    if (conclusion === "") {
      missing.push("关闭结论不能为空");
    }

    if (missing.length > 0) {
      throw new Error(`关闭条件不满足：${missing.join("；")}`);
    }

    item.state = "CLOSED";
    item.conclusion = conclusion;
    timelineNote = conclusion;
  }

  item.version += 1;
  item.timeline = Array.isArray(item.timeline) ? item.timeline : [];
  item.timeline.push({
    time: Date.now(),
    action,
    actor: actingUser,
    note: timelineNote,
  });

  // 只替换 cases 并追加一条审计，保留 spaces、owners 及其他已有分区。
  writeSavedDemoState({
    ...saved,
    spaces: saved.spaces,
    owners: saved.owners,
    cases: saved.cases,
    audit: appendAudit(saved, {
      actor: actingUser,
      action: `case.${action}`,
      targetId: item.id,
    }),
  });

  return copy(item);
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

