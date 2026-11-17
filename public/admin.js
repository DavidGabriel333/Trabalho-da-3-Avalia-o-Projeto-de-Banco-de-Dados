const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const brl = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const campos = ['nome', 'plataforma', 'ano', 'desenvolvedora', 'genero', 'classificacao', 'preco', 'estoque', 'imagem', 'descricao'];
let img = '', atual = '', editId = null, cache = [], charts = [];
if (!sessionStorage.token) location = '/';
async function adm(url, opt = {}) {
  const r = await fetch(url, { ...opt, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + sessionStorage.token } });
  if (r.status === 401) { sessionStorage.clear(); location = '/'; }
  return r;
}
$('#out').onclick = () => { sessionStorage.clear(); location = '/'; };
function show(v) { document.querySelectorAll('.view').forEach((x) => (x.hidden = x.id !== 'v-' + v));
  document.querySelectorAll('.side [data-v]').forEach((b) => b.classList.toggle('on', b.dataset.v === v)); scrollTo(0, 0); }
document.querySelector('.side').onclick = (e) => { const v = e.target.dataset.v; if (!v) return; if (v === 'form') reset(); show(v); };

$('#arq').onchange = (e) => {
  const f = e.target.files[0]; if (!f) return;
  const rd = new FileReader();
  rd.onload = () => { const im = new Image(); im.onload = () => {
    const k = Math.min(1, 500 / im.width), c = document.createElement('canvas');
    c.width = im.width * k; c.height = im.height * k; c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
    img = c.toDataURL('image/jpeg', 0.8); $('#prev').src = img; $('#prev').hidden = false; }; im.src = rd.result; };
  rd.readAsDataURL(f);
};
function reset() { campos.forEach((c) => c !== 'plataforma' && c !== 'classificacao' && ($('#' + c).value = '')); img = atual = ''; editId = null;
  $('#prev').hidden = true; $('#arq').value = ''; $('#ft').textContent = 'Cadastrar jogo'; $('#save').textContent = 'Cadastrar produto'; $('#cancel').hidden = true; }
$('#cancel').onclick = () => { reset(); show('prod'); };
$('#save').onclick = async () => {
  const body = Object.fromEntries(campos.map((c) => [c, $('#' + c).value]));
  body.imagem = img || body.imagem || atual;
  const r = await adm(editId ? '/api/products/' + editId : '/api/products', { method: editId ? 'PUT' : 'POST', body: JSON.stringify(body) });
  const d = await r.json();
  $('#msg').style.color = r.ok ? '#55efc4' : '#ff7675';
  $('#msg').textContent = r.ok ? '✔ Salvo! Já aparece na loja.' : d.erro;
  if (r.ok) { const ed = !!editId; reset(); list(); stats(); if (ed) show('prod'); }
};
async function list() {
  cache = await (await fetch('/api/products')).json();
  $('#list').innerHTML = cache.map((p) => `<div class="row"><span>${esc(p.nome)} <small>(${esc(p.plataforma)} · ${p.ano || '-'} · estoque ${p.estoque})</small></span>
    <span><button class="sec" data-e="${p._id}">Editar</button> <button class="red" data-d="${p._id}">Excluir</button></span></div>`).join('');
}
$('#list').onclick = async (e) => {
  const { e: ed, d } = e.target.dataset;
  if (d && confirm('Excluir este produto?')) { await adm('/api/products/' + d, { method: 'DELETE' }); list(); stats(); }
  if (ed) { const p = cache.find((x) => x._id === ed); editId = ed; atual = p.imagem || '';
    campos.forEach((c) => c !== 'imagem' && ($('#' + c).value = p[c] ?? '')); $('#imagem').value = atual.startsWith('data:') ? '' : atual;
    $('#prev').src = atual; $('#prev').hidden = !atual; $('#ft').textContent = 'Editando: ' + p.nome; $('#save').textContent = 'Salvar alterações';
    $('#cancel').hidden = false; show('form'); }
};
async function stats() {
  const s = await (await adm('/api/admin/stats')).json();
  $('#stats').innerHTML = [['Faturamento', brl(s.faturamento)], ['Pedidos', s.pedidos], ['Ticket médio', brl(s.ticket)], ['Jogos cadastrados', s.jogos]]
    .map(([a, b]) => `<div class="stat">${a}<b>${b}</b></div>`).join('');
  charts.forEach((c) => c.destroy());
  const lab = Object.keys(s.dia).map((d) => d.slice(8) + '/' + d.slice(5, 7));
  charts = [new Chart($('#c1'), { type: 'bar', data: { labels: lab, datasets: [{ label: 'R$', data: Object.values(s.dia), backgroundColor: '#6c5ce7' }] } }),
    new Chart($('#c2'), { type: 'doughnut', data: { labels: Object.keys(s.plat), datasets: [{ data: Object.values(s.plat), backgroundColor: ['#0070d1', '#107c10', '#fdcb6e'] }] } })];
  $('#top').innerHTML = s.top.length ? s.top.map(([n, q], i) => `<div class="row"><span>${i + 1}. ${esc(n)}</span><b>${q} un.</b></div>`).join('') : '<p>Sem vendas ainda.</p>';
}
async function orders() {
  const os = await (await adm('/api/admin/orders')).json();
  $('#orders').innerHTML = '<tr><th>Data</th><th>Cliente</th><th>Itens</th><th>Total</th><th>Status</th></tr>' + os.map((o) =>
    `<tr><td>${new Date(o.criadoEm).toLocaleString('pt-BR')}</td><td>${esc(o.cliente ? o.cliente.nome : 'Visitante')}</td><td>${o.itens.map((i) => i.qtd + 'x ' + esc(i.nome)).join(', ')}</td><td>${brl(o.total)}</td>
    <td><select data-o="${o._id}">${['pendente', 'concluido', 'cancelado'].map((s) => `<option ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}</select></td></tr>`).join('');
}
$('#orders').onchange = async (e) => { if (!e.target.dataset.o) return;
  await adm('/api/admin/orders/' + e.target.dataset.o, { method: 'PATCH', body: JSON.stringify({ status: e.target.value }) }); stats(); orders(); list(); };
list(); stats(); orders();
