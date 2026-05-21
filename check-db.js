const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('prisma/dev.db');

db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
  if (err) {
    console.error('Error:', err);
    db.close();
    return;
  }
  
  console.log('Tables in database:');
  tables.forEach(table => {
    console.log(`- ${table.name}`);
    
    db.all(`PRAGMA table_info(${table.name})`, (err, columns) => {
      if (err) return;
      console.log('  Columns:');
      columns.forEach(col => {
        console.log(`    - ${col.name} (${col.type})`);
      });
    });
  });
  
  setTimeout(() => db.close(), 1000);
});