import { supabase } from './supabase.js';
import { esc, icon, fmtDate, hue, one, toast, confirmDialog, errMsg, emptyState } from './utils.js';

const PAGE = 15;
const SEL = 'id,content,category,created_at,status,answers';
const COLS = '(id,content,created_at,updated_at)';
const FILTERS = [['pending', 'Para moderar'], ['waiting', 'Sem resposta'], ['answered', 'Respondidas'], ['hidden', 'Ocultas'], ['all', 'Todas']];
const STATUS = { pending: ['Pendente', 'wait'], approved: ['Publicada', 'ok'], hidden: ['Oculta', 'mute'] };

let root, user, filter = 'pending', page = 0, loaded = 0, tok = 0;

export async function renderTeacher(el) {
  root = el;
  el.innerHTML = '<div class="card sk"></div>';
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return loginView();
  try {
    const { data, error } = await supabase.from('teacher_accounts').select('user_id,name').eq('user_id', session.user.id).maybeSingle();
    if (error) throw error;
    if (!data) return deniedView();
    user = { id: session.user.id, name: data.name };
    return dashboard();
  } catch (e) {
    el.innerHTML = emptyState('alert', 'Não foi possível verificar seu acesso', errMsg(e), '<button class="btn btn-primary" id="r">Tentar de novo</button>');
    el.querySelector('#r').addEventListener('click', () => renderTeacher(el));
  }
}

function loginView() {
  root.innerHTML = `<section class="card auth">
    <span class="ib">${icon('lock', 24)}</span>
    <h1 style="font-size:1.8rem;margin:.8rem 0 .3rem">Área do professor</h1>
    <p class="muted" style="margin-bottom:1.2rem">Entre com a conta criada pela coordenação.</p>
    <form class="form" id="login" novalidate>
      <div class="field"><label for="email">E-mail</label><input id="email" type="email" autocomplete="username" required></div>
      <div class="field"><label for="pw">Senha</label><input id="pw" type="password" autocomplete="current-password" required></div>
      <p class="error" id="err" role="alert"></p>
      <button class="btn btn-primary" id="go" type="submit">Entrar</button>
    </form></section>`;
  const f = root.querySelector('#login'), err = root.querySelector('#err'), go = root.querySelector('#go');
  f.addEventListener('submit', async (e) => {
    e.preventDefault(); err.textContent = '';
    const email = f.email.value.trim(), password = f.pw.value;
    if (!email || !password) { err.textContent = 'Informe e-mail e senha.'; return; }
    go.disabled = true; go.innerHTML = '<span class="spin"></span> Entrando…';
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      err.textContent = /invalid/i.test(error.message) ? 'E-mail ou senha incorretos.' : errMsg(error);
      go.disabled = false; go.textContent = 'Entrar';
      return;
    }
    renderTeacher(root);
  });
}

async function signOut() { await supabase.auth.signOut(); renderTeacher(root); }

function deniedView() {
  root.innerHTML = `<section class="card auth">${emptyState('shield', 'Conta sem permissão', 'Esta conta existe, mas não está autorizada como professora. Peça à coordenação para liberar o acesso.', '<button class="btn btn-ghost" id="out">Sair</button>')}</section>`;
  root.querySelector('#out').addEventListener('click', signOut);
}

async function count(build) {
  const { count: c, error } = await build(supabase.from('questions').select('id', { count: 'exact', head: true }));
  if (error) throw error;
  return c ?? 0;
}
async function loadStats() {
  try {
    const [total, pending, published, answers] = await Promise.all([
      count((q) => q), count((q) => q.eq('status', 'pending')), count((q) => q.eq('status', 'approved')),
      supabase.from('answers').select('id', { count: 'exact', head: true }).then(({ count: c, error }) => { if (error) throw error; return c ?? 0; }),
    ]);
    const set = (id, v) => (root.querySelector(id).textContent = v);
    set('#t-total', total); set('#t-pend', pending); set('#t-ans', answers); set('#t-pub', published);
  } catch (e) { console.error(e); }
}

