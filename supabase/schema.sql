-- ============================================================
-- GIFT CONTROL - QUADRO DE TAREFAS INTELIGENTE
-- Banco zerado e sem conflito com outros projetos
-- Prefixo: gift_control_
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.gift_control_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  period text not null default 'dia' check (period in ('dia','semana','mes','ano')),
  column_key text not null default 'ideias' check (column_key in ('ideias','fazer','andamento','aguardando','concluido')),
  priority text not null default 'média' check (priority in ('baixa','média','alta','urgente')),
  due_date date,
  responsible text,
  recurrence text default 'única',
  tags text,
  color text default 'red',
  checklist text,
  observations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gift_control_tasks_period_idx on public.gift_control_tasks(period);
create index if not exists gift_control_tasks_column_idx on public.gift_control_tasks(column_key);
create index if not exists gift_control_tasks_due_date_idx on public.gift_control_tasks(due_date);

create or replace function public.gift_control_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists gift_control_tasks_updated_at on public.gift_control_tasks;
create trigger gift_control_tasks_updated_at
before update on public.gift_control_tasks
for each row execute function public.gift_control_set_updated_at();

-- Modo simples para começar rápido.
-- Se quiser usar Supabase Auth depois, substitua as policies por regras com auth.uid().
alter table public.gift_control_tasks enable row level security;

drop policy if exists "gift_control_tasks_select" on public.gift_control_tasks;
drop policy if exists "gift_control_tasks_insert" on public.gift_control_tasks;
drop policy if exists "gift_control_tasks_update" on public.gift_control_tasks;
drop policy if exists "gift_control_tasks_delete" on public.gift_control_tasks;

create policy "gift_control_tasks_select" on public.gift_control_tasks for select using (true);
create policy "gift_control_tasks_insert" on public.gift_control_tasks for insert with check (true);
create policy "gift_control_tasks_update" on public.gift_control_tasks for update using (true) with check (true);
create policy "gift_control_tasks_delete" on public.gift_control_tasks for delete using (true);

-- Histórico separado do quadro
create table if not exists public.gift_control_activity_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  details text,
  task_id uuid,
  task_title text,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists gift_control_activity_logs_created_idx on public.gift_control_activity_logs(created_at desc);
create index if not exists gift_control_activity_logs_task_idx on public.gift_control_activity_logs(task_id);

alter table public.gift_control_activity_logs enable row level security;

drop policy if exists "gift_control_activity_logs_select" on public.gift_control_activity_logs;
drop policy if exists "gift_control_activity_logs_insert" on public.gift_control_activity_logs;
drop policy if exists "gift_control_activity_logs_delete" on public.gift_control_activity_logs;

create policy "gift_control_activity_logs_select" on public.gift_control_activity_logs for select using (true);
create policy "gift_control_activity_logs_insert" on public.gift_control_activity_logs for insert with check (true);
create policy "gift_control_activity_logs_delete" on public.gift_control_activity_logs for delete using (true);
