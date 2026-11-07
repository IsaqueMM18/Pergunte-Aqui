import { configured } from './supabase.js';
import { icon, esc, emptyState } from './utils.js';
import { renderSend, renderMural, questionCard, fetchStats, fetchQuestions } from './questions.js';

const main = document.getElementById('main');
const ROUTES = [
  ['', 'Início', 'home'],
  ['enviar', 'Enviar dúvida', 'send'],
  ['mural', 'Mural', 'chat'],
  ['professor', 'Professor', 'user'],
];
document.getElementById('nav').innerHTML = ROUTES.map(([r, label, ic]) => `<a href="#/${r}" data-route="${r}">${icon(ic, 22)}<span>${label}</span></a>`).join('');

function setupNotice(el) {
  el.innerHTML = `<div class="card auth"><h1 style="font-size:1.7rem">Falta configurar o Supabase</h1>
    <p class="muted" style="margin-top:.6rem">Abra <code>js/supabase.js</code> e preencha <code>SUPABASE_URL</code> e <code>SUPABASE_KEY</code> com a URL e a chave pública do seu projeto. O passo a passo está em <code>docs/INSTALACAO.md</code>.</p></div>`;
}

async function home(el) {
  el.innerHTML = `
    <section class="hero">
      <div>
        <h1>Sua dúvida merece espaço. Pergunte sem medo!</h1>
        <p style="margin-top:1rem">O Pergunte Aqui é o canal da escola para você mandar dúvidas aos professores sem precisar se identificar. As respostas ficam públicas no mural, e todo mundo aprende junto.</p>
        <div class="actions" style="margin-top:1.4rem">
          <a class="btn btn-accent btn-lg" href="#/enviar">${icon('send')} Enviar minha dúvida</a>
          <a class="btn btn-ghost btn-lg" href="#/mural">Consultar o mural</a>
        </div>
      </div>
      <div class="hero-art" aria-hidden="true">
        <span class="bub a">Por que isso funciona assim?</span><span class="bub b">Boa pergunta!</span>
        <span class="bub c">Agora eu entendi</span><span class="bub d">?</span>
      </div>
    </section>
    <section class="stats" aria-label="Indicadores">
      <div class="card stat indigo"><b id="s-rec">–</b><span>perguntas recebidas</span></div>
      <div class="card stat green"><b id="s-ans">–</b><span>respondidas e publicadas</span></div>
      <div class="card stat amber"><b id="s-pct">–</b><span>das dúvidas já respondidas</span></div>
    </section>
    <section class="section" aria-labelledby="rec-t">
      <div class="section-head"><h2 id="rec-t">Dúvidas recentes</h2><a href="#/mural">Ver mural completo</a></div>
      <div id="recent" class="stack recent" aria-busy="true">${'<div class="card sk"></div>'.repeat(2)}</div>
    </section>
    <section class="section" aria-labelledby="how-t">
      <h2 id="how-t" style="margin-bottom:1rem">Como funciona</h2>
      <div class="steps">
        <div class="card step"><span class="ib">${icon('edit', 24)}</span><div><h3>Pergunte</h3><p class="muted small">Escolha a disciplina e escreva. Sem nome, sem e-mail, sem cadastro.</p></div></div>
        <div class="card step"><span class="ib">${icon('shield', 24)}</span><div><h3>Moderação</h3><p class="muted small">Um professor lê antes de publicar, para manter o mural respeitoso.</p></div></div>
        <div class="card step"><span class="ib">${icon('book', 24)}</span><div><h3>Aprenda</h3><p class="muted small">Consulte a resposta no mural quando ela for publicada.</p></div></div>
      </div>
    </section>`;

  const $ = (s) => el.querySelector(s);
  fetchStats().then((s) => {
    const rec = Number(s.received) || 0, ans = Number(s.answered) || 0;
    $('#s-rec').textContent = rec; $('#s-ans').textContent = ans;
    $('#s-pct').textContent = rec ? Math.round((ans / rec) * 100) + '%' : '0%';
  }).catch((e) => console.error(e));

  fetchQuestions({ size: 4 }).then(({ items }) => {
    $('#recent').innerHTML = items.length
      ? items.map(questionCard).join('')
      : emptyState('chat', 'Ainda não há dúvidas publicadas', 'Seja a primeira pessoa a perguntar. Ninguém vai saber que foi você.', '<a class="btn btn-primary" href="#/enviar">Enviar minha dúvida</a>');
  }).catch(() => {
    $('#recent').innerHTML = emptyState('alert', 'Não deu para carregar as dúvidas', 'Confira a conexão e recarregue a página.');
  }).finally(() => $('#recent').setAttribute('aria-busy', 'false'));
}

const VIEWS = {
  '': home,
  enviar: renderSend,
  mural: renderMural,
  professor: async (el) => (await import('./teacher.js')).renderTeacher(el),
};

async function router() {
  const route = (location.hash.replace(/^#\/?/, '').split(/[?/]/)[0]) || '';
  const view = VIEWS[route] ? route : '';
  document.querySelectorAll('#nav a').forEach((a) => (a.dataset.route === view ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  main.innerHTML = '';
  if (!configured) setupNotice(main);
  else {
    try { await VIEWS[view](main); }
    catch (e) { console.error(e); main.innerHTML = emptyState('alert', 'Algo deu errado', 'Recarregue a página para tentar de novo.'); }
  }
  document.title = (ROUTES.find((r) => r[0] === view)[1] === 'Início' ? '' : ROUTES.find((r) => r[0] === view)[1] + ' — ') + 'Pergunte Aqui';
  window.scrollTo({ top: 0 });
  main.focus({ preventScroll: true });
}
window.addEventListener('hashchange', router);
router();
