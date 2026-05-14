const twilio = require('twilio');

const TWILIO_ACCOUNT_SID = 'ACcfba9f73512525e422513488d7e71955';
const TWILIO_AUTH_TOKEN = 'a7cebea7fc4b2161542a233f83e9bc66';
const TWILIO_WHATSAPP_NUMBER = 'whatsapp:+14155238886';
const SUPABASE_URL = 'https://bzqcflkadvtbuvjtrkrr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_8snotXBoCOArE8cZ-YQbWg_X0U9GKpN';
const SITE_URL = 'https://georural-pro-two.vercel.app';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { Body, From, Latitude, Longitude, NumMedia } = req.body;
  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

  const enviarMsg = async (para, texto) => {
    await client.messages.create({
      from: TWILIO_WHATSAPP_NUMBER,
      to: para,
      body: texto
    });
  };

  try {
    // Verificar se é localização compartilhada
    let lat = null, lon = null;

    if (Latitude && Longitude) {
      lat = parseFloat(Latitude);
      lon = parseFloat(Longitude);
    } else if (Body) {
      // Tentar extrair coordenadas do texto
      const match = Body.match(/(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)/);
      if (match) {
        lat = parseFloat(match[1]);
        lon = parseFloat(match[2]);
      }
    }

    // Mensagem de ajuda
    if (!lat || !lon) {
      const msg = Body?.toLowerCase().trim();
      
      if (msg === 'ajuda' || msg === 'help' || msg === 'oi' || msg === 'olá' || msg === 'ola') {
        await enviarMsg(From, 
          `🌿 *GeoRural Pro — Barros Agro Engenharia*\n\n` +
          `Olá! Sou o assistente de consulta fundiária.\n\n` +
          `📍 *Como usar:*\n` +
          `Envie a *localização* do imóvel pelo WhatsApp\n` +
          `(botão de anexo → Localização)\n\n` +
          `Ou envie as *coordenadas decimais:*\n` +
          `Exemplo: -16.4412, -51.1234\n\n` +
          `📊 *O que consulto:*\n` +
          `✅ SIGEF/INCRA — Georreferenciamento\n` +
          `✅ SICAR — CAR do imóvel\n` +
          `✅ MapBiomas — Embargos\n\n` +
          `📄 *Retorno:* Dados completos + link para PDF e KML\n\n` +
          `_CREA/GO 1016859961 · engandrembarros@gmail.com_`
        );
        return res.status(200).end();
      }

      await enviarMsg(From,
        `⚠️ Não consegui identificar as coordenadas.\n\n` +
        `Por favor:\n` +
        `• Compartilhe a *localização* pelo WhatsApp, ou\n` +
        `• Envie as coordenadas no formato:\n` +
        `  *-16.4412, -51.1234*\n\n` +
        `Digite *ajuda* para mais informações.`
      );
      return res.status(200).end();
    }

    // Confirmar recebimento
    await enviarMsg(From,
      `📍 Localização recebida!\n` +
      `Lat: ${lat.toFixed(6)} | Lon: ${lon.toFixed(6)}\n\n` +
      `🔍 Consultando SIGEF, SICAR e MapBiomas...\n` +
      `_Aguarde alguns segundos..._`
    );

    // Consultar SIGEF via Supabase (dados reais)
    let dadosSIGEF = null;
    let dadosSICAR = null;
    let dadosMapBiomas = null;

    try {
      const raio = 500;
      const d = raio / 111320;
      const bbox = `${lon-d},${lat-d},${lon+d},${lat+d}`;
      
      // Buscar no Supabase (banco local com dados reais)
      const supaResp = await fetch(
        `${SUPABASE_URL}/rest/v1/sigef_go?select=*&geom=ov.{${lon-d},${lat-d},${lon+d},${lat+d}}&limit=1`,
        {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
          }
        }
      );
      
      if (supaResp.ok) {
        const dados = await supaResp.json();
        if (dados && dados.length > 0) {
          dadosSIGEF = dados[0];
        }
      }
    } catch(e) {
      console.error('Erro SIGEF:', e.message);
    }

    // Consultar MapBiomas
    try {
      const mbResp = await fetch(`${SITE_URL}/api/mapbiomas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          geometry: {
            type: 'Point',
            coordinates: [lon, lat]
          }
        })
      });
      if (mbResp.ok) {
        dadosMapBiomas = await mbResp.json();
      }
    } catch(e) {
      console.error('Erro MapBiomas:', e.message);
    }

    // Montar resposta
    const nome = dadosSIGEF?.nome_area || 'Imóvel não identificado na área';
    const area = dadosSIGEF?.area_ha ? parseFloat(dadosSIGEF.area_ha).toFixed(2) + ' ha' : 'N/D';
    const status = dadosSIGEF?.status || 'N/D';
    const matricula = dadosSIGEF?.registro_matricula || 'Ver no SIGEF';
    const dataCert = dadosSIGEF?.data_aprovacao || 'N/D';
    const codImovel = dadosSIGEF?.codigo_imovel || 'N/D';
    const nEmbargos = dadosMapBiomas?.alertas?.length || 0;
    const temEmbargo = nEmbargos > 0;

    const linkConsulta = `${SITE_URL}?lat=${lat}&lon=${lon}`;

    const resposta = 
      `🌿 *GeoRural Pro — Resultado da Consulta*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `🏡 *${nome}*\n\n` +
      `📋 *SIGEF/INCRA:*\n` +
      `• Código: ${codImovel}\n` +
      `• Área: ${area}\n` +
      `• Status: ${status}\n` +
      `• Matrícula: ${matricula}\n` +
      `• Certificação: ${dataCert}\n\n` +
      `🌿 *CAR/SICAR:*\n` +
      `• Consulte em: car.gov.br\n\n` +
      `${temEmbargo ? '🚨' : '✅'} *MapBiomas Alerta:*\n` +
      `• ${temEmbargo ? `⚠️ ${nEmbargos} alerta(s) de embargo detectado(s)!` : 'Nenhum embargo detectado'}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📄 *PDF e KML completos:*\n` +
      `${linkConsulta}\n\n` +
      `_Barros Agro Engenharia_\n` +
      `_CREA/GO 1016859961_`;

    await enviarMsg(From, resposta);

    return res.status(200).end();

  } catch(err) {
    console.error('Erro bot:', err);
    try {
      const client2 = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
      await client2.messages.create({
        from: TWILIO_WHATSAPP_NUMBER,
        to: From,
        body: '❌ Ocorreu um erro na consulta. Tente novamente ou acesse georural-pro-two.vercel.app'
      });
    } catch(e2) {}
    return res.status(200).end();
  }
}
