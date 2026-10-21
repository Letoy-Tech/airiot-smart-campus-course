// 临时检查脚本（不写入项目）：验证 data-service 的令牌只留在内存、请求头与 401/403 处理。
import { pathToFileURL } from "node:url";

const base = "/Users/learner/projects/airiot-smart-campus-course/教学/AI编程_智慧校园_48学时/student-runs/v2.0.1-20261020-192228/campus-lab/frontend";
const ds = await import(pathToFileURL(`${base}/data-service.js`).href);

const calls = [];
const queue = [];
const storageWrites = [];

globalThis.fetch = async (url, options = {}) => {
  calls.push({ url, headers: options.headers ?? {}, body: options.body ?? null });
  const next = queue.shift();
  if (!next) throw new Error("没有准备这个请求的响应");
  return new Response(JSON.stringify(next.body), {
    status: next.status,
    headers: { "Content-Type": "application/json" },
  });
};

globalThis.window = {
  localStorage: {
    getItem: () => null,
    setItem: (k, v) => storageWrites.push([k, v]),
    removeItem: () => {},
  },
};

const ok = (label, condition) => {
  if (!condition) throw new Error(`检查失败：${label}`);
  console.log(`ok  ${label}`);
};

// 1) 登录：请求体带口令，返回后本模块记住令牌，不返回给调用方
queue.push({ status: 200, body: { code: 0, message: "ok", data: { token: "tok-1", user: { username: "manager", role: "MANAGER" } } } });
const user = await ds.login("MANAGER", "pw-only-for-request");
ok("登录响应使用数据库规范 username", user.username === "manager" && user.role === "MANAGER");
ok("登录返回对象不含令牌", !("token" in user));
ok("登录请求体只带本次口令", calls[0].body === JSON.stringify({ username: "MANAGER", password: "pw-only-for-request" }));
ok("登录前不带 Authorization", calls[0].headers.Authorization === undefined);

// 2) /api/me 带 Bearer
queue.push({ status: 200, body: { code: 0, message: "ok", data: { username: "manager", role: "MANAGER" } } });
await ds.fetchMe();
ok("/api/me 带 Authorization: Bearer", calls[1].headers.Authorization === "Bearer tok-1");

// 3) 设备请求带 Bearer
queue.push({ status: 200, body: { code: 0, message: "ok", data: [{ id: "d01", name: "温湿度01", category: "environment", spaceId: "s1", online: null, simulated: true }] } });
const devices = await ds.getDevicesFromServer();
ok("设备请求带 Authorization: Bearer", calls[2].headers.Authorization === "Bearer tok-1");
ok("online=null 保留", devices[0].online === null);

// 4) 退出：清内存令牌，之后请求不再带 Authorization
queue.push({ status: 200, body: { code: 0, message: "ok", data: null } });
const logoutResult = await ds.logout();
ok("退出后端确认", logoutResult.serverConfirmed === true);
queue.push({ status: 200, body: { code: 0, message: "ok", data: [] } });
await ds.getDevicesFromServer();
ok("退出后不再带 Authorization", calls[calls.length - 1].headers.Authorization === undefined);

// 5) 401：标记 unauthorized，并清掉内存令牌
queue.push({ status: 200, body: { code: 0, message: "ok", data: { token: "tok-2", user: { username: "viewer", role: "VIEWER" } } } });
await ds.login("viewer", "pw2");
queue.push({ status: 401, body: { code: 401, message: "未登录或会话已过期", data: null } });
let unauthorizedError = null;
try {
  await ds.getDevicesFromServer();
} catch (error) {
  unauthorizedError = error;
}
ok("401 标记 unauthorized", unauthorizedError && unauthorizedError.unauthorized === true);
queue.push({ status: 200, body: { code: 0, message: "ok", data: [] } });
await ds.getDevicesFromServer();
ok("401 后内存令牌已清除", calls[calls.length - 1].headers.Authorization === undefined);

// 6) 403：标记 forbidden，带后端文案
queue.push({ status: 200, body: { code: 0, message: "ok", data: { token: "tok-3", user: { username: "viewer", role: "VIEWER" } } } });
await ds.login("viewer", "pw3");
queue.push({ status: 403, body: { code: 403, message: "已登录但无权执行该操作", data: null } });
let forbiddenError = null;
try {
  await ds.getDevicesFromServer();
} catch (error) {
  forbiddenError = error;
}
ok("403 标记 forbidden", forbiddenError && forbiddenError.forbidden === true && forbiddenError.message.includes("无权"));

// 7) 503：登录时 Redis 不可用，不产生令牌（先手动清掉上一步 403 仍保留的旧令牌）
ds.clearSessionToken();
queue.push({ status: 503, body: { code: 503, message: "会话服务暂时不可用，请稍后重试", data: null } });
let unavailableError = null;
try {
  await ds.login("admin", "pw4");
} catch (error) {
  unavailableError = error;
}
ok("503 标记 unavailable", unavailableError && unavailableError.unavailable === true);
queue.push({ status: 200, body: { code: 0, message: "ok", data: [] } });
await ds.getDevicesFromServer();
ok("503 登录失败后没有令牌", calls[calls.length - 1].headers.Authorization === undefined);

ok("全程没有写 localStorage", storageWrites.length === 0);
console.log("全部通过：令牌只在内存，请求头与错误分类正确。");
