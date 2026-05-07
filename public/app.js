/* ===== app.js — Course Registration Frontend ===== */

const API = '/api';
let allCourses = [];
let currentFilter = 'all';
const allowedOpenElectiveCodes = new Set(['OE-DSA', 'OE-HF']);
const studentGreetings = ['Welcome back', 'Ready to learn', 'Greetings'];

// Auth State
let currentUser = JSON.parse(localStorage.getItem('user')) || null;
let currentToken = localStorage.getItem('token') || null;
let selectedAuthRole = null;

const currentStudentId = () => currentUser ? currentUser.studentId.toUpperCase() : null;

// Helper to add Auth header
const getHeaders = () => {
  const headers = { 'Content-Type': 'application/json' };
  if (currentToken) headers['Authorization'] = `Bearer ${currentToken}`;
  return headers;
};

/* ══════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  checkAuthState();
  setupCreateCourseValidation();
  if (currentUser) {
    loadCourses();
  }
});
function setupCreateCourseValidation() {
  const createForm = document.getElementById('createCourseForm');
  const instructorInput = document.getElementById('fInstructor');
  if (!createForm || !instructorInput) return;

  const requiredFields = createForm.querySelectorAll('input[required], select[required], textarea[required]');
  requiredFields.forEach((field) => {
    field.addEventListener('invalid', () => {
      if (field.validity.valueMissing) {
        field.setCustomValidity('required');
      }
    });
    field.addEventListener('input', () => field.setCustomValidity(''));
    field.addEventListener('change', () => field.setCustomValidity(''));
  });

  instructorInput.addEventListener('input', () => {
    const isValid = /^[A-Za-z. ]+$/.test(instructorInput.value.trim());
    instructorInput.setCustomValidity(isValid || !instructorInput.value ? '' : 'Invalid');
  });
}




/* ══════════════════════════════════════════════════
   TABS
══════════════════════════════════════════════════ */
function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById(`tab-${tab}`).classList.add('active');
  document.getElementById(`content-${tab}`).classList.add('active');
  if (tab === 'my') loadStudentEnrollments();
}

