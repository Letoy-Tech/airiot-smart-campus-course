INSERT INTO api_rule (name, pattern, methods, group_policy, allowed_group_ids, priority, enabled)
SELECT 'User groups', '/users/{uid}/groups', 'GET', 'ALLOWLIST', 'ROOT,PLATFORM,OPERATIONS,AUDIT', 220, 1
WHERE NOT EXISTS (SELECT 1 FROM api_rule WHERE pattern = '/users/{uid}/groups' AND methods = 'GET');
