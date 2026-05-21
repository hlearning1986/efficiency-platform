-- 验证 TAPD 数据清理结果
SELECT 'tapd_timesheet' as table_name, COUNT(*) as count FROM tapd_timesheet
UNION ALL
SELECT 'tapd_bug', COUNT(*) FROM tapd_bug
UNION ALL
SELECT 'tapd_task', COUNT(*) FROM tapd_task
UNION ALL
SELECT 'tapd_story', COUNT(*) FROM tapd_story
UNION ALL
SELECT 'tapd_iteration', COUNT(*) FROM tapd_iteration
UNION ALL
SELECT 'tapd_sync_record', COUNT(*) FROM tapd_sync_record
UNION ALL
SELECT 'tapd_workspace', COUNT(*) FROM tapd_workspace;
