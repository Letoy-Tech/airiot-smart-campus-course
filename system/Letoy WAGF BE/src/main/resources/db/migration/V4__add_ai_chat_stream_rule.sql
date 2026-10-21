INSERT INTO api_rule (name, pattern, methods, group_policy, allowed_group_ids, priority, enabled)
SELECT 'AI chat stream', '/ai/chat/stream', 'POST', 'ALLOWLIST', 'ROOT,PLATFORM,OPERATIONS,BUSINESS,AUDIT', 210, 1
WHERE NOT EXISTS (SELECT 1 FROM api_rule WHERE pattern = '/ai/chat/stream' AND methods = 'POST');
