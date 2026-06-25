import { loadAll, saveDoc, deleteDoc, batchUpdate } from './db.js';
import { showDetail } from './detail.js';

const view = () => document.getElementById('view');

const TABS = [
  { key: 'committee',    label: 'Committee' },
  { key: 'registration', label: 'Registration' },
  { key: 'callForPapers', label: 'Call for Papers' },
  { key: 'submissions',  label: 'Submissions' },
  { key: 'gettingThere', label: 'Getting There' },
];

// ── Render ────────────────────────────────────────────────────

export async function render(tab = 'committee') {
  view().innerHTML = '<p class="view-loading">Loading…</p>';

  const raw  = await loadAll('info');
  const info = raw || {};

  const v = view();
  v.innerHTML = '';

  const header = el('div', 'view-header');
  header.appendChild(el('h1', 'view-title', 'Info'));
  v.appendChild(header);

  v.appendChild(buildTabs(tab));

  switch (tab) {
    case 'committee':
      v.appendChild(buildCommitteeList(info.committee || {}));
      break;
    case 'registration':
      v.appendChild(buildTextCard('registration', 'Registration', info.registration || ''));
      break;
    case 'callForPapers':
      v.appendChild(buildTextCard('callForPapers', 'Call for Papers', info.callForPapers || ''));
      break;
    case 'submissions':
      v.appendChild(buildTextCard('submissions', 'Submissions', info.submissions || ''));
      break;
    case 'gettingThere':
      v.appendChild(buildGettingThereCard(info.gettingThere || {}));
      break;
  }
}

// ── Tabs ──────────────────────────────────────────────────────

function buildTabs(active) {
  const nav = el('div', 'info-tabs');
  TABS.forEach(({ key, label }) => {
    const t = el('button', `info-tab${active === key ? ' active' : ''}`, label);
    t.addEventListener('click', () => render(key));
    nav.appendChild(t);
  });
  return nav;
}

// ── Committee list ────────────────────────────────────────────

