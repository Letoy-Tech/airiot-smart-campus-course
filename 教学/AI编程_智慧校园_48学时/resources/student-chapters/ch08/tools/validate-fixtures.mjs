import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';

// Standalone fixture consistency only: no HTTP, database or provider execution.
const fixtureDir = fileURLToPath(new URL('../fixtures/', import.meta.url));
const clock = 1792303200000;
const table = {
  environment: { prefix: 'env', tableId: 'teaching_environment', tags: { temperature: '°C', humidity: '%' } },
  energy: { prefix: 'energy', tableId: 'teaching_energy', tags: { voltage: 'V', power: 'kW' } },
  facility: { prefix: 'facility', tableId: 'teaching_facility', tags: { run_state: '', equipment_temperature: '°C' } },
  lighting: { prefix: 'light', tableId: 'teaching_lighting', tags: { illuminance: 'lux' } },
};
let groups = 0;
let rejectionChecks = 0;

function json(name) {
  return JSON.parse(readFileSync(path.join(fixtureDir, name), 'utf8'));
}
function keys(value, expected, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label}: object required`);
  assert.deepEqual(Object.keys(value).sort(), [...expected].sort(), `${label}: unexpected/missing fields`);
}
function unique(values, label) {
  assert.equal(new Set(values).size, values.length, `${label}: duplicate`);
}
function epoch(value) {
  return typeof value === 'number' && Number.isSafeInteger(value) && Number.isFinite(new Date(value).getTime());
}
function nonempty(value, label) {
  assert(typeof value === 'string' && value.trim().length > 0, `${label}: nonempty string required`);
}
function noProductionIds(value) {
  if (typeof value === 'string') {
    assert(!/^[a-f0-9]{24}$/i.test(value), 'catalog must not contain an upstream project/object identifier');
  } else if (Array.isArray(value)) value.forEach(noProductionIds);
  else if (value && typeof value === 'object') {
    assert(!Object.hasOwn(value, 'projectId'), 'catalog must not carry projectId');
    Object.values(value).forEach(noProductionIds);
  }
}

// Only isolated conditions are classified. Deliberately refuses to decide the
// unfrozen precedence between a missing field and another invalid field.
function isolatedQuality(raw, observedAt) {
  const missingValue = raw.value === null;
  const missingTime = raw.time === null;
  const invalidValue = !missingValue && (typeof raw.value !== 'number' || !Number.isFinite(raw.value));
  const invalidTime = !missingTime && !epoch(raw.time);
  assert(!((missingValue || missingTime) && (invalidValue || invalidTime)), 'combined missing/invalid precedence is not frozen');
  if (invalidValue || invalidTime) return 'invalid';
  if (missingValue || missingTime) return 'missing';
  if (raw.time - observedAt > 5000) return 'invalid';
  return observedAt - raw.time > 60000 ? 'stale' : 'fresh';
}

function validateCatalog(catalog) {
  keys(catalog, ['schemaVersion', 'source', 'simulated', 'observedAt', 'spaces', 'devices', 'points'], 'catalog');
  assert.equal(catalog.schemaVersion, 1);
  assert.equal(catalog.source, 'TEACHING_MOCK');
  assert.equal(catalog.simulated, true);
  assert.equal(catalog.observedAt, clock);
  assert(epoch(catalog.observedAt));
  assert.equal(catalog.spaces.length, 4, 'space count');
  assert.equal(catalog.devices.length, 16, 'device count');
  assert.equal(catalog.points.length, 28, 'point count');
  unique(catalog.spaces.map(s => s.id), 'space ids');
  unique(catalog.devices.map(d => d.id), 'device ids');
  unique(catalog.points.map(p => `${p.deviceId}/${p.tagId}`), 'device/tag point keys');
  noProductionIds(catalog);
  const spaces = new Map(catalog.spaces.map(s => [s.id, s]));
  for (let i = 1; i <= 4; i++) assert(spaces.has(`teaching_space_${String(i).padStart(2, '0')}`));
  for (const s of catalog.spaces) {
    keys(s, ['id', 'name', 'type', 'campusId', 'buildingId', 'floor'], `space ${s.id}`);
    nonempty(s.name, 'space.name');
    assert(s.type === null || typeof s.type === 'string');
    for (const field of ['campusId', 'buildingId', 'floor']) assert.equal(s[field], null, `initial ${field}`);
  }
  const devices = new Map(catalog.devices.map(d => [d.id, d]));
  let tagCount = 0;
  for (const d of catalog.devices) {
    keys(d, ['id', 'tableId', 'name', 'category', 'spaceId', 'spaceName', 'online', 'communicationTime', 'simulated', 'switchOn', 'tags'], `device ${d.id}`);
    nonempty(d.name, 'device.name');
    const category = table[d.category];
    assert(category, `unknown category ${d.category}`);
    assert(new RegExp(`^teaching_${category.prefix}_0[1-4]$`).test(d.id), `teaching device id ${d.id}`);
    assert.equal(d.tableId, category.tableId);
    assert(spaces.has(d.spaceId), `space FK ${d.spaceId}`);
    assert.equal(d.spaceId, `teaching_space_${d.id.slice(-2)}`, 'space/device teaching grouping');
    assert.equal(d.spaceName, spaces.get(d.spaceId).name);
    assert(d.online === null || typeof d.online === 'boolean', 'online must be Boolean/null');
    assert(d.communicationTime === null || epoch(d.communicationTime), 'communication time');
    assert.equal(d.simulated, true);
    assert(d.switchOn === null || typeof d.switchOn === 'boolean', 'switchOn must be Boolean/null');
    unique(d.tags.map(t => t.id), 'device tag ids');
    assert.deepEqual(d.tags.map(t => t.id).sort(), Object.keys(category.tags).sort());
    for (const t of d.tags) {
      keys(t, ['id', 'name', 'unit'], 'tag');
      nonempty(t.name, 'tag.name');
      assert.equal(t.unit, category.tags[t.id], `tag unit ${d.id}/${t.id}`);
    }
    tagCount += d.tags.length;
  }
  assert.equal(tagCount, 28);
  for (const [category] of Object.entries(table)) assert.equal(catalog.devices.filter(d => d.category === category).length, 4);
  for (const p of catalog.points) {
    keys(p, ['deviceId', 'tableId', 'tagId', 'value', 'time', 'quality', 'unit'], 'point');
    const d = devices.get(p.deviceId);
    assert(d, `device FK ${p.deviceId}`);
    assert.equal(p.tableId, d.tableId);
    const t = d.tags.find(tag => tag.id === p.tagId);
    assert(t, `tag FK ${p.deviceId}/${p.tagId}`);
    assert.equal(p.unit, t.unit, `point unit ${p.deviceId}/${p.tagId}`);
    assert(p.value === null || (typeof p.value === 'number' && Number.isFinite(p.value)), 'point numeric value');
    assert(p.time === null || epoch(p.time), 'point epoch time');
    assert.equal(p.quality, isolatedQuality(p, clock), `point quality ${p.deviceId}/${p.tagId}`);
  }
  for (const d of catalog.devices) {
    assert.deepEqual(catalog.points.filter(p => p.deviceId === d.id).map(p => p.tagId).sort(), d.tags.map(t => t.id).sort(), 'all tags have one point');
  }
  assert(catalog.points.some(p => p.value === 0 && p.quality === 'fresh'), 'known zero remains valid');
  assert(catalog.points.some(p => p.value === null && p.time !== null && p.quality === 'missing'), 'null sample remains missing');
  assert.equal(devices.get('teaching_env_01').online, true);
  assert.equal(devices.get('teaching_energy_01').online, null);
  assert.equal(devices.get('teaching_facility_04').online, false);
}

function expectReject(label, mutation, catalog) {
  const changed = structuredClone(catalog);
  mutation(changed);
  assert.throws(() => validateCatalog(changed), undefined, `must reject ${label}`);
  rejectionChecks++;
}

try {
  const catalog = json('catalog.json');
  validateCatalog(catalog);
  groups++;

  const selectors = json('selectors.json');
  assert.equal(selectors.schemaVersion, 1);
  assert.equal(selectors.kind, 'CATALOG_SELECTION');
  keys(selectors.profiles, ['first-chain', 'full'], 'selection profiles');
  for (const [profile, selection] of Object.entries(selectors.profiles)) {
    keys(selection, ['spaceIds', 'deviceIds', 'includeAllTagsForSelectedDevices'], profile);
    assert.equal(selection.includeAllTagsForSelectedDevices, true);
    unique(selection.spaceIds, 'selected spaces');
    unique(selection.deviceIds, 'selected devices');
    const selectedSpaces = catalog.spaces.filter(s => selection.spaceIds.includes(s.id));
    const selectedDevices = catalog.devices.filter(d => selection.deviceIds.includes(d.id));
    assert.equal(selectedSpaces.length, selection.spaceIds.length, 'selected space FK');
    assert.equal(selectedDevices.length, selection.deviceIds.length, 'selected device FK');
    assert(selectedDevices.every(d => selection.spaceIds.includes(d.spaceId)));
    const selectedPoints = catalog.points.filter(p => selection.deviceIds.includes(p.deviceId));
    assert.deepEqual([selectedSpaces.length, selectedDevices.length, selectedPoints.length], profile === 'first-chain' ? [1, 2, 4] : [4, 16, 28]);
  }
  assert.deepEqual(selectors.profiles['first-chain'].spaceIds, ['teaching_space_01']);
  assert.deepEqual(selectors.profiles['first-chain'].deviceIds, ['teaching_env_01', 'teaching_energy_01']);
  groups++;

  const quality = json('quality-cases.json');
  assert.equal(quality.schemaVersion, 1);
  assert.equal(quality.kind, 'RAW_QUALITY_CASES');
  assert.equal(quality.source, 'TEACHING_MOCK');
  assert.equal(quality.simulated, true);
  assert.equal(quality.observedAt, clock);
  assert.equal(quality.policy.staleAfterMs, 60000);
  assert.equal(quality.policy.futureToleranceMs, 5000);
  assert.equal(quality.policy.combinedErrorPrecedence, 'NOT_FROZEN');
  unique(quality.cases.map(c => c.id), 'quality ids');
  assert.equal(quality.cases.length, 15);
  for (const c of quality.cases) {
    keys(c.raw, ['value', 'time'], 'raw quality input');
    assert.equal(isolatedQuality(c.raw, clock), c.expectedQuality, `quality ${c.id}`);
    const differences = ['value', 'time'].filter(k => c.raw[k] !== quality.baseRaw[k]);
    assert.equal(differences.length, c.id === 'valid-number' ? 0 : 1, `single variable ${c.id}`);
  }
  for (const [id, expected] of Object.entries({ 'valid-zero': 'fresh', 'age-59999ms': 'fresh', 'age-60000ms': 'fresh', 'age-60001ms': 'stale', 'future-4999ms': 'fresh', 'future-5000ms': 'fresh', 'future-5001ms': 'invalid', 'missing-value': 'missing', 'missing-time': 'missing' })) {
    assert.equal(quality.cases.find(c => c.id === id)?.expectedQuality, expected, `required quality case ${id}`);
  }
  for (const [id, offset] of Object.entries({ 'age-59999ms': -59999, 'age-60000ms': -60000, 'age-60001ms': -60001, 'future-4999ms': 4999, 'future-5000ms': 5000, 'future-5001ms': 5001 })) {
    assert.equal(quality.cases.find(c => c.id === id).raw.time, clock + offset, `exact boundary ${id}`);
  }
  assert.equal(quality.cases.find(c => c.id === 'valid-zero').raw.value, 0);
  assert.equal(quality.cases.find(c => c.id === 'missing-value').raw.value, null);
  assert.equal(quality.cases.find(c => c.id === 'missing-time').raw.time, null);
  for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    assert.equal(isolatedQuality({ value, time: clock - 1000 }, clock), 'invalid');
  }
  assert.throws(() => isolatedQuality({ value: null, time: 'bad' }, clock), /not frozen/);
  groups++;

  const history = json('history-cases.json');
  keys(history, ['code', 'message', 'data'], 'history response');
  assert.equal(history.code, 0);
  assert.equal(history.message, 'ok');
  const h = history.data;
  keys(h, ['source', 'deviceId', 'tagId', 'unit', 'from', 'to', 'observedAt', 'samples', 'truncated', 'issues'], 'history data');
  assert.equal(h.source, 'TEACHING_MOCK');
  assert.equal(h.deviceId, 'teaching_energy_01');
  assert.equal(h.tagId, 'power');
  assert.equal(h.unit, 'kW');
  assert.equal(h.observedAt, clock);
  assert(epoch(h.from) && epoch(h.to) && h.from < h.to);
  assert.equal(h.to - h.from, 900000);
  assert.equal(h.samples.length, 4);
  unique(h.samples.map(s => s.time), 'history time');
  for (const s of h.samples) {
    keys(s, ['time', 'value'], 'history sample');
    assert(epoch(s.time) && s.time > h.from && s.time < h.to, 'samples intentionally inside window');
    assert(s.value === null || (typeof s.value === 'number' && Number.isFinite(s.value)));
  }
  assert.equal(h.samples.filter(s => s.value === null).length, 1);
  assert.equal(h.samples.filter(s => s.value === 0).length, 1);
  assert.equal(h.truncated, false);
  assert.deepEqual(h.issues, []);
  groups++;

  const permissions = json('permission-scenarios.json');
  const pagination = json('pagination-scenarios.json');
  const transactions = json('concurrency-rollback-scenarios.json');
  for (const spec of [permissions, pagination, transactions]) {
    assert.equal(spec.schemaVersion, 1);
    assert.equal(spec.kind, 'SCENARIO_SPEC');
    assert.equal(spec.executionStatus, 'NOT_EXECUTED');
  }
  assert.deepEqual(permissions.identities, [
    { key: 'teaching_admin', roles: ['ADMIN', 'CAMPUS_VIEWER'] },
    { key: 'teaching_manager_a', roles: ['CAMPUS_MANAGER'] },
    { key: 'teaching_manager_b', roles: ['CAMPUS_MANAGER'] },
    { key: 'teaching_viewer', roles: ['CAMPUS_VIEWER'] },
  ]);
  const revoke = permissions.scenarios.find(s => s.id === 'revoke-admin-retain-reader');
  assert.deepEqual(revoke.initialRoles, ['ADMIN', 'CAMPUS_VIEWER']);
  assert.equal(revoke.mutation.removeRole, 'ADMIN');
  assert.deepEqual(revoke.mutation.remainingRoles, ['CAMPUS_VIEWER']);
  assert.deepEqual(revoke.requestsAfterRevocation.map(r => r.expectedHttpStatus), [200, 403]);
  const scope = permissions.scenarios.find(s => s.id === 'assigned-to-a');
  assert.equal(scope.eventSetup.assigneeKey, 'teaching_manager_a');
  assert.equal(scope.eventSetup.state, 'ASSIGNED');
  assert.deepEqual(scope.independentCases.map(c => c.actorKey), ['teaching_manager_a', 'teaching_manager_b', 'teaching_viewer']);
  assert.deepEqual(scope.independentCases.map(c => c.expectedHttpStatus), [200, 403, 403]);
  for (const c of scope.independentCases) assert.equal(c.request.body.expectedVersion, scope.eventSetup.version);
  assert.equal(scope.independentCases[0].expectedVersion, scope.eventSetup.version + 1);
  groups++;

  assert.equal(pagination.endpoint, 'GET /campus/alarm-cases');
  assert.equal(pagination.setup.matchingRowCount, 4);
  assert.equal(pagination.setup.concurrentWrites, false);
  // Validate both fields, their priority and direction, not just a vague "frozen" label.
  const paginationSort = pagination.sortSemantics.split('；', 1)[0]
    .split(',').map(clause => clause.trim().split(/\s+/));
  assert.deepEqual(paginationSort, [['createdAt', 'DESC'], ['id', 'DESC']]);
  unique(pagination.cases.map(c => c.id), 'pagination ids');
  assert.equal(pagination.cases.length, 9);
  for (const c of pagination.cases) {
    const { limit, skip } = c.query;
    const valid = Number.isInteger(limit) && limit >= 1 && limit <= 100 && Number.isInteger(skip) && skip >= 0 && skip <= 10000;
    assert.equal(c.expectedHttpStatus, valid ? 200 : 400);
    if (valid) {
      assert.equal(c.expectedItemsLength, Math.max(0, Math.min(limit, 4 - skip)));
      assert.equal(c.expectedTotal, 4);
    }
  }
  groups++;

  assert.equal(transactions.evidenceRequired, 'REAL_ISOLATED_MYSQL_INTEGRATION');
  assert.equal(transactions.scenarios.length, 4);
  unique(transactions.scenarios.map(c => c.id), 'transaction scenario ids');
  const actorKeys = new Set(permissions.identities.map(i => i.key));
  for (const scenario of transactions.scenarios) {
    if (scenario.actorKeys) {
      assert(scenario.actorKeys.every(key => actorKeys.has(key)));
      assert.equal(scenario.requests.length, 2);
      for (const request of scenario.requests) assert.equal(request.expectedVersion, scenario.setup.currentVersion, 'both race current version');
      assert.deepEqual(scenario.expected.httpStatusesUnordered, [200, 409]);
      assert.equal(scenario.expected.finalVersion, scenario.setup.currentVersion + 1);
      assert.equal(scenario.expected.timelineAdded, 1);
    } else {
      assert(actorKeys.has(scenario.actorKey));
      assert.equal(scenario.request.expectedVersion, scenario.setup.currentVersion);
      assert.equal(scenario.expected.responseIsSafeFailure, true);
      assert.equal(scenario.expected.exactHttpStatus, 'NOT_FROZEN');
      assert.equal(scenario.expected.masterSnapshotUnchanged, true);
      assert.equal(scenario.expected.timelineSnapshotUnchanged, true);
    }
  }
  groups++;

  expectReject('duplicate point', c => { c.points[1] = structuredClone(c.points[0]); }, catalog);
  expectReject('missing point', c => { c.points.pop(); }, catalog);
  expectReject('dangling space', c => { c.devices[0].spaceId = 'teaching_space_99'; }, catalog);
  expectReject('dangling device', c => { c.points[0].deviceId = 'teaching_env_99'; }, catalog);
  expectReject('unknown tag', c => { c.points[0].tagId = 'unknown'; }, catalog);
  expectReject('wrong unit', c => { c.points.find(p => p.tagId === 'power').unit = 'kWh'; }, catalog);
  expectReject('wrong source', c => { c.source = 'AIRIOT'; }, catalog);
  expectReject('device source field', c => { c.devices[0].source = 'TEACHING_MOCK'; }, catalog);
  expectReject('real marker', c => { c.devices[0].simulated = false; }, catalog);
  expectReject('string Boolean', c => { c.devices[0].online = 'true'; }, catalog);
  expectReject('string number', c => { c.points[0].value = '24'; }, catalog);
  expectReject('invalid time', c => { c.points[0].time = clock + 0.5; }, catalog);
  expectReject('wrong quality', c => { c.points[0].quality = 'stale'; }, catalog);
  expectReject('observation drift', c => { c.observedAt++; }, catalog);
  groups++;

  const manifest = json('manifest.json');
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.kind, 'FIXTURE_MANIFEST');
  assert.equal(manifest.source, 'TEACHING_MOCK');
  assert.equal(manifest.simulated, true);
  assert.equal(manifest.clock.epochMs, clock);
  assert.equal(manifest.clock.isoUtc, new Date(clock).toISOString());
  assert.deepEqual(manifest.catalogCounts, { spaces: 4, devices: 16, uniquePoints: 28 });
  assert.deepEqual(manifest.firstChain, { spaceIds: selectors.profiles['first-chain'].spaceIds, deviceIds: selectors.profiles['first-chain'].deviceIds, uniquePoints: 4 });
  assert.equal(manifest.labVerified, false);
  assert.equal(manifest.databaseVerified, false);
  const expectedFiles = ['README.md', 'schema.md', 'catalog.json', 'selectors.json', 'quality-cases.json', 'history-cases.json', 'permission-scenarios.json', 'pagination-scenarios.json', 'concurrency-rollback-scenarios.json'];
  assert.deepEqual(manifest.files.map(f => f.path).sort(), expectedFiles.sort());
  unique(manifest.files.map(f => f.path), 'manifest paths');
  for (const file of manifest.files) {
    assert.equal(path.basename(file.path), file.path, 'manifest cannot escape fixture directory');
    const bytes = readFileSync(path.join(fixtureDir, file.path));
    assert.equal(bytes.length, file.bytes, `manifest byte count ${file.path}`);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256, `manifest SHA-256 ${file.path}`);
  }
  for (const [category, definition] of Object.entries(table)) {
    const mappings = manifest.tagMappings.filter(m => m.category === category);
    assert.deepEqual(Object.fromEntries(mappings.map(m => [m.teachingTagId, m.unit])), definition.tags);
  }
  groups++;

  console.log(`PASS: ${groups} fixture validation groups; catalog 4 spaces / 16 devices / 28 unique points.`);
  console.log(`PASS: first-chain 1 / 2 / 4; 15 quality cases; 4 history samples; ${rejectionChecks} damaged-catalog rejection checks.`);
  console.log('SCOPE: standalone files and scenario specifications only. No HTTP/provider/database/browser checks; lab_verified=false.');
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
}
