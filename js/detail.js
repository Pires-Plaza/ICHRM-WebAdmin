export function showDetail(title, bodyHTML) {
  document.getElementById('detail-title').textContent = title;
  document.getElementById('detail-body').innerHTML = bodyHTML;
  document.getElementById('detail-backdrop').hidden = false;
}

export function initDetail() {
  document.getElementById('detail-close').addEventListener('click', close);
  document.getElementById('detail-backdrop').addEventListener('click', e => {
    if (e.target === e.currentTarget) close();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') close();
  });
}

function close() {
  document.getElementById('detail-backdrop').hidden = true;
}
