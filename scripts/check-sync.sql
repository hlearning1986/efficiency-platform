-- 查看最新同步记录
SELECT 
  id,
  status,
  progress,
  story_count,
  error_msg,
  started_at,
  finished_at
FROM tapd_sync_record 
ORDER BY started_at DESC 
LIMIT 5;
