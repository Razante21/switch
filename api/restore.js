// api/restore.js
// GET → busca turmas da planilha master e retorna JSON

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const MASTER_URL = process.env.APPS_SCRIPT_MASTER_URL;

  if (!MASTER_URL) {
    return res.status(500).json({ error: 'APPS_SCRIPT_MASTER_URL não configurado' });
  }

  try {
    const r = await fetch(`${MASTER_URL}?action=getTurmas`);
    const d = await r.json();
    return res.status(200).json(d);
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
