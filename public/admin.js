/* =========================================================
   FIEC ADMIN — lógica
   ========================================================= */
const API = '/api/switch';

let POLOS = [];
let senha = '';
let dadosGlobais = {};
let polosStatus  = {};
let editandoPolo = null;
let editandoIdx  = null;
let poloAtivo    = null;
let enderecos    = {};

function formatarId(id) {
  return 'Polo ' + id.replace('polo-', '').split('-')
    .map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
}

/* ─────────────────────────────────────────────
   LOGIN / SAIR
   ───────────────────────────────────────────── */
function sair() {
  senha = '';
  localStorage.removeItem('fiec_admin_senha');
  window.location.href = '/index.html';
}

/* ─────────────────────────────────────────────
   CARREGAR TUDO
   ───────────────────────────────────────────── */
async function carregarTudo() {
  try {
    const r = await fetch(API);
    const d = await r.json();

    const teste = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senha, status: 'ABERTO' })
    });
    const t = await teste.json();
    if (!t.success && t.error === 'Senha incorreta') {
      localStorage.removeItem('fiec_admin_senha');
      window.location.href = '/index.html';
      return;
    }

    atualizarStatusDot(d.aberto);
    dadosGlobais  = d.turmas      || {};
    polosStatus   = d.polosStatus || {};
    enderecos     = d.enderecos   || {};
    const nomes   = d.nomes       || {};
    const configs = d.configs     || {};

    if (configs.titulo)     document.getElementById('cfgTitulo').value     = configs.titulo;
    if (configs.eyebrow)    document.getElementById('cfgEyebrow').value    = configs.eyebrow;
    if (configs.dataEvento) document.getElementById('cfgDataEvento').value = configs.dataEvento;
    if (configs.data24)     document.getElementById('cfgData24').value     = configs.data24;
    if (configs.data35)     document.getElementById('cfgData35').value     = configs.data35;
    if (configs.semestre)   document.getElementById('cfgSemestre').value   = configs.semestre;
    if (configs.linkEspera) document.getElementById('cfgLinkEspera').value = configs.linkEspera;

    const idsPolos = Object.keys(d.polosStatus || {});
    POLOS = idsPolos.map(id => ({
      id,
      nome: nomes[id] || formatarId(id)
    }));

    atualizarEsperaGlobal(d.esperaGlobal !== false);
    atualizarStats();
    renderPolos();
  } catch(e) {
    toast('Erro de conexão', 'err');
  }
}

function atualizarStats() {
  let totalTurmas = 0;
  Object.values(dadosGlobais).forEach(arr => totalTurmas += (arr?.length || 0));
  const st = document.getElementById('statPolos');
  const su = document.getElementById('statTurmas');
  if (st) st.textContent = POLOS.length;
  if (su) su.textContent = totalTurmas;
}

/* ─────────────────────────────────────────────
   SWITCH INSCRIÇÕES GLOBAL
   ───────────────────────────────────────────── */
async function setSwitch(status) {
  try {
    const r = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senha, status })
    });
    const d = await r.json();
    if (d.success) {
      atualizarStatusDot(status === 'ABERTO');
      toast(status === 'ABERTO'
        ? '✓ Inscrições abertas em todos os polos!'
        : '✕ Inscrições fechadas em todos os polos!', 'ok');
    } else {
      toast(d.error || 'Erro', 'err');
    }
  } catch(e) {
    toast('Erro de conexão', 'err');
  }
}

function atualizarStatusDot(aberto) {
  const dot   = document.getElementById('statusDot');
  const label = document.getElementById('statusLabel');
  if (!dot) return;
  dot.className   = 'status-orb ' + (aberto ? 'is-open' : 'is-closed');
  label.textContent = aberto ? 'Inscrições abertas' : 'Inscrições fechadas';
}

/* ─────────────────────────────────────────────
   LISTA DE ESPERA GLOBAL
   ───────────────────────────────────────────── */
function atualizarEsperaGlobal(aberta) {
  const dot   = document.getElementById('esperaDot');
  const label = document.getElementById('esperaLabel');
  if (!dot) return;
  dot.className   = 'status-orb ' + (aberta ? 'is-open' : 'is-closed');
  label.textContent = aberta ? 'Lista de espera aberta' : 'Lista de espera fechada';
}

async function setEsperaGlobal(aberta) {
  const r = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ senha, esperaGlobal: aberta })
  });
  const d = await r.json();
  if (d.success) {
    atualizarEsperaGlobal(aberta);
    toast(aberta ? '🔓 Lista de espera aberta!' : '🔒 Lista de espera fechada!', 'ok');
  } else {
    toast(d.error || 'Erro', 'err');
  }
}

