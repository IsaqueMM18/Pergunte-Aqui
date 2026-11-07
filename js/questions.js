import { supabase, CONFIG } from './supabase.js';
import { CATEGORIES, esc, fmtDate, icon, hue, one, errMsg, emptyState } from './utils.js';

const PAGE = 8;
const COOLDOWN_MS = 60_000;
const KEY = 'pergunteaqui:ultimo-envio'; // guarda só um horário (controle anti-repetição), nunca perguntas

export function questionCard(q) {
  const a = one(q.answers);
  return `<article class="card qcard" style="--h:${hue(q.category)}">
    <header class="qmeta">
      <span class="chip">${esc(q.category)}</span>
      <time datetime="${esc(q.created_at)}">${fmtDate(q.created_at)}</time>
      <span class="badge ${a ? 'ok' : 'wait'}">${icon(a ? 'check' : 'clock', 14)} ${a ? 'Respondida' : 'Aguardando resposta'}</span>
    </header>
    <p class="qtext">${esc(q.content)}</p>
    ${a ? `<div class="answer"><strong>${icon('chat', 16)} Resposta do professor</strong><p>${esc(a.content)}</p><small>Publicada em ${fmtDate(a.updated_at || a.created_at)}</small></div>` : ''}
  </article>`;
}

export async function fetchStats() {
  const { data, error } = await supabase.rpc('public_stats');
  if (error) throw error;
  return data;
}

export async function fetchQuestions({ search = '', category = '', status = '', order = 'desc', page = 0, size = PAGE }) {
  const inner = status === 'answered' ? '!inner' : '';
  let q = supabase
    .from('questions')
    .select(`id,content,category,created_at,answers${inner}(content,created_at,updated_at)`, { count: 'exact' })
    .eq('status', 'approved');
  if (category) q = q.eq('category', category);
  if (status === 'waiting') q = q.is('answers', null);
  const term = search.trim();
  if (term) q = q.ilike('content', `%${term.replace(/[\\%_]/g, '\\$&')}%`);
  const from = page * size;
  const { data, error, count } = await q.order('created_at', { ascending: order === 'asc' }).range(from, from + size - 1);
  if (error) throw error;
  return { items: data, total: count ?? 0 };
}

/* ------------------------------ MURAL ------------------------------ */
export function renderMural(el) {
  el.innerHTML = `
    <section class="page-head"><h1>Mural de dúvidas</h1>
      <p>Veja o que a turma já perguntou e o que os professores responderam. Só aparecem perguntas aprovadas pela moderação.</p></section>
    <form class="card filters" role="search" aria-label="Filtrar dúvidas" onsubmit="return false">
      <div class="field grow"><label for="q">Pesquisar</label>
        <div class="input-ico">${icon('search')}<input id="q" type="search" placeholder="Ex.: fração, verbo, fotossíntese" autocomplete="off"></div></div>
      <div class="field"><label for="cat">Disciplina</label>
        <select id="cat"><option value="">Todas</option>${CATEGORIES.map((c) => `<option>${c}</option>`).join('')}</select></div>
      <div class="field"><label for="st">Status</label>
        <select id="st"><option value="">Todos</option><option value="answered">Respondidas</option><option value="waiting">Aguardando resposta</option></select></div>
      <div class="field"><label for="ord">Ordem</label>
        <select id="ord"><option value="desc">Mais recentes</option><option value="asc">Mais antigas</option></select></div>
    </form>
    <p id="count" class="muted small" aria-live="polite"></p>
    <div id="list" class="stack" aria-busy="true"></div>
    <div class="center"><button id="more" class="btn btn-ghost" hidden>Carregar mais dúvidas</button></div>`;

  const $ = (s) => el.querySelector(s);
  const list = $('#list'), more = $('#more'), count = $('#count');
  const st = { page: 0, loaded: 0, tok: 0 };
  const params = () => ({ search: $('#q').value, category: $('#cat').value, status: $('#st').value, order: $('#ord').value });

  async function load(reset) {
    const tok = ++st.tok;
    if (reset) { st.page = 0; st.loaded = 0; list.innerHTML = '<div class="card sk"></div>'.repeat(3); more.hidden = true; }
    list.setAttribute('aria-busy', 'true'); more.disabled = true;
    try {
      const { items, total } = await fetchQuestions({ ...params(), page: st.page });
      if (tok !== st.tok) return;
      if (reset) list.innerHTML = '';
      if (!items.length && reset) {
        const filtered = Object.values(params()).some((v, i) => i < 3 && v);
        list.innerHTML = filtered
          ? emptyState('search', 'Nenhuma dúvida encontrada', 'Tente outras palavras ou limpe os filtros.')
          : emptyState('chat', 'O mural ainda está vazio', 'Assim que os professores aprovarem as primeiras perguntas, elas aparecem aqui. Que tal enviar a sua?', '<a class="btn btn-primary" href="#/enviar">Enviar minha dúvida</a>');
      }
      list.insertAdjacentHTML('beforeend', items.map(questionCard).join(''));
      st.loaded += items.length; st.page++;
      count.textContent = total ? `${total} ${total === 1 ? 'dúvida encontrada' : 'dúvidas encontradas'}` : '';
      more.hidden = st.loaded >= total;
    } catch (e) {
      if (tok !== st.tok) return;
      list.innerHTML = emptyState('alert', 'Não deu para carregar o mural', errMsg(e), '<button class="btn btn-primary" id="retry">Tentar de novo</button>');
      $('#retry')?.addEventListener('click', () => load(true));
    } finally {
      if (tok === st.tok) { list.setAttribute('aria-busy', 'false'); more.disabled = false; }
    }
  }

  let t;
  $('#q').addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => load(true), 350); });
  ['#cat', '#st', '#ord'].forEach((s) => $(s).addEventListener('change', () => load(true)));
  more.addEventListener('click', () => load(false));
  load(true);
}

