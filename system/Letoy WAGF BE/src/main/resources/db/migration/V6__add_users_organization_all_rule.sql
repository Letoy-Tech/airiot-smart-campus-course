INSERT INTO api_rule (name, pattern, methods, group_policy, allowed_group_ids, priority, enabled)
SELECT 'User organization all', '/users/organization/all', 'GET', 'ALLOWLIST', 'ROOT,PLATFORM,OPERATIONS,AUDIT', 220, 1
WHERE NOT EXISTS (SELECT 1 FROM api_rule WHERE pattern = '/users/organization/all' AND methods = 'GET');