/* ══════════════════════════════════════════════════
   TOAST NOTIFICATIONS
══════════════════════════════════════════════════ */
function showToast(type, title, message, duration = 4000) {
  const icons = { success: '✅', error: '❌', warn: '⚠️', info: 'ℹ️' };
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-icon">${icons[type] || 'ℹ️'}</div>
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      ${message ? `<div class="toast-msg">${message}</div>` : ''}
    </div>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('hiding');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/* ══════════════════════════════════════════════════
   API LOG
══════════════════════════════════════════════════ */
function logEntry(type, text) {
  const log = document.getElementById('apiLog');
  if (!log) return; // API log panel has been removed from UI
  const empty = log.querySelector('.log-empty');
  if (empty) empty.remove();
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  const time = new Date().toLocaleTimeString();
  entry.innerHTML = `<span class="log-time">[${time}]</span>${text}`;
  log.appendChild(entry);
  log.scrollTop = log.scrollHeight;
}

function clearLog() {
  const log = document.getElementById('apiLog');
  log.innerHTML = '<div class="log-empty">No activity yet…</div>';
}

/* ══════════════════════════════════════════════════
   HERO STATS ANIMATION
══════════════════════════════════════════════════ */
function animateHeroStats() {
  const els = document.querySelectorAll('.stat-num');
  els.forEach(el => {
    const target = parseInt(el.dataset.target || '0');
    if (!target) return;
    let current = 0;
    const step = Math.ceil(target / 30);
    const timer = setInterval(() => {
      current = Math.min(current + step, target);
      el.textContent = current;
      if (current >= target) clearInterval(timer);
    }, 30);
  });
}

function updateHeroStats(courses) {
  const total = courses.length;
  const totalSeats = courses.reduce((s, c) => s + (c.availableSeats ?? (c.totalSeats - c.enrolledCount)), 0);
  const enrolled = courses.reduce((s, c) => s + c.enrolledCount, 0);

  const nums = document.querySelectorAll('.stat-num');
  [[nums[0], total],[nums[1], totalSeats],[nums[2], enrolled]].forEach(([el, val]) => {
    if (!el) return;
    let cur = 0, step = Math.ceil(val / 20);
    const t = setInterval(() => {
      cur = Math.min(cur + step, val);
      el.textContent = cur;
      if (cur >= val) clearInterval(t);
    }, 25);
  });
}

/* ══════════════════════════════════════════════════
   LOAD COURSES
══════════════════════════════════════════════════ */
async function loadCourses() {
  const grid = document.getElementById('coursesGrid');
  grid.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading courses…</p></div>';
  try {
    const res = await fetch(`${API}/courses`, { headers: getHeaders() });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    allCourses = data.data.filter((course) =>
      course.courseType !== 'OPEN_ELECTIVE' || allowedOpenElectiveCodes.has(course.courseCode)
    );
    updateHeroStats(allCourses);
    // Populate the course roster dropdown in the admin panel
    const rosterSelect = document.getElementById('adminCourseRosterSelect');
    if (rosterSelect) {
      rosterSelect.innerHTML = '<option value="">— Select Course —</option>' +
        allCourses.map(c => `<option value="${c._id}">[${c.courseCode}] ${c.title}</option>`).join('');
    }
    populateCourseSelect(allCourses);
    renderCourses();
  } catch (err) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>Failed to load courses</p><span>${err.message}</span></div>`;
    showToast('error', 'Connection Error', err.message);
  }
}

function renderCourses() {
  const grid = document.getElementById('coursesGrid');
  const mandatoryGrid = document.getElementById('mandatoryCoursesGrid');
  const electiveGrid = document.getElementById('electiveCoursesGrid');
  const mandatorySection = document.getElementById('mandatorySection');
  const electiveSection = document.getElementById('electiveSection');
  const search = document.getElementById('searchInput').value.toLowerCase();
  
  let courses = allCourses;

  if (search) {
    courses = courses.filter(c =>
      c.title.toLowerCase().includes(search) ||
      c.courseCode.toLowerCase().includes(search) ||
      c.instructor.toLowerCase().includes(search)
    );
  }

  if (currentFilter === 'available') courses = courses.filter(c => c.enrolledCount < c.totalSeats);
  if (currentFilter === 'full') courses = courses.filter(c => c.enrolledCount >= c.totalSeats);

  if (!courses.length) {
    grid.style.display = 'grid';
    mandatorySection.style.display = 'none';
    electiveSection.style.display = 'none';
    grid.innerHTML = '<div class="empty-state"><div class="empty-icon">🔍</div><p>No courses found</p><span>Try adjusting your search or filters</span></div>';
    return;
  }

  if (currentUser && currentUser.role !== 'admin') {
    const mandatory = courses.filter(c => c.courseType === 'MANDATORY');
    const electives = courses.filter(c => c.courseType === 'ELECTIVE');
    const openElectives = courses.filter(c => c.courseType === 'OPEN_ELECTIVE' && allowedOpenElectiveCodes.has(c.courseCode));

    grid.style.display = 'none';
    
    if (mandatory.length) {
      mandatorySection.style.display = 'block';
      mandatoryGrid.innerHTML = mandatory.map(c => mandatoryRow(c)).join('');
    } else {
      mandatorySection.style.display = 'none';
    }

    if (electives.length) {
      electiveSection.style.display = 'block';
      electiveGrid.innerHTML = electives.map(c => electiveRow(c)).join('');
    } else {
      electiveSection.style.display = 'none';
    }

    const openElectiveSection = document.getElementById('openElectiveSection');
    const openElectiveGrid = document.getElementById('openElectiveCoursesGrid');
    if (openElectives.length > 0) {
      openElectiveSection.style.display = 'block';
      openElectiveGrid.innerHTML = openElectives.map(c => extraRow(c)).join('');
    } else {
      openElectiveSection.style.display = 'none';
    }
  } else {
    // Admin view
    mandatorySection.style.display = 'none';
    electiveSection.style.display = 'none';
    document.getElementById('openElectiveSection').style.display = 'none';
    grid.style.display = 'grid';
    grid.innerHTML = courses.map(c => courseCard(c)).join('');
  }
}

function mandatoryRow(c) {
  return `
  <div class="mandatory-row">
    <span class="mandatory-code">${c.courseCode}</span>
    <span class="mandatory-title">${c.title}</span>
    <span class="mandatory-meta">${c.credits} cr · ${c.instructor}</span>
    <span class="mandatory-lock">🔒 Mandatory</span>
  </div>`;
}

function electiveRow(c) {
  const avail = c.totalSeats - c.enrolledCount;
  const isFull = avail <= 0;
  const isAlmost = avail > 0 && avail <= 5;
  const badgeClass = isFull ? 'full' : isAlmost ? 'almost' : 'available';
  const badgeText = isFull ? 'Full' : `${avail} left`;

  return `
  <div class="elective-row" onclick="openCourseModal('${c._id}')">
    <span class="elective-code">${c.courseCode}</span>
    <span class="elective-title">${c.title}</span>
    <span class="elective-meta">${c.credits} cr · ${c.instructor}</span>
    <span class="seat-badge ${badgeClass}" style="margin-left:auto; font-size:0.75rem;">${badgeText}</span>
  </div>`;
}

function extraRow(c) {
  const avail = c.totalSeats - c.enrolledCount;
  const isFull = avail <= 0;
  
  return `
  <div class="elective-row extra-row" onclick="openCourseModal('${c._id}')">
    <span class="elective-code" style="background:var(--bg3); color:var(--text3);">${c.courseCode}</span>
    <span class="elective-title">${c.title}</span>
    <span class="elective-meta">${c.credits} cr · ${c.instructor}</span>
    <span class="seat-badge ${isFull ? 'full' : 'available'}" style="margin-left:auto; font-size:0.75rem;">${isFull ? 'Full' : avail + ' left'}</span>
  </div>`;
}

function courseCard(c) {
  const avail = c.totalSeats - c.enrolledCount;
  const pct = Math.round((c.enrolledCount / c.totalSeats) * 100);
  const isFull = avail <= 0;
  const isAlmost = avail > 0 && avail <= 2;
  const isMandatory = c.courseType === 'MANDATORY';
  const badgeClass = isFull ? 'full' : isAlmost ? 'almost' : 'available';
  const badgeText = isFull ? '🔴 Full' : isAlmost ? `${avail} left` : `✅ ${avail} seats`;
  const fillClass = isFull ? 'red' : isAlmost ? 'amber' : 'green';

  return `
  <div class="course-card${isFull ? ' is-full' : ''}${isMandatory ? ' is-mandatory' : ''}" onclick="openCourseModal('${c._id}')">
    <div class="card-top">
      <span class="course-code">${c.courseCode}</span>
      <span class="seat-badge ${badgeClass}">${badgeText}</span>
    </div>
    <div class="course-title">${c.title}</div>
    <div class="course-instructor">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="2"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      ${c.instructor}
    </div>
    <div class="course-meta">
      <span class="meta-item">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        ${c.schedule || 'TBD'}
      </span>
      <span class="meta-item">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" stroke-width="2"/></svg>
        ${c.credits} credits
      </span>
    </div>
    ${c.description ? `<div class="course-description">${c.description}</div>` : ''}
    <div class="progress-bar"><div class="progress-fill ${fillClass}" style="width:${pct}%"></div></div>
  </div>`;
}

function filterCourses() { renderCourses(); }

function setFilter(filter, btn) {
  currentFilter = filter;
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  renderCourses();
}

/* ══════════════════════════════════════════════════
   ENROLL
══════════════════════════════════════════════════ */
async function enroll(courseId) {
  const sid = currentStudentId();
  if (!sid) {
    showToast('warn', 'Roll Number Required', 'Please log in with your roll number first');
    return;
  }
  try {
    logEntry('info', `POST /enroll  ${sid} → ${courseId.slice(-6)}`);
    const res = await fetch(`${API}/enroll`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ studentId: sid, courseId }),
    });
    const data = await res.json();
    if (res.status === 201) {
      if (data.fallback) {
        showToast('warn', '⚡ Auto-Assigned!', data.message, 7000);
      } else {
        showToast('success', '🎉 Enrolled!', data.message);
      }
      logEntry('success', data.message);
    } else if (res.status === 202) {
      showToast('warn', 'Waitlisted', data.message);
      logEntry('warn', data.message);
    } else if (res.status === 409 && data.isFull) {
      // Elective is full → prompt student to try another
      showToast('warn', '🔴 Elective Full', data.message);
      logEntry('warn', data.message);
    } else if (res.status === 403) {
      // Student already has an elective/open elective confirmed
      showToast('error', '🚫 Enrollment Blocked', data.message, 6000);
      logEntry('error', data.message);
    } else {
      showToast('error', 'Enrollment Failed', data.message);
      logEntry('error', data.message);
    }
    await loadCourses();
  } catch (err) {
    showToast('error', 'Request Failed', err.message);
    logEntry('error', err.message);
  }
}

/* ══════════════════════════════════════════════════
   DROP
══════════════════════════════════════════════════ */
async function drop(courseId) {
  const sid = currentStudentId();
  if (!sid) {
    showToast('warn', 'Roll Number Required', 'Please log in with your roll number first');
    return;
  }
  try {
    logEntry('info', `POST /drop  ${sid} → ${courseId.slice(-6)}`);
    const res = await fetch(`${API}/drop`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ studentId: sid, courseId }),
    });
    const data = await res.json();
    if (data.success) {
      showToast('success', 'Dropped', data.message);
      logEntry('success', data.message);
    } else {
      showToast('error', 'Drop Failed', data.message);
      logEntry('error', data.message);
    }
    await loadCourses();
  } catch (err) {
    showToast('error', 'Request Failed', err.message);
    logEntry('error', err.message);
  }
}

/* ══════════════════════════════════════════════════
   MY ENROLLMENTS
══════════════════════════════════════════════════ */
async function loadStudentEnrollments() {
  const sid = currentStudentId();
  const list = document.getElementById('myEnrollmentsList');
  const label = document.getElementById('myStudentLabel');

  if (!sid) {
    label.textContent = 'Log in with your roll number to view your courses';
    list.innerHTML = '<div class="empty-state"><div class="empty-icon">🎓</div><p>No roll number found</p><span>Log in and open My Courses</span></div>';
    return;
  }

  label.textContent = `Enrollments for ${sid}`;
  list.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading…</p></div>';

  try {
    const res = await fetch(`${API}/student/${sid}`, { headers: getHeaders() });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);

    const items = data.data;
    if (!items.length) {
      list.innerHTML = `<div class="empty-state"><div class="empty-icon">📚</div><p>No enrollments found</p><span>${sid} has not enrolled in any courses yet</span></div>`;
      return;
    }

    list.innerHTML = items.map(e => {
      const course = e.courseId;
      const isEnrolled = e.status === 'ENROLLED';
      const isMandatory = course && course.courseType === 'MANDATORY';
      
      return `
      <div class="enrollment-item">
        <div class="enroll-status-dot ${isEnrolled ? 'enrolled' : 'waitlisted'}"></div>
        <div class="enroll-info">
          <div class="enroll-course-name">${course ? course.title : 'Unknown Course'}</div>
          <div class="enroll-code">${course ? course.courseCode : ''} ${!isEnrolled ? `· Waitlist #${e.waitlistPosition}` : ''} ${isMandatory ? '· 🔒 Mandatory' : ''}</div>
        </div>
        <span class="enroll-badge ${isEnrolled ? 'badge-enrolled' : 'badge-waitlisted'}">${e.status}</span>
        ${!isMandatory ? `<button class="enroll-drop-btn" onclick="dropFromList('${course ? course._id : ''}', this)">Drop</button>` : `<span style="font-size:0.8rem;color:var(--text2);margin-left:auto;">Locked</span>`}
      </div>`;
    }).join('');
  } catch (err) {
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>Error</p><span>${err.message}</span></div>`;
  }
}

