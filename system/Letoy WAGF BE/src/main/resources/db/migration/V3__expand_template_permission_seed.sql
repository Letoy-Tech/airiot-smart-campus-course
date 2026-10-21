-- ------------------------------------------------------------
-- Expand template seed data for base groups and API rules.
-- This migration is additive so existing databases can upgrade safely.
-- ------------------------------------------------------------

-- ============================================================
-- Base groups
-- ============================================================
INSERT INTO groups_info (group_id, group_name, group_description, parent_group_id, path, level, sort_order, status)
SELECT 'PLATFORM', 'Platform Group', 'Platform management and backend development group', 'ROOT', '/ROOT/PLATFORM/', 1, 10, 1
WHERE NOT EXISTS (SELECT 1 FROM groups_info WHERE group_id = 'PLATFORM');

INSERT INTO groups_info (group_id, group_name, group_description, parent_group_id, path, level, sort_order, status)
SELECT 'OPERATIONS', 'Operations Group', 'Operations and support group', 'ROOT', '/ROOT/OPERATIONS/', 1, 20, 1
WHERE NOT EXISTS (SELECT 1 FROM groups_info WHERE group_id = 'OPERATIONS');

INSERT INTO groups_info (group_id, group_name, group_description, parent_group_id, path, level, sort_order, status)
SELECT 'BUSINESS', 'Business Group', 'Business module and product operation group', 'ROOT', '/ROOT/BUSINESS/', 1, 30, 1
WHERE NOT EXISTS (SELECT 1 FROM groups_info WHERE group_id = 'BUSINESS');

INSERT INTO groups_info (group_id, group_name, group_description, parent_group_id, path, level, sort_order, status)
SELECT 'AUDIT', 'Audit Group', 'Read-only audit and report viewing group', 'ROOT', '/ROOT/AUDIT/', 1, 40, 1
WHERE NOT EXISTS (SELECT 1 FROM groups_info WHERE group_id = 'AUDIT');

-- ============================================================
-- Align existing user management rules from V2
-- ============================================================
UPDATE api_rule
SET allowed_group_ids = 'ROOT,PLATFORM,OPERATIONS,AUDIT',
    priority = 220
WHERE pattern = '/users/query' AND methods = 'POST';

UPDATE api_rule
SET allowed_group_ids = 'ROOT,PLATFORM',
    priority = 240
WHERE pattern = '/users' AND methods = 'POST';

UPDATE api_rule
SET allowed_group_ids = 'ROOT,PLATFORM,OPERATIONS,AUDIT',
    priority = 220
WHERE pattern = '/users/{uid}' AND methods = 'GET';

UPDATE api_rule
SET allowed_group_ids = 'ROOT,PLATFORM',
    priority = 240
WHERE pattern = '/users/{uid}' AND methods = 'PUT';

UPDATE api_rule
SET allowed_group_ids = 'ROOT,PLATFORM',
    priority = 240
WHERE pattern = '/users/{uid}/password' AND methods = 'PUT';

UPDATE api_rule
SET allowed_group_ids = 'ROOT,PLATFORM',
    priority = 240
WHERE pattern = '/users/{uid}/status' AND methods = 'PATCH';

UPDATE api_rule
SET allowed_group_ids = 'ROOT,PLATFORM',
    priority = 240
WHERE pattern = '/users/{uid}' AND methods = 'DELETE';

-- ============================================================
-- Public / whitelist auth rules
-- ============================================================
INSERT INTO api_rule (name, pattern, methods, group_policy, allowed_group_ids, priority, enabled)
SELECT 'Auth bootstrap', '/auth/bootstrap', 'POST', 'ANY', NULL, 100, 1
WHERE NOT EXISTS (SELECT 1 FROM api_rule WHERE pattern = '/auth/bootstrap' AND methods = 'POST');

INSERT INTO api_rule (name, pattern, methods, group_policy, allowed_group_ids, priority, enabled)
SELECT 'Auth login', '/auth/login', 'POST', 'ANY', NULL, 100, 1
WHERE NOT EXISTS (SELECT 1 FROM api_rule WHERE pattern = '/auth/login' AND methods = 'POST');

INSERT INTO api_rule (name, pattern, methods, group_policy, allowed_group_ids, priority, enabled)
SELECT 'Auth phone login code send', '/auth/login/phone-code/send', 'POST', 'ANY', NULL, 100, 1
WHERE NOT EXISTS (SELECT 1 FROM api_rule WHERE pattern = '/auth/login/phone-code/send' AND methods = 'POST');

