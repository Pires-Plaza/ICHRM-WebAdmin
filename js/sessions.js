import { loadAll, batchUpdate } from './db.js';
import { showDetail } from './detail.js';

const view = () => document.getElementById('view');

const SESSION_DURATIONS = [
  { value: 15,  label: '15 min' },
  { value: 30,  label: '30 min' },
  { value: 45,  label: '45 min' },
  { value: 60,  label: '1 h' },
  { value: 90,  label: '1 h 30 min' },
  { value: 120, label: '2 h' },
  { value: 150, label: '2 h 30 min' },
  { value: 180, label: '3 h' },
];

const SESSION_TYPES = [
  { value: 'keynote',      label: 'Keynote' },
  { value: 'presentation', label: 'Presentation' },
  { value: 'workshop',     label: 'Workshop' },
  { value: 'panel',        label: 'Panel' },
  { value: 'poster',       label: 'Poster' },
  { value: 'break',        label: 'Break' },
  { value: 'opening',      label: 'Opening' },
  { value: 'closing',      label: 'Closing' },
];

let _sessions = [], _authorsData = {}, _papersData = {};
let _sort = { col: 'date', dir: 'asc' };

const COLS = [
  { key: 'title',    label: 'Title' },
  { key: 'type',     label: 'Type' },
  { key: 'date',     label: 'Date' },
  { key: 'location', label: 'Location' },
  { key: 'speakers', label: 'Speakers' },
  { key: 'papers',   label: 'Papers' },
];

// ── List ──────────────────────────────────────────────────────

export async function render() {
  view().innerHTML = '<p class="view-loading">Loading…</p>';

  const [sessionsData, authorsData, papersData] = await Promise.all([
    loadAll('sessions'), loadAll('authors'), loadAll('papers'),
  ]);
  _sessions    = Object.values(sessionsData);
  _authorsData = authorsData;
  _papersData  = papersData;

  const v = view();
  v.innerHTML = '';

  const header = el('div', 'view-header');
  header.appendChild(el('h1', 'view-title', 'Sessions'));
  header.appendChild(btn('+ New Session', 'btn-primary', () => renderForm()));
  v.appendChild(header);

  if (!_sessions.length) {
    v.appendChild(el('p', 'view-empty', 'No sessions yet. Click "+ New Session" to add one.'));
    return;
  }

  const table = document.createElement('table');
  table.className = 'entity-table';
  renderList(table);
  v.appendChild(table);
}

