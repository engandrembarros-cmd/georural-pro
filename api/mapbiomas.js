export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  let geometry;
  try {
    if (req.method === 'POST') {
      geometry = req.body?.geometry;
    } else {
      geometry = req.query.geometry ? JSON.parse(req.query.geometry) : null;
    }
    if (!geometry) throw new Error('Geometria não informada');

    const query = `
      query AlertasPorTerritorio($territorio: JSON!) {
        allAlerts(territorio: $territorio, limit: 50) {
          alertCode
          areaHa
          detectedAt
          classifiedAt
          source
          status
        }
      }
    `;

    const response = await fetch('https://plataforma.alerta.mapbiomas.org/api/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ query, variables: { territorio: geometry } }),
      signal: AbortSignal.timeout(20000)
    });

    if (!response.ok) throw new Error(`MapBiomas HTTP ${response.status}`);
    const data = await response.json();
    const alertas = data.data?.allAlerts || [];

    return res.status(200).json({
      ok: true,
      alertas: alertas.map(a => ({
        alertaId: a.alertCode,
        areaHa: a.areaHa,
        dataDeteccao: a.detectedAt,
        fonte: a.source || 'MapBiomas',
        status: a.status
      })),
      total: alertas.length
    });

  } catch (err) {
    return res.status(200).json({ ok: false, erro: err.message, alertas: [], total: 0 });
  }
}
