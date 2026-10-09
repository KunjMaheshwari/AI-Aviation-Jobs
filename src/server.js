const express = require('express');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const { z } = require('zod');
const { db, close } = require('./db');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const SESSION_TTL_MS = SESSION_TTL_SECONDS * 1000;
const runtimeEnvironment = process.env.NODE_ENV || 'development';
const secureCookies = !['development', 'test'].includes(runtimeEnvironment);

app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '20kb' }));
app.use(express.static(path.join(__dirname, '..', 'public'), { etag: true }));
app.use(csrfProtection);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === 'test' ? 1000 : 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please try again later.' }
});

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
  role: z.enum(['candidate', 'employer'])
});
const registrationSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(128),
  role: z.literal('candidate').default('candidate')
});
const profileSchema = z.object({
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  phone: z.string().trim().max(30).optional(),
  location: z.string().trim().max(100).optional(),
  skills: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
  experience: z.number().finite().min(0).max(100).optional()
});
const jobSchema = z.object({
  title: z.string().trim().min(1).max(200),
  location: z.string().trim().min(1).max(100),
  type: z.string().trim().min(1).max(80),
  experience: z.string().trim().max(80).optional(),
  salary: z.string().trim().max(80).optional(),
  skills: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
  description: z.string().trim().min(1).max(5000)
}).strict();
const statusSchema = z.object({
  status: z.enum(['Applied', 'Under Review', 'Shortlisted', 'Rejected', 'Interview Scheduled'])
});

function parse(schema, value, res) {
  const result = schema.safeParse(value);
  if (!result.success) {
    res.status(400).json({ message: 'Invalid request data' });
    return null;
  }
  return result.data;
}

function hashToken(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sessionToken(req) {
  const header = req.get('authorization') || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  const cookie = req.get('cookie') || '';
  const match = cookie.split(';').map(value => value.trim()).find(value => value.startsWith('session='));
  return match ? decodeURIComponent(match.slice('session='.length)) : null;
}

function publicUser(user) {
  return {
    id: user.id,
    role: user.role,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    phone: user.phone,
    location: user.location,
    company: user.company,
    skills: JSON.parse(user.skills_json || '[]'),
    experience: user.experience
  };
}

function rowToJob(job) {
  return {
    id: job.id,
    ownerId: job.owner_id,
    title: job.title,
    company: job.company,
    location: job.location,
    type: job.type,
    experience: job.experience,
    salary: job.salary,
    skills: JSON.parse(job.skills_json || '[]'),
    description: job.description,
    postedDaysAgo: job.posted_days_ago
  };
}

function rowToApplication(application) {
  return {
    id: application.id,
    jobId: application.job_id,
    candidateId: application.candidate_id,
    status: application.status,
    appliedAt: application.applied_at
  };
}

function auth(req, res, next) {
  const token = sessionToken(req);
  if (!token) return res.status(401).json({ message: 'Authentication required' });
  const tokenHash = hashToken(token);
  const session = db.prepare('SELECT user_id, expires_at FROM sessions WHERE token_hash = ?').get(tokenHash);
  if (!session || session.expires_at <= Date.now()) {
    if (session) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
    return res.status(401).json({ message: 'Authentication required' });
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(session.user_id);
  if (!user) return res.status(401).json({ message: 'Authentication required' });
  req.user = user;
  req.tokenHash = tokenHash;
  next();
}

function csrfProtection(req, res, next) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) || req.get('authorization')) return next();
  const origin = req.get('origin');
  if (!origin) return next();
  const expectedOrigin = `${req.protocol}://${req.get('host')}`;
  if (origin !== expectedOrigin) return res.status(403).json({ message: 'Cross-origin request blocked' });
  next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role) return res.status(403).json({ message: `${role[0].toUpperCase()}${role.slice(1)} access required` });
    next();
  };
}

