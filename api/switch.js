export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const EC_ID    = process.env.EDGE_CONFIG_ID;
  const EC_TOKEN = process.env.EDGE_CONFIG_TOKEN;
  const V_TOKEN  = process.env.VERCEL_TOKEN;
  const SENHA    = process.env.SENHA_PAINEL;
  const MASTER_URL = process.env.APPS_SCRIPT_MASTER_URL;

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

  async function backupTurmas(turmasTodas) {
    if (!MASTER_URL) return;
    try {
      await fetch(MASTER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'backupTurmas', turmas: turmasTodas })
      });
    } catch(e) {}
  }

  // ── GET ───────────────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const [inscricoes, turmasTodas, polosStatus, esperaStatus] = await Promise.all([
        ecGet('inscricoes'),
        ecGet('turmas'),
        ecGet('polosStatus'),
        ecGet('esperaStatus')
      ]);

      const aberto = inscricoes !== 'FECHADO';
      const polo   = req.query?.polo;
      const turmas = polo ? (turmasTodas?.[polo] ?? []) : (turmasTodas ?? {});
      const poloAberto  = polo ? (polosStatus?.[polo] !== false) : undefined;
      const esperaAberta = polo ? (esperaStatus?.[polo] !== false) : undefined;

      return res.status(200).json({
        aberto,
        turmas,
        polosStatus:  polosStatus  ?? {},
        esperaStatus: esperaStatus ?? {},
        ...(polo !== undefined ? { poloAberto, esperaAberta } : {})
      });
    } catch(e) {
      return res.status(200).json({ aberto: true, turmas: [], polosStatus: {}, esperaStatus: {} });
    }
  }

  // ── POST ──────────────────────────────────────────────────
  if (req.method === 'POST') {
    const body = req.body;
    if (body.senha !== SENHA) {
      return res.status(401).json({ error: 'Senha incorreta' });
    }

    // Switch geral
    if (body.status) {
      if (!['ABERTO','FECHADO'].includes(body.status)) {
        return res.status(400).json({ error: 'Status inválido' });
      }
      const ok = await ecSet([{ operation: 'upsert', key: 'inscricoes', value: body.status }]);
      return res.status(ok ? 200 : 500).json({ success: ok, status: body.status });
    }

    // Toggle polo
    if (body.polo && body.poloAberto !== undefined) {
      const atual = await ecGet('polosStatus') ?? {};
      atual[body.polo] = body.poloAberto;
      const ok = await ecSet([{ operation: 'upsert', key: 'polosStatus', value: atual }]);
      return res.status(ok ? 200 : 500).json({ success: ok });
    }

    // Toggle lista de espera
    if (body.polo && body.esperaAberta !== undefined) {
      const atual = await ecGet('esperaStatus') ?? {};
      atual[body.polo] = body.esperaAberta;
      const ok = await ecSet([{ operation: 'upsert', key: 'esperaStatus', value: atual }]);
      return res.status(ok ? 200 : 500).json({ success: ok });
    }

    // Deletar polo
    if (body.deletarPolo) {
      try {
        const [turmas, polosStatus, esperaStatus] = await Promise.all([
          ecGet('turmas') ?? {},
          ecGet('polosStatus') ?? {},
          ecGet('esperaStatus') ?? {}
        ]);
        const t = turmas      || {};
        const p = polosStatus || {};
        const e = esperaStatus || {};
        delete t[body.deletarPolo];
        delete p[body.deletarPolo];
        delete e[body.deletarPolo];
        const ok = await ecSet([
          { operation: 'upsert', key: 'turmas',       value: t },
          { operation: 'upsert', key: 'polosStatus',  value: p },
          { operation: 'upsert', key: 'esperaStatus', value: e },
        ]);
        if (ok) backupTurmas(t);
        return res.status(ok ? 200 : 500).json({ success: ok });
      } catch(e) {
        return res.status(500).json({ error: e.message });
      }
    }

    // Salvar todas as turmas de uma vez (restaurar) — sem backup para não criar loop
    if (body.todasTurmas !== undefined) {
      const ok = await ecSet([{ operation: 'upsert', key: 'turmas', value: body.todasTurmas }]);
      return res.status(ok ? 200 : 500).json({ success: ok });
    }

    // Atualizar turmas de um polo
    if (body.polo && body.turmas !== undefined) {
      const atual = await ecGet('turmas') ?? {};
      atual[body.polo] = body.turmas;
      const ok = await ecSet([{ operation: 'upsert', key: 'turmas', value: atual }]);
      if (ok) backupTurmas(atual);
      return res.status(ok ? 200 : 500).json({ success: ok });
    }

    return res.status(400).json({ error: 'Requisição inválida' });
  }
}
