const express = require('express');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

const users = [
  {
    id: 'USR-1001', role: 'candidate', email: 'candidate@test.com', password: 'Password@123',
    firstName: 'Aarav', lastName: 'Sharma', phone: '9876543210', location: 'Mumbai',
    skills: ['JavaScript', 'Playwright', 'API Testing'], experience: 2,
    resume: 'aarav-sharma-resume.pdf'
  },
  {
    id: 'USR-2001', role: 'employer', email: 'employer@test.com', password: 'Password@123',
    company: 'SkyTech Aviation', firstName: 'Riya', lastName: 'Mehta', location: 'Bengaluru'
  },
  {
    id: 'USR-2002', role: 'employer', email: 'other-employer@test.com', password: 'Password@123',
    company: 'Other Aviation', firstName: 'Kabir', lastName: 'Kapoor', location: 'Delhi'
  }
];

const jobs = [
  { id: 'JOB-1001', ownerId: 'USR-2001', title: 'Senior QA Automation Engineer', company: 'SkyTech Aviation', location: 'Bengaluru', type: 'Full-time', experience: '3-6 years', salary: '₹12-18 LPA', skills: ['Playwright', 'JavaScript', 'API Testing'], description: 'Build reliable UI and API automation for aviation products.', postedDaysAgo: 2 },
  { id: 'JOB-1002', ownerId: 'USR-2001', title: 'Software Engineer - Aviation Platform', company: 'AeroNext Labs', location: 'Hyderabad', type: 'Full-time', experience: '1-3 years', salary: '₹8-14 LPA', skills: ['JavaScript', 'React', 'Node.js'], description: 'Develop scalable features for an aviation recruitment platform.', postedDaysAgo: 4 },
  { id: 'JOB-1003', ownerId: 'USR-2001', title: 'QA Analyst', company: 'FlyHigh Systems', location: 'Pune', type: 'Full-time', experience: '2-4 years', salary: '₹7-11 LPA', skills: ['Manual Testing', 'Jira', 'SQL'], description: 'Own functional, regression and exploratory testing for web modules.', postedDaysAgo: 6 },
  { id: 'JOB-1004', ownerId: 'USR-2001', title: 'SDET - AI Products', company: 'AeroMind AI', location: 'Remote', type: 'Full-time', experience: '2-5 years', salary: '₹10-16 LPA', skills: ['Playwright', 'TypeScript', 'CI/CD'], description: 'Automate AI-powered workflows and quality gates.', postedDaysAgo: 8 }
];

const applications = [
  { id: 'APP-1001', jobId: 'JOB-1003', candidateId: 'USR-1001', status: 'Under Review', appliedAt: '2026-09-20' }
];
const initialData = {
  users: structuredClone(users),
  jobs: structuredClone(jobs),
  applications: structuredClone(applications)
};

const sessions = new Map();

function token() { return crypto.randomBytes(18).toString('hex'); }
function auth(req, res, next) {
  const bearer = req.headers.authorization || '';
  const session = sessions.get(bearer.replace('Bearer ', ''));
  if (!session) return res.status(401).json({ message: 'Authentication required' });
  req.user = users.find(u => u.id === session.userId);
  if (!req.user) return res.status(401).json({ message: 'Authentication required' });
  next();
}
function publicUser(user) {
  const { password, ...safe } = user;
  return safe;
}

app.post('/api/auth/login', (req, res) => {
  const { email, password, role } = req.body;
  const user = users.find(u => u.email === email && u.password === password && u.role === role);
  if (!user) return res.status(401).json({ message: 'Invalid email, password, or role' });
  const accessToken = token();
  sessions.set(accessToken, { userId: user.id });
  res.json({ accessToken, user: publicUser(user) });
});

app.post('/api/auth/register', (req, res) => {
  const { firstName, lastName, email, password, role = 'candidate' } = req.body;
  if (!firstName || !lastName || !email || !password) return res.status(400).json({ message: 'All required fields must be provided' });
  if (role !== 'candidate') return res.status(400).json({ message: 'Only candidate registration is supported' });
  if (users.some(u => u.email === email)) return res.status(409).json({ message: 'Email already registered' });
  const user = { id: `USR-${Date.now()}`, role, email, password, firstName, lastName, skills: [], experience: 0 };
  users.push(user);
  res.status(201).json({ user: publicUser(user) });
});

app.get('/api/jobs', (req, res) => {
  const { keyword = '', location = '', type = '' } = req.query;
  const q = keyword.toLowerCase();
  const result = jobs.filter(job =>
    (!q || `${job.title} ${job.company} ${job.skills.join(' ')}`.toLowerCase().includes(q)) &&
    (!location || job.location.toLowerCase() === location.toLowerCase()) &&
    (!type || job.type === type)
  );
  res.json({ jobs: result, total: result.length });
});

