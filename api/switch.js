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

  async function backupPolos(polosStatus, nomes, enderecos) {
    if (!MASTER_URL) return;
    try {
      await fetch(MASTER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'backupPolos', polos: polosStatus, nomes, enderecos })
      });
    } catch(e) {}
  }

  // ── GET ───────────────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const [inscricoes, turmasTodas, polosStatus, esperaGlobal, enderecos, nomes, configs] = await Promise.all([
        ecGet('inscricoes'),
        ecGet('turmas'),
        ecGet('polosStatus'),
        ecGet('esperaGlobal'),
        ecGet('enderecos'),
        ecGet('nomes'),
        ecGet('configs')
      ]);

      const aberto = inscricoes !== 'FECHADO';
      const polo   = req.query?.polo;
      const turmas = polo ? (turmasTodas?.[polo] ?? []) : (turmasTodas ?? {});
      const poloAberto = polo ? (polosStatus?.[polo] !== false) : undefined;

      const enderecosPolo = enderecos ?? {};
      const nomesPolo     = nomes     ?? {};
      return res.status(200).json({
        aberto,
        turmas,
        polosStatus:  polosStatus ?? {},
        esperaGlobal: esperaGlobal !== false,
        enderecos:    enderecosPolo,
        nomes:        nomesPolo,
        configs:      configs ?? {},
        endereco:     polo ? (enderecosPolo[polo] || '') : undefined,
        poloNome:     polo ? (nomesPolo[polo]     || '') : undefined,
        ...(polo !== undefined ? { poloAberto } : {})
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

    // Atualizar endereço e/ou nome de um polo
    if (body.polo && (body.endereco !== undefined || body.nome !== undefined)) {
      const [atualEnd, atualNomes] = await Promise.all([
        ecGet('enderecos') ?? {},
        ecGet('nomes')     ?? {}
      ]);
      const e = atualEnd   || {};
      const n = atualNomes || {};
      if (body.endereco !== undefined) e[body.polo] = body.endereco;
      if (body.nome     !== undefined) n[body.polo] = body.nome;
      const ok = await ecSet([
        { operation: 'upsert', key: 'enderecos', value: e },
        { operation: 'upsert', key: 'nomes',     value: n },
      ]);
      return res.status(ok ? 200 : 500).json({ success: ok });
    }

    // Backup manual imediato (turmas + polos)
    if (body.backupAgora) {
      const [turmas, polosStatus, nomes, enderecos] = await Promise.all([
        ecGet('turmas'),
        ecGet('polosStatus'),
        ecGet('nomes'),
        ecGet('enderecos')
      ]);
      backupTurmas(turmas || {});
      backupPolos(polosStatus || {}, nomes || {}, enderecos || {});
      return res.status(200).json({ success: true });
    }

    // Salvar configurações do semestre
    if (body.configs !== undefined) {
      const ok = await ecSet([{ operation: 'upsert', key: 'configs', value: body.configs }]);
      return res.status(ok ? 200 : 500).json({ success: ok });
    }

    // Toggle lista de espera global
    if (body.esperaGlobal !== undefined) {
      const ok = await ecSet([{ operation: 'upsert', key: 'esperaGlobal', value: body.esperaGlobal }]);
      return res.status(ok ? 200 : 500).json({ success: ok });
    }

    // Deletar polo
    if (body.deletarPolo) {
      try {
        const [turmas, polosStatus, enderecos] = await Promise.all([
          ecGet('turmas'),
          ecGet('polosStatus'),
          ecGet('enderecos')
        ]);
        const t = turmas      || {};
        const p = polosStatus || {};
        const e = enderecos   || {};
        delete t[body.deletarPolo];
        delete p[body.deletarPolo];
        delete e[body.deletarPolo];
        const nomesTodos = await ecGet('nomes') ?? {};
        const n = nomesTodos || {};
        delete n[body.deletarPolo];
        const ok = await ecSet([
          { operation: 'upsert', key: 'turmas',      value: t },
          { operation: 'upsert', key: 'polosStatus', value: p },
          { operation: 'upsert', key: 'enderecos',   value: e },
          { operation: 'upsert', key: 'nomes',       value: n },
        ]);
        if (ok) {
          backupTurmas(t);
          backupPolos(p, n, e);
        }
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

    // Atualizar turmas de um polo (sem backup automático — use backupAgora para backup manual)
    if (body.polo && body.turmas !== undefined) {
      const atual = await ecGet('turmas') ?? {};
      atual[body.polo] = body.turmas;
      const ok = await ecSet([{ operation: 'upsert', key: 'turmas', value: atual }]);
      return res.status(ok ? 200 : 500).json({ success: ok });
    }

    return res.status(400).json({ error: 'Requisição inválida' });
  }
}
