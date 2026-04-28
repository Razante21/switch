export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const EDGE_CONFIG_ID = process.env.EDGE_CONFIG_ID;
  const EDGE_CONFIG_TOKEN = process.env.EDGE_CONFIG_TOKEN;
  const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
  const SENHA = process.env.SENHA_PAINEL;

  // ── GET: lê o status direto pela API REST do Edge Config ──
  if (req.method === 'GET') {
    try {
      const r = await fetch(
        `https://edge-config.vercel.com/${EDGE_CONFIG_ID}/item/inscricoes`,
        { headers: { Authorization: `Bearer ${EDGE_CONFIG_TOKEN}` } }
      );
      const valor = await r.json();
      return res.status(200).json({ aberto: valor === 'ABERTO' });
    } catch (e) {
      return res.status(200).json({ aberto: true });
    }
  }

  // ── POST: atualiza o status ────────────────────────────────
  if (req.method === 'POST') {
    const { senha, status } = req.body;

    if (senha !== SENHA) {
      return res.status(401).json({ error: 'Senha incorreta' });
    }

    if (status !== 'ABERTO' && status !== 'FECHADO') {
      return res.status(400).json({ error: 'Status inválido' });
    }

    try {
      const r = await fetch(
        `https://api.vercel.com/v1/edge-config/${EDGE_CONFIG_ID}/items`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${VERCEL_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            items: [{ operation: 'upsert', key: 'inscricoes', value: status }]
          })
        }
      );
      const data = await r.json();
      if (r.ok) {
        return res.status(200).json({ success: true, status });
      } else {
        return res.status(500).json({ error: data });
      }
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }
}
