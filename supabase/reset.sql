-- RESET GIFT CONTROL - QUADRO DE TAREFAS
-- Limpa tarefas e histórico. Não mexe em storage.objects.
truncate table public.gift_control_activity_logs restart identity cascade;
truncate table public.gift_control_tasks restart identity cascade;
