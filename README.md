# Pergunte Aqui

> Sua dúvida merece espaço. Pergunte sem medo!

Aplicação web escolar para estudantes enviarem dúvidas aos professores **sem cadastro nem identificação**, e para consultarem no mural as respostas publicadas. Os professores moderam e respondem por um painel com login.

Front-end estático (HTML, CSS e JavaScript ES modules) hospedado no **GitHub Pages**; dados e autenticação no **Supabase** (PostgreSQL + Auth + RLS). Não há Node.js nem servidor próprio em produção.

## Recursos
- **Início:** proposta, indicadores (recebidas / respondidas) e dúvidas recentes.
- **Enviar dúvida:** disciplina, texto com contador, aviso de privacidade, honeypot, intervalo entre envios e tela de sucesso.
- **Mural:** pesquisa, filtros por disciplina e status, ordenação, "carregar mais". Só mostra perguntas aprovadas.
- **Painel do professor** (`#/professor`): login por e-mail/senha (Supabase Auth), resumo, moderação (aprovar, ocultar, excluir com confirmação), publicar e editar respostas.
- Mobile-first, navegação inferior no celular, foco visível, `prefers-reduced-motion`, estados de carregamento/erro/vazio.

## Estrutura
```
index.html
assets/icons/logo.svg  assets/images/
css/styles.css  css/responsive.css
js/supabase.js   configuração pública e cliente
js/utils.js      ícones, toasts, diálogo de confirmação, erros
js/app.js        rotas (#/, #/enviar, #/mural, #/professor) e página inicial
js/questions.js  envio e mural
js/teacher.js    login e painel (carregado só na rota do professor)
sql/schema.sql   tabelas, funções, gatilhos
sql/policies.sql permissões + RLS
sql/hardening_edge_function.sql  (opcional)
supabase/functions/submit-question/index.ts  (opcional) limite de envios
docs/INSTALACAO.md
```
*Ajuste em relação ao pedido:* acrescentei `js/utils.js` (código compartilhado) e a pasta `supabase/functions`.

## Começar
Siga **[docs/INSTALACAO.md](docs/INSTALACAO.md)**: criar projeto Supabase → rodar `schema.sql` e `policies.sql` → desativar cadastro público e criar a conta do professor → colar URL e chave pública em `js/supabase.js` → publicar no GitHub Pages → roteiro de testes.

## Modelo de segurança
| Quem | Pode |
|---|---|
| Visitante | Inserir pergunta (só `content` e `category`; status sempre `pending`); ler perguntas `approved` e respectivas respostas; ler os números de `public_stats()` |
| Visitante | **Não** pode ler pendentes/ocultas, alterar, excluir ou responder |
| Professor autorizado (`teacher_accounts`) | Ler tudo; alterar o status; excluir; criar, editar e excluir respostas |
| Conta autenticada sem autorização | Mesmos direitos de visitante |

- Só a chave pública (anon/publishable) vai ao navegador. A `service_role` fica apenas na Edge Function, como segredo do Supabase.
- Conhecer a URL `#/professor` não dá acesso: a autorização é feita no banco (RLS + `is_teacher()`), não na tela.
- Privilégios por coluna: visitantes só inserem `content` e `category`; professores só atualizam `status`. A data de aprovação é carimbada por gatilho.
- Professores não se cadastram sozinhos: criar a conta no Supabase e inserir em `teacher_accounts`.

## Anonimato (o que é e o que não é)
O sistema **não solicita** nome, e-mail, matrícula nem cadastro, e não grava IP nas tabelas de perguntas. Isso **não** é anonimato absoluto: hospedagem, Supabase, rede da escola e provedores podem registrar metadados técnicos (como IP). A Edge Function opcional guarda somente um hash do IP, por até 48 h, para limitar abuso. Oriente os estudantes a não escrever dados pessoais no texto.

## Anti-spam
Camadas: campo honeypot, tempo mínimo de preenchimento, intervalo de 60 s no navegador, restrições de tamanho e categoria no banco e, opcionalmente, limite por IP na Edge Function. Para abuso sério, ative o limite de requisições do Supabase e considere um CAPTCHA.

## Limitações do MVP
- Uma resposta por pergunta.
- Moderação é por pergunta, sem fila de denúncias.
- Sem notificações e sem recuperação de senha na interface (o administrador redefine no painel do Supabase).
- Não foi possível testar contra um projeto Supabase real no ambiente de desenvolvimento; use o roteiro de testes da instalação antes de divulgar.

## Licença
Uso livre para fins educacionais. Ajuste conforme a política da sua escola.
