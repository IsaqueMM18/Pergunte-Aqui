-- OPCIONAL: use depois de publicar a Edge Function "submit-question".
-- Fecha o envio direto pela API e obriga o uso da função (que limita envios por IP).
-- Depois de executar, ajuste USE_EDGE_FUNCTION = true em js/supabase.js.
drop policy if exists "questions_insert_public" on public.questions;
revoke insert on public.questions from anon, authenticated;

-- Para voltar ao modo direto, execute novamente o bloco de insert de policies.sql.
