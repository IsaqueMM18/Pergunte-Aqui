export const CATEGORIES = ['Matemática', 'Português', 'Ciências', 'História', 'Geografia', 'Tecnologia', 'Outros'];
const HUES = { Matemática: 232, Português: 330, Ciências: 150, História: 28, Geografia: 190, Tecnologia: 268, Outros: 215 };
export const hue = (c) => HUES[c] ?? 215;

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fmtDate = (iso) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso));
export const one = (v) => (Array.isArray(v) ? v[0] : v);

const P = {
  home: '<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  eyeoff: '<path d="M9.9 4.2A10 10 0 0 1 12 4c7 0 10 8 10 8a17 17 0 0 1-2.6 3.8M6.6 6.6A17 17 0 0 0 2 12s3 8 10 8a9.7 9.7 0 0 0 5.4-1.6"/><path d="m2 2 20 20"/>',
  trash: '<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.4 8.2 8 9 4.6-.8 8-4 8-9V6Z"/><path d="m9 12 2 2 4-4"/>',
  book: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5Z"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>',
};
export const icon = (n, s = 20) =>
  `<svg class="ico" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ''}</svg>`;

export function toast(msg, type = 'info') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  document.getElementById('toasts').append(t);
  setTimeout(() => t.remove(), 4500);
}

export function confirmDialog({ title, text, ok = 'Confirmar', danger = false }) {
  const d = document.getElementById('confirm');
  d.querySelector('h2').textContent = title;
  d.querySelector('p').textContent = text;
  const b = d.querySelector('[data-ok]');
  b.textContent = ok;
  b.className = 'btn ' + (danger ? 'btn-danger' : 'btn-primary');
  return new Promise((res) => {
    d.returnValue = '';
    d.onclose = () => res(d.returnValue === 'ok');
    d.showModal();
  });
}

export function errMsg(e) {
  console.error(e);
  if (!navigator.onLine) return 'Você parece estar sem internet. Confira a conexão e tente de novo.';
  const m = String(e?.message || '');
  if (/failed to fetch|network|load failed/i.test(m)) return 'Não conseguimos falar com o servidor. Tente novamente em instantes.';
  if (/jwt|expired|not authenticated/i.test(m)) return 'Sua sessão expirou. Entre novamente.';
  if (e?.code === '42501' || /row-level security|permission/i.test(m)) return 'Esta ação não é permitida para a sua conta.';
  return 'Algo deu errado. Tente novamente em instantes.';
}

export const emptyState = (iconName, title, text, extra = '') =>
  `<div class="card empty"><span class="ib">${icon(iconName, 28)}</span><h3>${esc(title)}</h3><p>${esc(text)}</p>${extra}</div>`;
