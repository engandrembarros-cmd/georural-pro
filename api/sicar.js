export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { cod_car, lat, lon, ibge } = req.query;

  try {
    if (cod_car) {
      const url = `https://www.car.gov.br/publico/imoveis/index?dados=${encodeURIComponent(JSON.stringify({ imovel: { tipo: 'RURAL', cod_imovel: cod_car } }))}`;
      const response = await fetch(url, {
        headers: { 'Accept': 'application