function dashboard() {
  root.innerHTML = `
    <div class="who"><div><h1 style="font-size:2rem">Olá, ${esc(user.name)}</h1><p class="muted">Modere as dúvidas e publique respostas.</p></div>
      <button class="btn btn-ghost btn-sm" id="out">${icon('logout', 18)} Sair</button></div>
    <section class="stats" style="grid-template-columns:repeat(2,1fr)" aria-label="Resumo">
      <div class="card stat indigo"><b id="t-total">–</b><span>perguntas recebidas</span></div>
      <div class="card stat amber"><b id="t-pend">–</b><span>pendentes de moderação</span></div>
      <div class="card stat green"><b id="t-ans">–</b><span>respostas escritas</span></div>
      <div class="card stat indigo"><b id="t-pub">–</b><span>perguntas publicadas</span></div>
    </section>
    <div class="tabs" role="group" aria-label="Filtrar perguntas">${FILTERS.map(([k, l]) => `<button type="button" data-f="${k}" aria-pressed="${k === filter}">${l}</button>`).join('')}</div>
    <div id="list" class="stack" aria-busy="true"></div>
    <div class="center"><button id="more" class="btn btn-ghost" hidden>Carregar mais</button></div>`;
  const list = root.querySelector('#list'), more = root.querySelector('#more');
  root.querySelector('#out').addEventListener('click', signOut);
  root.querySelector('.tabs').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-f]'); if (!b) return;
    filter = b.dataset.f;
    root.querySelectorAll('.tabs button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    load(true);
  });
  more.addEventListener('click', () => load(false));
  list.addEventListener('click', onAction);

  async function load(reset) {
    const t = ++tok;
    if (reset) { page = 0; loaded = 0; list.innerHTML = '<div class="card sk"></div>'.repeat(2); more.hidden = true; }
    list.setAttribute('aria-busy', 'true');
    try {
      let q = supabase.from('questions').select(`id,content,category,created_at,status,answers${filter === 'answered' ? '!inner' : ''}${COLS}`, { count: 'exact' });
      if (filter === 'pending' || filter === 'hidden') q = q.eq('status', filter);
      if (filter === 'waiting') q = q.is('answers', null).neq('status', 'hidden');
      const { data, error, count: total } = await q.order('created_at', { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1);
      if (error) throw error;
      if (t !== tok) return;
      if (reset) list.innerHTML = '';
      if (!data.length && reset) list.innerHTML = emptyState('check', 'Nada por aqui', 'Nenhuma pergunta neste filtro no momento.');
      list.insertAdjacentHTML('beforeend', data.map(card).join(''));
      loaded += data.length; page++; more.hidden = loaded >= (total ?? 0);
    } catch (e) {
      if (t !== tok) return;
      list.innerHTML = emptyState('alert', 'Não deu para carregar', errMsg(e), '<button class="btn btn-primary" id="r">Tentar de novo</button>');
      list.querySelector('#r').addEventListener('click', () => load(true));
    } finally { if (t === tok) list.setAttribute('aria-busy', 'false'); }
  }
  load(true); loadStats();
}

function card(q) {
  const a = one(q.answers), s = STATUS[q.status] || STATUS.pending;
  return `<article class="card tcard" data-id="${q.id}" style="--h:${hue(q.category)}">
    <header class="qmeta"><span class="chip">${esc(q.category)}</span><time datetime="${esc(q.created_at)}">${fmtDate(q.created_at)}</time>
      <span class="badge ${s[1]}">${s[0]}</span>${a ? `<span class="badge ok">${icon('check', 14)} Respondida</span>` : ''}</header>
    <p class="qtext">${esc(q.content)}</p>
    <div class="field"><label for="a-${q.id}">${a ? 'Editar resposta' : 'Sua resposta'}</label>
      <textarea id="a-${q.id}" rows="4" maxlength="2000" style="min-height:110px" placeholder="Escreva a resposta para a turma">${esc(a?.content || '')}</textarea>
      <span class="muted small">Ao publicar, a pergunta e a resposta ficam visíveis no mural.</span></div>
    <div class="actions">
      <button class="btn btn-primary btn-sm" data-act="publish">${icon('send', 16)} ${a ? 'Salvar edição' : 'Publicar resposta'}</button>
      ${q.status !== 'approved' ? `<button class="btn btn-ghost btn-sm" data-act="approve">${icon('check', 16)} Aprovar</button>` : ''}
      ${q.status !== 'hidden' ? `<button class="btn btn-ghost btn-sm" data-act="hide">${icon('eyeoff', 16)} Ocultar</button>` : ''}
      <button class="btn btn-danger-ghost btn-sm" data-act="delete">${icon('trash', 16)} Excluir</button>
    </div></article>`;
}

async function mutate(p) {
  const { data, error } = await p;
  if (error) throw error;
  if (!data?.length) throw new Error('Sem permissão ou item não encontrado.');
}

async function refreshOne(id, el) {
  const { data, error } = await supabase.from('questions').select(`id,content,category,created_at,status,answers${COLS}`).eq('id', id).single();
  if (error) throw error;
  el.outerHTML = card(data);
  loadStats();
}

async function onAction(e) {
  const b = e.target.closest('button[data-act]'); if (!b) return;
  const el = b.closest('.tcard'), id = el.dataset.id, act = b.dataset.act;
  b.disabled = true;
  try {
    if (act === 'publish') {
      const text = el.querySelector('textarea').value.trim();
      if (text.length < 2) { toast('Escreva a resposta antes de publicar.', 'error'); return; }
      await mutate(supabase.from('answers').upsert({ question_id: id, content: text, teacher_id: user.id }, { onConflict: 'question_id' }).select('id'));
      await mutate(supabase.from('questions').update({ status: 'approved' }).eq('id', id).select('id'));
      await refreshOne(id, el); toast('Resposta publicada no mural.', 'success');
    } else if (act === 'approve' || act === 'hide') {
      await mutate(supabase.from('questions').update({ status: act === 'approve' ? 'approved' : 'hidden' }).eq('id', id).select('id'));
      await refreshOne(id, el); toast(act === 'approve' ? 'Pergunta aprovada e visível no mural.' : 'Pergunta ocultada do mural.', 'success');
    } else if (act === 'delete') {
      const ok = await confirmDialog({ title: 'Excluir esta pergunta?', text: 'A pergunta e a resposta serão apagadas de vez. Para só tirar do mural, use Ocultar.', ok: 'Excluir', danger: true });
      if (!ok) return;
      await mutate(supabase.from('questions').delete().eq('id', id).select('id'));
      el.remove(); loadStats(); toast('Pergunta excluída.', 'success');
    }
  } catch (ex) { toast(errMsg(ex), 'error'); }
  finally { b.disabled = false; }
}