async function dropFromList(courseId, btn) {
  btn.disabled = true;
  btn.textContent = '…';
  await drop(courseId);
  await loadStudentEnrollments();
}

/* ══════════════════════════════════════════════════
   COURSE DETAIL MODAL
══════════════════════════════════════════════════ */
async function openCourseModal(courseId) {
  const course = allCourses.find(c => c._id === courseId);
  if (!course) return;
  const avail = course.totalSeats - course.enrolledCount;
  const isFull = avail <= 0;

  let waitlistHTML = '';
  try {
    const wRes = await fetch(`${API}/courses/${courseId}/waitlist`);
    const wData = await wRes.json();
    if (wData.success && wData.data.length) {
      waitlistHTML = `
        <div class="waitlist-list">
          <div style="font-size:.8rem;font-weight:700;color:var(--text2);margin-bottom:.5rem;text-transform:uppercase;letter-spacing:.05em">Waitlist (${wData.data.length})</div>
          ${wData.data.map(w => `
            <div class="waitlist-item">
              <span class="wl-pos">#${w.waitlistPosition}</span>
              <span class="wl-student">${w.studentId}</span>
              <span style="margin-left:auto;font-size:.72rem;color:var(--text3)">${new Date(w.enrolledAt).toLocaleString()}</span>
            </div>`).join('')}
        </div>`;
    }
  } catch {}

  const isMandatory = course.courseType === 'MANDATORY';
  document.getElementById('modalContent').innerHTML = `
    <div class="modal-course-code">${course.courseCode}</div>
    <div class="modal-title">${course.title}</div>
    <div class="modal-instructor">👤 ${course.instructor}</div>
    <div class="modal-stats">
      <div class="modal-stat"><div class="modal-stat-val">${course.credits}</div><div class="modal-stat-lbl">Credits</div></div>
      ${!isMandatory ? `
      <div class="modal-stat"><div class="modal-stat-val">${course.totalSeats}</div><div class="modal-stat-lbl">Total Seats</div></div>
      <div class="modal-stat"><div class="modal-stat-val" style="color:${isFull ? 'var(--red)' : 'var(--green)'}">${avail}</div><div class="modal-stat-lbl">Available</div></div>` : ''}
    </div>
    ${course.description ? `<div class="modal-desc">${course.description}</div>` : ''}
    <div class="modal-meta-row">
      <span class="modal-meta-item">🕒 ${course.schedule || 'TBD'}</span>
      ${isMandatory ? '<span class="modal-meta-item" style="color:#888;">🔒 Mandatory — auto-enrolled</span>' : ''}
    </div>
    ${!isMandatory ? `<div class="modal-actions">
      ${isFull
        ? `<button class="btn-primary" style="background:var(--amber)" onclick="enroll('${course._id}');closeModal()">⏳ Join Waitlist</button>`
        : `<button class="btn-primary" onclick="enroll('${course._id}');closeModal()">Enroll Now</button>`}
      <button class="btn-drop" onclick="drop('${course._id}');closeModal()">Drop Course</button>
    </div>` : ''}
    ${!isMandatory ? waitlistHTML : ''}
  `;
  document.getElementById('modalOverlay').classList.add('open');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

/* ══════════════════════════════════════════════════
   ADMIN — CREATE COURSE
══════════════════════════════════════════════════ */
// Removed obsolete handleAllBatch

async function createCourse(e) {
  e.preventDefault();
  const btn = document.getElementById('createCourseBtn');

  const courseType = document.querySelector('input[name="fCourseType"]:checked').value;
  const targetYear = document.getElementById('fYear').value;
  const targetSemester = document.getElementById('fSem').value;
  const targetBranch = document.getElementById('fBranch').value;

  const courseCode = document.getElementById('fCourseCode').value.trim().toUpperCase();
  const title = document.getElementById('fTitle').value.trim();
  const instructor = document.getElementById('fInstructor').value.trim();
  const credits = parseFloat(document.getElementById('fCredits').value);

  if (!/^(CS|CC|EC|ME)\d{3}$/.test(courseCode)) {
    showToast('error', 'Invalid Course Code', 'Use format like CS123, CC234, EC345, or ME456.');
    return;
  }
  if (!/^(?!.*\d).{1,250}$/.test(title)) {
    showToast('error', 'Invalid Course Title', 'Course title must be text only and up to 250 characters.');
    return;
  }
  if (!/^[A-Za-z. ]+$/.test(instructor)) {
    showToast('error', 'Invalid Instructor Name', 'Only letters, spaces, and dot (.) are allowed.');
    return;
  }
  if (Number.isNaN(credits) || credits < 1 || credits > 4.5 || (credits * 2) % 1 !== 0) {
    showToast('error', 'Invalid Credits', 'Credits must be 1 to 4.5 in 0.5 steps.');
    return;
  }

  btn.disabled = true; btn.textContent = 'Creating…';
  const body = {
    courseCode,
    title,
    instructor,
    totalSeats: parseInt(document.getElementById('fSeats').value),
    credits,
    description: document.getElementById('fDescription').value,
    courseType,
    targetYear,
    targetSemester,
    targetBranch
  };
  try {
    const res = await fetch(`${API}/courses`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.success) {
      showToast('success', 'Course Created', `${body.courseCode}: ${body.title}`);
      document.getElementById('createCourseForm').reset();
      await loadCourses();
    } else {
      showToast('error', 'Failed', data.message);
    }
  } catch (err) {
    showToast('error', 'Error', err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> Create Course';
  }
}

/* ══════════════════════════════════════════════════
   ADMIN — QUICK TOOL
══════════════════════════════════════════════════ */
function populateCourseSelect(courses) {
  const sel = document.getElementById('qCourseSelect');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Select Course —</option>';
  courses.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c._id;
    opt.textContent = `${c.courseCode} — ${c.title}`;
    sel.appendChild(opt);
  });
}

