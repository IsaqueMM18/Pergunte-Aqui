// Configuração pública do Supabase.
// Use SOMENTE a chave pública (anon / publishable). NUNCA coloque a service_role key aqui.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

export const CONFIG = {
  SUPABASE_URL: 'COLE_AQUI_A_PROJECT_URL',          // ex.: https://abcdefgh.supabase.co
  SUPABASE_KEY: 'COLE_AQUI_A_CHAVE_PUBLICA',        // anon key ou publishable key (sb_publishable_...)
  USE_EDGE_FUNCTION: false,                         // true após publicar a função submit-question
};

export const configured =
  /^https:\/\/.+\.supabase\.(co|in)/.test(CONFIG.SUPABASE_URL) && CONFIG.SUPABASE_KEY.length > 20 &&
  !CONFIG.SUPABASE_KEY.startsWith('COLE_AQUI');

export const supabase = configured
  ? createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    })
  : null;
