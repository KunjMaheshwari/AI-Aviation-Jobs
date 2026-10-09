const app = document.querySelector('#app');
const logoutBtn = document.querySelector('#logoutBtn');
const toast = document.querySelector('#toast');
const state = { token: localStorage.getItem('authenticated') ? 'cookie' : null, user: JSON.parse(localStorage.getItem('user') || 'null') };

function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (state.token && state.token !== 'cookie') headers.Authorization = `Bearer ${state.token}`;
  return fetch(path, { ...options, headers, credentials: 'same-origin' }).then(async r => {
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.message || 'Request failed');
    return data;
  });
}
function showToast(message) { toast.textContent = message; toast.style.display = 'block'; setTimeout(() => toast.style.display = 'none', 2500); }
function esc(v = '') { return String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function setSession(data) { state.token = 'cookie'; state.user = data.user; localStorage.setItem('authenticated', '1'); localStorage.setItem('user', JSON.stringify(state.user)); updateNav(); }
function updateNav() { logoutBtn.classList.toggle('hidden', !state.token); }
logoutBtn.onclick = async () => {
  try {
    if (state.token) await api('/api/auth/logout', { method: 'POST' });
  } finally {
    localStorage.removeItem('authenticated');
    localStorage.removeItem('user');
    state.token = null;
    state.user = null;
    updateNav();
    location.hash = '#/login';
  }
};

async function renderJobs() {
  if (location.hash !== '#/jobs') return;
  app.innerHTML = `<section class="hero"><h1>Build your career in aviation.</h1><p>Find opportunities across aviation, AI, engineering and quality.</p>
  <form id="searchForm" class="searchbar"><label for="keyword">Keyword</label><input id="keyword" placeholder="Job title, skill or company"/><label for="location">Location</label><select id="location"><option value="">All locations</option><option>Remote</option><option>Bengaluru</option><option>Hyderabad</option><option>Pune</option></select><label for="type">Type</label><select id="type"><option value="">All types</option><option>Full-time</option></select><button>Search</button></form></section><div id="jobList"></div>`;
  const searchForm = document.querySelector('#searchForm');
  const keyword = document.querySelector('#keyword');
  const jobLocation = document.querySelector('#location');
  const jobType = document.querySelector('#type');
  const jobList = document.querySelector('#jobList');
  async function load() {
    const params = new URLSearchParams({ keyword: keyword.value, location: jobLocation.value, type: jobType.value });
    const data = await api(`/api/jobs?${params}`);
    if (location.hash !== '#/jobs') return;
    jobList.innerHTML = data.jobs.length ? data.jobs.map(j => `<article class="card job-card"><div><h3>${esc(j.title)}</h3><div class="meta">${esc(j.company)} · ${esc(j.location)} · ${esc(j.type)}</div><div>${j.skills.map(s => `<span class="tag">${esc(s)}</span>`).join('')}</div><p>${esc(j.description)}</p></div><a class="btn" href="#/jobs/${j.id}">View job</a></article>`).join('') : '<div class="empty">No jobs found.</div>';
  }
  searchForm.onsubmit = e => { e.preventDefault(); load(); };
  await load();
}

function renderLogin() {
  app.innerHTML = `<div class="card form"><h2>Sign in</h2><form id="loginForm"><div class="form-row"><label for="email">Email</label><input id="email" type="email" required/></div><div class="form-row"><label for="password">Password</label><input id="password" type="password" required/></div><div class="form-row"><label for="role">Role</label><select id="role"><option value="candidate">Candidate</option><option value="employer">Employer</option></select></div><div id="error"></div><button>Sign in</button></form></div>`;
  const loginForm = document.querySelector('#loginForm');
  const email = document.querySelector('#email');
  const password = document.querySelector('#password');
  const role = document.querySelector('#role');
  const error = document.querySelector('#error');
  loginForm.onsubmit = async e => { e.preventDefault(); error.innerHTML = ''; try { const data = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: email.value, password: password.value, role: role.value }) }); setSession(data); showToast('Login successful'); location.hash = role.value === 'employer' ? '#/employer' : '#/jobs'; } catch (e) { error.innerHTML = `<div class="alert">${esc(e.message)}</div>`; } };
}

async function renderJobDetail(id) {
  const j = await api(`/api/jobs/${id}`);
  if (location.hash !== `#/jobs/${id}`) return;
  app.innerHTML = `<div class="card"><h1>${esc(j.title)}</h1><div class="meta">${esc(j.company)} · ${esc(j.location)} · ${esc(j.type)} · ${esc(j.experience)}</div><p><strong>Salary:</strong> ${esc(j.salary)}</p><h3>Skills</h3><div>${j.skills.map(s => `<span class="tag">${esc(s)}</span>`).join('')}</div><h3>Description</h3><p>${esc(j.description)}</p><div id="applyArea">${state.user?.role === 'candidate' ? '<button id="applyBtn">Apply now</button>' : '<a class="btn secondary" href="#/login">Login as candidate to apply</a>'}</div><div id="msg"></div></div>`;
  const applyBtn = document.querySelector('#applyBtn');
  const msg = document.querySelector('#msg');
  if (applyBtn) applyBtn.onclick = async () => { try { await api(`/api/jobs/${id}/apply`, { method: 'POST', body: '{}' }); msg.innerHTML = '<div class="alert success">Application submitted successfully.</div>'; applyBtn.disabled = true; } catch (e) { msg.innerHTML = `<div class="alert">${esc(e.message)}</div>`; } };
}

