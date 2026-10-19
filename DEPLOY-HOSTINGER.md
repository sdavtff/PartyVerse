# Publicar o PartyVerse na Hostinger (plano Business ou Cloud)

> **Jeito recomendado: ligado ao GitHub.** O código fica no repositório `sdavtff/PartyVerse`.
> Cada atualização enviada para a branch `main` publica o site sozinha — sem subir arquivo.
> O repositório já traz a versão compilada, então a Hostinger não precisa rodar build.
>
> No hPanel: **Websites → Add Website → Node.js web app → Import Git repository** →
> conecte o GitHub → escolha `sdavtff/PartyVerse`, branch `main` → configure:
> Build command **vazio**, Entry file **`server.cjs`**, Node **22** → cadastre as variáveis
> do passo 5 → **Deploy**. Pronto: daqui em diante é automático.
>
> As seções abaixo detalham banco, variáveis e solução de problemas (valem para os dois jeitos).

O PartyVerse é um único app Node.js: o mesmo processo entrega o site, a API e o tempo real
(Socket.IO). Na Hostinger ele roda como **Node.js Web App**.

O banco é **PostgreSQL** (os bancos do hPanel são MySQL), então usamos o **Supabase** (grátis).
O banco é opcional: sem ele, todo mundo joga como convidado; com ele, funcionam contas,
estatísticas e histórico.

---

## 1. Criar o banco no Supabase (5 min, opcional mas recomendado)

1. Acesse <https://supabase.com>, crie uma conta e clique em **New project**.
2. Dê um nome (ex.: `partyverse`), **anote a senha do banco** e escolha a região **South America (São Paulo)**.
3. Com o projeto criado, clique em **Connect** (topo da página).
4. Copie a string da seção **Session pooler** (porta `5432`). Ela é assim:
   `postgresql://postgres.abcdefgh:[YOUR-PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:5432/postgres`
5. Troque `[YOUR-PASSWORD]` pela senha que você anotou. Esse é o seu `DATABASE_URL`.

> Use o **Session pooler**, não o "Direct connection" (que só funciona em IPv6) nem o
> "Transaction pooler" (porta 6543).

As tabelas são criadas automaticamente na primeira vez que o servidor sobe.

## 2. Gerar o segredo das sessões

Qualquer texto longo e aleatório serve. Exemplo de como gerar (no terminal do seu PC):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Guarde o resultado: é o seu `JWT_SECRET`.

## 3. Criar o app na Hostinger

1. No hPanel: **Websites → Add Website → Node.js web app**.
2. Escolha como enviar o código:
   - **Upload your files**: envie o `.zip` do projeto (sem `node_modules`), **ou**
   - **Import Git repository**: conecte o GitHub e escolha o repositório (recomendado: cada
     `git push` publica de novo sozinho).
3. Escolha o domínio do site.

## 4. Configurações de build

| Campo | Valor |
|---|---|
| Framework preset | **Express** (ou **Other**) |
| Node.js version | **22** |
| Root directory | `/` (deixe a raiz) |
| Build command | *(deixe vazio — a versão compilada já vem pronta)* |
| Package manager | **npm** |
| Output directory | *(deixe vazio)* |
| Entry file | `server.cjs` |

## 5. Variáveis de ambiente

Em **Environment variables**, cadastre:

| Nome | Valor |
|---|---|
| `DATABASE_URL` | a string do Supabase (passo 1) |
| `JWT_SECRET` | o segredo do passo 2 |
| `CORS_ORIGINS` | `https://seudominio.com.br` |

Não precisa definir `PORT` (a Hostinger define) nem `NODE_ENV` (o `server.js` já usa `production`).

## 6. Publicar e conferir

1. Clique em **Deploy** e acompanhe em **Deployments** (leva alguns minutos).
2. Em **Runtime logs**, procure a linha `PartyVerse ouvindo na porta …`.
   Se configurou o banco, aparece antes `banco atualizado`.
3. Verifique se o **SSL** do domínio está ativo (hPanel → Segurança → SSL) e abra o site com
   `https://`.
4. Teste de verdade: crie uma sala no computador e entre pelo celular com o código.

## Atualizar o site depois

- **GitHub**: envie para a branch `main` (com `npm run build` antes) e a Hostinger publica sozinha.
- **Zip**: gere um novo zip e envie em **Deployments → Redeploy** (ou pelo upload de novo).

## Problemas comuns

