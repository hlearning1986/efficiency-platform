-- 清理 TAPD 同步数据
-- 按依赖关系顺序删除（先删子表，再删父表）

-- 1. 删除工时记录
DELETE FROM tapd_timesheet;

-- 2. 删除缺陷
DELETE FROM tapd_bug;

-- 3. 删除任务
DELETE FROM tapd_task;

-- 4. 删除需求
DELETE FROM tapd_story;

-- 5. 删除迭代
DELETE FROM tapd_iteration;

-- 6. 删除同步记录
DELETE FROM tapd_sync_record;

-- 7. 删除工作空间
DELETE FROM tapd_workspace;
