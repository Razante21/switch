export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const EC_ID    = process.env.EDGE_CONFIG_ID;
  const EC_TOKEN = process.env.EDGE_CONFIG_TOKEN;
  const V_TOKEN  = process.env.VERCEL_TOKEN;
  const SENHA    = process.env.SENHA_PAINEL;
  const MASTER_URL = process.env.APPS_SCRIPT_MASTER_URL; // URL do Apps Script master

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

  // Faz backup das turmas na aba Turmas do Apps Script master
  async function backupTurmas(turmasTodas) {
    if (!MASTER_URL) return;
    try {
      await fetch(MASTER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'backupTurmas', turmas: turmasTodas })
      });
    } catch(e) {
      // Backup falhou — não bloqueia a operação principal
      console.error('Backup falhou:', e.message);
    }
  }

  // ── GET ───────────────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const [inscricoes, turmasTodas, polosStatus] = await Promise.all([
        ecGet('inscricoes'),
        ecGet('turmas'),
        ecGet('polosStatus')
      ]);

      const aberto = inscricoes !== 'FECHADO';
      const polo   = req.query?.polo;
      const turmas = polo ? (turmasTodas?.[polo] ?? []) : (turmasTodas ?? {});
      const poloAberto = polo ? (polosStatus?.[polo] !== false) : undefined;

      return res.status(200).json({
        aberto,
        turmas,
        polosStatus: polosStatus ?? {},
        ...(polo !== undefined ? { poloAberto } : {})
      });
    } catch(e) {
      return res.status(200).json({ aberto: true, turmas: [], polosStatus: {} });
    }
  }

  // ── POST ──────────────────────────────────────────────────
  if (req.method === 'POST') {
    const body = req.body;
    if (body.senha !== SENHA) {
      return res.status(401).json({ error: 'Senha incorreta' });
    }

    // Atualizar switch geral
    if (body.status) {
      if (!['ABERTO','FECHADO'].includes(body.status)) {
        return res.status(400).json({ error: 'Status inválido' });
      }
      const ok = await ecSet([{ operation: 'upsert', key: 'inscricoes', value: body.status }]);
      return res.status(ok ? 200 : 500).json({ success: ok, status: body.status });
    }

    // Atualizar status de um polo
    if (body.polo && body.poloAberto !== undefined) {
      try {
        const atual = await ecGet('polosStatus') ?? {};
        atual[body.polo] = body.poloAberto;
        const ok = await ecSet([{ operation: 'upsert', key: 'polosStatus', value: atual }]);
        return res.status(ok ? 200 : 500).json({ success: ok });
      } catch(e) {
        return res.status(500).json({ error: e.message });
      }
    }

    // Atualizar TODAS as turmas de uma vez (restaurar backup)
    if (body.todasTurmas !== undefined) {
      try {
        const ok = await ecSet([{ operation: 'upsert', key: 'turmas', value: body.todasTurmas }]);
        if (ok) backupTurmas(body.todasTurmas); // backup só 1x
        return res.status(ok ? 200 : 500).json({ success: ok });
      } catch(e) {
        return res.status(500).json({ error: e.message });
      }
    }

    // Atualizar turmas de um polo + backup na planilha
    if (body.polo && body.turmas !== undefined) {
      try {
        const atual = await ecGet('turmas') ?? {};
        atual[body.polo] = body.turmas;
        const ok = await ecSet([{ operation: 'upsert', key: 'turmas', value: atual }]);
        if (ok) backupTurmas(atual);
        return res.status(ok ? 200 : 500).json({ success: ok });
      } catch(e) {
        return res.status(500).json({ error: e.message });
      }
    }

    return res.status(400).json({ error: 'Requisição inválida' });
  }
}