| Sintoma | O que fazer |
|---|---|
| Build falha | Abra o log em **Deployments**. Confira Node 22 e o build command `npm run build`. |
| Tela preta "503 Service Unavailable" | O app não iniciou. Confira se o Entry file é `server.cjs` e leia os **Runtime logs** (a linha com `[PartyVerse]` diz o motivo). |
| Site abre mas fica "conectando…" | Veja os **Runtime logs**. |
| Cadastro/login dá erro 503 | `DATABASE_URL` não configurado ou errado. Veja o log `não foi possível preparar o banco`. |
| Cadastro diz "Contas temporariamente indisponíveis" | O servidor não conecta ao banco. Veja a linha `[PartyVerse] ERRO no banco` nos Runtime logs. O servidor tenta de novo sozinho a cada minuto. |
| Login não "segura" (volta deslogado) | Acesse com `https://`; sem SSL o navegador descarta o cookie seguro. |
| Todos deslogam após reiniciar | Falta `JWT_SECRET` nas variáveis. |
| Jogo com atraso perceptível | O Socket.IO cai para *long-polling* se o WebSocket não passar pelo proxy. Funciona, só com um pouco mais de latência. Para tempo real máximo, use uma VPS (ver README → Docker). |

> Salas ficam na memória do servidor: ao republicar ou reiniciar o app, as salas abertas
> acabam (contas e histórico continuam no banco). Prefira publicar quando ninguém estiver jogando.


## Login com Google (opcional)

Sem estas variáveis o botão do Google simplesmente não aparece. Precisa do banco configurado.

1. Acesse <https://console.cloud.google.com/> e crie um projeto (ex.: `PartyVerse`).
2. Menu **APIs e serviços → Tela de consentimento OAuth**: tipo **Externo**, preencha nome do
   app, e-mail de suporte e o domínio do site. Escopos: `email`, `profile`, `openid`.
   Publique o app (status **Em produção**) para qualquer pessoa conseguir entrar.
3. **APIs e serviços → Credenciais → Criar credenciais → ID do cliente OAuth**:
   - Tipo: **Aplicativo da Web**
   - Origens JavaScript autorizadas: `https://seudominio.com.br`
   - URIs de redirecionamento autorizados: `https://seudominio.com.br/api/auth/google/callback`
4. Copie o **ID do cliente** e a **Chave secreta do cliente**.
5. Na Hostinger, em **Environment variables**, adicione:

| Nome | Valor |
|---|---|
| `GOOGLE_CLIENT_ID` | o ID do cliente |
| `GOOGLE_CLIENT_SECRET` | a chave secreta |
| `PUBLIC_URL` | `https://seudominio.com.br` (sem barra no final) |

6. Reinicie o app. O botão "Entrar com Google" aparece na página **Entrar**.

Se aparecer o erro `redirect_uri_mismatch` do Google, o endereço do passo 3 não está idêntico
ao `PUBLIC_URL` + `/api/auth/google/callback` (atenção a `https`, `www` e barra final).


## Recuperar senha por e-mail (opcional)

Sem isto, a página "Esqueci minha senha" avisa que o envio ainda não foi configurado.
Use uma caixa de e-mail do seu domínio (no hPanel: **E-mails → Contas de e-mail → Criar**,
por exemplo `contato@seudominio.com.br`). Depois, em **Environment variables**:

| Nome | Valor |
|---|---|
| `SMTP_HOST` | `smtp.hostinger.com` |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | o e-mail completo, ex.: `contato@seudominio.com.br` |
| `SMTP_PASS` | a senha dessa caixa de e-mail |
| `MAIL_FROM` | (opcional) `PartyVerse <contato@seudominio.com.br>` |
| `PUBLIC_URL` | `https://seudominio.com.br` (o link do e-mail usa este endereço) |

Reinicie o app. No painel **/admin** o quadro "E-mail" mostra ✅ quando está tudo certo.

## Painel de administração

Adicione a variável `ADMIN_EMAILS` com o(s) e-mail(s) das contas administradoras, separados
por vírgula (ex.: `voce@gmail.com`). Entre no site com essa conta: aparece **Admin** no menu,
com números do site (pessoas jogando, contas, partidas, desafio do dia), salas abertas (dá para
fechar) e busca de contas (dá para suspender e liberar). Conta suspensa não entra, não joga e
é tirada das salas na hora.

## Instalar como app

Nada a configurar: o site já é um app instalável (PWA). No Android/Chrome aparece "Instalar
app" no menu; no iPhone, Compartilhar → "Adicionar à Tela de Início".