function renderList(table) {
  table.innerHTML = '';

  const thead = document.createElement('thead');
  const htr   = document.createElement('tr');
  COLS.forEach(col => {
    const th = document.createElement('th');
    th.className = 'sortable' + (_sort.col === col.key ? ' sort-active' : '');
    th.innerHTML = `${col.label} <span class="sort-icon">${_sort.col === col.key ? (_sort.dir === 'asc' ? '▲' : '▼') : '⇅'}</span>`;
    th.addEventListener('click', () => {
      _sort = { col: col.key, dir: _sort.col === col.key && _sort.dir === 'asc' ? 'desc' : 'asc' };
      renderList(table);
    });
    htr.appendChild(th);
  });
  htr.appendChild(document.createElement('th'));
  thead.appendChild(htr);
  table.appendChild(thead);

  const mul = _sort.dir === 'asc' ? 1 : -1;
  const sorted = [..._sessions].sort((a, b) => {
    if (_sort.col === 'date')     return mul * ((a.date ?? Infinity) - (b.date ?? Infinity));
    if (_sort.col === 'speakers') return mul * (Object.keys(a.speakers || {}).length - Object.keys(b.speakers || {}).length);
    if (_sort.col === 'papers')   return mul * (Object.keys(a.papers   || {}).length - Object.keys(b.papers   || {}).length);
    if (_sort.col === 'type') {
      const al = SESSION_TYPES.find(t => t.value === a.type)?.label ?? '';
      const bl = SESSION_TYPES.find(t => t.value === b.type)?.label ?? '';
      return mul * al.localeCompare(bl);
    }
    return mul * (a[_sort.col] || '').localeCompare(b[_sort.col] || '');
  });

  const tbody = document.createElement('tbody');
  sorted.forEach(session => {
    const speakerCount = Object.keys(session.speakers || {}).length;
    const paperCount   = Object.keys(session.papers   || {}).length;
    const dateStr      = session.date
      ? new Date(session.date * 1000).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
      : '—';
    const typeLabel = SESSION_TYPES.find(t => t.value === session.type)?.label ?? '—';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${esc(session.title)}</strong></td>
      <td>${typeLabel}</td>
      <td>${dateStr}</td>
      <td>${esc(session.location || '—')}</td>
      <td>${speakerCount}</td>
      <td>${paperCount}</td>
      <td><div class="row-actions">
        <button class="btn-sm do-edit">Edit</button>
        <button class="btn-sm btn-danger do-del">Delete</button>
      </div></td>
    `;
    tr.querySelector('.do-edit').addEventListener('click', (e) => { e.stopPropagation(); renderForm(session.id); });
    tr.querySelector('.do-del').addEventListener('click',  (e) => { e.stopPropagation(); doDelete(session); });
    tr.addEventListener('click', () => showDetail(session.title, buildDetail(session, _authorsData, _papersData)));
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
}

// ── Form ──────────────────────────────────────────────────────

async function renderForm(id = null) {
  view().innerHTML = '<p class="view-loading">Loading…</p>';

  const [allSessions, allPapers, allAuthors] = await Promise.all([
    loadAll('sessions'), loadAll('papers'), loadAll('authors'),
  ]);

  const session         = id ? (allSessions[id] ?? null) : null;
  const papers          = Object.values(allPapers).sort((a, b) => a.title.localeCompare(b.title));
  const authors         = Object.values(allAuthors).sort((a, b) => a.name.localeCompare(b.name));
  const checkedPapers   = new Set(Object.keys(session?.papers   || {}));
  const checkedSpeakers = new Set(Object.keys(session?.speakers || {}));
  const dateValue       = session?.date
    ? new Date(session.date * 1000).toISOString().slice(0, 16)
    : '';

  // paper → Set<authorId>, used to drive the dynamic speakers list
  const paperAuthorMap = {};
  Object.values(allPapers).forEach(p => {
    paperAuthorMap[p.id] = new Set(Object.keys(p.authors || {}));
  });
  const currentPapers   = new Set(checkedPapers);
  const currentSpeakers = new Set(checkedSpeakers);

  const v = view();
  v.innerHTML = '';

  const saveBtn = btn('Save Session', 'btn-primary', () => save());

  const header = el('div', 'view-header');
  const left   = el('div', 'form-nav');
  left.appendChild(backBtn('Sessions', render));
  left.appendChild(el('h1', 'form-title', id ? `Edit: ${session?.title ?? ''}` : 'New Session'));
  header.appendChild(left);
  header.appendChild(saveBtn);
  v.appendChild(header);

  const form = el('div', 'form-body');

  const typeOptions = SESSION_TYPES.map(t =>
    `<option value="${t.value}" ${session?.type === t.value ? 'selected' : ''}>${t.label}</option>`
  ).join('');

  const durationOptions = SESSION_DURATIONS.map(d =>
    `<option value="${d.value}" ${session?.duration === d.value ? 'selected' : ''}>${d.label}</option>`
  ).join('');

  form.innerHTML = `
    <div class="field"><label>Title *</label>
      <input type="text" id="f-title" value="${esc(session?.title || '')}" /></div>
    <div class="field"><label>Type</label>
      <select id="f-type">
        <option value="">— No type —</option>
        ${typeOptions}
      </select></div>
    <div class="field"><label>Duration</label>
      <select id="f-duration">
        <option value="">— No duration —</option>
        ${durationOptions}
      </select></div>
    <div class="field"><label>Date &amp; Time</label>
      <input type="datetime-local" id="f-date" value="${dateValue}" /></div>
    <div class="field"><label>Location</label>
      <input type="text" id="f-location" value="${esc(session?.location || '')}" /></div>
    <div class="field"><label>Description</label>
      <textarea id="f-description">${esc(session?.description || '')}</textarea></div>
  `;

  form.appendChild(multiSelect('Chairs', authors, 'chairs', a => a.id, a => a.name,
    new Set(Object.keys(session?.chairs || {})), a => a.affiliation || null));

  // Papers widget — changes drive the speakers list
  const papersWidget = multiSelect('Papers', papers, 'papers', p => p.id, p => p.title, checkedPapers);
  form.appendChild(papersWidget);

  // Dynamic speakers list — only authors of currently selected papers
  const speakersWrap = document.createElement('div');
  form.appendChild(speakersWrap);

  function rebuildSpeakers() {
    const availableIds = new Set();
    currentPapers.forEach(pid => {
      (paperAuthorMap[pid] || new Set()).forEach(aid => availableIds.add(aid));
    });

    // auto-deselect speakers no longer in any selected paper
    currentSpeakers.forEach(aid => { if (!availableIds.has(aid)) currentSpeakers.delete(aid); });

    speakersWrap.innerHTML = '';
    speakersWrap.appendChild(el('p', 'ms-label', 'Speakers'));
    const list = el('div', 'ms-list');
    const available = authors.filter(a => availableIds.has(a.id));

    if (!available.length) {
      list.appendChild(el('p', 'ms-empty', 'No authors available — assign papers first.'));
    } else {
      available.forEach(author => {
        const row = el('div', 'cb-item');
        const cb  = document.createElement('input');
        cb.type    = 'checkbox';
        cb.name    = 'speakers';
        cb.value   = author.id;
        cb.checked = currentSpeakers.has(author.id);
        cb.addEventListener('change', () => {
          if (cb.checked) currentSpeakers.add(author.id);
          else currentSpeakers.delete(author.id);
        });
        const lbl = document.createElement('label');
        lbl.textContent = author.name;
        if (author.affiliation) lbl.appendChild(el('span', 'cb-sub', author.affiliation));
        row.appendChild(cb); row.appendChild(lbl); list.appendChild(row);
      });
    }
    speakersWrap.appendChild(list);
  }

  papersWidget.querySelectorAll('input[name="papers"]').forEach(cb => {
    cb.addEventListener('change', () => {
      if (cb.checked) currentPapers.add(cb.value);
      else currentPapers.delete(cb.value);
      rebuildSpeakers();
    });
  });

  rebuildSpeakers();
  const card = el('div', 'settings-card');
  card.appendChild(form);
  v.appendChild(card);

  async function save() {
    const title = document.getElementById('f-title').value.trim();
    if (!title) { document.getElementById('f-title').focus(); return; }

    const newPaperIds    = checkedIds(form, 'papers');
    const newSpeakerIds  = checkedIds(form, 'speakers');
    const newChairIds    = checkedIds(form, 'chairs');
    const dateInput      = document.getElementById('f-date').value;
    const entityId       = id ?? crypto.randomUUID();
    const newPapersObj   = idsToObj(newPaperIds);
    const newSpeakersObj = idsToObj(newSpeakerIds);
    const newChairsObj   = idsToObj(newChairIds);

    const typeVal     = document.getElementById('f-type').value;
    const durationVal = parseInt(document.getElementById('f-duration').value) || null;

    const sessionData = {
      id:       entityId,
      title,
      location:    document.getElementById('f-location').value.trim(),
      description: document.getElementById('f-description').value.trim(),
      ...(typeVal     && { type:     typeVal }),
      ...(durationVal && { duration: durationVal }),
      ...(dateInput                            && { date: Math.floor(new Date(dateInput).getTime() / 1000) }),
      ...(Object.keys(newPapersObj).length     && { papers:    newPapersObj }),
      ...(Object.keys(newSpeakersObj).length   && { speakers:  newSpeakersObj }),
      ...(Object.keys(newChairsObj).length     && { chairs:    newChairsObj }),
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

// ── Detail ────────────────────────────────────────────────────

function buildDetail(session, authorsData, papersData) {
  const dateStr = session.date
    ? new Date(session.date * 1000).toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' })
    : null;
  const typeLabel     = SESSION_TYPES.find(t => t.value === session.type)?.label ?? null;
  const durationLabel = SESSION_DURATIONS.find(d => d.value === session.duration)?.label ?? null;
  const chairs   = Object.keys(session.chairs   || {}).map(aid => authorsData[aid]?.name).filter(Boolean).sort();
  const speakers = Object.keys(session.speakers || {}).map(aid => authorsData[aid]?.name).filter(Boolean).sort();
  const papers   = Object.keys(session.papers   || {}).map(pid => papersData[pid]?.title).filter(Boolean).sort();

  return `
    ${typeLabel ? `<div class="detail-row">
      <span class="detail-label">Type</span>
      <span class="detail-value">${typeLabel}</span>
    </div>` : ''}
    ${durationLabel ? `<div class="detail-row">
      <span class="detail-label">Duration</span>
      <span class="detail-value">${durationLabel}</span>
    </div>` : ''}
    <div class="detail-row">
      <span class="detail-label">Date &amp; Time</span>
      <span class="detail-value ${dateStr ? '' : 'none'}">${dateStr ?? 'Not set'}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Location</span>
      <span class="detail-value ${session.location ? '' : 'none'}">${esc(session.location || 'Not set')}</span>
    </div>
    ${session.description ? `<div class="detail-row">
      <span class="detail-label">Description</span>
      <span class="detail-value">${esc(session.description)}</span>
    </div>` : ''}
    <div class="detail-row">
      <span class="detail-label">Chairs</span>
      ${chairs.length
        ? `<div class="detail-tags">${chairs.map(n => `<span class="detail-tag">${esc(n)}</span>`).join('')}</div>`
        : '<span class="detail-value none">None assigned</span>'}
    </div>
    <div class="detail-row">
      <span class="detail-label">Speakers</span>
      ${speakers.length
        ? `<div class="detail-tags">${speakers.map(n => `<span class="detail-tag">${esc(n)}</span>`).join('')}</div>`
        : '<span class="detail-value none">None assigned</span>'}
    </div>
    <div class="detail-row">
      <span class="detail-label">Papers</span>
      ${papers.length
        ? `<div class="detail-tags">${papers.map(t => `<span class="detail-tag">${esc(t)}</span>`).join('')}</div>`
        : '<span class="detail-value none">None assigned</span>'}
    </div>
  `;
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

function multiSelect(labelText, items, name, getId, getLabel, checked, getSub) {
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
      if (getSub) {
        const sub = getSub(item);
        if (sub) lbl.appendChild(el('span', 'cb-sub', sub));
      }

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