async function quickEnroll() {
  const sid = document.getElementById('qStudentId').value.trim().toUpperCase();
  const courseId = document.getElementById('qCourseSelect').value;
  if (!sid || !courseId) { showToast('warn', 'Missing Fields', 'Enter a roll number and select a course'); return; }
  try {
    const res = await fetch(`${API}/enroll`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ studentId: sid, courseId }),
    });
    const data = await res.json();
    if (res.status === 201) {
      showToast('success', 'Enrollment Updated', data.message);
      await loadCourses();
    } else if (res.status === 202) {
      showToast('warn', 'Waitlisted', data.message);
      await loadCourses();
    } else if (res.status === 403) {
      showToast('error', 'Enrollment Blocked', data.message, 6000);
    } else if (res.status === 409 && data.isFull) {
      showToast('warn', 'Course Full', data.message);
    } else {
      showToast('error', 'Enrollment Failed', data.message);
    }
  } catch (err) {
    showToast('error', 'Request Failed', err.message);
  }
}

/* ══════════════════════════════════════════════════
   AUTH LOGIC
══════════════════════════════════════════════════ */
function selectAuthRole(role) {
  selectedAuthRole = role;
  document.getElementById('authRoleSelection').style.display = 'none';
  document.getElementById('authFormsContainer').style.display = 'block';
  
  const roleName = role === 'admin' ? 'Admin' : 'Student';
  document.getElementById('authFormTitle').textContent = `${roleName} Login`;
  
  // Update labels dynamically based on role
  const idLabel = role === 'admin' ? 'Admin ID' : 'Roll Number';
  document.getElementById('lblLoginId').textContent = idLabel;
  document.getElementById('lblSignupId').textContent = idLabel;

  document.getElementById('lStudentId').placeholder = role === 'admin' ? 'Enter admXXX' : 'Enter roll number';
  document.getElementById('sStudentId').placeholder = role === 'admin' ? 'Enter admXXX' : 'Enter roll number';
  document.getElementById('sEmail').placeholder = role === 'admin'
    ? 'Enter college email (admXXX@lnmiit.ac.in)'
    : 'Enter college email (rollno@lnmiit.ac.in)';
  document.getElementById('sEmail').title = role === 'admin'
    ? 'Use format: adm345@lnmiit.ac.in'
    : 'Use format: 24ucs097@lnmiit.ac.in';
  
  switchAuthTab('login');
}

