// Configuração pública do Supabase.
// Use SOMENTE a chave pública (anon / publishable). NUNCA coloque a service_role key aqui.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

export const CONFIG = {
  SUPABASE_URL: 'https://hbmwepnoixyenyoyrpxs.supabase.co',
  SUPABASE_KEY: 'sb_publishable_nW0cy3U3RPJsC2NjTAGi1A_vI7kdrBD',
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