INSERT INTO api_rule (name, pattern, methods, group_policy, allowed_group_ids, priority, enabled)
SELECT 'Auth phone login', '/auth/login/phone-code', 'POST', 'ANY', NULL, 100, 1
WHERE NOT EXISTS (SELECT 1 FROM api_rule WHERE pattern = '/auth/login/phone-code' AND methods = 'POST');

INSERT INTO api_rule (name, pattern, methods, group_policy, allowed_group_ids, priority, enabled)
SELECT 'Auth refresh token', '/auth/refresh', 'POST', 'ANY', NULL, 100, 1
WHERE NOT EXISTS (SELECT 1 FROM api_rule WHERE pattern = '/auth/refresh' AND methods = 'POST');

INSERT INTO api_rule (name, pattern, methods, group_policy, allowed_group_ids, priority, enabled)
SELECT 'Auth revoke token', '/auth/revoke', 'POST', 'ANY', NULL, 110, 1
WHERE NOT EXISTS (SELECT 1 FROM api_rule WHERE pattern = '/auth/revoke' AND methods = 'POST');

-- ============================================================
-- Group management rules
-- Read: ROOT, PLATFORM, OPERATIONS, AUDIT
-- Write: ROOT, PLATFORM
-- ============================================================
INSERT INTO api_rule (name, pattern, methods, group_policy, allowed_group_ids, priority, enabled)
SELECT 'Group create root', '/groups/root', 'POST', 'ALLOWLIST', 'ROOT,PLATFORM', 240, 1
WHERE NOT EXISTS (SELECT 1 FROM api_rule WHERE pattern = '/groups/root' AND methods = 'POST');

INSERT INTO api_rule (name, pattern, methods, group_policy, allowed_group_ids, priority, enabled)
SELECT 'Group create child', '/groups/child', 'POST', 'ALLOWLIST', 'ROOT,PLATFORM', 240, 1
WHERE NOT EXISTS (SELECT 1 FROM api_rule WHERE pattern = '/groups/child' AND methods = 'POST');

INSERT INTO api_rule (name, pattern, methods, group_policy, allowed_group_ids, priority, enabled)
SELECT 'Group update', '/groups/{groupId}', 'PUT', 'ALLOWLIST', 'ROOT,PLATFORM', 240, 1
WHERE NOT EXISTS (SELECT 1 FROM api_rule WHERE pattern = '/groups/{groupId}' AND methods = 'PUT');

INSERT INTO api_rule (name, pattern, methods, group_policy, allowed_group_ids, priority, enabled)
SELECT 'Group get by id', '/groups/id/{id}', 'GET', 'ALLOWLIST', 'ROOT,PLATFORM,OPERATIONS,AUDIT', 220, 1
WHERE NOT EXISTS (SELECT 1 FROM api_rule WHERE pattern = '/groups/id/{id}' AND methods = 'GET');

INSERT INTO api_rule (name, pattern, methods, group_policy, allowed_group_ids, priority, enabled)
SELECT 'Group get by group id', '/groups/{groupId}', 'GET', 'ALLOWLIST', 'ROOT,PLATFORM,OPERATIONS,AUDIT', 220, 1
WHERE NOT EXISTS (SELECT 1 FROM api_rule WHERE pattern = '/groups/{groupId}' AND methods = 'GET');

INSERT INTO api_rule (name, pattern, methods, group_policy, allowed_group_ids, priority, enabled)
SELECT 'Group children', '/groups/{groupId}/children', 'GET', 'ALLOWLIST', 'ROOT,PLATFORM,OPERATIONS,AUDIT', 220, 1
WHERE NOT EXISTS (SELECT 1 FROM api_rule WHERE pattern = '/groups/{groupId}/children' AND methods = 'GET');

INSERT INTO api_rule (name, pattern, methods, group_policy, allowed_group_ids, priority, enabled)
SELECT 'Group subtree', '/groups/{groupId}/subtree', 'GET', 'ALLOWLIST', 'ROOT,PLATFORM,OPERATIONS,AUDIT', 220, 1
WHERE NOT EXISTS (SELECT 1 FROM api_rule WHERE pattern = '/groups/{groupId}/subtree' AND methods = 'GET');

INSERT INTO api_rule (name, pattern, methods, group_policy, allowed_group_ids, priority, enabled)
SELECT 'Group all', '/groups/all', 'GET', 'ALLOWLIST', 'ROOT,PLATFORM,OPERATIONS,AUDIT', 220, 1
WHERE NOT EXISTS (SELECT 1 FROM api_rule WHERE pattern = '/groups/all' AND methods = 'GET');