/* ─────────────────────────────────────────────
   RENDER POLOS
   ───────────────────────────────────────────── */
function renderPolos() {
  const grid = document.getElementById('polosGrid');
  if (!grid) return;
  atualizarStats();

  if (POLOS.length === 0) {
    grid.innerHTML = `<div class="empty-state">Nenhum polo cadastrado. Use a barra acima para criar o primeiro.</div>`;
    return;
  }

  grid.innerHTML = POLOS.map(polo => {
    const turmas     = dadosGlobais[polo.id] || [];
    const poloAberto = polosStatus[polo.id] !== false;
    const count      = turmas.length;

    return `
      <div class="polo-card">
        <div class="polo-head">
          <div style="min-width:0;">
            <div class="polo-name" onclick="abrirModalTurmas('${polo.id}')">${polo.nome}</div>
            <div class="polo-id">${polo.id}</div>
          </div>
          <button class="polo-toggle ${poloAberto ? 'is-open' : 'is-closed'}" onclick="togglePolo('${polo.id}')" title="${poloAberto ? 'Clique para fechar' : 'Clique para abrir'}">
            ${poloAberto ? lockOpenSVG() : lockClosedSVG()}
            ${poloAberto ? 'Aberto' : 'Fechado'}
          </button>
        </div>
        <div class="polo-body">
          <span class="polo-count"><strong>${count}</strong> turma${count !== 1 ? 's' : ''} cadastradas</span>
          <button class="btn btn-sm btn-primary" onclick="abrirModalTurmas('${polo.id}')">Turmas</button>
        </div>
        <div class="polo-foot">
          <button class="icon-btn" onclick="copiarUrl('${polo.id}')" title="Copiar URL pública">
            ${linkSVG()}
          </button>
          <button class="icon-btn danger" onclick="deletarPolo('${polo.id}')" title="Deletar polo">
            ${trashSVG()}
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function lockOpenSVG() {
  return `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>`;
}
function lockClosedSVG() {
  return `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
}
function linkSVG() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`;
}
function trashSVG() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>`;
}

/* ─────────────────────────────────────────────
   MODAL TURMAS
   ───────────────────────────────────────────── */
function abrirModalTurmas(poloId) {
  poloAtivo = poloId;
  const polo = POLOS.find(p => p.id === poloId);
  document.getElementById('modalTurmasTitulo').textContent = polo?.nome || 'Polo';
  renderTurmasModal();
  document.getElementById('modalTurmasBg').classList.add('open');
}
function fecharModalTurmas() {
  document.getElementById('modalTurmasBg').classList.remove('open');
  document.getElementById('enderecoEditBar').classList.remove('show');
  poloAtivo = null;
}

function renderTurmasModal() {
  const turmas = dadosGlobais[poloAtivo] || [];
  const body   = document.getElementById('modalTurmasBody');

  if (turmas.length === 0) {
    body.innerHTML = `<div class="empty-turmas">Nenhuma turma cadastrada.<br>Clique em <strong>+ Turma</strong> para adicionar.</div>`;
    return;
  }

  body.innerHTML = turmas.map((t, i) => {
    const aberta = t.aberta !== false;
    return `
      <div class="turma-item">
        <div class="turma-info">
          <div class="turma-modulo">${t.modulo}</div>
          <div class="turma-dias">${t.dias}</div>
          <div class="turma-horario">${t.horario}</div>
          ${t.form ? `<div class="turma-form">${t.form.replace('https://docs.google.com/forms/d/','').substring(0,40)}…</div>` : ''}
        </div>
        <div class="turma-actions">
          <button class="icon-btn" onclick="toggleTurma('${poloAtivo}', ${i})" title="${aberta ? 'Fechar turma' : 'Abrir turma'}" style="color: ${aberta ? 'var(--green)' : 'var(--red)'};">
            ${aberta ? lockOpenSVG() : lockClosedSVG()}
          </button>
          <button class="icon-btn" onclick="editarTurma('${poloAtivo}', ${i})" title="Editar">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="icon-btn danger" onclick="removerTurma('${poloAtivo}', ${i})" title="Remover">
            ${trashSVG()}
          </button>
        </div>
      </div>`;
  }).join('');
}

/* ─────────────────────────────────────────────
   FORM TURMA
   ───────────────────────────────────────────── */
function novaTurma(poloId) {
  editandoPolo = poloId;
  editandoIdx  = null;
  document.getElementById('modalTitulo').textContent = 'Nova turma';
  document.getElementById('mModulo').value  = 'Módulo I — Básico';
  document.getElementById('mDias').value    = '2ª e 4ª feira';
  document.getElementById('mHorario').value = '';
  document.getElementById('mForm').value    = '';
  document.getElementById('modalMsg').style.display = 'none';
  document.getElementById('modalBg').classList.add('open');
}

function editarTurma(poloId, idx) {
  editandoPolo = poloId;
  editandoIdx  = idx;
  const t = dadosGlobais[poloId][idx];
  document.getElementById('modalTitulo').textContent = 'Editar turma';
  document.getElementById('mModulo').value  = t.modulo;
  document.getElementById('mDias').value    = t.dias;
  document.getElementById('mHorario').value = t.horario;
  document.getElementById('mForm').value    = t.form || '';
  document.getElementById('modalMsg').style.display = 'none';
  document.getElementById('modalBg').classList.add('open');
}

function fecharModal() {
  document.getElementById('modalBg').classList.remove('open');
}

async function salvarTurma() {
  const abertaAtual = editandoIdx !== null && dadosGlobais[editandoPolo]?.[editandoIdx]?.aberta;
  const turma = {
    modulo:  document.getElementById('mModulo').value,
    dias:    document.getElementById('mDias').value,
    horario: document.getElementById('mHorario').value.trim(),
    form:    document.getElementById('mForm').value.trim(),
    aberta:  editandoIdx !== null ? (abertaAtual !== false) : true,
  };

  if (!turma.horario) return mostrarMsg('modalMsg', 'Preencha o horário', 'err');

  const lista = [...(dadosGlobais[editandoPolo] || [])];
  if (editandoIdx !== null) lista[editandoIdx] = turma;
  else lista.push(turma);

  try {
    const r = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senha, polo: editandoPolo, turmas: lista })
    });
    const d = await r.json();
    if (d.success) {
      dadosGlobais[editandoPolo] = lista;
      renderPolos();
      if (poloAtivo === editandoPolo) renderTurmasModal();
      fecharModal();
      toast('✓ Turma salva', 'ok');
    } else {
      mostrarMsg('modalMsg', d.error || 'Erro', 'err');
    }
  } catch(e) {
    mostrarMsg('modalMsg', 'Erro de conexão', 'err');
  }
}

