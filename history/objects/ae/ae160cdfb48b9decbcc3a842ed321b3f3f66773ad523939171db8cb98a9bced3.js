// 校园值班台 · 数据服务（第03课第4步）
// 以 mockCampus 为起点，再合并浏览器里保存的空间位置；不请求后端。
// 演示记录统一保存在 localStorage 的 campus-v2-demo 中。
// 页面统一通过这里取业务数据，不要直接导入 mock-data.js。

import { mockCampus } from "./mock-data.js";

const STORAGE_KEY = "campus-v2-demo";

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

// 只合并已保存的楼栋、楼层，空间名称和 ID 始终以 mockCampus 为准。
function mergeSavedSpaceLocations(baseSpaces, savedSpaces) {
  const savedById = new Map();

  for (const entry of savedSpaces) {
    if (!entry || typeof entry !== "object" || typeof entry.id !== "string") {
      continue;
    }
    savedById.set(entry.id, entry);
  }

  return baseSpaces.map((space) => {
    const saved = savedById.get(space.id);
    if (!saved) return space;

    const building =
      typeof saved.building === "string" ? saved.building.trim() : "";
    const floor = typeof saved.floor === "string" ? saved.floor.trim() : "";

    return {
      ...space,
      building: building === "" ? space.building : building,
      floor: floor === "" ? space.floor : floor,
    };
  });
}

// 当前空间数据：先复制原始练习数据，再合并浏览器中保存的位置。
let currentSpaces = null;
let spacesLoadError = null;

function getCurrentSpaces() {
  if (currentSpaces) return currentSpaces;
  if (spacesLoadError) throw spacesLoadError;

  try {
    const saved = readSavedDemoState();
    currentSpaces = mergeSavedSpaceLocations(
      copy(mockCampus.spaces),
      saved.spaces
    );
    return currentSpaces;
  } catch (error) {
    spacesLoadError = error;
    throw error;
  }
}

// 概览：与后端 /api/overview 的约定保持一致，返回五项完整练习数据。
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

// 负责人只读取 campus-v2-demo 中的 owners 部分。
export async function getOwners() {
  const saved = readSavedDemoState();
  return copy(saved.owners);
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

// 只修改楼栋和楼层；空间 ID、设备及其归属都不在这里改动。
// 先写浏览器存储，成功后才更新当前数据；失败时保留原记录和页面输入。
export async function saveSpace(id, { building, floor, actor } = {}) {
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

  // 读取已有记录，保留其中的 owners 和 cases，只替换 spaces 的位置。
  const saved = readSavedDemoState();

  const nextSpaces = getCurrentSpaces().map((item) => ({
    id: item.id,
    name: item.name,
    building: item.id === id ? nextBuilding : item.building,
    floor: item.id === id ? nextFloor : item.floor,
  }));

  writeSavedDemoState({
    ...saved,
    spaces: nextSpaces,
    owners: saved.owners,
    cases: saved.cases,
    audit: appendAudit(saved, {
      actor,
      action: "space.update",
      targetId: id,
    }),
  });

  space.building = nextBuilding;
  space.floor = nextFloor;

  return copy(space);
}

// 登记设备负责人：没有记录时版本视为 0，首次保存为 1，之后每次 +1。
// 只替换 owners 中该设备的记录，保留已有 spaces、cases 和其他负责人。
export async function saveOwner(
  deviceId,
  { username, note, expectedVersion, actor } = {}
) {
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

  const expected = Number(expectedVersion);
  if (!Number.isInteger(expected) || expected < 0) {
    throw new Error("负责人版本无效，请重新读取后再登记");
  }

  // 每次提交都从存储读取，按刚读取到的版本比较，不自动重试。
  const saved = readSavedDemoState();
  const existing = saved.owners.find(
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

  let replaced = false;
  const nextOwners = saved.owners.map((owner) => {
    if (owner && owner.deviceId === deviceId) {
      replaced = true;
      return nextOwner;
    }
    return owner;
  });

  if (!replaced) {
    nextOwners.push(nextOwner);
  }

  writeSavedDemoState({
    ...saved,
    spaces: saved.spaces,
    owners: nextOwners,
    cases: saved.cases,
    audit: appendAudit(saved, {
      actor,
      action: "owner.save",
      targetId: deviceId,
    }),
  });

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