INSERT INTO api_rule (name, pattern, methods, group_policy, allowed_group_ids, priority, enabled)
SELECT 'Group query', '/groups/query', 'POST', 'ALLOWLIST', 'ROOT,PLATFORM,OPERATIONS,AUDIT', 220, 1
WHERE NOT EXISTS (SELECT 1 FROM api_rule WHERE pattern = '/groups/query' AND methods = 'POST');

INSERT INTO api_rule (name, pattern, methods, group_policy, allowed_group_ids, priority, enabled)
SELECT 'Group delete', '/groups/{groupId}', 'DELETE', 'ALLOWLIST', 'ROOT,PLATFORM', 240, 1
WHERE NOT EXISTS (SELECT 1 FROM api_rule WHERE pattern = '/groups/{groupId}' AND methods = 'DELETE');

-- ============================================================
-- Role management rules
-- ============================================================
INSERT INTO api_rule (name, pattern, methods, group_policy, allowed_group_ids, priority, enabled)
SELECT 'Role list', '/roles', 'GET', 'ALLOWLIST', 'ROOT,PLATFORM,AUDIT', 220, 1
WHERE NOT EXISTS (SELECT 1 FROM api_rule WHERE pattern = '/roles' AND methods = 'GET');

INSERT INTO api_rule (name, pattern, methods, group_policy, allowed_group_ids, priority, enabled)
SELECT 'Role get', '/roles/{roleCode}', 'GET', 'ALLOWLIST', 'ROOT,PLATFORM,AUDIT', 220, 1
WHERE NOT EXISTS (SELECT 1 FROM api_rule WHERE pattern = '/roles/{roleCode}' AND methods = 'GET');

INSERT INTO api_rule (name, pattern, methods, group_policy, allowed_group_ids, priority, enabled)
SELECT 'Role create', '/roles', 'POST', 'ALLOWLIST', 'ROOT,PLATFORM', 240, 1
WHERE NOT EXISTS (SELECT 1 FROM api_rule WHERE pattern = '/roles' AND methods = 'POST');

INSERT INTO api_rule (name, pattern, methods, group_policy, allowed_group_ids, priority, enabled)
SELECT 'Role update', '/roles/{roleCode}', 'PUT', 'ALLOWLIST', 'ROOT,PLATFORM', 240, 1
WHERE NOT EXISTS (SELECT 1 FROM api_rule WHERE pattern = '/roles/{roleCode}' AND methods = 'PUT');

INSERT INTO api_rule (name, pattern, methods, group_policy, allowed_group_ids, priority, enabled)
SELECT 'Role delete', '/roles/{roleCode}', 'DELETE', 'ALLOWLIST', 'ROOT,PLATFORM', 240, 1
WHERE NOT EXISTS (SELECT 1 FROM api_rule WHERE pattern = '/roles/{roleCode}' AND methods = 'DELETE');

INSERT INTO api_rule (name, pattern, methods, group_policy, allowed_group_ids, priority, enabled)
SELECT 'Role list by user', '/roles/users/{uid}', 'GET', 'ALLOWLIST', 'ROOT,PLATFORM,AUDIT', 220, 1
WHERE NOT EXISTS (SELECT 1 FROM api_rule WHERE pattern = '/roles/users/{uid}' AND methods = 'GET');

INSERT INTO api_rule (name, pattern, methods, group_policy, allowed_group_ids, priority, enabled)
SELECT 'Role assign to user', '/roles/users/{uid}', 'PUT', 'ALLOWLIST', 'ROOT,PLATFORM', 240, 1
WHERE NOT EXISTS (SELECT 1 FROM api_rule WHERE pattern = '/roles/users/{uid}' AND methods = 'PUT');

-- ============================================================
-- API rule management rules
-- ============================================================
INSERT INTO api_rule (name, pattern, methods, group_policy, allowed_group_ids, priority, enabled)
SELECT 'Api rule list all', '/security/api-rules/get-all', 'POST', 'ALLOWLIST', 'ROOT,PLATFORM,AUDIT', 250, 1
WHERE NOT EXISTS (SELECT 1 FROM api_rule WHERE pattern = '/security/api-rules/get-all' AND methods = 'POST');

INSERT INTO api_rule (name, pattern, methods, group_policy, allowed_group_ids, priority, enabled)
SELECT 'Api rule query', '/security/api-rules/query', 'POST', 'ALLOWLIST', 'ROOT,PLATFORM,AUDIT', 250, 1
WHERE NOT EXISTS (SELECT 1 FROM api_rule WHERE pattern = '/security/api-rules/query' AND methods = 'POST');

