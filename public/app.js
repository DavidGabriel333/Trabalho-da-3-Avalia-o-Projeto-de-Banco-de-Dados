const $ = (s) => document.querySelector(s);
const cid = localStorage.cid || (localStorage.cid = crypto.randomUUID());
const H = { 'x-client-id': cid };
let cart = JSON.parse(localStorage.cart || '{}'), plat = '', zap = '';
const brl = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const get = (u) => fetch(u, { headers: H }).then((r) => r.json());
const ICON = { PlayStation: '🎮', Xbox: '🟢', PC: '🖥️' };
const card = (p) => `<div class="card" data-id="${p._id}"><img src="${esc(p.imagem)}" alt="" onerror="this.src='https://placehold.co/400x520/333/fff?text=Sem+imagem'">
<div><span class="tag">${ICON[p.plataforma] || ''} ${esc(p.plataforma)}</span><h3>${esc(p.nome)}</h3><div class="meta">${p.ano || ''} ${p.classificacao ? '· ' + esc(p.classificacao) : ''}</div><b>${brl(p.preco)}</b></div></div>`;

async function load() {
  const list = await get(`/api/products?plataforma=${plat}&q=${encodeURIComponent($('#q').value)}`);
  $('#hero').innerHTML = list.length && !$('#q').value ? `<div class="hero" data-id="${list[0]._id}"><img src="${esc(list[0].imagem)}" alt=""><div><span class="tag">⭐ Destaque</span><h2>${esc(list[0].nome)}</h2><p>${esc((list[0].descricao || '').slice(0, 120))}</p><b>${brl(list[0].preco)}</b></div></div>` : '';
  $('#grid').innerHTML = list.length ? list.map(card).join('') : '<p>Nenhum jogo encontrado.</p>';
  const rec = await get('/api/recent');
  $('#recentSec').hidden = !rec.length;
  $('#recent').innerHTML = rec.map(card).join('');
}
document.body.addEventListener('click', async (e) => {
  const c = e.target.closest('[data-id]'); if (!c) return;
  const p = await get('/api/products/' + c.dataset.id);
  $('#dlg').innerHTML = `<img src="${esc(p.imagem)}" style="width:100%;border-radius:10px"><span class="tag">${esc(p.plataforma)}</span> <small>${esc(p.genero)}</small>
  <h2>${esc(p.nome)}</h2><dl><dt>Ano</dt><dd>${p.ano || '-'}</dd><dt>Desenvolvedora</dt><dd>${esc(p.desenvolvedora || '-')}</dd><dt>Classificação</dt><dd>${esc(p.classificacao || '-')}</dd><dt>Estoque</dt><dd>${p.estoque > 0 ? p.estoque + ' un.' : 'Esgotado'}</dd></dl><p>${esc(p.descricao)}</p><h3>${brl(p.preco)}</h3>
  <button id="add" ${p.estoque > 0 ? '' : 'disabled'}>Adicionar ao carrinho</button> <button class="sec" onclick="dlg.close()">Fechar</button>`;
  $('#dlg').showModal();
  $('#add').onclick = () => { const i = cart[p._id] || (cart[p._id] = { nome: p.nome, preco: p.preco, qtd: 0 }); i.qtd++; save(); $('#dlg').close(); };
  load();
});
function save() { localStorage.cart = JSON.stringify(cart); render(); }
function render() {
  const ids = Object.keys(cart);
  $('#count').textContent = ids.reduce((s, i) => s + cart[i].qtd, 0);
  $('#items').innerHTML = ids.length ? ids.map((i) => `<div class="item"><div>${esc(cart[i].nome)}<br><small>${brl(cart[i].preco)}</small></div>
    <span><button class="sec" data-m="${i}">−</button>${cart[i].qtd}<button class="sec" data-p="${i}">+</button><button class="red" data-r="${i}">✕</button></span></div>`).join('') : '<p>Carrinho vazio.</p>';
  $('#total').textContent = brl(ids.reduce((s, i) => s + cart[i].preco * cart[i].qtd, 0));
}
$('#items').onclick = (e) => {
  const d = e.target.dataset;
  if (d.p) cart[d.p].qtd++;
  if (d.m && --cart[d.m].qtd <= 0) delete cart[d.m];
  if (d.r) delete cart[d.r];
  save();
};
$('#cartBtn').onclick = () => ($('#cart').hidden = false);
$('#close').onclick = () => ($('#cart').hidden = true);
$('#buy').onclick = async () => {
  const ids = Object.keys(cart); if (!ids.length) return alert('Seu carrinho está vazio.');
  const r = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-cliente': localStorage.ctoken || '' },
    body: JSON.stringify({ itens: ids.map((id) => ({ id, qtd: cart[id].qtd })) }) });
  const d = await r.json(); if (!r.ok) return alert(d.erro);
  const msg = `Olá, gostaria de pedir: ${d.itens.map((i) => `${i.qtd}x ${i.nome}`).join(', ')}. Total: ${brl(d.total)}`;
  cart = {}; save(); location.href = `https://wa.me/${zap}?text=${encodeURIComponent(msg)}`;
};
let t; $('#q').oninput = () => { clearTimeout(t); t = setTimeout(load, 300); };
(async () => {
  zap = (await get('/api/config')).whatsapp;
  $('#tabs').innerHTML = ['', 'PlayStation', 'Xbox', 'PC'].map((p) => `<button data-pl="${p}" class="${p ? '' : 'on'}">${p || 'Todos'}</button>`).join('');
  $('#tabs').onclick = (e) => { if (e.target.dataset.pl === undefined) return; plat = e.target.dataset.pl;
    document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b === e.target)); load(); };
  $('#user').innerHTML = localStorage.cnome ? `Olá, ${esc(localStorage.cnome)} <a href="/" onclick="localStorage.removeItem('ctoken');localStorage.removeItem('cnome')" style="color:#a29bfe">Sair</a>` : '<a href="/" style="color:#a29bfe">Entrar</a>';
  render(); load();
})();
