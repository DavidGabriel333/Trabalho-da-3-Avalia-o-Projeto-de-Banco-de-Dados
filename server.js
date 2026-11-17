require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const { MongoClient, ObjectId } = require('mongodb');
const { createClient: createRedis } = require('redis');
const { createClient: createSupabase } = require('@supabase/supabase-js');

const app = express();
app.use(express.json({ limit: '3mb' }));
app.use(express.static('public'));
const supabase = createSupabase(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const redis = createRedis({ url: process.env.REDIS_URL });
let produtos, pedidos, clientes;
const PLAT = ['PlayStation', 'Xbox', 'PC'];
const SEG = process.env.SESSION_SECRET || 'gamevault-dev';
const oid = (id) => (ObjectId.isValid(id) ? new ObjectId(id) : null);

// Sessão do cliente (token assinado) e senha com scrypt
const sig = (p) => crypto.createHmac('sha256', SEG).update(p).digest('base64url');
const assinar = (o) => { const p = Buffer.from(JSON.stringify(o)).toString('base64url'); return p + '.' + sig(p); };
const ler = (t = '') => { const [p, s] = t.split('.'); if (!p || s !== sig(p)) return null; try { return JSON.parse(Buffer.from(p, 'base64url')); } catch { return null; } };
const hash = (s, salt = crypto.randomBytes(16).toString('hex')) => salt + ':' + crypto.scryptSync(s, salt, 32).toString('hex');

// Admin: valida o JWT do Supabase Auth
const apenasAdmin = async (req, res, next) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return res.status(401).json({ erro: 'Não autorizado' });
  next();
};

app.get('/api/config', (req, res) => res.json({ whatsapp: process.env.WHATSAPP_NUMBER }));

// ---------- Supabase: login do administrador ----------
app.post('/api/admin/login', async (req, res) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email: req.body.email, password: req.body.password });
  if (error) return res.status(401).json({ erro: 'E-mail ou senha inválidos' });
  res.json({ token: data.session.access_token });
});

// ---------- Login único: admin (Supabase) ou cliente (MongoDB) ----------
app.post('/api/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase(), senha = String(req.body.senha || '');
  if (!email || !senha) return res.status(400).json({ erro: 'Informe e-mail e senha' });
  const { data } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (data && data.session) return res.json({ tipo: 'admin', token: data.session.access_token });
  const c = await clientes.findOne({ email });
  if (c && hash(senha, c.senha.split(':')[0]) === c.senha) return res.json({ tipo: 'cliente', nome: c.nome, token: assinar({ nome: c.nome, email }) });
  res.status(401).json({ erro: 'E-mail ou senha inválidos' });
});

// ---------- MongoDB: clientes ----------
app.post('/api/clientes/registro', async (req, res) => {
  const nome = String(req.body.nome || '').trim(), email = String(req.body.email || '').trim().toLowerCase(), senha = String(req.body.senha || '');
  if (!nome || !email.includes('@') || senha.length < 6) return res.status(400).json({ erro: 'Informe nome, e-mail válido e senha de 6+ caracteres' });
  if (await clientes.findOne({ email })) return res.status(409).json({ erro: 'E-mail já cadastrado' });
  await clientes.insertOne({ nome, email, senha: hash(senha), criadoEm: new Date() });
  res.status(201).json({ nome, token: assinar({ nome, email }) });
});
app.post('/api/clientes/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const c = await clientes.findOne({ email });
  if (!c || hash(String(req.body.senha || ''), c.senha.split(':')[0]) !== c.senha) return res.status(401).json({ erro: 'E-mail ou senha inválidos' });
  res.json({ nome: c.nome, token: assinar({ nome: c.nome, email }) });
});

// ---------- MongoDB: produtos ----------
const limpar = (b) => ({ nome: String(b.nome || '').trim(), descricao: b.descricao || '', preco: Number(b.preco), imagem: b.imagem || '',
  plataforma: b.plataforma, genero: b.genero || '', ano: Number(b.ano) || null, desenvolvedora: b.desenvolvedora || '',
  classificacao: b.classificacao || '', estoque: Number(b.estoque) || 0 });
const valido = (d) => d.nome && PLAT.includes(d.plataforma) && d.preco > 0;

