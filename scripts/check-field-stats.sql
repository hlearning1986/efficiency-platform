-- 查看数据库中的实际数据
SELECT 
  COUNT(*) as total_count,
  SUM(CASE WHEN workspace_name IS NOT NULL AND workspace_name != '' THEN 1 ELSE 0 END) as has_workspace_name,
  SUM(CASE WHEN created IS NOT NULL THEN 1 ELSE 0 END) as has_created,
  SUM(CASE WHEN completed IS NOT NULL THEN 1 ELSE 0 END) as has_completed,
  SUM(CASE WHEN custom_field_10 IS NOT NULL AND custom_field_10 != '' THEN 1 ELSE 0 END) as has_cf10,
  SUM(CASE WHEN custom_field_11 IS NOT NULL AND custom_field_11 != '' THEN 1 ELSE 0 END) as has_cf11,
  SUM(CASE WHEN custom_field_13 IS NOT NULL AND custom_field_13 != '' THEN 1 ELSE 0 END) as has_cf13
FROM tapd_story;