/* ------------------------------ ENVIO ------------------------------ */
const lastSent = () => { try { return Number(localStorage.getItem(KEY)) || 0; } catch { return 0; } };
const markSent = () => { try { localStorage.setItem(KEY, String(Date.now())); } catch { /* ignora */ } };

export function renderSend(el) {
  const started = Date.now();
  el.innerHTML = `
    <section class="page-head"><h1>Qual é a sua dúvida?</h1>
      <p>Escreva do seu jeito. Nenhuma dúvida é boba, e ninguém vai pedir seu nome.</p></section>
    <div class="send-grid">
      <div id="box"><form id="ask" class="card form" novalidate>
        <div class="field"><label for="category">Disciplina</label>
          <select id="category" name="category" required aria-describedby="err">
            <option value="" disabled selected>Escolha uma disciplina</option>${CATEGORIES.map((c) => `<option>${c}</option>`).join('')}
          </select></div>
        <div class="field"><label for="content">Escreva sua pergunta</label>
          <textarea id="content" name="content" maxlength="600" required placeholder="Ex.: Não entendi como dividir frações. Pode explicar com um exemplo?" aria-describedby="hint count err"></textarea>
          <div class="row between"><span id="hint" class="muted small">Mínimo de 10 caracteres.</span><span id="count" class="muted small">0/600</span></div>
        </div>
        <div class="hp" aria-hidden="true"><label>Deixe em branco<input name="website" tabindex="-1" autocomplete="off"></label></div>
        <p id="err" class="error" role="alert"></p>
        <button class="btn btn-primary btn-lg" type="submit" id="go">${icon('send')} Enviar pergunta</button>
      </form></div>
      <aside class="card privacy" aria-label="Sobre privacidade">
        <h2 style="font-size:1.2rem">${icon('lock', 22)} Sobre a sua privacidade</h2>
        <ul>
          <li>Você não precisa informar nome, e-mail nem fazer cadastro.</li>
          <li>Um professor lê a pergunta antes de ela aparecer no mural.</li>
          <li>O sistema não pede identificação, mas a hospedagem e a internet podem registrar dados técnicos (como o endereço IP). Por isso, não escreva dados pessoais na pergunta.</li>
        </ul>
      </aside>
    </div>`;

  const form = el.querySelector('#ask'), content = form.elements.content, err = el.querySelector('#err');
  const go = el.querySelector('#go'), counter = el.querySelector('#count'), box = el.querySelector('#box');
  content.addEventListener('input', () => { counter.textContent = `${content.value.length}/600`; });

  function success() {
    box.innerHTML = `<div class="card success" role="status"><div class="tick">${icon('check', 42)}</div>
      <h2 tabindex="-1" id="ok-title">Pergunta enviada!</h2>
      <p class="muted">Obrigado por perguntar. Um professor vai ler e, quando aprovada, ela aparece no mural.</p>
      <div class="actions"><button class="btn btn-ghost" id="again">Enviar outra dúvida</button><a class="btn btn-primary" href="#/mural">Ver o mural</a></div></div>`;
    box.querySelector('#ok-title').focus();
    box.querySelector('#again').addEventListener('click', () => renderSend(el));
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault(); err.textContent = '';
    const text = content.value.trim(), cat = form.elements.category.value;
    if (form.elements.website.value || Date.now() - started < 2500) return success(); // robô: finge sucesso, não envia
    if (!cat) { err.textContent = 'Escolha uma disciplina.'; form.elements.category.focus(); return; }
    if (text.length < 10) { err.textContent = 'Escreva pelo menos 10 caracteres para o professor entender sua dúvida.'; content.focus(); return; }
    const wait = Math.ceil((COOLDOWN_MS - (Date.now() - lastSent())) / 1000);
    if (wait > 0) { err.textContent = `Você acabou de enviar uma pergunta. Aguarde ${wait}s para enviar outra.`; return; }

    go.disabled = true; go.innerHTML = '<span class="spin"></span> Enviando…';
    try {
      if (CONFIG.USE_EDGE_FUNCTION) {
        const { error } = await supabase.functions.invoke('submit-question', { body: { content: text, category: cat, website: '' } });
        if (error) throw error;
      } else {
        const { error } = await supabase.from('questions').insert({ content: text, category: cat });
        if (error) throw error;
      }
      markSent(); success();
    } catch (ex) {
      err.textContent = ex?.context?.status === 429
        ? 'Muitas perguntas em pouco tempo. Tente de novo mais tarde.'
        : errMsg(ex) + ' Seu texto continua aqui.';
      go.disabled = false; go.innerHTML = `${icon('send')} Enviar pergunta`;
    }
  });
}
