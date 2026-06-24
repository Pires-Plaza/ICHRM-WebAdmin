import { loadAll, batchUpdate } from './db.js';
import { showDetail } from './detail.js';

const view = () => document.getElementById('view');

// ── List ──────────────────────────────────────────────────────

export async function render() {
  view().innerHTML = '<p class="view-loading">Loading…</p>';

  const [papersData, sessionsData, authorsData] = await Promise.all([
    loadAll('papers'), loadAll('sessions'), loadAll('authors'),
  ]);
  const papers = Object.values(papersData).sort((a, b) => a.title.localeCompare(b.title));

  const v = view();
  v.innerHTML = '';

  const header = el('div', 'view-header');
  header.appendChild(el('h1', 'view-title', 'Papers'));
  header.appendChild(btn('+ New Paper', 'btn-primary', () => renderForm()));
  v.appendChild(header);

  if (!papers.length) {
    v.appendChild(el('p', 'view-empty', 'No papers yet. Click "+ New Paper" to add one.'));
    return;
  }

  const table = document.createElement('table');
  table.className = 'entity-table';
  table.innerHTML = `
    <thead><tr>
      <th>Title</th><th>Session</th><th>Authors</th><th></th>
    </tr></thead>
  `;

  const tbody = document.createElement('tbody');
  papers.forEach(paper => {
    const sessionTitle = paper.session && sessionsData[paper.session]
      ? sessionsData[paper.session].title
      : '—';
    const authorCount = Object.keys(paper.authors || {}).length;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${esc(paper.title)}</strong></td>
      <td>${esc(sessionTitle)}</td>
      <td>${authorCount}</td>
      <td><div class="row-actions">
        <button class="btn-sm do-edit">Edit</button>
        <button class="btn-sm btn-danger do-del">Delete</button>
      </div></td>
    `;
    tr.querySelector('.do-edit').addEventListener('click', (e) => { e.stopPropagation(); renderForm(paper.id); });
    tr.querySelector('.do-del').addEventListener('click',  (e) => { e.stopPropagation(); doDelete(paper); });
    tr.addEventListener('click', () => showDetail(paper.title, buildDetail(paper, sessionsData, authorsData)));
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  v.appendChild(table);
}

// ── Form ──────────────────────────────────────────────────────

async function renderForm(id = null) {
  view().innerHTML = '<p class="view-loading">Loading…</p>';

  const [allPapers, allAuthors, allSessions] = await Promise.all([
    loadAll('papers'), loadAll('authors'), loadAll('sessions'),
  ]);

  const paper   = id ? (allPapers[id] ?? null) : null;
  const authors  = Object.values(allAuthors).sort((a, b) => a.name.localeCompare(b.name));
  const sessions = Object.values(allSessions).sort((a, b) => a.title.localeCompare(b.title));
  const checkedAuthors = new Set(Object.keys(paper?.authors || {}));

  const v = view();
  v.innerHTML = '';

  v.appendChild(backBtn('Papers', render));
  v.appendChild(el('h1', 'form-title', id ? `Edit: ${paper?.title ?? ''}` : 'New Paper'));

  const form = el('div', 'form-body');

  const sessionOptions = sessions.map(s =>
    `<option value="${s.id}" ${paper?.session === s.id ? 'selected' : ''}>${esc(s.title)}</option>`
  ).join('');

  form.innerHTML = `
    <div class="field"><label>Title *</label>
      <input type="text" id="f-title" value="${esc(paper?.title || '')}" /></div>
    <div class="field"><label>Abstract</label>
      <textarea id="f-abstract">${esc(paper?.abstract || '')}</textarea></div>
    <div class="field"><label>Session</label>
      <select id="f-session">
        <option value="">— No session assigned —</option>
        ${sessionOptions}
      </select></div>
  `;

  const authorWidget = authorSelect(allAuthors, authors, checkedAuthors, paper);
  form.appendChild(authorWidget);

  const actions = el('div', 'form-actions');
  const saveBtn = btn('Save Paper', 'btn-primary', () => save());
  actions.appendChild(saveBtn);
  actions.appendChild(btn('Cancel', 'btn-sm', render));
  form.appendChild(actions);
  v.appendChild(form);

  async function save() {
    const title = document.getElementById('f-title').value.trim();
    if (!title) { document.getElementById('f-title').focus(); return; }

    const newAuthorIds  = authorWidget.getOrderedIds();
    const newSessionId  = document.getElementById('f-session').value;
    const entityId      = id ?? crypto.randomUUID();
    const newAuthorsObj = Object.fromEntries(newAuthorIds.map((aid, i) => [aid, i]));

    const paperData = {
      id:       entityId,
      title,
      abstract: document.getElementById('f-abstract').value.trim(),
      ...(newSessionId                        && { session: newSessionId }),
      ...(Object.keys(newAuthorsObj).length   && { authors: newAuthorsObj }),
    };

    const oldAuthors   = new Set(Object.keys(paper?.authors || {}));
    const newAuthors   = new Set(newAuthorIds);
    const oldSessionId = paper?.session ?? null;
    const updates      = { [`papers/${entityId}`]: paperData };

    // Sync authors
    oldAuthors.forEach(aid => { if (!newAuthors.has(aid)) updates[`authors/${aid}/papers/${entityId}`] = null; });
    newAuthors.forEach(aid => { if (!oldAuthors.has(aid)) updates[`authors/${aid}/papers/${entityId}`] = true; });

    // Sync sessions
    if (oldSessionId && oldSessionId !== newSessionId) {
      updates[`sessions/${oldSessionId}/papers/${entityId}`] = null;
    }
    if (newSessionId) {
      updates[`sessions/${newSessionId}/papers/${entityId}`] = true;
    }

    saveBtn.disabled    = true;
    saveBtn.textContent = 'Saving…';
    try {
      await batchUpdate(updates);
      render();
    } catch (err) {
      alert(`Save failed: ${err.message}`);
      saveBtn.disabled    = false;
      saveBtn.textContent = 'Save Paper';
    }
  }
}

// ── Detail ────────────────────────────────────────────────────

function buildDetail(paper, sessionsData, authorsData) {
  const sessionTitle = paper.session && sessionsData[paper.session]
    ? sessionsData[paper.session].title : null;
  const authorNames = Object.entries(paper.authors || {})
    .sort(([aId, aVal], [bId, bVal]) =>
      (typeof aVal === 'number' ? aVal : Infinity) - (typeof bVal === 'number' ? bVal : Infinity)
      || (authorsData[aId]?.name || '').localeCompare(authorsData[bId]?.name || ''))
    .map(([aid]) => authorsData[aid]?.name).filter(Boolean);

  return `
    ${paper.abstract ? `<div class="detail-row">
      <span class="detail-label">Abstract</span>
      <span class="detail-value">${esc(paper.abstract)}</span>
    </div>` : ''}
    <div class="detail-row">
      <span class="detail-label">Session</span>
      <span class="detail-value ${sessionTitle ? '' : 'none'}">${esc(sessionTitle || 'Not assigned')}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Authors</span>
      ${authorNames.length
        ? `<div class="detail-tags">${authorNames.map(n => `<span class="detail-tag">${esc(n)}</span>`).join('')}</div>`
        : '<span class="detail-value none">None assigned</span>'}
    </div>
  `;
}

// ── Delete ────────────────────────────────────────────────────

async function doDelete(paper) {
  if (!confirm(`Delete "${paper.title}"? This cannot be undone.`)) return;

  const updates = { [`papers/${paper.id}`]: null };

  Object.keys(paper.authors || {}).forEach(aid => {
    updates[`authors/${aid}/papers/${paper.id}`] = null;
  });
  if (paper.session) {
    updates[`sessions/${paper.session}/papers/${paper.id}`] = null;
  }

  await batchUpdate(updates);
  render();
}

// ── Author order + select widget ──────────────────────────────

function authorSelect(authorsMap, sortedAuthors, checkedAuthors, paper) {
  const initialOrdered = Object.entries(paper?.authors || {})
    .sort(([aId, aVal], [bId, bVal]) =>
      (typeof aVal === 'number' ? aVal : Infinity) - (typeof bVal === 'number' ? bVal : Infinity)
      || (authorsMap[aId]?.name || '').localeCompare(authorsMap[bId]?.name || ''))
    .map(([id]) => id)
    .filter(id => authorsMap[id]);

  const wrap = document.createElement('div');

  wrap.appendChild(el('p', 'ms-label', 'Author Order'));
  const orderList = document.createElement('div');
  orderList.className = 'author-order-list';
  const emptyMsg = el('p', 'author-order-empty', 'No authors selected yet.');
  orderList.appendChild(emptyMsg);
  wrap.appendChild(orderList);

  let dragSrc = null;

  function syncEmpty() {
    emptyMsg.style.display = orderList.querySelectorAll('.author-order-item').length ? 'none' : '';
  }

  function makeItem(authorId) {
    const author = authorsMap[authorId];
    const item   = document.createElement('div');
    item.className  = 'author-order-item';
    item.draggable  = true;
    item.dataset.id = authorId;
    item.innerHTML  = `<span class="drag-handle" title="Drag to reorder">⠿</span><span>${esc(author.name)}</span>`;

    item.addEventListener('dragstart', e => {
      dragSrc = item; item.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move';
    });
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      orderList.querySelectorAll('.author-order-item').forEach(r => r.classList.remove('drag-over'));
    });
    item.addEventListener('dragover', e => {
      e.preventDefault(); e.dataTransfer.dropEffect = 'move';
      orderList.querySelectorAll('.author-order-item').forEach(r => r.classList.remove('drag-over'));
      item.classList.add('drag-over');
    });
    item.addEventListener('dragleave', () => item.classList.remove('drag-over'));
    item.addEventListener('drop', e => {
      e.preventDefault(); item.classList.remove('drag-over');
      if (!dragSrc || dragSrc === item) return;
      const all = [...orderList.querySelectorAll('.author-order-item')];
      all.indexOf(dragSrc) < all.indexOf(item) ? item.after(dragSrc) : item.before(dragSrc);
      dragSrc = null;
    });

    return item;
  }

  initialOrdered.forEach(id => orderList.appendChild(makeItem(id)));
  syncEmpty();

  wrap.appendChild(el('p', 'ms-label', 'Authors'));
  const list = el('div', 'ms-list');
  if (!sortedAuthors.length) {
    list.appendChild(el('p', 'ms-empty', 'No authors available yet.'));
  } else {
    sortedAuthors.forEach(author => {
      const row = el('div', 'cb-item');
      const cb  = document.createElement('input');
      cb.type    = 'checkbox';
      cb.name    = 'authors';
      cb.value   = author.id;
      cb.checked = checkedAuthors.has(author.id);
      cb.addEventListener('change', () => {
        if (cb.checked) {
          orderList.appendChild(makeItem(author.id));
        } else {
          orderList.querySelector(`.author-order-item[data-id="${author.id}"]`)?.remove();
        }
        syncEmpty();
      });
      const lbl = document.createElement('label');
      lbl.textContent = author.name;
      if (author.affiliation) lbl.appendChild(el('span', 'cb-sub', author.affiliation));
      row.appendChild(cb); row.appendChild(lbl); list.appendChild(row);
    });
  }
  wrap.appendChild(list);

  wrap.getOrderedIds = () =>
    [...orderList.querySelectorAll('.author-order-item')].map(i => i.dataset.id);

  return wrap;
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
