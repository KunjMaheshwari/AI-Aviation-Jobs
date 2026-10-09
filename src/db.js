const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const runtimeEnvironment = process.env.NODE_ENV || 'development';
if (!['development', 'test'].includes(runtimeEnvironment) && !process.env.DATABASE_PATH) {
  throw new Error('DATABASE_PATH must be configured in production.');
}
const defaultPath = process.env.NODE_ENV === 'test' ? 'data/test.sqlite' : 'data/app.sqlite';
const databasePath = process.env.DATABASE_PATH || defaultPath;
fs.mkdirSync(path.dirname(path.resolve(databasePath)), { recursive: true });

const db = new Database(databasePath);
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
const migrationDirectory = path.join(__dirname, '..', 'migrations');
const appliedMigrations = db.prepare('SELECT name FROM schema_migrations').all().map(row => row.name);
for (const name of fs.readdirSync(migrationDirectory).filter(file => file.endsWith('.sql')).sort()) {
  if (appliedMigrations.includes(name)) continue;
  const migration = fs.readFileSync(path.join(migrationDirectory, name), 'utf8');
  db.transaction(() => {
    db.exec(migration);
    db.prepare('INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)')
      .run(name, new Date().toISOString());
  })();
}

function close() {
  if (db.open) db.close();
}

module.exports = { db, databasePath, close };