async function togglePolo(poloId) {
  const aberto = polosStatus[poloId] !== false;
  const novoStatus = !aberto;
  try {
    const r = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senha, polo: poloId, poloAberto: novoStatus })
    });
    const d = await r.json();
    if (d.success) {
      polosStatus[poloId] = novoStatus;
      renderPolos();
      toast(novoStatus ? `🔓 ${poloId} aberto!` : `🔒 ${poloId} fechado!`, 'ok');
    } else {
      toast(d.error || 'Erro', 'err');
    }
  } catch(e) { toast('Erro de conexão', 'err'); }
}

async function toggleTurma(poloId, idx) {
  const lista = [...(dadosGlobais[poloId] || [])];
  lista[idx] = { ...lista[idx], aberta: lista[idx].aberta === false ? true : false };
  try {
    const r = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senha, polo: poloId, turmas: lista })
    });
    const d = await r.json();
    if (d.success) {
      dadosGlobais[poloId] = lista;
      renderPolos();
      renderTurmasModal();
    } else {
      toast(d.error || 'Erro', 'err');
    }
  } catch(e) { toast('Erro de conexão', 'err'); }
}

async function removerTurma(poloId, idx) {
  if (!confirm('Remover esta turma?')) return;
  const lista = [...(dadosGlobais[poloId] || [])];
  lista.splice(idx, 1);
  try {
    const r = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senha, polo: poloId, turmas: lista })
    });
    const d = await r.json();
    if (d.success) {
      dadosGlobais[poloId] = lista;
      renderPolos();
      renderTurmasModal();
      toast('Turma removida', 'ok');
    }
  } catch(e) { toast('Erro de conexão', 'err'); }
}

/* ─────────────────────────────────────────────
   CRIAR POLO
   ───────────────────────────────────────────── */
