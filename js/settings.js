import { loadAll, saveDoc } from './db.js';

const view = () => document.getElementById('view');

export async function render() {
  view().innerHTML = '<p class="view-loading">Loading…</p>';

  const conf = await loadAll('conference');

  const v = view();
  v.innerHTML = '';

  const header = el('div', 'view-header');
  header.appendChild(el('h1', 'view-title', 'Settings'));
  v.appendChild(header);

  v.appendChild(buildConferenceCard(conf));
}

function buildConferenceCard(conf) {
  const ongoing = conf.ongoing === true;

  const saveBtn = btn('Save', 'btn-primary', async () => {
    saveBtn.disabled    = true;
    saveBtn.textContent = 'Saving…';
    try {
      await saveDoc('conference', { ongoing: cb.checked });
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
  cardHeader.appendChild(el('h2', 'settings-card-title', 'Conference Status'));
  cardHeader.appendChild(saveBtn);
  card.appendChild(cardHeader);

  const wrap = el('div', 'toggle-wrap');
  wrap.innerHTML = `
    <label class="toggle">
      <input type="checkbox" id="f-ongoing" ${ongoing ? 'checked' : ''}>
      <span class="toggle-track"><span class="toggle-thumb"></span></span>
    </label>
    <span id="f-ongoing-label" class="toggle-label"></span>
  `;

  const cb    = wrap.querySelector('#f-ongoing');
  const label = wrap.querySelector('#f-ongoing-label');

  const updateLabel = () => {
    label.innerHTML = cb.checked
      ? 'Conference is <strong>ongoing</strong>'
      : 'Conference is <strong>not ongoing</strong>';
  };

  cb.addEventListener('change', updateLabel);
  updateLabel();
  card.appendChild(wrap);

  return card;
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
