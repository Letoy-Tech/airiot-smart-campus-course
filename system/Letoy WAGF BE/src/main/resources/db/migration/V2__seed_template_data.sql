INSERT INTO groups_info (group_id, group_name, group_description, parent_group_id, path, level, sort_order, status)
SELECT 'ROOT', 'Root Group', 'System root management group', NULL, '/ROOT/', 0, 0, 1
WHERE NOT EXISTS (SELECT 1 FROM groups_info WHERE group_id = 'ROOT');

INSERT INTO sys_role (role_code, role_name, description, sort_order, status)
SELECT 'SUPER_ADMIN', 'Super Admin', 'Full system administrator', 0, 1
WHERE NOT EXISTS (SELECT 1 FROM sys_role WHERE role_code = 'SUPER_ADMIN');

INSERT INTO sys_role (role_code, role_name, description, sort_order, status)
SELECT 'ADMIN', 'Administrator', 'Administrative operator', 10, 1
WHERE NOT EXISTS (SELECT 1 FROM sys_role WHERE role_code = 'ADMIN');

INSERT INTO sys_role (role_code, role_name, description, sort_order, status)
SELECT 'USER', 'User', 'Default application user', 20, 1
WHERE NOT EXISTS (SELECT 1 FROM sys_role WHERE role_code = 'USER');

INSERT INTO api_rule (name, pattern, methods, group_policy, allowed_group_ids, priority, enabled)
SELECT 'Auth current user', '/auth/me', 'GET', 'ANY', NULL, 100, 1
WHERE NOT EXISTS (SELECT 1 FROM api_rule WHERE pattern = '/auth/me' AND methods = 'GET');

INSERT INTO api_rule (name, pattern, methods, group_policy, allowed_group_ids, priority, enabled)
SELECT 'User self profile', '/users/me', 'GET', 'ANY', NULL, 100, 1
WHERE NOT EXISTS (SELECT 1 FROM api_rule WHERE pattern = '/users/me' AND methods = 'GET');

INSERT INTO api_rule (name, pattern, methods, group_policy, allowed_group_ids, priority, enabled)
SELECT 'User self update', '/users/me/profile', 'PUT', 'ANY', NULL, 100, 1
WHERE NOT EXISTS (SELECT 1 FROM api_rule WHERE pattern = '/users/me/profile' AND methods = 'PUT');

INSERT INTO api_rule (name, pattern, methods, group_policy, allowed_group_ids, priority, enabled)
SELECT 'User self password', '/users/me/password', 'PUT', 'ANY', NULL, 100, 1
WHERE NOT EXISTS (SELECT 1 FROM api_rule WHERE pattern = '/users/me/password' AND methods = 'PUT');

INSERT INTO api_rule (name, pattern, methods, group_policy, allowed_group_ids, priority, enabled)
SELECT 'User self bind phone code', '/users/me/phone/bind-code/send', 'POST', 'ANY', NULL, 100, 1
WHERE NOT EXISTS (SELECT 1 FROM api_rule WHERE pattern = '/users/me/phone/bind-code/send' AND methods = 'POST');

INSERT INTO api_rule (name, pattern, methods, group_policy, allowed_group_ids, priority, enabled)
SELECT 'User self bind phone', '/users/me/phone/bind', 'PUT', 'ANY', NULL, 100, 1
WHERE NOT EXISTS (SELECT 1 FROM api_rule WHERE pattern = '/users/me/phone/bind' AND methods = 'PUT');

INSERT INTO api_rule (name, pattern, methods, group_policy, allowed_group_ids, priority, enabled)
SELECT 'User self reset phone code', '/users/me/phone/reset-code/send', 'POST', 'ANY', NULL, 100, 1
WHERE NOT EXISTS (SELECT 1 FROM api_rule WHERE pattern = '/users/me/phone/reset-code/send' AND methods = 'POST');

INSERT INTO api_rule (name, pattern, methods, group_policy, allowed_group_ids, priority, enabled)
SELECT 'User self reset phone', '/users/me/phone/reset', 'PUT', 'ANY', NULL, 100, 1
WHERE NOT EXISTS (SELECT 1 FROM api_rule WHERE pattern = '/users/me/phone/reset' AND methods = 'PUT');