async function criarPolo() {
  const nome = document.getElementById('novoPoloNome').value.trim();
  const id   = document.getElementById('novoPoloId').value.trim();
  const end  = document.getElementById('novoPoloEnd').value.trim();

  if (!nome || !id) return toast('Preencha nome e ID do polo', 'err');
  if (!id.startsWith('polo-')) return toast('ID deve começar com "polo-"', 'err');
  if (POLOS.find(p => p.id === id)) return toast('Polo já existe', 'err');

  POLOS.push({ id, nome });
  dadosGlobais[id] = [];
  polosStatus[id]  = true;
  enderecos[id]    = end;

  await fetch(API, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ senha, polo: id, turmas: [] })
  });
  await fetch(API, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ senha, polo: id, poloAberto: true })
  });
  await fetch(API, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ senha, polo: id, nome, endereco: end })
  });
  await fetch(API, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ senha, backupAgora: true })
  });

  document.getElementById('novoPoloNome').value = '';
  document.getElementById('novoPoloId').value   = '';
  document.getElementById('novoPoloEnd').value  = '';
  renderPolos();
  toast(`✓ Polo "${nome}" criado!`, 'ok');
}

/* ─────────────────────────────────────────────
   ENDEREÇO DO POLO
   ───────────────────────────────────────────── */
function editarEndereco() {
  const bar = document.getElementById('enderecoEditBar');
  const polo = POLOS.find(p => p.id === poloAtivo);
  document.getElementById('nomeInput').value     = polo?.nome || '';
  document.getElementById('enderecoInput').value = enderecos[poloAtivo] || '';
  bar.classList.add('show');
}

function fecharEndereco() {
  document.getElementById('enderecoEditBar').classList.remove('show');
}

async function salvarEndereco() {
  const end       = document.getElementById('enderecoInput').value.trim();
  const nomeInput = document.getElementById('nomeInput');
  const nomeVal   = nomeInput ? nomeInput.value.trim() : undefined;
  const r = await fetch(API, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ senha, polo: poloAtivo, endereco: end, ...(nomeVal ? { nome: nomeVal } : {}) })
  });
  const d = await r.json();
  if (d.success) {
    enderecos[poloAtivo] = end;
    if (nomeVal) {
      const p = POLOS.find(x => x.id === poloAtivo);
      if (p) p.nome = nomeVal;
      document.getElementById('modalTurmasTitulo').textContent = nomeVal;
      renderPolos();
    }
    fecharEndereco();
    toast('✓ Endereço salvo!', 'ok');
  }
}

/* ─────────────────────────────────────────────
   DELETAR POLO
   ───────────────────────────────────────────── */
async function deletarPolo(poloId) {
  const polo = POLOS.find(p => p.id === poloId);
  if (!confirm(`Deletar "${polo?.nome}"? Todas as turmas serão removidas.`)) return;

  const r = await fetch(API, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ senha, deletarPolo: poloId })
  });
  const d = await r.json();

  if (d.success) {
    const idx = POLOS.findIndex(p => p.id === poloId);
    if (idx !== -1) POLOS.splice(idx, 1);
    delete dadosGlobais[poloId];
    delete polosStatus[poloId];
    delete enderecos[poloId];
    renderPolos();
    toast('✓ Polo deletado!', 'ok');
  }
}

/* ─────────────────────────────────────────────
   COPIAR URL
   ───────────────────────────────────────────── */
function copiarUrl(poloId) {
  const url = `${window.location.origin}/polo.html?id=${poloId}`;
  navigator.clipboard.writeText(url).then(() => {
    toast(`✓ URL copiada: ${url}`, 'ok');
  }).catch(() => {
    const el = document.createElement('textarea');
    el.value = url;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    toast(`✓ URL copiada: ${url}`, 'ok');
  });
}

/* ─────────────────────────────────────────────
   CONFIGURAÇÕES
   ───────────────────────────────────────────── */
async function salvarConfigs() {
  const configs = {
    titulo:     document.getElementById('cfgTitulo').value.trim(),
    eyebrow:    document.getElementById('cfgEyebrow').value.trim(),
    dataEvento: document.getElementById('cfgDataEvento').value.trim(),
    data24:     document.getElementById('cfgData24').value.trim(),
    data35:     document.getElementById('cfgData35').value.trim(),
    semestre:   document.getElementById('cfgSemestre').value.trim(),
    linkEspera: document.getElementById('cfgLinkEspera').value.trim(),
  };
  try {
    const r = await fetch(API, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senha, configs })
    });
    const d = await r.json();
    if (d.success) toast('✓ Configurações salvas!', 'ok');
    else toast(d.error || 'Erro', 'err');
  } catch(e) {
    toast('Erro de conexão', 'err');
  }
}

/* ─────────────────────────────────────────────
   BACKUP / RESTAURAR
   ───────────────────────────────────────────── */
