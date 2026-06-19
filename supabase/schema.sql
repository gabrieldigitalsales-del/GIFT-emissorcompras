-- ============================================================
-- GIFT Emissor de Pedido de Compra - Supabase SQL unico
-- Compras cria pedido; financeiro aprova/recusa e anexa comprovante.
-- Pode rodar no SQL Editor do Supabase mesmo se ja tiver rodado versao antiga.
-- ============================================================

create extension if not exists pgcrypto;

create sequence if not exists public.gift_pc_order_number_seq start 1;

create table if not exists public.gift_pc_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null default ('PC-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.gift_pc_order_number_seq')::text, 4, '0')),
  company text not null default 'GIFT EXCELLENCE',
  requester text,
  order_date date not null default current_date,
  status text not null default 'Pendente',
  notes text,
  total numeric(12,2) not null default 0,
  proof_path text,
  proof_url text,
  proof_name text,
  proof_uploaded_at timestamptz,
  approved_at timestamptz,
  rejected_at timestamptz,
  decision_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gift_pc_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.gift_pc_orders(id) on delete cascade,
  name text not null,
  link text,
  quantity_text text not null,
  package_count numeric(12,2) not null default 1,
  quantity_multiplier numeric(12,2) not null default 1,
  unit_value numeric(12,2) not null default 0,
  subtotal numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

-- Migração segura caso voce ja tenha rodado a primeira versao.
alter table public.gift_pc_orders add column if not exists proof_path text;
alter table public.gift_pc_orders add column if not exists proof_url text;
alter table public.gift_pc_orders add column if not exists proof_name text;
alter table public.gift_pc_orders add column if not exists proof_uploaded_at timestamptz;
alter table public.gift_pc_orders add column if not exists approved_at timestamptz;
alter table public.gift_pc_orders add column if not exists rejected_at timestamptz;
alter table public.gift_pc_orders add column if not exists decision_notes text;

alter table public.gift_pc_items add column if not exists package_count numeric(12,2) not null default 1;
alter table public.gift_pc_items add column if not exists quantity_multiplier numeric(12,2) not null default 1;

create or replace function public.gift_pc_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists gift_pc_orders_updated_at on public.gift_pc_orders;
create trigger gift_pc_orders_updated_at
before update on public.gift_pc_orders
for each row execute function public.gift_pc_set_updated_at();

create index if not exists gift_pc_orders_created_at_idx on public.gift_pc_orders(created_at desc);
create index if not exists gift_pc_orders_status_idx on public.gift_pc_orders(status);
create index if not exists gift_pc_items_order_id_idx on public.gift_pc_items(order_id);

-- App com senha simples no front-end.
-- Para uso interno rapido, as policies abaixo permitem leitura/escrita com a chave anon do projeto.
alter table public.gift_pc_orders enable row level security;
alter table public.gift_pc_items enable row level security;

drop policy if exists "gift_pc_orders_select" on public.gift_pc_orders;
drop policy if exists "gift_pc_orders_insert" on public.gift_pc_orders;
drop policy if exists "gift_pc_orders_update" on public.gift_pc_orders;
drop policy if exists "gift_pc_orders_delete" on public.gift_pc_orders;

drop policy if exists "gift_pc_items_select" on public.gift_pc_items;
drop policy if exists "gift_pc_items_insert" on public.gift_pc_items;
drop policy if exists "gift_pc_items_update" on public.gift_pc_items;
drop policy if exists "gift_pc_items_delete" on public.gift_pc_items;

create policy "gift_pc_orders_select" on public.gift_pc_orders for select using (true);
create policy "gift_pc_orders_insert" on public.gift_pc_orders for insert with check (true);
create policy "gift_pc_orders_update" on public.gift_pc_orders for update using (true) with check (true);
create policy "gift_pc_orders_delete" on public.gift_pc_orders for delete using (true);

create policy "gift_pc_items_select" on public.gift_pc_items for select using (true);
create policy "gift_pc_items_insert" on public.gift_pc_items for insert with check (true);
create policy "gift_pc_items_update" on public.gift_pc_items for update using (true) with check (true);
create policy "gift_pc_items_delete" on public.gift_pc_items for delete using (true);

-- Bucket publico para comprovantes.
-- O app salva o link publico do comprovante no pedido.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gift-pedido-comprovantes',
  'gift-pedido-comprovantes',
  true,
  10485760,
  array['image/png','image/jpeg','image/webp','application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Policies do Storage. Se alguma policy ja existir, ela sera recriada.
drop policy if exists "gift_pc_receipts_select" on storage.objects;
drop policy if exists "gift_pc_receipts_insert" on storage.objects;
drop policy if exists "gift_pc_receipts_update" on storage.objects;

create policy "gift_pc_receipts_select"
on storage.objects for select
using (bucket_id = 'gift-pedido-comprovantes');

create policy "gift_pc_receipts_insert"
on storage.objects for insert
with check (bucket_id = 'gift-pedido-comprovantes');

create policy "gift_pc_receipts_update"
on storage.objects for update
using (bucket_id = 'gift-pedido-comprovantes')
with check (bucket_id = 'gift-pedido-comprovantes');