app.get('/api/products', async (req, res) => {
  const f = {};
  if (PLAT.includes(req.query.plataforma)) f.plataforma = req.query.plataforma;
  if (req.query.q) f.nome = { $regex: req.query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  res.json(await produtos.find(f).sort({ criadoEm: -1 }).toArray());
});

// ---------- Redis: vistos recentemente ----------
app.get('/api/products/:id', async (req, res) => {
  const id = oid(req.params.id), p = id && await produtos.findOne({ _id: id });
  if (!p) return res.status(404).json({ erro: 'Produto não encontrado' });
  const cid = req.headers['x-client-id'];
  if (cid) { const k = `recentes:${cid}`; await redis.lRem(k, 0, req.params.id); await redis.lPush(k, req.params.id); await redis.lTrim(k, 0, 5); await redis.expire(k, 604800); }
  res.json(p);
});
app.get('/api/recent', async (req, res) => {
  const cid = req.headers['x-client-id'];
  if (!cid) return res.json([]);
  const ids = await redis.lRange(`recentes:${cid}`, 0, 5);
  const docs = await produtos.find({ _id: { $in: ids.map((i) => new ObjectId(i)) } }).toArray();
  res.json(ids.map((i) => docs.find((d) => String(d._id) === i)).filter(Boolean));
});

app.post('/api/products', apenasAdmin, async (req, res) => {
  const d = limpar(req.body);
  if (!valido(d)) return res.status(400).json({ erro: 'Informe nome, plataforma e preço válido' });
  d.criadoEm = new Date();
  res.status(201).json({ ...d, _id: (await produtos.insertOne(d)).insertedId });
});
app.put('/api/products/:id', apenasAdmin, async (req, res) => {
  const d = limpar(req.body), id = oid(req.params.id);
  if (!id || !valido(d)) return res.status(400).json({ erro: 'Dados inválidos' });
  await produtos.updateOne({ _id: id }, { $set: d });
  res.json({ ok: true });
});
app.delete('/api/products/:id', apenasAdmin, async (req, res) => {
  const id = oid(req.params.id);
  if (id) await produtos.deleteOne({ _id: id });
  res.json({ ok: true });
});

// ---------- MongoDB: pedidos (vendas) ----------
app.post('/api/orders', async (req, res) => {
  const itens = [];
  for (const i of req.body.itens || []) {
    const id = oid(i.id), qtd = Math.floor(Number(i.qtd)), p = id && await produtos.findOne({ _id: id });
    if (!p || !(qtd >= 1)) return res.status(400).json({ erro: 'Item inválido no carrinho' });
    if (p.estoque < qtd) return res.status(400).json({ erro: `Estoque insuficiente de ${p.nome} (restam ${p.estoque})` });
    itens.push({ produtoId: p._id, nome: p.nome, plataforma: p.plataforma, preco: p.preco, qtd });
  }
  if (!itens.length) return res.status(400).json({ erro: 'Carrinho vazio' });
  for (const i of itens) await produtos.updateOne({ _id: i.produtoId }, { $inc: { estoque: -i.qtd } });
  const c = ler(req.headers['x-cliente']);
  const doc = { itens, total: itens.reduce((s, i) => s + i.preco * i.qtd, 0), cliente: c ? { nome: c.nome, email: c.email } : null, status: 'pendente', criadoEm: new Date() };
  doc._id = (await pedidos.insertOne(doc)).insertedId;
  res.status(201).json(doc);
});

app.get('/api/admin/orders', apenasAdmin, async (req, res) => res.json(await pedidos.find().sort({ criadoEm: -1 }).limit(30).toArray()));
app.patch('/api/admin/orders/:id', apenasAdmin, async (req, res) => {
  const id = oid(req.params.id), st = req.body.status, p = id && await pedidos.findOne({ _id: id });
  if (!p || !['pendente', 'concluido', 'cancelado'].includes(st)) return res.status(400).json({ erro: 'Inválido' });
  if (st === 'cancelado' && p.status !== 'cancelado') for (const i of p.itens) await produtos.updateOne({ _id: i.produtoId }, { $inc: { estoque: i.qtd } });
  if (p.status === 'cancelado' && st !== 'cancelado') for (const i of p.itens) await produtos.updateOne({ _id: i.produtoId }, { $inc: { estoque: -i.qtd } });
  await pedidos.updateOne({ _id: id }, { $set: { status: st } });
  res.json({ ok: true });
});
app.get('/api/admin/stats', apenasAdmin, async (req, res) => {
  const todos = await pedidos.find({ status: { $ne: 'cancelado' } }).toArray();
  const dk = (d) => new Date(d).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  const dia = {}, plat = {}, top = {};
  for (let i = 6; i >= 0; i--) dia[dk(Date.now() - i * 864e5)] = 0;
  for (const p of todos) {
    const k = dk(p.criadoEm); if (k in dia) dia[k] += p.total;
    for (const i of p.itens) { plat[i.plataforma] = (plat[i.plataforma] || 0) + i.preco * i.qtd; top[i.nome] = (top[i.nome] || 0) + i.qtd; }
  }
  const fat = todos.reduce((s, p) => s + p.total, 0);
  res.json({ faturamento: fat, pedidos: todos.length, ticket: todos.length ? fat / todos.length : 0, jogos: await produtos.countDocuments(),
    dia, plat, top: Object.entries(top).sort((a, b) => b[1] - a[1]).slice(0, 5) });
});

app.use((err, req, res, next) => { console.error(err); res.status(500).json({ erro: 'Erro interno' }); });

(async () => {
  await redis.connect();
  const db = (await MongoClient.connect(process.env.MONGO_URI)).db('loja_games');
  produtos = db.collection('produtos'); pedidos = db.collection('pedidos'); clientes = db.collection('clientes');
  app.listen(process.env.PORT || 3000, () => console.log(`Loja rodando em http://localhost:${process.env.PORT || 3000}`));
})();