async function fazerBackup() {
  try {
    toast('Enviando backup para a planilha…', 'ok');
    const r = await fetch(API, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senha, backupAgora: true })
    });
    const d = await r.json();
    if (d.success) {
      toast('✓ Backup enviado para a planilha!', 'ok');
      const meta = document.getElementById('lastBackup');
      if (meta) meta.textContent = 'agora · manual';
    } else {
      toast(d.error || 'Erro ao fazer backup', 'err');
    }
  } catch(e) {
    toast('Erro de conexão', 'err');
  }
}

async function restaurarDaPlanilha() {
  if (!confirm('⚠️ ATENÇÃO: Isso vai APAGAR todos os dados atuais do Edge Config e substituir pelo que está na planilha.\n\nUse apenas em emergência quando o Edge Config perder os dados.\n\nTem certeza?')) return;

  try {
    toast('Buscando turmas da planilha…', 'ok');

    const r = await fetch('/api/restore');
    const d = await r.json();

    if (!d.turmas) return toast('Planilha sem turmas ou erro de conexão', 'err');

    const r2 = await fetch(API, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senha, todasTurmas: d.turmas })
    });
    const d2 = await r2.json();
    if (!d2.success) return toast(d2.error || 'Erro ao salvar', 'err');

    const ids = Object.keys(d.turmas);
    for (const id of ids) {
      await fetch(API, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senha, polo: id, poloAberto: true })
      });
      if (d.nomes?.[id] || d.enderecos?.[id]) {
        await fetch(API, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ senha, polo: id, nome: d.nomes?.[id], endereco: d.enderecos?.[id] })
        });
      }
    }

    dadosGlobais = d.turmas;
    renderPolos();
    toast(`✓ ${ids.length} polos restaurados da planilha!`, 'ok');
  } catch(e) {
    toast('Erro ao restaurar: ' + e.message, 'err');
  }
}

/* ─────────────────────────────────────────────
   NAVEGAÇÃO entre páginas
   ───────────────────────────────────────────── */
const pageMeta = {
  overview: { title: 'Visão Geral',     sub: 'Status global das inscrições em todos os polos', crumb: 'painel · visão geral' },
  polos:    { title: 'Polos e Turmas',  sub: 'Crie, configure e gerencie os polos cadastrados', crumb: 'painel · polos' },
  config:   { title: 'Configurações',   sub: 'Datas, títulos e parâmetros do semestre',          crumb: 'painel · configurações' },
  backup:   { title: 'Backup',          sub: 'Backup e restauração do Edge Config',              crumb: 'painel · backup' },
};

function navigate(page) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === page));
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.dataset.page === page));
  const m = pageMeta[page] || pageMeta.overview;
  document.getElementById('pageTitle').textContent = m.title;
  document.getElementById('pageSub').textContent = m.sub;
  document.getElementById('crumb').textContent = m.crumb;
  localStorage.setItem('fiec_admin_page', page);
  closeSidebar();
}

/* ─────────────────────────────────────────────
   SIDEBAR MOBILE
   ───────────────────────────────────────────── */
function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('scrim').classList.add('show');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('scrim').classList.remove('show');
}

/* ─────────────────────────────────────────────
   TOAST
   ───────────────────────────────────────────── */
function toast(msg, type='ok') {
  const wrap = document.getElementById('toasts');
  if (!wrap) return;
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function mostrarMsg(id, texto, tipo) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = texto;
  el.className = 'msg ' + tipo;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 4000);
}

/* ─────────────────────────────────────────────
   INIT
   ───────────────────────────────────────────── */
window.addEventListener('load', () => {
  const senhaSalva = localStorage.getItem('fiec_admin_senha');
  if (!senhaSalva) {
    window.location.href = '/index.html';
    return;
  }
  senha = senhaSalva;

  // Navegação
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.page));
  });

  // Hamburger
  document.getElementById('hamburger').addEventListener('click', openSidebar);
  document.getElementById('scrim').addEventListener('click', closeSidebar);

  // Modais fecham ao clicar no fundo
  document.getElementById('modalTurmasBg').addEventListener('click', e => {
    if (e.target === e.currentTarget) fecharModalTurmas();
  });
  document.getElementById('modalBg').addEventListener('click', e => {
    if (e.target === e.currentTarget) fecharModal();
  });

  // Esc fecha modais
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      fecharModal();
      fecharModalTurmas();
    }
  });

  // Restaura última página vista
  const saved = localStorage.getItem('fiec_admin_page');
  if (saved && pageMeta[saved]) navigate(saved);

  carregarTudo();
});
