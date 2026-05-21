const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('prisma/dev.db');

db.serialize(() => {
  console.log('Checking for existing admin user...');
  
  db.get("SELECT COUNT(*) as count FROM user_account WHERE email = 'admin@company.com'", (err, row) => {
    if (err) {
      console.error('Error checking user:', err);
      db.close();
      return;
    }
    
    if (row && row.count > 0) {
      console.log('Admin user already exists');
      db.close();
      return;
    }

    console.log('Creating initial data...');
    
    db.run("INSERT OR IGNORE INTO organization (id, name, level, created_at, updated_at) VALUES ('org-001', '研发中心', 'DEPARTMENT', datetime('now'), datetime('now'))");
    db.run("INSERT OR IGNORE INTO team (id, name, org_id, created_at) VALUES ('team-001', '平台研发组', 'org-001', datetime('now'))");
    db.run("INSERT OR IGNORE INTO member (id, name, employee_no, team_id, role, level, status, joined_at) VALUES ('member-001', '系统管理员', 'ADMIN001', 'team-001', 'MANAGER', 'P8', 'ACTIVE', datetime('now'))");
    db.run("INSERT OR IGNORE INTO user_account (id, member_id, email, role, status) VALUES ('user-001', 'member-001', 'admin@company.com', 'ADMIN', 'ACTIVE')");
    
    console.log('✅ Initialization complete!');
    console.log('Login credentials:');
    console.log('  Email: admin@company.com');
    console.log('  Password: initial_password');
    
    db.close();
  });
});