INSERT INTO api_rule (name, pattern, methods, group_policy, allowed_group_ids, priority, enabled)
SELECT 'Api rule detail', '/security/api-rules/{id}', 'GET', 'ALLOWLIST', 'ROOT,PLATFORM,AUDIT', 250, 1
WHERE NOT EXISTS (SELECT 1 FROM api_rule WHERE pattern = '/security/api-rules/{id}' AND methods = 'GET');

INSERT INTO api_rule (name, pattern, methods, group_policy, allowed_group_ids, priority, enabled)
SELECT 'Api rule create', '/security/api-rules', 'POST', 'ALLOWLIST', 'ROOT,PLATFORM', 260, 1
WHERE NOT EXISTS (SELECT 1 FROM api_rule WHERE pattern = '/security/api-rules' AND methods = 'POST');

INSERT INTO api_rule (name, pattern, methods, group_policy, allowed_group_ids, priority, enabled)
SELECT 'Api rule update', '/security/api-rules/{id}', 'PUT', 'ALLOWLIST', 'ROOT,PLATFORM', 260, 1
WHERE NOT EXISTS (SELECT 1 FROM api_rule WHERE pattern = '/security/api-rules/{id}' AND methods = 'PUT');

INSERT INTO api_rule (name, pattern, methods, group_policy, allowed_group_ids, priority, enabled)
SELECT 'Api rule enable', '/security/api-rules/{id}/enabled', 'PATCH', 'ALLOWLIST', 'ROOT,PLATFORM', 260, 1
WHERE NOT EXISTS (SELECT 1 FROM api_rule WHERE pattern = '/security/api-rules/{id}/enabled' AND methods = 'PATCH');

INSERT INTO api_rule (name, pattern, methods, group_policy, allowed_group_ids, priority, enabled)
SELECT 'Api rule delete', '/security/api-rules/{id}', 'DELETE', 'ALLOWLIST', 'ROOT,PLATFORM', 260, 1
WHERE NOT EXISTS (SELECT 1 FROM api_rule WHERE pattern = '/security/api-rules/{id}' AND methods = 'DELETE');

INSERT INTO api_rule (name, pattern, methods, group_policy, allowed_group_ids, priority, enabled)
SELECT 'Api rule rebuild cache', '/security/api-rules/rebuild-cache', 'POST', 'ALLOWLIST', 'ROOT,PLATFORM', 260, 1
WHERE NOT EXISTS (SELECT 1 FROM api_rule WHERE pattern = '/security/api-rules/rebuild-cache' AND methods = 'POST');

-- ============================================================
-- Aliyun / AI rules
-- ============================================================
INSERT INTO api_rule (name, pattern, methods, group_policy, allowed_group_ids, priority, enabled)
SELECT 'Aliyun captcha verify', '/aliyun/captcha/verify', 'POST', 'ANY', NULL, 100, 1
WHERE NOT EXISTS (SELECT 1 FROM api_rule WHERE pattern = '/aliyun/captcha/verify' AND methods = 'POST');

INSERT INTO api_rule (name, pattern, methods, group_policy, allowed_group_ids, priority, enabled)
SELECT 'Aliyun template sms', '/aliyun/sms/template', 'POST', 'ALLOWLIST', 'ROOT,PLATFORM,OPERATIONS', 230, 1
WHERE NOT EXISTS (SELECT 1 FROM api_rule WHERE pattern = '/aliyun/sms/template' AND methods = 'POST');

INSERT INTO api_rule (name, pattern, methods, group_policy, allowed_group_ids, priority, enabled)
SELECT 'Aliyun global sms', '/aliyun/sms/global', 'POST', 'ALLOWLIST', 'ROOT,PLATFORM,OPERATIONS', 230, 1
WHERE NOT EXISTS (SELECT 1 FROM api_rule WHERE pattern = '/aliyun/sms/global' AND methods = 'POST');

INSERT INTO api_rule (name, pattern, methods, group_policy, allowed_group_ids, priority, enabled)
SELECT 'AI chat', '/ai/chat', 'POST', 'ALLOWLIST', 'ROOT,PLATFORM,OPERATIONS,BUSINESS,AUDIT', 210, 1
WHERE NOT EXISTS (SELECT 1 FROM api_rule WHERE pattern = '/ai/chat' AND methods = 'POST');
