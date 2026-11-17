# 🎮 GameVault — Loja de Jogos (PlayStation, Xbox e PC)

Projeto da **3ª Avaliação de Banco de Dados**: e-commerce de jogos com **banco de dados poliglota**, em que cada tecnologia atende ao caso de uso em que é mais adequada.

**Autor:** _(seu nome)_ · **Disciplina:** Banco de Dados · **Entrega:** 26/11/2026

## 1. Arquitetura de dados

| Banco | Uso na aplicação | Por que foi escolhido |
|---|---|---|
| **Supabase (PostgreSQL)** | Autenticação e login do administrador (Supabase Auth; o JWT é validado no servidor em toda rota restrita) | Autenticação pronta, segura e gerenciada |
| **MongoDB (Atlas)** | Produtos, clientes e pedidos (banco `loja_games`) | Documentos flexíveis: cada jogo pode ter campos diferentes e o pedido guarda um "retrato" dos itens comprados |
| **Redis (Upstash)** | Histórico de jogos vistos recentemente por cliente (`recentes:<id>`, lista com os últimos 6 itens, expira em 7 dias) | Acesso em memória, ideal para dados temporários e de leitura rápida |

**Coleções do MongoDB**
- `produtos`: nome, plataforma, gênero, ano, desenvolvedora, classificação, preço, estoque, imagem, descrição.
- `clientes`: nome, e-mail e senha com hash (scrypt, com salt).
- `pedidos`: itens (com preço no momento da compra), total, cliente (ou visitante), status e data.

## 2. Funcionalidades

**Tela inicial (`/`)** — login único: o sistema reconhece se o e-mail é de administrador (Supabase) ou de cliente (MongoDB) e redireciona para o painel ou para a loja. Também permite criar conta de cliente ou continuar como visitante.

**Módulo administrativo (`/admin.html`)** — menu lateral com:
- **Dashboard:** faturamento, pedidos, ticket médio, gráfico dos últimos 7 dias, vendas por plataforma e jogos mais vendidos.
- **Cadastrar jogo:** todos os dados do jogo e upload da capa (ou URL).
- **Produtos:** edição e exclusão, com controle de estoque.
- **Pedidos:** lista de vendas e alteração de status (cancelar devolve o estoque).

**Módulo do cliente (`/loja.html`)** — destaque, filtro por plataforma, busca, detalhes do jogo, seção "Vistos recentemente" (Redis), carrinho com adicionar/remover e total.

**Finalização** — o botão **Enviar pedido via WhatsApp** salva o pedido no MongoDB, baixa o estoque e redireciona para o WhatsApp com a mensagem formatada:
`Olá, gostaria de pedir: 1x Produto A, 2x Produto B. Total: R$ XX`

## 3. Tecnologias
Node.js, Express 5, HTML/CSS/JavaScript puro, Chart.js (gráficos), `@supabase/supabase-js`, `mongodb` e `redis`.

## 4. Estrutura
```
├── server.js          # API e regras de negócio
├── seed.js            # popula o catálogo com 8 jogos de exemplo
├── package.json
├── .env.example       # modelo das variáveis de ambiente
└── public/            # interface (login, loja e painel admin)
```

## 5. Configuração

### 5.1 Supabase
1. Crie um projeto em supabase.com.
2. **Authentication → Users → Add user → Create new user**: informe o e-mail e a senha do administrador e marque **Auto Confirm User**.
3. Em **Settings → API Keys**, copie a **Project URL** e a **Publishable key** (`sb_publishable_...`). Não use a secret key.

### 5.2 MongoDB Atlas
1. Crie um cluster gratuito (M0) e um usuário em **Database Access**.
2. Em **Network Access**, libere o seu IP (ou `0.0.0.0/0` para testes).
3. Em **Connect → Drivers**, copie a connection string e troque `<db_password>` pela senha do usuário.

### 5.3 Redis
- **Upstash (nuvem):** crie um banco Redis gratuito e use `rediss://default:SENHA@ENDPOINT.upstash.io:6379` (com dois "s", pois exige TLS).
- **Local (Docker):** `docker run -d -p 6379:6379 redis` e use `redis://localhost:6379`.

### 5.4 Variáveis de ambiente
Copie `.env.example` para `.env` e preencha:

| Variável | Descrição |
|---|---|
| `PORT` | Porta do servidor (padrão 3000) |
| `SUPABASE_URL` | Project URL do Supabase |
| `SUPABASE_ANON_KEY` | Publishable key do Supabase |
| `MONGO_URI` | Connection string do MongoDB Atlas |
| `REDIS_URL` | URL do Redis |
| `WHATSAPP_NUMBER` | Número que recebe os pedidos (DDI + DDD + número, só dígitos) |
| `SESSION_SECRET` | Texto longo e aleatório para assinar a sessão do cliente |

O arquivo `.env` **não é versionado**; nenhuma senha fica no repositório.

## 6. Como executar
```bash
npm install
npm run seed    # popula os 8 jogos de exemplo (apaga os produtos atuais)
npm start       # http://localhost:3000
```

## 7. Roteiro de demonstração
1. Mostrar os três bancos (Supabase, Atlas e Upstash) e a arquitetura.
2. Login com senha errada e depois como administrador.
3. Cadastrar um jogo e conferir que ele aparece na loja e no Atlas.
4. Como cliente, abrir jogos e mostrar "Vistos recentemente" e a chave no Redis.
5. Montar o carrinho e enviar o pedido ao WhatsApp, mostrando a mensagem formatada.
6. Voltar ao painel e mostrar o pedido, o estoque e os gráficos atualizados.

## 8. Segurança
- Rotas de cadastro, edição, exclusão e relatórios exigem o token do Supabase, validado no servidor.
- Senhas de clientes são armazenadas com hash scrypt e salt.
- O preço e o total do pedido são calculados no servidor, nunca confiados ao navegador.
- Segredos ficam em variáveis de ambiente (`.env` fora do Git).

## 9. Capturas de tela
_(adicione aqui prints do login, do painel admin, da loja, do carrinho e dos bancos, cobrindo senhas, URLs e chaves)_