async function renderApplications() {
  if (!state.token) return location.hash = '#/login';
  const data = await api('/api/applications/me');
  app.innerHTML = `<h1>My Applications</h1>${data.applications.length ? data.applications.map(a => `<div class="card"><h3>${esc(a.job.title)}</h3><div class="meta">${esc(a.job.company)} · Applied ${esc(a.appliedAt)}</div><span class="tag">${esc(a.status)}</span></div>`).join('') : '<div class="card empty">You have not applied to any jobs yet.</div>'}`;
}

async function renderProfile() {
  if (!state.token) return location.hash = '#/login';
  const data = await api('/api/profile');
  const u = data.user;
  app.innerHTML = `<div class="card form"><h1>Candidate Profile</h1><form id="profileForm"><div class="grid"><div class="form-row"><label for="firstName">First name</label><input id="firstName" value="${esc(u.firstName)}"/></div><div class="form-row"><label for="lastName">Last name</label><input id="lastName" value="${esc(u.lastName)}"/></div></div><div class="form-row"><label for="phone">Phone</label><input id="phone" value="${esc(u.phone || '')}"/></div><div class="form-row"><label for="profileLocation">Location</label><input id="profileLocation" value="${esc(u.location || '')}"/></div><div class="form-row"><label for="skills">Skills (comma separated)</label><input id="skills" value="${esc((u.skills || []).join(', '))}"/></div><div class="form-row"><label for="experience">Experience (years)</label><input id="experience" type="number" min="0" value="${u.experience || 0}"/></div><button>Save profile</button></form><div id="msg"></div></div>`;
  const profileForm = document.querySelector('#profileForm');
  const firstName = document.querySelector('#firstName');
  const lastName = document.querySelector('#lastName');
  const phone = document.querySelector('#phone');
  const profileLocation = document.querySelector('#profileLocation');
  const skills = document.querySelector('#skills');
  const experience = document.querySelector('#experience');
  const msg = document.querySelector('#msg');
  profileForm.onsubmit = async e => { e.preventDefault(); try { const data = await api('/api/profile', { method: 'PUT', body: JSON.stringify({ firstName: firstName.value, lastName: lastName.value, phone: phone.value, location: profileLocation.value, skills: skills.value.split(',').map(s => s.trim()).filter(Boolean), experience: Number(experience.value) }) }); state.user = data.user; localStorage.setItem('user', JSON.stringify(state.user)); msg.innerHTML = '<div class="alert success">Profile updated.</div>'; } catch (e) { msg.innerHTML = `<div class="alert">${esc(e.message)}</div>`; } };
}

async function renderEmployer() {
  if (!state.token) return location.hash = '#/login';
  if (state.user?.role !== 'employer') { app.innerHTML = '<div class="card alert">Employer access required.</div>'; return; }
  const data = await api('/api/employer/applications');
  app.innerHTML = `<div class="stat-grid"><div class="stat">Open jobs<strong>4+</strong></div><div class="stat">Applications<strong>${data.applications.length}</strong></div><div class="stat">Pipeline<strong>${data.applications.filter(a => a.status !== 'Rejected').length}</strong></div></div><div class="card"><h2>Post a Job</h2><form id="jobForm"><div class="grid"><label for="title">Title</label><input id="title" placeholder="Job title" required/><label for="location">Location</label><input id="location" placeholder="Location" required/><label for="type">Type</label><input id="type" placeholder="Full-time" required/><label for="experience">Experience</label><input id="experience" placeholder="2-5 years"/><label for="salary">Salary</label><input id="salary" placeholder="₹8-12 LPA"/><label for="skills">Skills</label><input id="skills" placeholder="Playwright, JavaScript"/></div><br/><label for="description">Description</label><textarea id="description" placeholder="Job description" required></textarea><br/><br/><button>Publish job</button></form></div><div class="card"><h2>Candidate Applications</h2>${data.applications.map(a => `<div class="card"><strong>${esc(a.candidate.firstName)} ${esc(a.candidate.lastName)}</strong> — ${esc(a.job.title)}<div class="meta">${esc(a.candidate.email)}</div><span class="tag">${esc(a.status)}</span></div>`).join('')}</div>`;
  const jobForm = document.querySelector('#jobForm');
  const title = document.querySelector('#title');
  const employerLocation = document.querySelector('#location');
  const jobType = document.querySelector('#type');
  const experience = document.querySelector('#experience');
  const salary = document.querySelector('#salary');
  const skills = document.querySelector('#skills');
  const description = document.querySelector('#description');
  jobForm.onsubmit = async e => { e.preventDefault(); try { await api('/api/jobs', { method: 'POST', body: JSON.stringify({ title: title.value, location: employerLocation.value, type: jobType.value, experience: experience.value, salary: salary.value, skills: skills.value.split(',').map(s => s.trim()).filter(Boolean), description: description.value }) }); showToast('Job published'); renderEmployer(); } catch (e) { showToast(e.message); } };
}

async function router() {
  updateNav();
  const route = location.hash.slice(1) || '/jobs';
  try { if (route === '/jobs') return renderJobs(); if (route === '/login') return renderLogin(); if (route === '/applications') return renderApplications(); if (route === '/profile') return renderProfile(); if (route === '/employer') return renderEmployer(); const match = route.match(/^\/jobs\/(.+)$/); if (match) return renderJobDetail(match[1]); app.innerHTML = '<div class="card">Page not found</div>'; } catch (e) { app.innerHTML = `<div class="card alert">${esc(e.message)}</div>`; }
}
window.addEventListener('hashchange', router);
router();