function goBackToRoleSelection() {
  selectedAuthRole = null;
  document.getElementById('authRoleSelection').style.display = 'block';
  document.getElementById('authFormsContainer').style.display = 'none';
  document.getElementById('loginForm').reset();
  document.getElementById('signupForm').reset();
}

function checkAuthState() {
  if (!currentUser) {
    document.getElementById('authModalOverlay').style.display = 'flex';
    document.getElementById('userPanel').style.display = 'none';
    goBackToRoleSelection();
  } else {
    document.getElementById('authModalOverlay').style.display = 'none';
    document.getElementById('userPanel').style.display = 'flex';
    document.getElementById('loggedInUserName').textContent = currentUser.name;

    // Role-based routing
    if (currentUser.role === 'admin') {
      document.getElementById('heroStats').style.display = 'flex';
      document.getElementById('heroGreeting').style.display = 'none';
      document.getElementById('tab-browse').style.display = 'none';
      document.getElementById('tab-my').style.display = 'none';
      document.getElementById('tab-admin').style.display = 'flex';
      switchTab('admin');
    } else {
      document.getElementById('heroStats').style.display = 'none';
      const randomGreeting = studentGreetings[Math.floor(Math.random() * studentGreetings.length)];
      document.getElementById('heroGreeting').innerHTML = `${randomGreeting}, ${currentUser.name}!`;
      document.getElementById('heroGreeting').style.display = 'block';
      document.getElementById('tab-browse').style.display = 'flex';
      document.getElementById('tab-my').style.display = 'flex';
      document.getElementById('tab-admin').style.display = 'none';
      switchTab('browse');
    }
  }
}

