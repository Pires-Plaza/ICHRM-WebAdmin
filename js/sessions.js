import { loadAll, batchUpdate } from './db.js';
import { showDetail } from './detail.js';

const view = () => document.getElementById('view');

// ── List ──────────────────────────────────────────────────────

export async function render() {
  view().innerHTML = '<p class="view-loading">Loading…</p>';

  const [sessionsData, authorsData, papersData] = await Promise.all([
    loadAll('sessions'), loadAll('authors'), loadAll('papers'),
  ]);
  const sessions = Object.values(sessionsData).sort((a, b) => (a.date ?? Infinity) - (b.date ?? Infinity));

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
      <th>Title</th><th>Date</th><th>Location</th><th>Speakers</th><th>Papers</th><th></th>
    </tr></thead>
  `;

  const tbody = document.createElement('tbody');
  sessions.forEach(session => {
    const speakerCount = Object.keys(session.speakers || {}).length;
    const paperCount   = Object.keys(session.papers   || {}).length;
    const dateStr      = session.date
      ? new Date(session.date * 1000).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
      : '—';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${esc(session.title)}</strong></td>
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
    tr.addEventListener('click', () => showDetail(session.title, buildDetail(session, authorsData, papersData)));
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  v.appendChild(table);
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
    <div class="field"><label>Description <span class="hint">(Markdown — clients handle rendering)</span></label>
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

  const actions = el('div', 'form-actions');
  const saveBtn = btn('Save Session', 'btn-primary', () => save());
  actions.appendChild(saveBtn);
  actions.appendChild(btn('Cancel', 'btn-sm', render));
  form.appendChild(actions);
  v.appendChild(form);

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

    const sessionData = {
      id:       entityId,
      title,
      location:    document.getElementById('f-location').value.trim(),
      description: document.getElementById('f-description').value.trim(),
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
  const chairs   = Object.keys(session.chairs   || {}).map(aid => authorsData[aid]?.name).filter(Boolean).sort();
  const speakers = Object.keys(session.speakers || {}).map(aid => authorsData[aid]?.name).filter(Boolean).sort();
  const papers   = Object.keys(session.papers   || {}).map(pid => papersData[pid]?.title).filter(Boolean).sort();

  return `
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