INSERT INTO api_rule (name, pattern, methods, group_policy, allowed_group_ids, priority, enabled)
SELECT 'User management', '/users/query', 'POST', 'ALLOWLIST', 'ROOT', 200, 1
WHERE NOT EXISTS (SELECT 1 FROM api_rule WHERE pattern = '/users/query' AND methods = 'POST');

INSERT INTO api_rule (name, pattern, methods, group_policy, allowed_group_ids, priority, enabled)
SELECT 'User create', '/users', 'POST', 'ALLOWLIST', 'ROOT', 200, 1
WHERE NOT EXISTS (SELECT 1 FROM api_rule WHERE pattern = '/users' AND methods = 'POST');

INSERT INTO api_rule (name, pattern, methods, group_policy, allowed_group_ids, priority, enabled)
SELECT 'User detail', '/users/{uid}', 'GET', 'ALLOWLIST', 'ROOT', 200, 1
WHERE NOT EXISTS (SELECT 1 FROM api_rule WHERE pattern = '/users/{uid}' AND methods = 'GET');

INSERT INTO api_rule (name, pattern, methods, group_policy, allowed_group_ids, priority, enabled)
SELECT 'User update', '/users/{uid}', 'PUT', 'ALLOWLIST', 'ROOT', 200, 1
WHERE NOT EXISTS (SELECT 1 FROM api_rule WHERE pattern = '/users/{uid}' AND methods = 'PUT');

INSERT INTO api_rule (name, pattern, methods, group_policy, allowed_group_ids, priority, enabled)
SELECT 'User password reset', '/users/{uid}/password', 'PUT', 'ALLOWLIST', 'ROOT', 200, 1
WHERE NOT EXISTS (SELECT 1 FROM api_rule WHERE pattern = '/users/{uid}/password' AND methods = 'PUT');

INSERT INTO api_rule (name, pattern, methods, group_policy, allowed_group_ids, priority, enabled)
SELECT 'User status update', '/users/{uid}/status', 'PATCH', 'ALLOWLIST', 'ROOT', 200, 1
WHERE NOT EXISTS (SELECT 1 FROM api_rule WHERE pattern = '/users/{uid}/status' AND methods = 'PATCH');

INSERT INTO api_rule (name, pattern, methods, group_policy, allowed_group_ids, priority, enabled)
SELECT 'User delete', '/users/{uid}', 'DELETE', 'ALLOWLIST', 'ROOT', 200, 1
WHERE NOT EXISTS (SELECT 1 FROM api_rule WHERE pattern = '/users/{uid}' AND methods = 'DELETE');

INSERT INTO api_rule (name, pattern, methods, group_policy, allowed_group_ids, priority, enabled)
SELECT 'Group management', '/groups/**', NULL, 'ALLOWLIST', 'ROOT', 200, 1
WHERE NOT EXISTS (SELECT 1 FROM api_rule WHERE pattern = '/groups/**');

INSERT INTO api_rule (name, pattern, methods, group_policy, allowed_group_ids, priority, enabled)
SELECT 'Role management', '/roles/**', NULL, 'ALLOWLIST', 'ROOT', 200, 1
WHERE NOT EXISTS (SELECT 1 FROM api_rule WHERE pattern = '/roles/**');

INSERT INTO api_rule (name, pattern, methods, group_policy, allowed_group_ids, priority, enabled)
SELECT 'Aliyun sms management', '/aliyun/sms/**', NULL, 'ALLOWLIST', 'ROOT', 200, 1
WHERE NOT EXISTS (SELECT 1 FROM api_rule WHERE pattern = '/aliyun/sms/**');

INSERT INTO api_rule (name, pattern, methods, group_policy, allowed_group_ids, priority, enabled)
SELECT 'AI management', '/ai/**', NULL, 'ALLOWLIST', 'ROOT', 200, 1
WHERE NOT EXISTS (SELECT 1 FROM api_rule WHERE pattern = '/ai/**');

INSERT INTO api_rule (name, pattern, methods, group_policy, allowed_group_ids, priority, enabled)
SELECT 'API rule management', '/security/api-rules/**', NULL, 'ALLOWLIST', 'ROOT', 200, 1
WHERE NOT EXISTS (SELECT 1 FROM api_rule WHERE pattern = '/security/api-rules/**');
