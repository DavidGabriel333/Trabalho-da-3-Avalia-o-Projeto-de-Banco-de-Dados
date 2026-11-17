require('dotenv').config();
const { MongoClient } = require('mongodb');
const img = (t, c) => `https://placehold.co/400x520/${c}/ffffff?text=${encodeURIComponent(t)}`;
const EX = {'God of War Ragnarök':{ano:2022,dev:'Santa Monica Studio',cl:'18+'},'Spider-Man 2':{ano:2023,dev:'Insomniac Games',cl:'16+'},'Forza Horizon 5':{ano:2021,dev:'Playground Games',cl:'Livre'},'Halo Infinite':{ano:2021,dev:'343 Industries',cl:'16+'},'Cyberpunk 2077':{ano:2020,dev:'CD Projekt Red',cl:'18+'},'Elden Ring':{ano:2022,dev:'FromSoftware',cl:'16+'},'EA Sports FC 25':{ano:2024,dev:'EA Vancouver',cl:'Livre'},'Starfield':{ano:2023,dev:'Bethesda Game Studios',cl:'16+'}};
const base = [
  ['God of War Ragnarök', 'PlayStation', 'Ação/Aventura', 199.9, '1a1a2e'],
  ['Spider-Man 2', 'PlayStation', 'Ação', 249.9, 'b00020'],
  ['Forza Horizon 5', 'Xbox', 'Corrida', 169.9, '107c10'],
  ['Halo Infinite', 'Xbox', 'FPS', 129.9, '0b3d0b'],
  ['Cyberpunk 2077', 'PC', 'RPG', 149.9, 'c9a800'],
  ['Elden Ring', 'PC', 'RPG', 229.9, '5a4a2a'],
  ['EA Sports FC 25', 'PlayStation', 'Esportes', 279.9, '0050a0'],
  ['Starfield', 'Xbox', 'RPG/Ficção', 219.9, '2a2a4a'],
].map(([nome, plataforma, genero, preco, cor]) => ({
  nome, plataforma, genero, preco, imagem: img(nome, cor), estoque: 20, ...(({ano,dev,cl})=>({ano,desenvolvedora:dev,classificacao:cl}))(EX[nome]),
  descricao: `${nome} para ${plataforma}. Mídia digital com entrega imediata.`, criadoEm: new Date(),
}));
(async () => {
  const m = await MongoClient.connect(process.env.MONGO_URI);
  const c = m.db('loja_games').collection('produtos');
  await c.deleteMany({});
  await c.insertMany(base);
  console.log(`${base.length} jogos inseridos.`);
  await m.close();
})();
