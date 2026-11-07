# Instalação passo a passo

Tempo estimado: 20 a 30 minutos. Você precisa de uma conta no [Supabase](https://supabase.com) e outra no [GitHub](https://github.com), ambas gratuitas.

## 1. Criar o projeto no Supabase
1. Em supabase.com, clique em **New project**, escolha um nome (ex.: `pergunte-aqui`), região próxima (ex.: São Paulo) e defina a senha do banco. Guarde-a.
2. Aguarde o projeto ficar pronto.

## 2. Criar tabelas e políticas de segurança
1. Menu **SQL Editor → New query**.
2. Cole todo o conteúdo de `sql/schema.sql` e clique em **Run**.
3. Abra outra consulta, cole `sql/policies.sql` e clique em **Run**.

Ambos podem ser executados novamente sem causar erro.

## 3. Configurar a autenticação
1. **Authentication → Sign In / Providers** (ou *Providers → Email*): mantenha **Email** ativo.
2. Desative **Allow new users to sign up** (cadastro público). Assim ninguém cria conta sozinho.
   Mesmo que isso fique ligado por engano, as políticas RLS impedem que uma conta não autorizada leia ou altere perguntas.
3. Opcional: desative *Confirm email*, ou marque *Auto Confirm User* ao criar a conta (passo 4).

## 4. Criar a primeira conta de professor
1. **Authentication → Users → Add user → Create new user**.
2. Informe e-mail e senha forte e marque **Auto Confirm User**.
3. No **SQL Editor**, autorize essa conta (troque e-mail e nome):
```sql
insert into public.teacher_accounts (user_id, name)
select id, 'Nome da Professora'
from auth.users
where email = 'professora@escola.edu.br';
```
4. Para outros professores, repita os dois passos. Para revogar o acesso:
`delete from public.teacher_accounts where user_id = '...';`

Ter conta no Auth **não** basta: sem a linha em `teacher_accounts`, o painel recusa o acesso e o banco bloqueia as consultas.

## 5. Colocar as credenciais públicas
1. **Project Settings → API** (ou *API Keys*).
2. Copie a **Project URL** e a chave **anon / publishable** (começa com `eyJ...` ou `sb_publishable_...`).
3. Edite `js/supabase.js`:
```js
SUPABASE_URL: 'https://xxxx.supabase.co',
SUPABASE_KEY: 'sua-chave-publica',
```
**Nunca** use a `service_role` / `secret` key nesse arquivo. A chave pública é feita para ficar no navegador; a proteção real vem do RLS.

## 6. Testar no computador
Os módulos JavaScript não funcionam abrindo o arquivo direto (`file://`). Use um servidor estático:
```bash
cd pergunte-aqui
python3 -m http.server 8000
```
Acesse `http://localhost:8000`.

## 7. Publicar no GitHub Pages
1. Crie um repositório (ex.: `pergunte-aqui`) e envie os arquivos, com `index.html` na raiz:
```bash
git init && git add . && git commit -m "Pergunte Aqui"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/pergunte-aqui.git
git push -u origin main
```
2. No GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, branch `main`, pasta `/ (root)` → **Save**.
3. Em 1 a 2 minutos o site estará em `https://SEU-USUARIO.github.io/pergunte-aqui/`.

**Subdiretório:** todos os caminhos são relativos (`css/...`, `js/...`) e a navegação usa `#/rota`, então funciona em `/pergunte-aqui/` sem ajustes. O arquivo `.nojekyll` evita processamento do Jekyll.

**Auth:** em **Authentication → URL Configuration**, defina *Site URL* como a URL do GitHub Pages (boa prática, mesmo sem e-mails de recuperação).

## 8. (Recomendado) Limite de envios no servidor com Edge Function
Sem a função, o app já usa honeypot, tempo mínimo de preenchimento, intervalo de 60 s entre envios no navegador e validações no banco. Esses controles de navegador podem ser contornados por quem chamar a API diretamente. A função aplica limite por IP (3 a cada 10 min, 10 por dia; guarda apenas hash).

```bash
npm i -g supabase            # ou: brew install supabase/tap/supabase
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase secrets set RATE_SALT="uma-frase-aleatoria-longa" ALLOWED_ORIGIN="https://SEU-USUARIO.github.io"
supabase functions deploy submit-question
```
Depois:
1. Execute `sql/hardening_edge_function.sql` (fecha o envio direto).
2. Em `js/supabase.js`, troque `USE_EDGE_FUNCTION: true`, faça commit e push.

## 9. Roteiro de testes
1. **Envio:** em *Enviar dúvida*, escolha uma disciplina, escreva 10+ caracteres e envie. Deve aparecer a tela de sucesso.
2. **Visitante não vê pendentes:** abra o *Mural* (de preferência em janela anônima). A pergunta ainda **não** deve aparecer. O indicador "perguntas recebidas" na Início deve subir.
3. **Login:** em *Professor*, entre com a conta autorizada. Confira os números e a pergunta em *Para moderar*.
4. **Publicar:** escreva uma resposta e clique em **Publicar resposta**. A pergunta passa a *Publicada*.
5. **Mural:** recarregue o mural em outro dispositivo/janela anônima. Pergunta e resposta aparecem com o selo verde *Respondida*.
6. **Editar:** no painel, altere o texto e clique em **Salvar edição**; confira no mural.
7. **Ocultar/Excluir:** *Ocultar* remove do mural; *Excluir* pede confirmação.
8. **Segurança:** em janela anônima, acesse `#/professor`: deve mostrar só o login. Uma conta sem linha em `teacher_accounts` vê "Conta sem permissão".

## Problemas comuns
| Sintoma | Causa provável |
|---|---|
| Tela "Falta configurar o Supabase" | `js/supabase.js` ainda com os textos `COLE_AQUI` |
| Erro ao enviar pergunta (permissão) | `policies.sql` não executado, ou modo Edge Function ativo sem função publicada |
| Login funciona, mas "Conta sem permissão" | Falta inserir o usuário em `teacher_accounts` (passo 4) |
| Página em branco no GitHub Pages | Pages não ativado, ou `index.html` fora da raiz |
| Erro de CORS na Edge Function | `ALLOWED_ORIGIN` deve ser só a origem (`https://usuario.github.io`), sem `/pergunte-aqui` |
