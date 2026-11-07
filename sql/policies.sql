-- =====================================================================
-- Pergunte Aqui — permissões e Row Level Security
-- Execute DEPOIS de schema.sql.
-- =====================================================================
alter table public.teacher_accounts enable row level security;
alter table public.questions        enable row level security;
alter table public.answers          enable row level security;
alter table public.submission_log   enable row level security;   -- sem políticas = ninguém acessa pela API

-- Começa do zero: remove privilégios padrão e concede só o necessário
revoke all on public.teacher_accounts, public.questions, public.answers, public.submission_log
  from anon, authenticated;

grant select on public.questions to anon, authenticated;
grant insert (content, category) on public.questions to anon, authenticated;  -- status fica sempre 'pending'
grant update (status) on public.questions to authenticated;                   -- só moderação (e só professor, via RLS)
grant delete on public.questions to authenticated;

grant select on public.answers to anon, authenticated;
grant insert, update, delete on public.answers to authenticated;

grant select on public.teacher_accounts to authenticated;

grant execute on function public.is_teacher()   to anon, authenticated;
grant execute on function public.public_stats() to anon, authenticated;

-- QUESTIONS ----------------------------------------------------------------
drop policy if exists "questions_insert_public"  on public.questions;
drop policy if exists "questions_select"         on public.questions;
drop policy if exists "questions_update_teacher" on public.questions;
drop policy if exists "questions_delete_teacher" on public.questions;

-- Qualquer visitante pode enviar, sempre como pendente
create policy "questions_insert_public" on public.questions
  for insert to anon, authenticated
  with check (status = 'pending' and approved_at is null and approved_by is null);

-- Visitantes veem apenas perguntas aprovadas; professores autorizados veem tudo
create policy "questions_select" on public.questions
  for select to anon, authenticated
  using (status = 'approved' or public.is_teacher());

create policy "questions_update_teacher" on public.questions
  for update to authenticated
  using (public.is_teacher()) with check (public.is_teacher());

create policy "questions_delete_teacher" on public.questions
  for delete to authenticated using (public.is_teacher());

-- ANSWERS ------------------------------------------------------------------
drop policy if exists "answers_select"        on public.answers;
drop policy if exists "answers_write_teacher" on public.answers;

-- Respostas só são públicas se a pergunta estiver aprovada
create policy "answers_select" on public.answers
  for select to anon, authenticated
  using (
    public.is_teacher()
    or exists (select 1 from public.questions q where q.id = question_id and q.status = 'approved')
  );

create policy "answers_write_teacher" on public.answers
  for all to authenticated
  using (public.is_teacher()) with check (public.is_teacher());

-- TEACHER_ACCOUNTS -----------------------------------------------------------
-- O professor só enxerga a própria linha. Inserções são feitas pelo administrador no SQL Editor.
drop policy if exists "teachers_select_self" on public.teacher_accounts;
create policy "teachers_select_self" on public.teacher_accounts
  for select to authenticated using (user_id = auth.uid());
