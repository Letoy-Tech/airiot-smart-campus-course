INSERT INTO api_rule (name, pattern, methods, group_policy, allowed_group_ids, priority, enabled)
SELECT 'Dashboard overview', '/dashboard/overview', 'GET', 'ALLOWLIST', 'ROOT,PLATFORM,OPERATIONS,AUDIT', 220, 1
WHERE NOT EXISTS (SELECT 1 FROM api_rule WHERE pattern = '/dashboard/overview' AND methods = 'GET');

INSERT INTO api_rule (name, pattern, methods, group_policy, allowed_group_ids, priority, enabled)
SELECT 'Dashboard trends', '/dashboard/trends', 'GET', 'ALLOWLIST', 'ROOT,PLATFORM,OPERATIONS,AUDIT', 220, 1
WHERE NOT EXISTS (SELECT 1 FROM api_rule WHERE pattern = '/dashboard/trends' AND methods = 'GET');

INSERT INTO api_rule (name, pattern, methods, group_policy, allowed_group_ids, priority, enabled)
SELECT 'Dashboard distribution', '/dashboard/distribution', 'GET', 'ALLOWLIST', 'ROOT,PLATFORM,OPERATIONS,AUDIT', 220, 1
WHERE NOT EXISTS (SELECT 1 FROM api_rule WHERE pattern = '/dashboard/distribution' AND methods = 'GET');

INSERT INTO api_rule (name, pattern, methods, group_policy, allowed_group_ids, priority, enabled)
SELECT 'Dashboard health', '/dashboard/health', 'GET', 'ALLOWLIST', 'ROOT,PLATFORM,OPERATIONS,AUDIT', 220, 1
WHERE NOT EXISTS (SELECT 1 FROM api_rule WHERE pattern = '/dashboard/health' AND methods = 'GET');
