import { loadAll, batchUpdate } from './db.js';

const view = () => document.getElementById('view');

// ── List ──────────────────────────────────────────────────────

export async function render() {
  view().innerHTML = '<p class="view-loading">Loading…</p>';

  const data     = await loadAll('sessions');
  const sessions = Object.values(data).sort((a, b) => a.title.localeCompare(b.title));

  const v = view();
  v.innerHTML = '';

  const header = el('div', 'view-header');
  header.appendChild(el('h1', 'view-title', 'Sessions'));
  header.appendChild(btn('+ New Session', 'btn-primary', () => renderForm()));
  v.appendChild(header);

  if (!sessions.length) {
    v.appendChild(el('p', 'view-empty', 'No sessions yet. Click "+ New Session" to add one.'));
    return;
  }

  const table = document.createElement('table');
  table.className = 'entity-table';
  table.innerHTML = `
    <thead><tr>
      <th>Title</th><th>Date</th><th>Location</th><th>Papers</th><th></th>
    </tr></thead>
  `;

  const tbody = document.createElement('tbody');
  sessions.forEach(session => {
    const paperCount = Object.keys(session.papers || {}).length;
    const dateStr    = session.date
      ? new Date(session.date * 1000).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
      : '—';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${esc(session.title)}</strong></td>
      <td>${dateStr}</td>
      <td>${esc(session.location || '—')}</td>
      <td>${paperCount}</td>
      <td><div class="row-actions">
        <button class="btn-sm do-edit">Edit</button>
        <button class="btn-sm btn-danger do-del">Delete</button>
      </div></td>
    `;
    tr.querySelector('.do-edit').addEventListener('click', () => renderForm(session.id));
    tr.querySelector('.do-del').addEventListener('click',  () => doDelete(session));
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  v.appendChild(table);
}

// ── Form ──────────────────────────────────────────────────────

async function renderForm(id = null) {
  view().innerHTML = '<p class="view-loading">Loading…</p>';

  const [allSessions, allPapers] = await Promise.all([loadAll('sessions'), loadAll('papers')]);

  const session       = id ? (allSessions[id] ?? null) : null;
  const papers        = Object.values(allPapers).sort((a, b) => a.title.localeCompare(b.title));
  const checkedPapers = new Set(Object.keys(session?.papers || {}));
  const dateValue     = session?.date
    ? new Date(session.date * 1000).toISOString().slice(0, 16)
    : '';

  const v = view();
  v.innerHTML = '';

  v.appendChild(backBtn('Sessions', render));
  v.appendChild(el('h1', 'form-title', id ? `Edit: ${session?.title ?? ''}` : 'New Session'));

  const form = el('div', 'form-body');

  form.innerHTML = `
    <div class="field"><label>Title *</label>
      <input type="text" id="f-title" value="${esc(session?.title || '')}" /></div>
    <div class="field"><label>Date &amp; Time</label>
      <input type="datetime-local" id="f-date" value="${dateValue}" /></div>
    <div class="field"><label>Location</label>
      <input type="text" id="f-location" value="${esc(session?.location || '')}" /></div>
  `;

  form.appendChild(multiSelect('Papers', papers, 'papers', p => p.id, p => p.title, checkedPapers));

  const actions = el('div', 'form-actions');
  const saveBtn = btn('Save Session', 'btn-primary', () => save());
  actions.appendChild(saveBtn);
  actions.appendChild(btn('Cancel', 'btn-sm', render));
  form.appendChild(actions);
  v.appendChild(form);

  async function save() {
    const title = document.getElementById('f-title').value.trim();
    if (!title) { document.getElementById('f-title').focus(); return; }

    const newPaperIds  = checkedIds(form, 'papers');
    const dateInput    = document.getElementById('f-date').value;
    const entityId     = id ?? crypto.randomUUID();
    const newPapersObj = idsToObj(newPaperIds);

    const sessionData = {
      id:       entityId,
      title,
      location: document.getElementById('f-location').value.trim(),
      ...(dateInput                          && { date: Math.floor(new Date(dateInput).getTime() / 1000) }),
      ...(Object.keys(newPapersObj).length   && { papers: newPapersObj }),
    };

    const oldPapers = new Set(Object.keys(session?.papers || {}));
    const newPapers = new Set(newPaperIds);
    const updates   = { [`sessions/${entityId}`]: sessionData };

    // Sync papers' session field
    oldPapers.forEach(pid => { if (!newPapers.has(pid)) updates[`papers/${pid}/session`] = null; });
    newPapers.forEach(pid => { if (!oldPapers.has(pid)) updates[`papers/${pid}/session`] = entityId; });

    saveBtn.disabled    = true;
    saveBtn.textContent = 'Saving…';
    try {
      await batchUpdate(updates);
      render();
    } catch (err) {
      alert(`Save failed: ${err.message}`);
      saveBtn.disabled    = false;
      saveBtn.textContent = 'Save Session';
    }
  }
}

// ── Delete ────────────────────────────────────────────────────

async function doDelete(session) {
  if (!confirm(`Delete "${session.title}"? This cannot be undone.`)) return;

  const updates = { [`sessions/${session.id}`]: null };
  Object.keys(session.papers || {}).forEach(pid => {
    updates[`papers/${pid}/session`] = null;
  });

  await batchUpdate(updates);
  render();
}

// ── Helpers ───────────────────────────────────────────────────

function multiSelect(labelText, items, name, getId, getLabel, checked) {
  const wrap = document.createElement('div');
  wrap.appendChild(el('p', 'ms-label', labelText));

  const list = el('div', 'ms-list');
  if (!items.length) {
    list.appendChild(el('p', 'ms-empty', `No ${labelText.toLowerCase()} available yet.`));
  } else {
    items.forEach(item => {
      const row = el('div', 'cb-item');
      const cb  = document.createElement('input');
      cb.type    = 'checkbox';
      cb.name    = name;
      cb.value   = getId(item);
      cb.checked = checked.has(getId(item));

      const lbl = document.createElement('label');
      lbl.textContent = getLabel(item);

      row.appendChild(cb);
      row.appendChild(lbl);
      list.appendChild(row);
    });
  }

  wrap.appendChild(list);
  return wrap;
}

function checkedIds(container, name) {
  return [...container.querySelectorAll(`input[name="${name}"]:checked`)].map(cb => cb.value);
}

function idsToObj(ids) {
  return Object.fromEntries(ids.map(id => [id, true]));
}

function backBtn(label, onClick) {
  const b = document.createElement('button');
  b.className = 'form-back';
  b.innerHTML = `&#8592; Back to ${label}`;
  b.addEventListener('click', onClick);
  return b;
}

function btn(text, className, onClick) {
  const b = document.createElement('button');
  b.className = className;
  b.textContent = text;
  b.addEventListener('click', onClick);
  return b;
}

function el(tag, className, text) {
  const e = document.createElement(tag);
  e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
