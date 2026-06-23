import { ref, get, set, remove } from 'firebase/database';
import { db } from './firebase-config.js';

const $ = id => document.getElementById(id);

let currentPath = [];   // array of path segments, e.g. ['users', 'abc']
let modalMode   = 'add'; // 'add' | 'edit'
let modalPath   = [];    // target path for the open modal operation

// ── Public ────────────────────────────────────────────────────

export function initRTDB() {
  $('db-add-btn').addEventListener('click', () => openAddModal(currentPath));
  $('db-refresh-btn').addEventListener('click', reload);
  $('db-go-btn').addEventListener('click', () => {
    const raw = $('db-path-input').value.trim().replace(/^\//, '');
    navigateTo(raw ? raw.split('/').filter(Boolean) : []);
  });
  $('db-path-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') $('db-go-btn').click();
  });
}

export function setupModalListeners() {
  $('modal-cancel').addEventListener('click', closeModal);
  $('modal-backdrop').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });
  $('modal-backdrop').addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });
  $('modal-confirm').addEventListener('click', handleModalConfirm);
}

export async function loadPath(pathParts) {
  currentPath = pathParts ?? [];
  renderBreadcrumb();

  const body = $('db-content');
  body.innerHTML = '<p class="empty-state">Loading…</p>';

  try {
    const snapshot = await get(ref(db, currentPath.join('/') || '/'));
    body.innerHTML = '';

    if (!snapshot.exists()) {
      body.innerHTML = '<p class="empty-state">No data at this path.</p>';
      return;
    }

    body.appendChild(renderNode(null, snapshot.val(), currentPath, false));
  } catch (err) {
    body.innerHTML = `<p class="error">Error: ${err.message}</p>`;
  }
}

// ── Navigation ────────────────────────────────────────────────

function navigateTo(pathParts) { loadPath(pathParts); }

function reload() { loadPath(currentPath); }

// ── Breadcrumb ────────────────────────────────────────────────

function renderBreadcrumb() {
  const nav = $('db-breadcrumb');
  nav.innerHTML = '';

  nav.appendChild(bcItem('root', () => navigateTo([])));

  currentPath.forEach((seg, i) => {
    nav.appendChild(bcSep());
    if (i < currentPath.length - 1) {
      nav.appendChild(bcItem(seg, () => navigateTo(currentPath.slice(0, i + 1))));
    } else {
      const el = document.createElement('span');
      el.className = 'bc-current';
      el.textContent = seg;
      nav.appendChild(el);
    }
  });
}

function bcItem(label, onClick) {
  const el = document.createElement('span');
  el.className = 'bc-item';
  el.textContent = label;
  el.addEventListener('click', onClick);
  return el;
}

function bcSep() {
  const el = document.createElement('span');
  el.className = 'bc-sep';
  el.textContent = '/';
  return el;
}

// ── Tree rendering ────────────────────────────────────────────

function renderNode(key, value, nodePath, isNested) {
  if (typeof value === 'object' && value !== null) {
    return renderObjectNode(key, value, nodePath, isNested);
  }
  return renderLeafNode(key, value, nodePath);
}

function renderObjectNode(key, value, nodePath, isNested) {
  const wrapper = document.createElement('div');

  const row = document.createElement('div');
  row.className = 'tree-row';

  const toggle = mkEl('span', 'toggle', '▶');

  if (key !== null) {
    const keyEl = mkEl('span', 't-key t-key-nav', key);
    keyEl.title = 'Navigate into this node';
    keyEl.addEventListener('click', () => navigateTo(nodePath));
    row.appendChild(toggle);
    row.appendChild(keyEl);
    row.appendChild(mkEl('span', 't-colon', ': '));
  } else {
    row.appendChild(toggle);
  }

  const childKeys = Object.keys(value);
  const countEl = mkEl('span', 't-count', `{${childKeys.length}}`);
  row.appendChild(countEl);
  row.appendChild(buildActions(key, value, nodePath));

  const children = document.createElement('div');
  children.className = 'tree-children';
  children.hidden = true;

  childKeys.forEach(k => {
    children.appendChild(renderNode(k, value[k], [...nodePath, k], true));
  });

  let open = false;
  toggle.addEventListener('click', () => {
    open = !open;
    toggle.textContent = open ? '▼' : '▶';
    children.hidden = !open;
    countEl.hidden = open;
  });

  wrapper.appendChild(row);
  wrapper.appendChild(children);
  return wrapper;
}

function renderLeafNode(key, value, nodePath) {
  const row = document.createElement('div');
  row.className = 'tree-row';

  row.appendChild(mkEl('span', 'toggle')); // spacer keeps alignment

  if (key !== null) {
    row.appendChild(mkEl('span', 't-key', key));
    row.appendChild(mkEl('span', 't-colon', ': '));
  }

  const type = value === null ? 'null' : typeof value;
  row.appendChild(mkEl('span', `t-val ${type}`, value === null ? 'null' : String(value)));
  row.appendChild(buildActions(key, value, nodePath));

  return row;
}

// ── Row action buttons ─────────────────────────────────────────

function buildActions(key, value, nodePath) {
  const div = document.createElement('div');
  div.className = 'row-actions';

  if (typeof value === 'object' && value !== null) {
    div.appendChild(actBtn('+ Add', () => openAddModal(nodePath)));
  } else {
    div.appendChild(actBtn('Edit', () => openEditModal(nodePath, value)));
  }

  if (key !== null) {
    const del = actBtn('Del', async () => {
      if (!confirm(`Delete "${key}"?`)) return;
      await remove(ref(db, nodePath.join('/')));
      reload();
    });
    del.classList.add('danger');
    div.appendChild(del);
  }

  return div;
}

function actBtn(label, onClick) {
  const btn = document.createElement('button');
  btn.className = 'act-btn';
  btn.textContent = label;
  btn.addEventListener('click', onClick);
  return btn;
}

// ── Modal ─────────────────────────────────────────────────────

function openAddModal(parentPath) {
  modalMode = 'add';
  modalPath = parentPath;
  $('modal-title').textContent = 'Add Node';
  $('modal-key-group').hidden = false;
  $('node-key').value = '';
  $('node-value').value = '';
  $('modal-backdrop').hidden = false;
  $('node-key').focus();
}

function openEditModal(nodePath, currentValue) {
  modalMode = 'edit';
  modalPath = nodePath;
  const key = nodePath.at(-1) ?? 'value';
  $('modal-title').textContent = `Edit: ${key}`;
  $('modal-key-group').hidden = true;
  $('node-value').value = currentValue === null ? '' : String(currentValue);
  $('modal-backdrop').hidden = false;
  $('node-value').focus();
}

function closeModal() {
  $('modal-backdrop').hidden = true;
}

async function handleModalConfirm() {
  try {
    if (modalMode === 'add') {
      const key = $('node-key').value.trim();
      if (!key) { $('node-key').focus(); return; }
      const path = [...modalPath, key].join('/');
      await set(ref(db, path || key), parseValue($('node-value').value));
    } else {
      await set(ref(db, modalPath.join('/')), parseValue($('node-value').value));
    }
    closeModal();
    reload();
  } catch (err) {
    alert(`Save failed: ${err.message}`);
  }
}

// ── Helpers ───────────────────────────────────────────────────

function parseValue(raw) {
  const s = raw.trim();
  if (s === 'true')  return true;
  if (s === 'false') return false;
  if (s === 'null')  return null;
  if (s !== '' && !isNaN(Number(s))) return Number(s);
  try { return JSON.parse(s); } catch { return s; }
}

function mkEl(tag, className, text) {
  const el = document.createElement(tag);
  el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}