function switchAuthTab(tab) {
  if (tab === 'login') {
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('signupForm').style.display = 'none';
    document.getElementById('authLoginBtn').classList.add('active');
    document.getElementById('authLoginBtn').style.color = 'var(--text)';
    document.getElementById('authSignupBtn').classList.remove('active');
    document.getElementById('authSignupBtn').style.color = 'var(--text2)';
  } else {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('signupForm').style.display = 'block';
    document.getElementById('authSignupBtn').classList.add('active');
    document.getElementById('authSignupBtn').style.color = 'var(--text)';
    document.getElementById('authLoginBtn').classList.remove('active');
    document.getElementById('authLoginBtn').style.color = 'var(--text2)';
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('loginBtn');
  btn.disabled = true; btn.textContent = 'Logging in...';

  const studentId = document.getElementById('lStudentId').value;
  const password = document.getElementById('lPassword').value;

  try {
    const res = await fetch(`${API}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, password, role: selectedAuthRole })
    });
    const data = await res.json();

    if (data.success) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      currentToken = data.token;
      currentUser = data.user;
      
      showToast('success', 'Logged In', data.message);
      checkAuthState();
      loadCourses();
      animateHeroStats();
    } else {
      showToast('error', 'Login Failed', data.message);
    }
  } catch (err) {
    showToast('error', 'Error', err.message);
  } finally {
    btn.disabled = false; btn.textContent = 'Login';
  }
}

async function handleSignup(e) {
  e.preventDefault();
  const btn = document.getElementById('signupBtn');
  btn.disabled = true; btn.textContent = 'Creating Account...';

  const body = {
    studentId: document.getElementById('sStudentId').value,
    name: document.getElementById('sName').value,
    email: document.getElementById('sEmail').value,
    password: document.getElementById('sPassword').value,
    role: selectedAuthRole || 'student'
  };

  try {
    const res = await fetch(`${API}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();

    if (data.success) {
      showToast('success', 'Account Created', data.message);
      document.getElementById('signupForm').reset();
      switchAuthTab('login');
    } else {
      showToast('error', 'Signup Failed', data.message);
    }
  } catch (err) {
    showToast('error', 'Error', err.message);
  } finally {
    btn.disabled = false; btn.textContent = 'Create Account';
  }
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  currentToken = null;
  currentUser = null;
  
  document.getElementById('loginForm').reset();
  document.getElementById('signupForm').reset();
  
  // Clear sensitive data
  allCourses = [];
  document.getElementById('coursesGrid').innerHTML = '';
  document.getElementById('myEnrollmentsList').innerHTML = '';
  const apiLogEl = document.getElementById('apiLog');
  if (apiLogEl) apiLogEl.innerHTML = '';
  
  checkAuthState();
}

async function quickDrop() {
  const sid = document.getElementById('qStudentId').value.trim().toUpperCase();
  const courseId = document.getElementById('qCourseSelect').value;
  if (!sid || !courseId) { showToast('warn', 'Missing Fields', 'Enter a roll number and select a course'); return; }
  try {
    const res = await fetch(`${API}/drop`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ studentId: sid, courseId }),
    });
    const data = await res.json();
    if (data.success) {
      showToast('success', 'Drop Updated', data.message);
      await loadCourses();
    } else {
      showToast('error', 'Drop Failed', data.message);
    }
  } catch (err) {
    showToast('error', 'Request Failed', err.message);
  }
}

