-- =====================================================================
-- Pergunte Aqui — esquema do banco (PostgreSQL / Supabase)
-- Execute este arquivo PRIMEIRO no SQL Editor; depois execute policies.sql.
-- =====================================================================
create extension if not exists pgcrypto;

-- Professores autorizados (vinculados a contas do Supabase Auth)
create table if not exists public.teacher_accounts (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  name       text not null check (char_length(name) between 2 and 80),
  created_at timestamptz not null default now()
);

-- Perguntas (sem nenhum dado de identificação do estudante)
create table if not exists public.questions (
  id          uuid primary key default gen_random_uuid(),
  content     text not null check (char_length(btrim(content)) between 10 and 600),
  category    text not null check (category in
              ('Matemática','Português','Ciências','História','Geografia','Tecnologia','Outros')),
  status      text not null default 'pending' check (status in ('pending','approved','hidden')),
  created_at  timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references public.teacher_accounts(user_id) on delete set null
);
create index if not exists questions_status_created_idx on public.questions (status, created_at desc);
create index if not exists questions_category_idx on public.questions (category);

-- Respostas (no máximo uma por pergunta; pode ser editada)
create table if not exists public.answers (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null unique references public.questions(id) on delete cascade,
  content     text not null check (char_length(btrim(content)) between 2 and 2000),
  teacher_id  uuid references public.teacher_accounts(user_id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Registro técnico usado SOMENTE pela Edge Function (limite de envios). Guarda hash, nunca o IP.
create table if not exists public.submission_log (
  id         bigint generated always as identity primary key,
  ip_hash    text not null,
  created_at timestamptz not null default now()
);
create index if not exists submission_log_ip_idx on public.submission_log (ip_hash, created_at desc);

-- Funções auxiliares ---------------------------------------------------
create or replace function public.is_teacher()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.teacher_accounts where user_id = auth.uid());
$$;

-- Indicadores públicos: apenas números, sem expor perguntas pendentes.
create or replace function public.public_stats()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'received', (select count(*) from public.questions),
    'answered', (select count(*) from public.answers a
                 join public.questions q on q.id = a.question_id
                 where q.status = 'approved')
  );
$$;

-- Gatilhos ---------------------------------------------------------------
create or replace function public.touch_answer()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end; $$;
drop trigger if exists trg_touch_answer on public.answers;
create trigger trg_touch_answer before update on public.answers
  for each row execute function public.touch_answer();

-- Carimba aprovação automaticamente quando o status muda
create or replace function public.stamp_approval()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    new.approved_at := now(); new.approved_by := auth.uid();
  elsif new.status <> 'approved' then
    new.approved_at := null; new.approved_by := null;
  end if;
  return new;
end; $$;
drop trigger if exists trg_stamp_approval on public.questions;
create trigger trg_stamp_approval before update of status on public.questions
  for each row execute function public.stamp_approval();