function seedTestData() {
  if (process.env.NODE_ENV !== 'test') return;
  const passwordHash = bcrypt.hashSync('Password@123', 10);
  const seed = db.transaction(() => {
    db.exec('DELETE FROM sessions; DELETE FROM applications; DELETE FROM jobs; DELETE FROM users;');
    const addUser = db.prepare(`INSERT INTO users
      (id, role, email, password_hash, first_name, last_name, phone, location, company, skills_json, experience)
      VALUES (@id, @role, @email, @passwordHash, @firstName, @lastName, @phone, @location, @company, @skills, @experience)`);
    addUser.run({ id: 'USR-1001', role: 'candidate', email: 'candidate@test.com', passwordHash, firstName: 'Aarav', lastName: 'Sharma', phone: '9876543210', location: 'Mumbai', company: null, skills: JSON.stringify(['JavaScript', 'Playwright', 'API Testing']), experience: 2 });
    addUser.run({ id: 'USR-2001', role: 'employer', email: 'employer@test.com', passwordHash, firstName: 'Riya', lastName: 'Mehta', phone: null, location: 'Bengaluru', company: 'SkyTech Aviation', skills: '[]', experience: 0 });
    addUser.run({ id: 'USR-2002', role: 'employer', email: 'other-employer@test.com', passwordHash, firstName: 'Kabir', lastName: 'Kapoor', phone: null, location: 'Delhi', company: 'Other Aviation', skills: '[]', experience: 0 });
    const addJob = db.prepare(`INSERT INTO jobs
      (id, owner_id, title, company, location, type, experience, salary, skills_json, description, posted_days_ago)
      VALUES (@id, @ownerId, @title, @company, @location, @type, @experience, @salary, @skills, @description, @postedDaysAgo)`);
    const jobs = [
      ['JOB-1001', 'USR-2001', 'Senior QA Automation Engineer', 'SkyTech Aviation', 'Bengaluru', 'Full-time', '3-6 years', '₹12-18 LPA', ['Playwright', 'JavaScript', 'API Testing'], 'Build reliable UI and API automation for aviation products.', 2],
      ['JOB-1002', 'USR-2001', 'Software Engineer - Aviation Platform', 'AeroNext Labs', 'Hyderabad', 'Full-time', '1-3 years', '₹8-14 LPA', ['JavaScript', 'React', 'Node.js'], 'Develop scalable features for an aviation recruitment platform.', 4],
      ['JOB-1003', 'USR-2001', 'QA Analyst', 'FlyHigh Systems', 'Pune', 'Full-time', '2-4 years', '₹7-11 LPA', ['Manual Testing', 'Jira', 'SQL'], 'Own functional, regression and exploratory testing for web modules.', 6],
      ['JOB-1004', 'USR-2001', 'SDET - AI Products', 'AeroMind AI', 'Remote', 'Full-time', '2-5 years', '₹10-16 LPA', ['Playwright', 'TypeScript', 'CI/CD'], 'Automate AI-powered workflows and quality gates.', 8]
    ];
    jobs.forEach(([id, ownerId, title, company, location, type, experience, salary, skills, description, postedDaysAgo]) => addJob.run({ id, ownerId, title, company, location, type, experience, salary, skills: JSON.stringify(skills), description, postedDaysAgo }));
    db.prepare(`INSERT INTO applications (id, job_id, candidate_id, status, applied_at)
      VALUES (?, ?, ?, ?, ?)`).run('APP-1001', 'JOB-1003', 'USR-1001', 'Under Review', '2026-09-20');
  });
  seed();
}

seedTestData();

app.get('/healthz', (req, res) => res.json({ status: 'ok' }));
app.get('/readyz', (req, res) => {
  try {
    db.prepare('SELECT 1').get();
    res.json({ status: 'ready' });
  } catch {
    res.status(503).json({ status: 'not_ready' });
  }
});

