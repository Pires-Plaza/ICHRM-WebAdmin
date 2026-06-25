import { loadAll, batchUpdate } from './db.js';
import { showDetail } from './detail.js';

const view = () => document.getElementById('view');

let _authors = [], _papersData = {};
let _sort = { col: 'name', dir: 'asc' };

const COLS = [
  { key: 'name',        label: 'Name' },
  { key: 'email',       label: 'Email' },
  { key: 'affiliation', label: 'Affiliation' },
  { key: 'papers',      label: 'Papers' },
];

// ── List ──────────────────────────────────────────────────────

export async function render() {
  view().innerHTML = '<p class="view-loading">Loading…</p>';

  const [authorsData, papersData] = await Promise.all([loadAll('authors'), loadAll('papers')]);
  _authors   = Object.values(authorsData);
  _papersData = papersData;

  const v = view();
  v.innerHTML = '';

  const header = el('div', 'view-header');
  header.appendChild(el('h1', 'view-title', 'Authors'));
  header.appendChild(btn('+ New Author', 'btn-primary', () => renderForm()));
  v.appendChild(header);

  if (!_authors.length) {
    v.appendChild(el('p', 'view-empty', 'No authors yet. Click "+ New Author" to add one.'));
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
  const sorted = [..._authors].sort((a, b) => {
    if (_sort.col === 'papers') {
      return mul * (Object.keys(a.papers || {}).length - Object.keys(b.papers || {}).length);
    }
    return mul * (a[_sort.col] || '').localeCompare(b[_sort.col] || '');
  });

  const tbody = document.createElement('tbody');
  sorted.forEach(author => {
    const paperCount = Object.keys(author.papers || {}).length;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${esc(author.name)}</strong></td>
      <td>${esc(author.email || '—')}</td>
      <td>${esc(author.affiliation || '—')}</td>
      <td>${paperCount}</td>
      <td><div class="row-actions">
        <button class="btn-sm do-edit">Edit</button>
        <button class="btn-sm btn-danger do-del">Delete</button>
      </div></td>
    `;
    tr.querySelector('.do-edit').addEventListener('click', (e) => { e.stopPropagation(); renderForm(author.id); });
    tr.querySelector('.do-del').addEventListener('click',  (e) => { e.stopPropagation(); doDelete(author); });
    tr.addEventListener('click', () => showDetail(author.name, buildDetail(author, _papersData)));
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
}

// ── Form ──────────────────────────────────────────────────────

async function renderForm(id = null) {
  view().innerHTML = '<p class="view-loading">Loading…</p>';

  const [allAuthors, allPapers] = await Promise.all([loadAll('authors'), loadAll('papers')]);
  const author       = id ? (allAuthors[id] ?? null) : null;
  const papers       = Object.values(allPapers).sort((a, b) => a.title.localeCompare(b.title));
  const checkedPapers = new Set(Object.keys(author?.papers || {}));

  const v = view();
  v.innerHTML = '';

  const saveBtn = btn('Save Author', 'btn-primary', () => save());

  const header = el('div', 'view-header');
  const left   = el('div', 'form-nav');
  left.appendChild(backBtn('Authors', render));
  left.appendChild(el('h1', 'form-title', id ? `Edit: ${author?.name ?? ''}` : 'New Author'));
  header.appendChild(left);
  header.appendChild(saveBtn);
  v.appendChild(header);

  const form = el('div', 'form-body');
  form.innerHTML = `
    <div class="field"><label>Name *</label>
      <input type="text" id="f-name" value="${esc(author?.name || '')}" /></div>
    <div class="field"><label>Email</label>
      <input type="email" id="f-email" value="${esc(author?.email || '')}" /></div>
    <div class="field"><label>Affiliation</label>
      <input type="text" id="f-affiliation" value="${esc(author?.affiliation || '')}" /></div>
    <div class="field"><label>Bio</label>
      <textarea id="f-bio">${esc(author?.bio || '')}</textarea></div>
    <div class="field"><label>Photo URL</label>
      <input type="url" id="f-photoURL" value="${esc(author?.photoURL || '')}" /></div>
  `;

  form.appendChild(multiSelect('Papers', papers, 'papers', p => p.id, p => p.title, checkedPapers));
  const card = el('div', 'settings-card');
  card.appendChild(form);
  v.appendChild(card);

  async function save() {
    const name = document.getElementById('f-name').value.trim();
    if (!name) { document.getElementById('f-name').focus(); return; }

    const newPaperIds  = checkedIds(form, 'papers');
    const entityId     = id ?? crypto.randomUUID();
    const newPapersObj = idsToObj(newPaperIds);

    const authorData = {
      id:          entityId,
      name,
      email:       document.getElementById('f-email').value.trim(),
      affiliation: document.getElementById('f-affiliation').value.trim(),
      bio:         document.getElementById('f-bio').value.trim(),
      photoURL:    document.getElementById('f-photoURL').value.trim(),
      ...(Object.keys(newPapersObj).length && { papers: newPapersObj }),
    };

    const oldPapers = new Set(Object.keys(author?.papers || {}));
    const newPapers = new Set(newPaperIds);
    const updates   = { [`authors/${entityId}`]: authorData };

    oldPapers.forEach(pid => { if (!newPapers.has(pid)) updates[`papers/${pid}/authors/${entityId}`] = null; });
    newPapers.forEach(pid => { if (!oldPapers.has(pid)) updates[`papers/${pid}/authors/${entityId}`] = true; });

    saveBtn.disabled    = true;
    saveBtn.textContent = 'Saving…';
    try {
      await batchUpdate(updates);
      render();
    } catch (err) {
      alert(`Save failed: ${err.message}`);
      saveBtn.disabled    = false;
      saveBtn.textContent = 'Save Author';
    }
  }
}

// ── Detail ────────────────────────────────────────────────────

function buildDetail(author, papersData) {
  const papers = Object.keys(author.papers || {})
    .map(pid => papersData[pid]?.title).filter(Boolean).sort();

  return `
    ${author.photoURL ? `<div class="detail-row">
      <span class="detail-label">Photo</span>
      <img class="detail-photo" src="${esc(author.photoURL)}" alt="" />
    </div>` : ''}
    <div class="detail-row">
      <span class="detail-label">Email</span>
      <span class="detail-value">${esc(author.email || '—')}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Affiliation</span>
      <span class="detail-value">${esc(author.affiliation || '—')}</span>
    </div>
    ${author.bio ? `<div class="detail-row">
      <span class="detail-label">Bio</span>
      <span class="detail-value">${esc(author.bio)}</span>
    </div>` : ''}
    <div class="detail-row">
      <span class="detail-label">Papers</span>
      ${papers.length
        ? `<div class="detail-tags">${papers.map(t => `<span class="detail-tag">${esc(t)}</span>`).join('')}</div>`
        : '<span class="detail-value none">None assigned</span>'}
    </div>
  `;
}

// ── Delete ────────────────────────────────────────────────────

async function doDelete(author) {
  if (!confirm(`Delete "${author.name}"? This cannot be undone.`)) return;

  const updates = { [`authors/${author.id}`]: null };
  Object.keys(author.papers || {}).forEach(pid => {
    updates[`papers/${pid}/authors/${author.id}`] = null;
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
      cb.type  = 'checkbox';
      cb.name  = name;
      cb.value = getId(item);
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
