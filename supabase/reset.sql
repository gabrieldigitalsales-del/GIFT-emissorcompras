-- Reset somente dos pedidos/itens do sistema.
-- Nao apaga arquivos do Storage, pois o Supabase bloqueia delete direto na tabela storage.objects.
delete from public.gift_pc_items;
delete from public.gift_pc_orders;
alter sequence if exists public.gift_pc_order_number_seq restart with 1;