app.post('/api/auth/login', loginLimiter, (req, res) => {
  const input = parse(loginSchema, req.body, res);
  if (!input) return;
  const user = db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE AND role = ?').get(input.email, input.role);
  if (!user || !bcrypt.compareSync(input.password, user.password_hash)) {
    return res.status(401).json({ message: 'Invalid email, password, or role' });
  }
  const accessToken = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .run(hashToken(accessToken), user.id, Date.now() + SESSION_TTL_MS);
  res.setHeader('Set-Cookie', `session=${encodeURIComponent(accessToken)}; Max-Age=${SESSION_TTL_SECONDS}; Path=/; HttpOnly; SameSite=Lax${secureCookies ? '; Secure' : ''}`);
  res.json({ user: publicUser(user) });
});

app.post('/api/auth/logout', auth, (req, res) => {
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(req.tokenHash);
  res.setHeader('Set-Cookie', `session=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax${secureCookies ? '; Secure' : ''}`);
  res.status(204).end();
});

app.post('/api/auth/register', (req, res) => {
  const input = parse(registrationSchema, req.body, res);
  if (!input) return;
  if (db.prepare('SELECT 1 FROM users WHERE email = ? COLLATE NOCASE').get(input.email)) {
    return res.status(409).json({ message: 'Email already registered' });
  }
  const user = {
    id: `USR-${crypto.randomUUID()}`,
    role: 'candidate',
    email: input.email,
    passwordHash: bcrypt.hashSync(input.password, 12),
    firstName: input.firstName,
    lastName: input.lastName
  };
  db.prepare(`INSERT INTO users
    (id, role, email, password_hash, first_name, last_name, skills_json, experience)
    VALUES (?, ?, ?, ?, ?, ?, '[]', 0)`)
    .run(user.id, user.role, user.email, user.passwordHash, user.firstName, user.lastName);
  res.status(201).json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(user.id)) });
});

app.get('/api/jobs', (req, res) => {
  const querySchema = z.object({ keyword: z.string().max(100).default(''), location: z.string().max(100).default(''), type: z.string().max(80).default('') }).strict();
  const input = parse(querySchema, req.query, res);
  if (!input) return;
  const keyword = input.keyword.toLowerCase();
  const jobs = db.prepare('SELECT * FROM jobs ORDER BY rowid DESC').all()
    .map(rowToJob)
    .filter(job => (!keyword || `${job.title} ${job.company} ${job.skills.join(' ')}`.toLowerCase().includes(keyword)) &&
      (!input.location || job.location.toLowerCase() === input.location.toLowerCase()) &&
      (!input.type || job.type === input.type));
  res.json({ jobs, total: jobs.length });
});

app.get('/api/jobs/:id', (req, res) => {
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id);
  if (!job) return res.status(404).json({ message: 'Job not found' });
  res.json(rowToJob(job));
});

app.post('/api/jobs', auth, requireRole('employer'), (req, res) => {
  const input = parse(jobSchema, req.body, res);
  if (!input) return;
  const id = `JOB-${crypto.randomUUID()}`;
  db.prepare(`INSERT INTO jobs
    (id, owner_id, title, company, location, type, experience, salary, skills_json, description, posted_days_ago)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`)
    .run(id, req.user.id, input.title, req.user.company, input.location, input.type, input.experience || 'Not specified', input.salary || 'Not specified', JSON.stringify(input.skills || []), input.description);
  res.status(201).json(rowToJob(db.prepare('SELECT * FROM jobs WHERE id = ?').get(id)));
});

app.put('/api/profile', auth, requireRole('candidate'), (req, res) => {
  const input = parse(profileSchema, req.body, res);
  if (!input) return;
  const columns = { firstName: 'first_name', lastName: 'last_name', phone: 'phone', location: 'location', experience: 'experience' };
  const updates = [];
  const values = [];
  for (const [key, column] of Object.entries(columns)) {
    if (input[key] !== undefined) {
      updates.push(`${column} = ?`);
      values.push(input[key]);
    }
  }
  if (input.skills !== undefined) {
    updates.push('skills_json = ?');
    values.push(JSON.stringify(input.skills));
  }
  if (updates.length) {
    values.push(req.user.id);
    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  }
  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)) });
});