/* ══════════════════════════════════════════════════
   ADMIN — STUDENT LOOKUP
══════════════════════════════════════════════════ */
async function adminLookupStudent() {
  const sid = document.getElementById('adminStudentLookupId').value.trim().toUpperCase();
  const result = document.getElementById('adminStudentLookupResult');
  if (!sid) { showToast('warn', 'Missing', 'Enter a roll number'); return; }

  result.innerHTML = '<div class="loading-state" style="padding:1rem 0;"><div class="spinner"></div><p>Searching…</p></div>';
  try {
    const res = await fetch(`${API}/student/${sid}`, { headers: getHeaders() });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);

    const items = data.data;
    if (!items.length) {
      result.innerHTML = `<div class="empty-state" style="padding:1rem;"><div class="empty-icon">🔍</div><p>No enrollments found for <strong>${sid}</strong></p></div>`;
      return;
    }

    result.innerHTML = `
      <p style="margin-bottom:0.75rem;font-size:0.85rem;color:var(--text2);">Found <strong>${items.length}</strong> enrollment(s) for <strong>${sid}</strong></p>
      <table style="width:100%;border-collapse:collapse;font-size:0.85rem;">
        <thead>
          <tr style="border-bottom:1px solid var(--border);">
            <th style="text-align:left;padding:0.5rem 0.4rem;">Course Code</th>
            <th style="text-align:left;padding:0.5rem 0.4rem;">Course Title</th>
            <th style="text-align:left;padding:0.5rem 0.4rem;">Type</th>
            <th style="text-align:left;padding:0.5rem 0.4rem;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(e => {
            const c = e.courseId;
            const statusColor = e.status === 'ENROLLED' ? '#4ade80' : '#facc15';
            return `<tr style="border-bottom:1px solid var(--border);">
              <td style="padding:0.5rem 0.4rem;font-family:monospace;">${c ? c.courseCode : 'N/A'}</td>
              <td style="padding:0.5rem 0.4rem;">${c ? c.title : 'Unknown'}</td>
              <td style="padding:0.5rem 0.4rem;">
                <span style="font-size:0.75rem;padding:0.15rem 0.5rem;border-radius:999px;background:var(--surface2);">${c ? c.courseType : '—'}</span>
              </td>
              <td style="padding:0.5rem 0.4rem;">
                <span style="color:${statusColor};font-weight:600;">${e.status}</span>
                ${e.status === 'WAITLISTED' ? `<span style="color:var(--text2);font-size:0.75rem;"> (#${e.waitlistPosition})</span>` : ''}
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>`;
  } catch (err) {
    result.innerHTML = `<div style="color:var(--red);padding:0.5rem;">⚠️ ${err.message}</div>`;
  }
}

/* ══════════════════════════════════════════════════
   ADMIN — COURSE ENROLLMENT ROSTER
══════════════════════════════════════════════════ */
async function adminLoadRoster() {
  const courseId = document.getElementById('adminCourseRosterSelect').value;
  const result = document.getElementById('adminCourseRosterResult');
  if (!courseId) { showToast('warn', 'Missing', 'Please select a course first'); return; }

  result.innerHTML = '<div class="loading-state" style="padding:1rem 0;"><div class="spinner"></div><p>Loading roster…</p></div>';
  try {
    const res = await fetch(`${API}/courses/${courseId}/enrollments`, { headers: getHeaders() });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);

    const items = data.data;
    const courseName = document.getElementById('adminCourseRosterSelect').selectedOptions[0].text;
    if (!items.length) {
      result.innerHTML = `<div class="empty-state" style="padding:1rem;"><div class="empty-icon">📋</div><p>No students enrolled in this course yet</p></div>`;
      return;
    }

    const enrolled = items.filter(e => e.status === 'ENROLLED');
    const waitlisted = items.filter(e => e.status === 'WAITLISTED');

    result.innerHTML = `
      <p style="margin-bottom:0.75rem;font-size:0.85rem;color:var(--text2);"><strong>${courseName}</strong> — ${enrolled.length} enrolled, ${waitlisted.length} waitlisted</p>
      <table style="width:100%;border-collapse:collapse;font-size:0.85rem;">
        <thead>
          <tr style="border-bottom:1px solid var(--border);">
            <th style="text-align:left;padding:0.5rem 0.4rem;">#</th>
            <th style="text-align:left;padding:0.5rem 0.4rem;">Roll Number</th>
            <th style="text-align:left;padding:0.5rem 0.4rem;">Status</th>
            <th style="text-align:left;padding:0.5rem 0.4rem;">Enrolled At</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((e, i) => {
            const statusColor = e.status === 'ENROLLED' ? '#4ade80' : '#facc15';
            const date = new Date(e.enrolledAt).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
            return `<tr style="border-bottom:1px solid var(--border);">
              <td style="padding:0.5rem 0.4rem;color:var(--text2);">${i + 1}</td>
              <td style="padding:0.5rem 0.4rem;font-family:monospace;font-weight:600;">${e.studentId}</td>
              <td style="padding:0.5rem 0.4rem;">
                <span style="color:${statusColor};font-weight:600;">${e.status}</span>
                ${e.status === 'WAITLISTED' ? `<span style="color:var(--text2);font-size:0.75rem;"> (#${e.waitlistPosition})</span>` : ''}
              </td>
              <td style="padding:0.5rem 0.4rem;color:var(--text2);">${date}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>`;
  } catch (err) {
    result.innerHTML = `<div style="color:var(--red);padding:0.5rem;">⚠️ ${err.message}</div>`;
  }
}
