export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { lat, lon, raio, codigo, municipio } = req.query;

  try {
    let url;
    if (codigo) {
      // UUID de certificação SIGEF — ex: c2f838eb-d9c2-462f-b0a9-802a039f4e8a
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(codigo.trim());
      if (isUUID) {
        url = `https://sigef.incra.gov.br/geo/wfs/?service=WFS&version=1.1.0&request=GetFeature&typeName=parcela:parcela_certificada_lote&CQL_FILTER=id='${codigo.trim()}'&outputFormat=application/json&srsName=EPSG:4326`;
      } else {
        // Tenta por código de imóvel texto
        url = `https://sigef.incra.gov.br/geo/wfs/?service=WFS&version=1.1.0&request=GetFeature&typeName=parcela:parcela_certificada_lote&CQL_FILTER=codigo_imovel='${codigo.trim()}'&outputFormat=application/json&srsName=EPSG:4326`;
      }
    } else {
      const r = parseFloat(raio || 500);
      const d = r / 111320;
      const la = parseFloat(lat), lo = parseFloat(lon);
      const bbox = `${lo-d},${la-d},${lo+d},${la+d}`;
      url = `https://sigef.incra.gov.br/geo/wfs/?service=WFS&version=1.1.0&request=GetFeature&typeName=parcela:parcela_certificada_lote&bbox=${bbox},EPSG:4326&outputFormat=application/json&srsName=EPSG:4326`;
    }

    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) throw new Error(`SIGEF HTTP ${response.status}`);
    const data = await response.json();

    let features = data.features || [];
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
