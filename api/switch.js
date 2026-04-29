// api/switch.js
// GET  ?polo=polo-fiec  → retorna { aberto, turmas }
// POST { senha, status } → atualiza switch
// POST { senha, polo, turmas } → atualiza turmas de um polo

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const EC_ID    = process.env.EDGE_CONFIG_ID;
  const EC_TOKEN = process.env.EDGE_CONFIG_TOKEN;
  const V_TOKEN  = process.env.VERCEL_TOKEN;
  const SENHA    = process.env.SENHA_PAINEL;

  // ── helpers ──────────────────────────────────────────────
  async function ecGet(key) {
    const r = await fetch(
      `https://edge-config.vercel.com/${EC_ID}/item/${key}`,
      { headers: { Authorization: `Bearer ${EC_TOKEN}` } }
    );
    if (!r.ok) return null;
    return await r.json();
  }

  async function ecSet(items) {
    const r = await fetch(
      `https://api.vercel.com/v1/edge-config/${EC_ID}/items`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${V_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ items })
      }
    );
    return r.ok;
  }

  // ── GET ───────────────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const [inscricoes, turmasTodas] = await Promise.all([
        ecGet('inscricoes'),
        ecGet('turmas')
      ]);

      const aberto = inscricoes !== 'FECHADO';
      const polo = req.query?.polo;
      const turmas = polo
        ? (turmasTodas?.[polo] ?? [])
        : (turmasTodas ?? {});

      return res.status(200).json({ aberto, turmas });
    } catch (e) {
      return res.status(200).json({ aberto: true, turmas: [] });
    }
  }

  // ── POST ──────────────────────────────────────────────────
  if (req.method === 'POST') {
    const body = req.body;
    if (body.senha !== SENHA) {
      return res.status(401).json({ error: 'Senha incorreta' });
    }

    // Atualizar switch
    if (body.status) {
      if (!['ABERTO','FECHADO'].includes(body.status)) {
        return res.status(400).json({ error: 'Status inválido' });
      }
      const ok = await ecSet([{ operation: 'upsert', key: 'inscricoes', value: body.status }]);
      return res.status(ok ? 200 : 500).json({ success: ok, status: body.status });
    }

    // Atualizar turmas de um polo
    if (body.polo && body.turmas !== undefined) {
      try {
        const atual = await ecGet('turmas') ?? {};
        atual[body.polo] = body.turmas;
        const ok = await ecSet([{ operation: 'upsert', key: 'turmas', value: atual }]);
        return res.status(ok ? 200 : 500).json({ success: ok });
      } catch(e) {
        return res.status(500).json({ error: e.message });
      }
    }

    return res.status(400).json({ error: 'Requisição inválida' });
  }
}
