# 🎮 GameVault — Loja de Jogos (PlayStation, Xbox e PC)

Projeto da 3ª Avaliação de Banco de Dados: e-commerce com **banco de dados poliglota**.
link do video de apresentação: https://drive.google.com/file/d/1G8ubM5jYM8EngaPl_0i1BCfCuTLF2hUj/view?usp=sharing

| Banco | Uso na aplicação |
|---|---|
| **Supabase (PostgreSQL)** | Autenticação e login do administrador (Supabase Auth, JWT validado no servidor) |
| **MongoDB** | Cadastro, listagem e busca dos produtos (documentos flexíveis, coleção `loja_games.produtos`) |
| **Redis** | Histórico de itens vistos recentemente por cliente (lista `recentes:<id>`, últimos 6, expira em 7 dias) |

**Stack:** Node.js + Express 5, HTML/CSS/JS puro. **Pedido:** o carrinho gera um link `wa.me` com a mensagem formatada.

## Configuração
1. **Supabase:** crie um projeto → *Authentication → Users → Add user* (e-mail + senha do admin, marque *Auto Confirm*). Em *Providers → Email*, desative novos cadastros. Copie `Project URL` e `anon key` (Settings → API).
2. **MongoDB:** crie um cluster gratuito no MongoDB Atlas (libere seu IP em Network Access) e copie a connection string.
3. **Redis:** local com `docker run -p 6379:6379 redis` ou um banco gratuito no Upstash (use a URL `rediss://...`).
4. Copie `.env.example` para `.env` e preencha (o `.env` não vai para o GitHub). `WHATSAPP_NUMBER` com DDI+DDD, só números.
5. Rode:
```bash
npm install
npm run seed   # popula 8 jogos de exemplo
npm start      # http://localhost:3000  |  admin: /admin.html
```

## Roteiro do vídeo (5 a 10 min)
1. Mostrar os três bancos (painéis do Supabase, Atlas e Redis) e a arquitetura.
2. Login em `/admin.html`; mostrar erro com senha errada e sucesso com a correta.
3. Cadastrar um jogo e abrir a loja: o produto aparece imediatamente; mostrar o documento no Atlas.
4. Clicar em alguns jogos → seção "Vistos recentemente" (mostrar a chave no Redis).
5. Montar o carrinho (adicionar/remover, total) → "Enviar pedido via WhatsApp" → mostrar a mensagem formatada.

## Segurança
Rotas de cadastro/exclusão exigem o token do Supabase; nenhuma senha fica no repositório (variáveis de ambiente).

## Fluxo do sistema
- `/` — tela inicial: login do **administrador** (Supabase) ou **cliente** (entrar / criar conta / visitante; clientes e senhas com hash scrypt no MongoDB).
- `/loja.html` — vitrine com destaque, filtros por plataforma, detalhes do jogo (ano, desenvolvedora, classificação, estoque) e carrinho.
- `/admin.html` — dashboard (faturamento, pedidos, ticket médio, gráficos, mais vendidos), cadastro/edição de jogos com upload de capa e gestão de pedidos.
- Ao clicar em **Enviar pedido via WhatsApp**, o pedido é salvo no MongoDB (coleção `pedidos`), o estoque é baixado e o cliente é redirecionado ao WhatsApp.
