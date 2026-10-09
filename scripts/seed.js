process.env.NODE_ENV = 'development';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { db, close } = require('../src/db');

if (!process.env.SEED_PASSWORD || process.env.SEED_PASSWORD.length < 12) {
  throw new Error('SEED_PASSWORD must be provided and contain at least 12 characters.');
}
const passwordHash = bcrypt.hashSync(process.env.SEED_PASSWORD, 12);
const seed = db.transaction(() => {
  db.exec('DELETE FROM sessions; DELETE FROM applications; DELETE FROM jobs; DELETE FROM users;');
  const addUser = db.prepare(`INSERT INTO users
    (id, role, email, password_hash, first_name, last_name, company, skills_json, experience)
    VALUES (?, ?, ?, ?, ?, ?, ?, '[]', 0)`);
  addUser.run('USR-DEV-CANDIDATE', 'candidate', 'candidate@local.invalid', passwordHash, 'Local', 'Candidate', null);
  addUser.run('USR-DEV-EMPLOYER', 'employer', 'employer@local.invalid', passwordHash, 'Local', 'Employer', 'Local Aviation');
  const addJob = db.prepare(`INSERT INTO jobs
    (id, owner_id, title, company, location, type, experience, salary, skills_json, description, posted_days_ago)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`);
  addJob.run(`JOB-${crypto.randomUUID()}`, 'USR-DEV-EMPLOYER', 'Local Development Job', 'Local Aviation', 'Remote', 'Full-time', '1-3 years', 'Not specified', '[]', 'Development-only seed job.');
});
seed();
close();
console.log('Development seed data created.');
