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

// 演示记录的空结构；spaces、owners、cases 必须一起保存，写入时互不覆盖。
function createEmptyDemoState() {
  return { spaces: [], owners: [], cases: [] };
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

  if (
    !Array.isArray(spaces) ||
    !Array.isArray(owners) ||
    !Array.isArray(cases)
  ) {
    throw new Error(
      "浏览器中的演示记录缺少 spaces、owners、cases 数组，未加载也未覆盖"
    );
  }

  return { ...parsed, spaces, owners, cases };
}

function writeSavedDemoState(state) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    throw new Error("浏览器禁止保存或存储空间不足，本次修改未保存");
  }
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

// 负责人只读取 campus-v2-demo 中的 owners 部分。
export async function getOwners() {
  const saved = readSavedDemoState();
  return copy(saved.owners);
}

// 只修改楼栋和楼层；空间 ID、设备及其归属都不在这里改动。
// 先写浏览器存储，成功后才更新当前数据；失败时保留原记录和页面输入。
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
  });

  space.building = nextBuilding;
  space.floor = nextFloor;

  return copy(space);
}

// 登记设备负责人：没有记录时版本视为 0，首次保存为 1，之后每次 +1。
// 只替换 owners 中该设备的记录，保留已有 spaces、cases 和其他负责人。
export async function saveOwner(
  deviceId,
  { username, note, expectedVersion } = {}
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
  });

  return copy(nextOwner);
}