app.get('/api/jobs/:id', (req, res) => {
  const job = jobs.find(j => j.id === req.params.id);
  if (!job) return res.status(404).json({ message: 'Job not found' });
  res.json(job);
});

app.post('/api/jobs', auth, (req, res) => {
  if (req.user.role !== 'employer') return res.status(403).json({ message: 'Employer access required' });
  const { title, location, type, experience, salary, skills, description } = req.body;
  if (!title || !location || !type || !description) return res.status(400).json({ message: 'Title, location, type and description are required' });
  const job = { id: `JOB-${Date.now()}`, ownerId: req.user.id, title, company: req.user.company, location, type, experience: experience || 'Not specified', salary: salary || 'Not specified', skills: Array.isArray(skills) ? skills : [], description, postedDaysAgo: 0 };
  jobs.unshift(job);
  res.status(201).json(job);
});

app.put('/api/profile', auth, (req, res) => {
  const { firstName, lastName, phone, location, skills, experience } = req.body;
  if (experience !== undefined && (!Number.isFinite(experience) || experience < 0)) {
    return res.status(400).json({ message: 'Experience must be a non-negative number' });
  }
  if (skills !== undefined && (!Array.isArray(skills) || skills.some(skill => typeof skill !== 'string'))) {
    return res.status(400).json({ message: 'Skills must be an array of strings' });
  }
  const updates = { firstName, lastName, phone, location, skills, experience };
  Object.keys(updates).forEach(key => updates[key] === undefined && delete updates[key]);
  Object.assign(req.user, updates);
  res.json({ user: publicUser(req.user) });
});

app.get('/api/profile', auth, (req, res) => res.json({ user: publicUser(req.user) }));

app.post('/api/jobs/:id/apply', auth, (req, res) => {
  if (req.user.role !== 'candidate') return res.status(403).json({ message: 'Candidate access required' });
  const job = jobs.find(j => j.id === req.params.id);
  if (!job) return res.status(404).json({ message: 'Job not found' });
  if (applications.some(a => a.jobId === job.id && a.candidateId === req.user.id)) return res.status(409).json({ message: 'You have already applied for this job' });
  const application = { id: `APP-${Date.now()}`, jobId: job.id, candidateId: req.user.id, status: 'Applied', appliedAt: new Date().toISOString().slice(0, 10) };
  applications.push(application);
  res.status(201).json({ application });
});

app.get('/api/applications/me', auth, (req, res) => {
  const mine = applications.filter(a => a.candidateId === req.user.id).map(a => ({ ...a, job: jobs.find(j => j.id === a.jobId) }));
  res.json({ applications: mine });
});

app.get('/api/employer/applications', auth, (req, res) => {
  if (req.user.role !== 'employer') return res.status(403).json({ message: 'Employer access required' });
  const mine = applications
    .map(a => ({ application: a, job: jobs.find(j => j.id === a.jobId) }))
    .filter(({ job }) => job && job.ownerId === req.user.id)
    .map(({ application: a, job }) => ({ ...a, candidate: publicUser(users.find(u => u.id === a.candidateId)), job }));
  res.json({ applications: mine });
});

app.patch('/api/applications/:id/status', auth, (req, res) => {
  if (req.user.role !== 'employer') return res.status(403).json({ message: 'Employer access required' });
  const appItem = applications.find(a => a.id === req.params.id);
  if (!appItem) return res.status(404).json({ message: 'Application not found' });
  const job = jobs.find(j => j.id === appItem.jobId);
  if (!job || job.ownerId !== req.user.id) return res.status(404).json({ message: 'Application not found' });
  const allowed = ['Applied', 'Under Review', 'Shortlisted', 'Rejected', 'Interview Scheduled'];
  if (!allowed.includes(req.body.status)) return res.status(400).json({ message: 'Invalid application status' });
  appItem.status = req.body.status;
  res.json({ application: appItem });
});

if (process.env.NODE_ENV === 'test') {
  app.post('/api/test/reset', (req, res) => {
    users.splice(0, users.length, ...structuredClone(initialData.users));
    jobs.splice(0, jobs.length, ...structuredClone(initialData.jobs));
    applications.splice(0, applications.length, ...structuredClone(initialData.applications));
    sessions.clear();
    res.status(204).end();
  });
}

app.get('/{*splat}', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

app.listen(PORT, () => console.log(`AI Aviation Jobs running at http://localhost:${PORT}`));