app.get('/api/profile', auth, requireRole('candidate'), (req, res) => {
  res.json({ user: publicUser(req.user) });
});

app.post('/api/jobs/:id/apply', auth, requireRole('candidate'), (req, res) => {
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id);
  if (!job) return res.status(404).json({ message: 'Job not found' });
  if (db.prepare('SELECT 1 FROM applications WHERE job_id = ? AND candidate_id = ?').get(job.id, req.user.id)) {
    return res.status(409).json({ message: 'You have already applied for this job' });
  }
  const application = { id: `APP-${crypto.randomUUID()}`, jobId: job.id, candidateId: req.user.id, status: 'Applied', appliedAt: new Date().toISOString().slice(0, 10) };
  db.prepare('INSERT INTO applications (id, job_id, candidate_id, status, applied_at) VALUES (?, ?, ?, ?, ?)')
    .run(application.id, application.jobId, application.candidateId, application.status, application.appliedAt);
  res.status(201).json({ application });
});

app.get('/api/applications/me', auth, requireRole('candidate'), (req, res) => {
  const applications = db.prepare(`SELECT a.*, j.id AS job_id_value, j.owner_id, j.title, j.company, j.location,
    j.type, j.experience, j.salary, j.skills_json, j.description, j.posted_days_ago
    FROM applications a JOIN jobs j ON j.id = a.job_id WHERE a.candidate_id = ?`).all(req.user.id);
  res.json({ applications: applications.map(a => ({ ...rowToApplication(a), job: rowToJob({ id: a.job_id_value, owner_id: a.owner_id, title: a.title, company: a.company, location: a.location, type: a.type, experience: a.experience, salary: a.salary, skills_json: a.skills_json, description: a.description, posted_days_ago: a.posted_days_ago }) })) });
});

app.get('/api/employer/applications', auth, requireRole('employer'), (req, res) => {
  const applications = db.prepare(`SELECT a.*, u.first_name, u.last_name, u.email,
    j.id AS job_id_value, j.owner_id, j.title, j.company, j.location, j.type, j.experience,
    j.salary, j.skills_json, j.description, j.posted_days_ago
    FROM applications a JOIN jobs j ON j.id = a.job_id
    JOIN users u ON u.id = a.candidate_id
    WHERE j.owner_id = ?`).all(req.user.id);
  res.json({
    applications: applications.map(a => ({
      ...rowToApplication(a),
      candidate: { firstName: a.first_name, lastName: a.last_name, email: a.email },
      job: rowToJob({ id: a.job_id_value, owner_id: a.owner_id, title: a.title, company: a.company, location: a.location, type: a.type, experience: a.experience, salary: a.salary, skills_json: a.skills_json, description: a.description, posted_days_ago: a.posted_days_ago })
    }))
  });
});

app.patch('/api/applications/:id/status', auth, requireRole('employer'), (req, res) => {
  const input = parse(statusSchema, req.body, res);
  if (!input) return;
  const application = db.prepare(`SELECT a.* FROM applications a JOIN jobs j ON j.id = a.job_id
    WHERE a.id = ? AND j.owner_id = ?`).get(req.params.id, req.user.id);
  if (!application) return res.status(404).json({ message: 'Application not found' });
  db.prepare('UPDATE applications SET status = ? WHERE id = ?').run(input.status, application.id);
  res.json({ application: rowToApplication({ ...application, status: input.status }) });
});

if (process.env.NODE_ENV === 'test') {
  app.post('/api/test/reset', (req, res) => {
    seedTestData();
    res.status(204).end();
  });
}

app.get('/{*splat}', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

const server = app.listen(PORT, () => console.log(`AI Aviation Jobs running at http://localhost:${PORT}`));
function shutdown() {
  server.close(() => {
    close();
    process.exit(0);
  });
}
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);

module.exports = { app, server };
