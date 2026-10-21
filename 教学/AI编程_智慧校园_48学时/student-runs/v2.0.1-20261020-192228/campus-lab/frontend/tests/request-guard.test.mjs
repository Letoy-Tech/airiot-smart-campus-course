import test from "node:test";
import assert from "node:assert/strict";

import { createLatestRequest, createSessionGuard } from "../request-guard.js";

test("会话切换后，较早请求携带的代次不再有效", () => {
  const guard = createSessionGuard();
  const startedBeforeSwitch = guard.generation();

  guard.invalidate();

  assert.notEqual(guard.generation(), startedBeforeSwitch);
});

test("同一页只接受最后一次请求的结果", () => {
  const guard = createLatestRequest();
  const first = guard.begin();
  const second = guard.begin();

  assert.equal(guard.isLatest(first), false);
  assert.equal(guard.isLatest(second), true);
});

test("作废后，所有在途请求都不能再写入页面", () => {
  const guard = createLatestRequest();
  const token = guard.begin();

  guard.invalidate();

  assert.equal(guard.isLatest(token), false);
});
