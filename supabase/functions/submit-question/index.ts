// Edge Function: validação + limite de envios no servidor.
// Deploy: supabase functions deploy submit-question
// Segredos: supabase secrets set RATE_SALT="texto-aleatorio-longo" ALLOWED_ORIGIN="https://SEU-USUARIO.github.io"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const CATS = ['Matemática', 'Português', 'Ciências', 'História', 'Geografia', 'Tecnologia', 'Outros'];
const LIMIT_10MIN = 3;
const LIMIT_DAY = 10;

const cors = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

async function sha256(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let body: { content?: string; category?: string; website?: string };
  try { body = await req.json(); } catch { return json({ error: 'invalid_json' }, 400); }

  if (body.website) return json({ ok: true });                       // honeypot: finge sucesso

  const content = String(body.content ?? '').trim();
  const category = String(body.category ?? '');
  if (content.length < 10 || content.length > 600) return json({ error: 'invalid_content' }, 400);
  if (!CATS.includes(category)) return json({ error: 'invalid_category' }, 400);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const ip = (req.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim();
  const ipHash = await sha256(ip + (Deno.env.get('RATE_SALT') ?? 'troque-este-sal'));   // nunca guardamos o IP puro

  const since = (ms: number) => new Date(Date.now() - ms).toISOString();
  const [{ count: recent }, { count: today }] = await Promise.all([
    admin.from('submission_log').select('id', { count: 'exact', head: true }).eq('ip_hash', ipHash).gte('created_at', since(10 * 60_000)),
    admin.from('submission_log').select('id', { count: 'exact', head: true }).eq('ip_hash', ipHash).gte('created_at', since(24 * 3600_000)),
  ]);
  if ((recent ?? 0) >= LIMIT_10MIN || (today ?? 0) >= LIMIT_DAY) return json({ error: 'rate_limited' }, 429);

  const { error } = await admin.from('questions').insert({ content, category });
  if (error) return json({ error: 'insert_failed' }, 500);

  await admin.from('submission_log').insert({ ip_hash: ipHash });
  await admin.from('submission_log').delete().lt('created_at', since(48 * 3600_000));   // limpeza
  return json({ ok: true });
});
