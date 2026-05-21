-- 调试 TAPD 数据
SELECT 
  id,
  name,
  workspace_name,
  created,
  completed,
  custom_field_10 as customField10,
  custom_field_11 as customField11,
  custom_field_13 as customField13
FROM tapd_story 
ORDER BY synced_at DESC 
LIMIT 5;
