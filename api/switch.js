// api/switch.js
// GET  → retorna se inscrições estão abertas
// POST → atualiza o status (requer senha)

export default async function handler(req, res) {
  // CORS para os polos conseguirem fazer fetch
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const EDGE_CONFIG_URL = process.env.EDGE_CONFIG;
  const VERCEL_TOKEN    = process.env.VERCEL_TOKEN;
  const EDGE_CONFIG_ID  = process.env.EDGE_CONFIG_ID;
  const SENHA           = process.env.SENHA_PAINEL;

  // ── GET: retorna status atual ──────────────────────────────
  if (req.method === 'GET') {
    try {
      const r = await fetch(`${EDGE_CONFIG_URL}/item/inscricoes`, {
        headers: { Authorization: `Bearer ${process.env.EDGE_CONFIG_TOKEN}` }
      });
      const data = await r.json();
      return res.status(200).json({ aberto: data === 'ABERTO' });
    } catch (e) {
      // Se não encontrar, considera aberto por padrão
      return res.status(200).json({ aberto: true });
    }
  }

  // ── POST: atualiza status ──────────────────────────────────
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
      return res.status(200).json({ success: true, status, data });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }
}
