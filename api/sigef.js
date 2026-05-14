export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { lat, lon, raio, codigo, municipio } = req.query;

  try {
    let url;
    const headers = {
      'Accept': 'application/json, text/plain, */*',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://sigef.incra.gov.br/',
      'Origin': 'https://sigef.incra.gov.br'
    };

    if (codigo) {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(codigo.trim());
      if (isUUID) {
        // Endpoint REST do SIGEF por UUID
        url = `https://sigef.incra.gov.br/api/parcela/search/?id=${codigo.trim()}&format=json`;
      } else {
        url = `https://sigef.incra.gov.br/api/parcela/search/?codigo_imovel=${encodeURIComponent(codigo.trim())}&format=json`;
      }
    } else {
      const r = parseFloat(raio || 500);
      const d = r / 111320;
      const la = parseFloat(lat), lo = parseFloat(lon);
      const bbox = `${lo-d},${la-d},${lo+d},${la+d}`;
      // WFS público com bbox
      url = `https://sigef.incra.gov.br/geo/wfs/?service=WFS&version=1.1.0&request=GetFeature&typeName=parcela:parcela_certificada_lote&bbox=${bbox},EPSG:4326&outputFormat=application/json&srsName=EPSG:4326&maxFeatures=10`;
    }

    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(20000)
    });

    if (!response.ok) throw new Error(`SIGEF HTTP ${response.status}`);
    const data = await response.json();

    // Normalizar resposta REST vs WFS
    let features = [];
    if (data.features) {
      // WFS GeoJSON
      features = data.features;
    } else if (data.results) {
      // REST API
      features = data.results.map(p => ({
        type: 'Feature',
        properties: {
          codigo_imovel: p.codigo || p.id,
          nome_imovel: p.nome || p.denominacao,
          municipio_nome: p.municipio?.nome || p.municipio,
          uf: p.uf || 'GO',
          area_ha: p.area_total_hectares || p.area_ha,
          status: p.situacao || 'CERTIFICADO',
          data_certificacao: p.data_certificacao,
          codigo_incra: p.codigo_incra,
          numero_matricula: p.matricula,
          proprietario: p.proprietario || p.nome_proprietario
        },
        geometry: p.geometry || p.geom
      }));
    }

    if (municipio) {
      features = features.filter(f => {
        const mun = (f.properties?.municipio_nome || '').toLowerCase();
        return mun.includes(municipio.toLowerCase());
      });
    }

    return res.status(200).json({ ok: true, features, total: features.length });
  } catch (err) {
    return res.status(500).json({ ok: false, erro: err.message });
  }
}