function buildCommitteeList(membersObj) {
  const members = Object.values(membersObj)
    .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || a.name.localeCompare(b.name));

  const wrap = document.createElement('div');

  const addBtn = btn('+ New Member', 'btn-primary', () => renderCommitteeForm());
  addBtn.style.marginBottom = '20px';
  wrap.appendChild(addBtn);

  if (!members.length) {
    wrap.appendChild(el('p', 'view-empty', 'No committee members yet.'));
    return wrap;
  }

  const table = document.createElement('table');
  table.className = 'entity-table';
  table.innerHTML = `
    <thead><tr>
      <th style="width:32px"></th>
      <th>Name</th><th>Affiliation</th><th>Email</th><th></th>
    </tr></thead>
  `;

  const tbody = document.createElement('tbody');
  let dragSrcIdx = null;

  members.forEach((member, idx) => {
    const tr = document.createElement('tr');
    tr.draggable = true;
    tr.innerHTML = `
      <td class="drag-handle" title="Drag to reorder">⠿</td>
      <td><strong>${esc(member.name)}</strong></td>
      <td>${esc(member.affiliation || '—')}</td>
      <td>${esc(member.email || '—')}</td>
      <td><div class="row-actions">
        <button class="btn-sm do-edit">Edit</button>
        <button class="btn-sm btn-danger do-del">Delete</button>
      </div></td>
    `;

    tr.addEventListener('dragstart', e => {
      dragSrcIdx = idx;
      tr.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    tr.addEventListener('dragend', () => {
      tr.classList.remove('dragging');
      tbody.querySelectorAll('tr').forEach(r => r.classList.remove('drag-over'));
    });
    tr.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      tbody.querySelectorAll('tr').forEach(r => r.classList.remove('drag-over'));
      tr.classList.add('drag-over');
    });
    tr.addEventListener('dragleave', () => tr.classList.remove('drag-over'));
    tr.addEventListener('drop', async e => {
      e.preventDefault();
      tr.classList.remove('drag-over');
      if (dragSrcIdx === null || dragSrcIdx === idx) return;
      const [moved] = members.splice(dragSrcIdx, 1);
      members.splice(idx, 0, moved);
      dragSrcIdx = null;
      const updates = {};
      members.forEach((m, i) => { updates[`info/committee/${m.id}/order`] = i; });
      try {
        await batchUpdate(updates);
        render('committee');
      } catch (err) {
        alert(`Reorder failed: ${err.message}`);
      }
    });

    tr.querySelector('.do-edit').addEventListener('click', e => { e.stopPropagation(); renderCommitteeForm(member.id); });
    tr.querySelector('.do-del').addEventListener('click',  e => { e.stopPropagation(); deleteCommitteeMember(member); });
    tr.addEventListener('click', () => showDetail(member.name, `
      <div class="detail-row">
        <span class="detail-label">Affiliation</span>
        <span class="detail-value ${member.affiliation ? '' : 'none'}">${esc(member.affiliation || '—')}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Email</span>
        <span class="detail-value ${member.email ? '' : 'none'}">${esc(member.email || '—')}</span>
      </div>
    `));
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
}

// ── Committee form ────────────────────────────────────────────

async function renderCommitteeForm(id = null) {
  view().innerHTML = '<p class="view-loading">Loading…</p>';

  const raw        = await loadAll('info');
  const member     = id ? (raw?.committee?.[id] ?? null) : null;
  const maxOrder   = Object.values(raw?.committee ?? {}).reduce((m, c) => Math.max(m, c.order ?? -1), -1);

  const v = view();
  v.innerHTML = '';

  const saveBtn = btn('Save Member', 'btn-primary', async () => {
    const name = document.getElementById('f-name').value.trim();
    if (!name) { document.getElementById('f-name').focus(); return; }

    const entityId   = id ?? crypto.randomUUID();
    const memberData = {
      id:          entityId,
      name,
      affiliation: document.getElementById('f-affiliation').value.trim(),
      email:       document.getElementById('f-email').value.trim(),
      order:       member?.order ?? maxOrder + 1,
    };

    saveBtn.disabled    = true;
    saveBtn.textContent = 'Saving…';
    try {
      await saveDoc(`info/committee/${entityId}`, memberData);
      render('committee');
    } catch (err) {
      alert(`Save failed: ${err.message}`);
      saveBtn.disabled    = false;
      saveBtn.textContent = 'Save Member';
    }
  });

  const header = el('div', 'view-header');
  const left   = el('div', 'form-nav');
  left.appendChild(backBtn('Info — Committee', () => render('committee')));
  left.appendChild(el('h1', 'form-title', id ? `Edit: ${member?.name ?? ''}` : 'New Committee Member'));
  header.appendChild(left);
  header.appendChild(saveBtn);
  v.appendChild(header);

  const form = el('div', 'form-body');
  form.innerHTML = `
    <div class="field"><label>Name *</label>
      <input type="text" id="f-name" value="${esc(member?.name || '')}" /></div>
    <div class="field"><label>Affiliation</label>
      <input type="text" id="f-affiliation" value="${esc(member?.affiliation || '')}" /></div>
    <div class="field"><label>Email</label>
      <input type="email" id="f-email" value="${esc(member?.email || '')}" /></div>
  `;

  const card = el('div', 'settings-card');
  card.appendChild(form);
  v.appendChild(card);
}

// ── Committee delete ──────────────────────────────────────────

async function deleteCommitteeMember(member) {
  if (!confirm(`Delete "${member.name}"?`)) return;
  await deleteDoc(`info/committee/${member.id}`);
  render('committee');
}

// ── Text sections ─────────────────────────────────────────────

function buildTextCard(key, title, content) {
  const saveBtn = btn('Save', 'btn-primary', async () => {
    const text = document.getElementById(`f-${key}`).value;
    saveBtn.disabled    = true;
    saveBtn.textContent = 'Saving…';
    try {
      await saveDoc(`info/${key}`, text);
      saveBtn.textContent = 'Saved!';
      setTimeout(() => { saveBtn.disabled = false; saveBtn.textContent = 'Save'; }, 2000);
    } catch (err) {
      alert(`Save failed: ${err.message}`);
      saveBtn.disabled    = false;
      saveBtn.textContent = 'Save';
    }
  });

  const card = el('div', 'settings-card');

  const cardHeader = el('div', 'settings-card-header');
  cardHeader.appendChild(el('h2', 'settings-card-title', title));
  cardHeader.appendChild(saveBtn);
  card.appendChild(cardHeader);

  const form = el('div', 'form-body');
  form.innerHTML = `
    <div class="field">
      <label>Content</label>
      <textarea id="f-${key}" style="min-height:260px">${esc(content)}</textarea>
    </div>
  `;
  card.appendChild(form);
  return card;
}

// ── Getting There card ────────────────────────────────────────

function buildGettingThereCard(data) {
  const saveBtn = btn('Save', 'btn-primary', async () => {
    const g = id => document.getElementById(id).value.trim();
    const gtData = {
      text:   document.getElementById('f-gt-text').value,
      image1: g('f-gt-image1'),
      image2: g('f-gt-image2'),
      image3: g('f-gt-image3'),
      image4: g('f-gt-image4'),
      image5: g('f-gt-image5'),
    };
    saveBtn.disabled    = true;
    saveBtn.textContent = 'Saving…';
    try {
      await saveDoc('info/gettingThere', gtData);
      saveBtn.textContent = 'Saved!';
      setTimeout(() => { saveBtn.disabled = false; saveBtn.textContent = 'Save'; }, 2000);
    } catch (err) {
      alert(`Save failed: ${err.message}`);
      saveBtn.disabled    = false;
      saveBtn.textContent = 'Save';
    }
  });

  const card = el('div', 'settings-card');

  const cardHeader = el('div', 'settings-card-header');
  cardHeader.appendChild(el('h2', 'settings-card-title', 'Getting There'));
  cardHeader.appendChild(saveBtn);
  card.appendChild(cardHeader);

  const form = el('div', 'form-body');

  const textField = el('div', 'field');
  textField.innerHTML = `
    <label>Description <span class="hint">(Markdown — clients handle rendering)</span></label>
    <textarea id="f-gt-text" style="min-height:180px">${esc(data.text || '')}</textarea>
  `;
  form.appendChild(textField);

  [1, 2, 3, 4, 5].forEach(i => {
    const url   = data[`image${i}`] || '';
    const field = el('div', 'field');

    const lbl = document.createElement('label');
    lbl.textContent = `Image ${i}`;
    field.appendChild(lbl);

    const input = document.createElement('input');
    input.type  = 'url';
    input.id    = `f-gt-image${i}`;
    input.value = url;
    field.appendChild(input);

    const img = document.createElement('img');
    img.className    = 'gt-image-preview';
    img.alt          = '';
    img.style.display = url ? '' : 'none';
    if (url) img.src = url;
    field.appendChild(img);

    input.addEventListener('input', () => {
      const v = input.value.trim();
      img.style.display = v ? '' : 'none';
      img.src = v || '';
    });

    form.appendChild(field);
  });

  card.appendChild(form);
  return card;
}

// ── Helpers ───────────────────────────────────────────────────

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
