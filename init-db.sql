-- 检查是否已存在用户
SELECT COUNT(*) FROM user_account WHERE email = 'admin@company.com';

-- 如果不存在，创建初始数据
INSERT OR IGNORE INTO organization (id, name, level, created_at, updated_at)
VALUES ('org-001', '研发中心', 'DEPARTMENT', datetime('now'), datetime('now'));

INSERT OR IGNORE INTO team (id, name, org_id, created_at, updated_at)
VALUES ('team-001', '平台研发组', 'org-001', datetime('now'), datetime('now'));

INSERT OR IGNORE INTO member (id, name, employee_no, team_id, role, level, status, created_at, updated_at)
VALUES ('member-001', '系统管理员', 'ADMIN001', 'team-001', 'MANAGER', 'P8', 'ACTIVE', datetime('now'), datetime('now'));

INSERT OR IGNORE INTO user_account (id, member_id, email, role, status, created_at, updated_at)
VALUES ('user-001', 'member-001', 'admin@company.com', 'ADMIN', 'ACTIVE', datetime('now'), datetime('now'));

SELECT 'Initialization complete' as result;
