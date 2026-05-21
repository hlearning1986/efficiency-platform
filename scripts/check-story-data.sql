-- 详细检查需求数据
SELECT 
  id,
  name,
  workspace_name,
  workspace_id,
  created,
  completed,
  owner,
  creator,
  custom_field_10 as cf10_按时提测,
  custom_field_11 as cf11_成本归属,
  custom_field_13 as cf13_项目归属,
  custom_field_six as cf6_是否插入,
  iteration_name,
  effort,
  effort_completed,
  synced_at
FROM tapd_story 
LIMIT 3;
