/* ===== Telemetria de uso (somente hospedado) + Painel Administrador =====
   Telemetria: contagens e metadados (recurso, fase, resultado, duração). Nunca conteúdo de fichas, prints, pesquisas,
   contratos, respostas da IA, nomes de clientes, CNPJs ou valores. Falha de coleta nunca bloqueia a operação.
   Painel: a UI só aparece se /api/me informar painel=true; a autorização real é do backend (/api/adm/*). */
const TEL = { on: !!window.__HOSTED__, q: [], fail: 0, busy: false, tm: null, act: new Set(), inDiag: '', mudo: 0 };
const telId = () => { try { return crypto.randomUUID().replace(/-/g, '').slice(0, 24); } catch { return Date.now().toString(36) + Math.random().toString(36).slice(2, 12); } };
const TEL_COD = /^[a-z0-9_]{1,40}$/;
function tel(func, fase, resultado, o = {}) {
  try {
    if (!TEL.on || TEL.mudo) return;
    TEL.q.push({ id: o.id || telId(), func, fase, resultado: resultado || null, corr: o.corr || null, dur: o.dur ?? null, ts: new Date().toISOString(), meta: o.meta || {} });
    if (TEL.q.length > 300) TEL.q.splice(0, TEL.q.length - 300);
    telAgenda(fase === 'iniciada' ? 4000 : 1200);
  } catch { /* coleta nunca interrompe o uso */ }
}
function telAgenda(ms) { if (TEL.tm) return; TEL.tm = setTimeout(() => { TEL.tm = null; telFlush(); }, ms); }
async function telFlush() {
  if (TEL.busy || !TEL.q.length || !TEL.on) return; TEL.busy = true;
  const lote = TEL.q.splice(0, 25);
  try {
    const c = new AbortController(), to = setTimeout(() => c.abort(), 8000);
    let r; try { r = await fetch('/api/ev', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ eventos: lote }), keepalive: true, credentials: 'same-origin', redirect: 'manual', signal: c.signal }); } finally { clearTimeout(to); }
    if (r.status === 401 || r.status === 403 || r.status === 413 || r.type === 'opaqueredirect') { TEL.fail = 0; return; } /* não adianta repetir */
    const j = await r.json().catch(() => null); if (!r.ok || !j || !j.ok) throw new Error('coleta');
    if (TEL.fail) { const n = TEL.fail; TEL.fail = 0; TEL.q.push({ id: telId(), func: 'coleta_falha', fase: 'concluida', resultado: 'ok', corr: null, dur: null, ts: new Date().toISOString(), meta: { n } }); }
  } catch {
    TEL.fail++; if (TEL.fail < 6) TEL.q.unshift(...lote); /* reenvio é idempotente (mesmo id) */
  } finally { TEL.busy = false; if (TEL.q.length) { TEL.tm = null; telAgenda(Math.min(60000, 2000 * 2 ** Math.min(TEL.fail, 5))); } }
}
try {
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') telFlush(); });
  window.addEventListener('pagehide', () => { telFlush(); });
} catch { /* sem DOM */ }

const telLogN = k => { try { return (UI.log || []).filter(l => l.k === k).length; } catch { return 0; } };
/* envolve uma função global: spec(args) => { func, meta?, fim?(ret,args) => meta, inicio? } ou null para ignorar */
function telWrap(nome, spec) {
  const orig = globalThis[nome]; if (typeof orig !== 'function' || orig.__tel) return false;
  const w = function (...a) {
    let sp = null; try { if (TEL.on && !TEL.mudo) sp = spec(a); } catch { sp = null; }
    if (!sp || TEL.act.has(sp.func)) return orig.apply(this, a);
    const corr = telId(), t0 = Date.now(), bad0 = telLogN('bad'), ok0 = telLogN('ok'); TEL.act.add(sp.func);
    if (sp.inicio) tel(sp.func, 'iniciada', null, { corr, meta: sp.meta });
    const fim = (ret, err) => {
      TEL.act.delete(sp.func);
      try {
        const bad = Math.max(0, telLogN('bad') - bad0), ok = Math.max(0, telLogN('ok') - ok0); let fase = 'concluida', res = 'ok', meta = { ...(sp.meta || {}) };
        if (err) { fase = 'erro'; res = 'erro'; meta.codigo = TEL_COD.test(String(err.code || '').toLowerCase()) ? String(err.code).toLowerCase() : 'excecao'; }
        else if (bad && !ok) { fase = 'erro'; res = 'erro'; meta.codigo = 'falha_registrada'; }
        else if (bad) res = 'parcial';
        if (!err && sp.fim) { const m = sp.fim(ret, a); if (m === false) return; Object.assign(meta, m || {}); }
        tel(sp.func, fase, res, { corr, dur: Date.now() - t0, meta });
      } catch { /* nunca propaga */ }
    };
    let ret; try { ret = orig.apply(this, a); } catch (e) { fim(null, e); throw e; }
    if (ret && typeof ret.then === 'function') return ret.then(v => { fim(v); return v; }, e => { fim(null, e); throw e; });
    fim(ret); return ret;
  };
  w.__tel = 1; globalThis[nome] = w; return true;
}
const telN = x => Math.min(9999, (x && x.length) || 0);
const telClN = () => { try { return Object.keys(S.clients).length; } catch { return 0; } };
function telWire() {
  if (!TEL.on) return;
  /* carteira: o evento útil é a confirmação da importação; falha de leitura é registrada na própria leitura */
  telWrap('loadPortfolio', () => ({ func: 'import_carteira', meta: { tipo: 'carteira', via: 'arquivo' }, fim: () => (UI.wiz || UI.emp?.pend ? false : undefined) }));
  telWrap('empAplicar', () => ({ func: 'import_carteira', meta: { tipo: 'carteira', via: 'arquivo' }, fim: () => ({ clientes: telClN() }) }));
  telWrap('impApplyPlan', () => { const n0 = telClN(); return { func: 'import_carteira', meta: { tipo: 'carteira', via: 'arquivo' }, fim: () => (UI.wiz ? false : { n: Math.max(0, telClN() - n0), clientes: telClN() }) }; });
  telWrap('ingestLote', a => ({ func: a[1] === 'doc' ? 'doc_upload' : 'ficha_upload', inicio: true, meta: { modo: 'lote', tipo: a[1] === 'doc' ? 'doc' : 'ficha', n: telN(a[0]) } }));
  telWrap('ingest', a => ({ func: a[1] === 'ficha' ? 'ficha_upload' : 'doc_upload', inicio: true, meta: { modo: 'individual', tipo: a[1] === 'ficha' ? 'ficha' : 'doc', n: telN(a[0]) } }));
  telWrap('ingestCdoc', a => ({ func: 'doc_upload', inicio: true, meta: { modo: 'individual', tipo: 'doc', n: telN(a[0]) } }));
  telWrap('prAdd', a => ({ func: 'doc_upload', inicio: true, meta: { tipo: 'imagem', n: telN(a[0]) } }));
  telWrap('ocrPrep', a => ({ func: 'doc_upload', inicio: true, meta: { tipo: 'imagem', n: telN(a[0]) } }));
  telWrap('solImportFiles', a => ({ func: 'solucao_importar', inicio: true, meta: { via: 'arquivo', n: telN(a[0]) } }));
  telWrap('aiImportFile', () => ({ func: 'solucao_importar', inicio: true, meta: { via: 'arquivo', n: 1 } }));
  telWrap('importBackup', () => ({ func: 'dados_backup', meta: { op: 'restaurar' } }));
  telWrap('dmRun', () => ({ func: 'dados_backup', meta: { op: 'limpar' } }));
  telWrap('execExport', () => ({ func: 'relatorio_exportar', inicio: true, meta: { tipo: 'pdf' } }));
  telWrap('jdSet', a => { const k = a[2]; if (!['faz_sentido', 'investigar', 'ja_atendida', 'descartar'].includes(k)) return null; return { func: 'recomendacao_leitura', meta: { leitura: k } }; });
  telWrap('offer', a => {
    const nome = String(a[0] || '').toLowerCase(), ext = (nome.match(/\.([a-z0-9]{2,5})$/) || [])[1] || '';
    if (/backup/.test(nome)) return { func: 'dados_backup', meta: { op: 'export', tipo: 'backup' } };
    if (/^pedido-|^roteiro-/.test(nome)) return null;
    return { func: 'relatorio_exportar', meta: { tipo: ['pdf', 'csv', 'xlsx', 'json', 'html'].includes(ext) ? ext : 'doc' } };
  });
  /* diagnóstico completo: uma abertura por entrada na tela (ou troca de cliente) */
  telWrap('render', () => {
    const k = UI.view === 'diag' && UI.dx ? 'diag:' + UI.dx.key + ':' + UI.dx.id : '';
    if (k && k !== TEL.inDiag) { TEL.inDiag = k; tel('diag_abrir', 'concluida', 'ok', { meta: {} }); } else if (!k) TEL.inDiag = '';
    return null;
  });
}
function telActWire() {
  if (!TEL.on) return;
  const o = ACT.rxRefresh; if (typeof o === 'function' && !o.__tel) { const w = function (...a) { const t0 = Date.now(); let r; try { r = o.apply(this, a); tel('raiox_gerar', 'concluida', 'ok', { dur: Date.now() - t0, meta: { modo: 'manual' } }); return r; } catch (e) { tel('raiox_gerar', 'erro', 'erro', { dur: Date.now() - t0, meta: { codigo: 'excecao' } }); throw e; } }; w.__tel = 1; ACT.rxRefresh = w; }
}
/* Desempenho da abertura (item 30): 1 evento por abertura, só tempos em ms do navegador (sem URL, conteúdo ou nome). dur = fase de dados (initStore). */
const TEL_PERF = { lcp: 0, cls: 0 };
try {
  if (TEL.on) {
    try { new PerformanceObserver(l => { for (const e of l.getEntries()) TEL_PERF.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true }); } catch { /* sem suporte */ }
    try { new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) TEL_PERF.cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); } catch { /* sem suporte */ }
  }
} catch { /* sem DOM */ }
function telAbertura(t0) {
  try {
    if (!TEL.on || telAbertura.feito) return; telAbertura.feito = 1;
    const fcp = (performance.getEntriesByName('first-contentful-paint')[0] || {}).startTime || 0, falha = /^(ERRO|mem[óo]ria)/.test(String(UI.persist || ''));
    tel('desempenho_abertura', falha ? 'erro' : 'concluida', falha ? 'erro' : 'ok', { dur: Date.now() - t0, meta: { fcp_ms: fcp, lcp_ms: TEL_PERF.lcp, pronto_ms: performance.now(), cls_m: TEL_PERF.cls * 1000, clientes: telClN(), ...(falha ? { codigo: 'modo_memoria' } : {}) } });
  } catch { /* coleta nunca interrompe o uso */ }
}
/* aviso simples de que eventos de uso são registrados */
const TEL_AVISO = 'Eventos de uso são registrados para acompanhar a adoção e o funcionamento da ferramenta: recurso utilizado, data/hora, resultado e tempo de processamento. Nunca são gravados o conteúdo de fichas, prints, pesquisas, contratos ou respostas da IA, nem nomes de clientes, CNPJs ou valores. Os eventos são guardados por prazo limitado e acessados apenas pelo administrador da plataforma.';
{
  const o = typeof vConta === 'function' ? vConta : null;
  if (o && TEL.on) { const w = function () { return o() + `<div class="card"><h3>Registro de uso</h3><p class="sm">${esc(TEL_AVISO)}</p></div>`; }; w.__tel = 1; globalThis.vConta = w; }
}
function telAvisoUmaVez() { if (!TEL.on) return; try { if (lsGet('adm.aviso') === '1') return; lsSet('adm.aviso', '1'); setTimeout(() => toast('Registramos eventos de uso (recurso, data, resultado), sem conteúdo de carteira. Detalhes em Configurações → Conta.'), 1500); } catch { /* ok */ } }

/* ---------------- Painel Administrador ---------------- */
const ADMV = { lem: null, data: null, loading: false, err: null, dias: 30, de: '', ate: '', func: '', sit: '', acc: '', msg: '', rosterTxt: '', edit: '', cat: null, catF: { fonte: '', estado: 'lida', q: '', pag: 0, mudou: false }, catBusy: '', catSel: {}, catMapa: null };
window.__PAINEL = false;
function admPainelOn(v) {
  window.__PAINEL = v === true;
  const i = NAV.findIndex(x => x[0] === 'adm');
  if (window.__PAINEL && i < 0) NAV.push(['adm', 'Administrador', 'shield', []]);
  if (!window.__PAINEL && i >= 0) NAV.splice(i, 1);
  VIEW_TITLE.adm = 'Painel Administrador';
  try { paintShell(); } catch { /* shell ainda não montado */ }
}
const ADM_SIT = { ativo: ['Ativo', 'p-ok'], sem_atividade_recente: ['Sem atividade recente', 'p-warn'], sem_recursos_principais: ['Acessou, sem recursos principais', 'p-warn'], nunca_acessou: ['Previsto — ainda não acessou', 'p-info'] };
async function admApi(rota, corpo) {
  const r = await fetch(rota, { method: corpo ? 'POST' : 'GET', headers: corpo ? { 'content-type': 'application/json' } : {}, body: corpo ? JSON.stringify(corpo) : undefined, credentials: 'same-origin', redirect: 'manual' });
  if (r.type === 'opaqueredirect' || r.status === 302) throw Object.assign(new Error('Sessão expirada: recarregue a página.'), { code: 'sessao_expirada' });
  let j = null; try { j = await r.json(); } catch { /* sem corpo */ }
  if (!j || !j.ok) throw Object.assign(new Error(j?.erro?.mensagem || (r.status === 403 ? 'Acesso negado.' : 'Erro HTTP ' + r.status)), { code: j?.erro?.codigo || 'http_' + r.status, status: r.status });
  return j;
}
async function admLoad() {
  if (ADMV.loading) return; ADMV.loading = true; ADMV.err = null;
  try {
    const p = new URLSearchParams(); if (ADMV.de && ADMV.ate) { p.set('de', new Date(ADMV.de + 'T00:00:00').toISOString()); p.set('ate', new Date(ADMV.ate + 'T23:59:59').toISOString()); } else p.set('dias', String(ADMV.dias));
    if (ADMV.func) p.set('func', ADMV.func);
    ADMV.data = await admApi('/api/adm/resumo?' + p.toString());
    try { ADMV.sug = await admApi('/api/adm/sugestoes'); } catch { ADMV.sug = { erro: true }; }
    await admCatLoad(true);
    try { ADMV.aud = (await admApi('/api/adm/auditoria')).itens; } catch { ADMV.aud = null; }
    try { ADMV.integ = await admApi('/api/adm/integracoes'); } catch { ADMV.integ = null; }
    try { ADMV.lem = await admApi('/api/adm/lembrete'); } catch { ADMV.lem = { erro: true }; } /* falha do bloco de lembretes não derruba o painel */
  } catch (e) { ADMV.err = e; ADMV.data = null; } finally { ADMV.loading = false; if (UI.view === 'adm') render(); }
}
const admPct = v => v == null ? '—' : (v * 100).toFixed(1).replace('.', ',') + '%';
const admMs = v => v == null ? '—' : v < 1000 ? v + ' ms' : (v / 1000).toFixed(1).replace('.', ',') + ' s';
function admSerie(s) {
  if (!s || !s.length) return '';
  const W = 640, H = 150, pad = 24, mx = Math.max(1, ...s.map(x => Math.max(x.acessaram, x.ativos))), bw = (W - pad * 2) / s.length;
  const bars = s.map((x, i) => { const x0 = pad + i * bw, ha = (x.acessaram / mx) * (H - pad - 14), hb = (x.ativos / mx) * (H - pad - 14), w = Math.max(2, bw * 0.38);
    return `<rect x="${(x0 + bw * 0.1).toFixed(1)}" y="${(H - pad - ha).toFixed(1)}" width="${w.toFixed(1)}" height="${ha.toFixed(1)}" fill="var(--ciano)"><title>${esc(x.t)}: ${x.acessaram} com acesso</title></rect><rect x="${(x0 + bw * 0.1 + w + 1).toFixed(1)}" y="${(H - pad - hb).toFixed(1)}" width="${w.toFixed(1)}" height="${hb.toFixed(1)}" fill="var(--pet)"><title>${esc(x.t)}: ${x.ativos} com atividade útil</title></rect>`; }).join('');
  const lab = (i) => `<text x="${(pad + i * bw + bw / 2).toFixed(1)}" y="${H - 8}" font-size="10" text-anchor="middle" fill="var(--txt2)">${esc(s[i].t.slice(5))}</text>`;
  const passo = Math.ceil(s.length / 10), ticks = s.map((_, i) => (i % passo === 0 ? lab(i) : '')).join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Executivos com acesso e com atividade útil por ${s.length > 31 ? 'semana' : 'dia'}" style="width:100%;max-height:190px"><line x1="${pad}" y1="${H - pad}" x2="${W - pad}" y2="${H - pad}" stroke="var(--bd)"/>${bars}${ticks}<text x="${pad}" y="11" font-size="10" fill="var(--txt2)">máx. ${mx}</text></svg>
  <div class="sm muted"><span style="color:var(--ciano)">■</span> com acesso &nbsp; <span style="color:var(--ink)">■</span> com atividade útil</div>`;
}
function vAdm() {
  if (!window.__PAINEL) return `<div class="card empty"><h2>Acesso restrito</h2><p>Este painel é exclusivo da conta administradora.</p></div>`;
  if (!ADMV.data && !ADMV.loading && !ADMV.err) setTimeout(admLoad, 0);
  const d = ADMV.data;
  if (ADMV.err) return `<div class="alert d" role="alert"><b>${ADMV.err.status === 403 ? 'Acesso negado.' : 'Falha ao carregar o painel.'}</b> ${esc(ADMV.err.message)}</div><button class="btn ghost" data-a="admReload">Tentar novamente</button>`;
  if (!d) return `<div class="alert i busy" role="status"><b>Carregando indicadores…</b></div>`;
  const k = d.kpis, c = d.criterios, fn = d.funcs || {}, rot = f => fn[f]?.rot || f;
  const opt = (v, l, cur) => `<option value="${esc(v)}" ${String(cur) === String(v) ? 'selected' : ''}>${esc(l)}</option>`;
  let h = `<div class="card"><div class="row" style="gap:10px;flex-wrap:wrap;align-items:end">
    <label class="sm">Período<br><select data-c="admDias">${[7, 14, 30, 60, 90, 180, 365].map(n => opt(n, 'Últimos ' + n + ' dias', ADMV.de ? '' : ADMV.dias)).join('')}${ADMV.de ? opt('x', 'Personalizado', 'x') : ''}</select></label>
    <label class="sm">De<br><input type="date" data-c="admDe" value="${esc(ADMV.de)}"></label><label class="sm">Até<br><input type="date" data-c="admAte" value="${esc(ADMV.ate)}"></label>
    <label class="sm">Recurso<br><select data-c="admFunc">${opt('', 'Todos os recursos', ADMV.func)}${Object.keys(fn).filter(f => f !== 'acesso').map(f => opt(f, rot(f), ADMV.func)).join('')}</select></label>
    <button class="btn ghost sm" data-a="admReload">Atualizar</button><span class="sp"></span><button class="btn pri sm" data-a="admExport">Exportar relatório (CSV)</button></div>
    <div class="sm muted" style="margin-top:6px">Período: ${esc(fmtDate(d.periodo.de))} → ${esc(fmtDate(d.periodo.ate))} • gerado em ${esc(fmtDate(d.geradoEm))}</div>${ADMV.msg ? `<div class="alert ${ADMV.msg.startsWith('!') ? 'd' : 'i'}" role="status" style="margin-top:8px">${esc(ADMV.msg.replace(/^!/, ''))}</div>` : ''}</div>`;
  h += `<div class="alert i"><b>Cobertura dos indicadores:</b> ${d.cobertura_inicio ? `eventos registrados desde <b>${esc(fmtDate(d.cobertura_inicio))}</b>. Não há histórico de uso anterior a essa data; nada foi inferido para trás.` : 'a coleta ainda não registrou eventos.'} Abrir a página não é uso contínuo e a ausência de eventos não prova que a ferramenta não foi usada (uso em instalação local/anônima não é identificável).</div>`;
  h += `<div class="grid g3">${[['Previstos (lista)', k.previstos], ['Identificados (acessaram)', k.identificados], ['Previstos que já acessaram', k.primeiro_acesso_previstos], ['Com acesso no período', k.com_acesso_periodo], ['Ativos no período (atividade útil)', k.ativos_periodo], ['Sem atividade recente', k.sem_atividade_recente], ['Nunca acessaram (previstos)', k.nunca_acessaram], ['Acessaram, sem recursos principais', k.acessaram_sem_recursos_principais], ['Identificados fora da lista', k.fora_da_lista]].map(([l, v]) => `<div class="kpi"><div class="sm muted">${l}</div><b style="font-size:24px">${v}</b></div>`).join('')}</div>`;
  h += `<div class="card"><h3>Critérios de classificação <span class="muted sm">(configuráveis)</span></h3>
    <ul class="sm"><li><b>Acesso</b>: entrada autenticada na ferramenta (1 por janela de ${c.sessao_min} min; recarregar não duplica). Não mede uso.</li>
    <li><b>Atividade útil</b>: execução <i>concluída</i> (ok/parcial) de recurso que gera valor — ${c.util.map(f => esc(rot(f))).join('; ')}.</li>
    <li><b>Recursos principais</b>: ${c.principais.map(f => esc(rot(f))).join('; ')}. <b>Ativo</b> = ao menos uma atividade útil em recurso principal nos últimos ${c.inatividade_dias} dias (a partir do início da cobertura).</li>
    <li><b>Sem atividade recente</b>: já usou recurso principal, mas não nos últimos ${c.inatividade_dias} dias • <b>Acessou, sem recursos principais</b>: entrou, mas nunca concluiu um recurso principal • <b>Previsto</b>: está na lista de convidados e ainda não entrou; passa a <b>Acessou</b> no primeiro login.</li></ul>
    <div class="row" style="gap:10px;flex-wrap:wrap;align-items:end"><label class="sm">Inatividade (dias)<br><input type="number" min="1" max="365" id="adm-inat" value="${c.inatividade_dias}" style="width:90px"></label>
    <label class="sm">Sessão (min)<br><input type="number" min="5" max="240" id="adm-sess" value="${c.sessao_min}" style="width:90px"></label>
    <label class="sm">Retenção (dias)<br><input type="number" min="30" max="730" id="adm-ret" value="${c.retencao_dias}" style="width:90px"></label>
    <div class="sm">Recursos principais:<br>${c.util.map(f => `<label style="margin-right:10px"><input type="checkbox" data-adm-pr="${esc(f)}" ${c.principais.includes(f) ? 'checked' : ''}> ${esc(rot(f))}</label>`).join('')}</div>
    <button class="btn ghost sm" data-a="admCfgSave">Salvar critérios</button></div></div>`;
  h += `<div class="card"><h3>Evolução da adoção</h3>${admSerie(d.serie)}<details class="sm"><summary>Tabela</summary><table><thead><tr><th>${d.serie.length && d.serie.length > 31 ? 'Semana' : 'Dia'}</th><th>Com acesso</th><th>Com atividade útil</th><th>Novos (1º acesso)</th><th>Identificados acumulados</th></tr></thead><tbody>${d.serie.map(x => `<tr><td>${esc(x.t)}</td><td>${x.acessaram}</td><td>${x.ativos}</td><td>${x.novos}</td><td>${x.acumulado_identificados}</td></tr>`).join('')}</tbody></table></details></div>`;
  const nPrev = d.usuarios.filter(u => !u.identificado).length, nAc = d.usuarios.length - nPrev, link = location.origin + '/sobre';
  h += `<div class="card" id="adm-prev"><h3>Lista de previstos e convites <span class="muted sm">(quem deveria usar a ferramenta)</span></h3><p class="sm muted">Inclua aqui quem você convidou. A pessoa aparece na lista de Executivos como <b>Previsto</b> e passa sozinha para <b>Acessou</b> no primeiro login corporativo (somente @${esc('totvs.com.br')}).</p>
    <div class="row" style="gap:6px;flex-wrap:wrap;align-items:end"><label class="sm">E-mail<br><input type="email" id="adm-r-email" placeholder="fulano@totvs.com.br" style="min-width:240px"></label><label class="sm">Nome<br><input type="text" id="adm-r-nome" placeholder="Fulano de Tal" maxlength="80" style="min-width:200px"></label><button class="btn pri sm" data-a="admRosterAdd1">Adicionar previsto</button></div>
    <p class="sm muted" style="margin:10px 0 4px">Ou cole vários, uma linha por pessoa: <code>e-mail;nome</code></p>
    <textarea id="adm-roster" rows="3" style="width:100%" placeholder="fulano@totvs.com.br;Fulano de Tal">${esc(ADMV.rosterTxt)}</textarea><div class="row" style="margin-top:6px;gap:6px;flex-wrap:wrap"><button class="btn ghost sm" data-a="admRosterAdd">Adicionar à lista</button><label class="btn ghost sm" style="cursor:pointer">Importar CSV/TXT<input type="file" id="adm-roster-f" accept=".csv,.txt" hidden></label><span class="sp"></span><button class="btn ghost sm" data-a="admCopyLink" data-v="${esc(link)}" title="${esc(link)}">Copiar link do convite</button><button class="btn ghost sm" data-a="admCopyPend" ${nPrev ? '' : 'disabled'}>Copiar e-mails de quem ainda não acessou (${nPrev})</button></div>
    <p class="sm muted" style="margin-top:6px">Link do convite: <code>${esc(link)}</code></p>
    ${d.roster.length ? `<details class="sm" style="margin-top:6px"><summary>${d.roster.length} previsto(s) na lista</summary><table><tbody>${d.roster.map(r => { const u = d.usuarios.find(x => x.email === r.email); return `<tr><td>${esc(r.nome || '')}</td><td>${esc(r.email)}</td><td>${u?.identificado ? `<span class="pill p-ok">Acessou</span> <span class="muted">${esc(fmtDate(u.primeiro_acesso))}</span>` : '<span class="pill p-info">Previsto</span>'}</td><td><button class="btn ghost sm" data-a="admRosterRm" data-id="${esc(r.email)}">Remover</button></td></tr>`; }).join('')}</tbody></table></details>` : ''}</div>`;
  const us = d.usuarios.filter(u => (!ADMV.sit || u.situacao === ADMV.sit) && (!ADMV.acc || (ADMV.acc === 'prev' ? !u.identificado : u.identificado)));
  h += admFunilCard(d.usuarios || []);
  h += `<div class="card"><div class="row"><h3>Executivos <span class="pill p-n">${us.length}</span></h3><span class="sp"></span><button class="btn pri sm" data-a="admAddFocus">+ Adicionar executivo</button></div><div class="row" style="margin-bottom:8px;gap:6px;flex-wrap:wrap" role="group" aria-label="Filtro de acesso">${[['', 'Todos', d.usuarios.length], ['prev', 'Previstos (ainda não acessaram)', nPrev], ['ac', 'Acessaram', nAc]].map(([v, l, n]) => `<button class="btn ${ADMV.acc === v ? 'pri' : 'ghost'} sm" data-a="admAcc" data-v="${v}" aria-pressed="${ADMV.acc === v}">${l} (${n})</button>`).join('')}<span class="sp"></span><label class="sm">Situação de uso <select data-c="admSit">${opt('', 'Todas', ADMV.sit)}${Object.entries(ADM_SIT).map(([v, [l]]) => opt(v, l, ADMV.sit)).join('')}</select></label></div>
    <div class="tw"><table><thead><tr><th>Nome</th><th>E-mail</th><th>Acesso</th><th>Primeiro acesso</th><th>Último acesso</th><th>Última atividade útil</th><th>Situação de uso</th><th>Recursos utilizados</th><th>Ações</th></tr></thead><tbody>${us.map(u => { const [sl, sc] = ADM_SIT[u.situacao] || [u.situacao, 'p-n'];
      if (ADMV.edit === u.email) return `<tr class="edit"><td><input type="text" id="adm-e-nome" value="${esc(u.nome)}" maxlength="80" aria-label="Nome" style="min-width:160px"></td><td>${u.identificado ? esc(u.email) + '<div class="sm muted">vem do login; não pode ser alterado</div>' : `<input type="email" id="adm-e-email" value="${esc(u.email)}" aria-label="E-mail" style="min-width:220px">`}</td><td colspan="6" class="sm muted">Editando ${esc(u.email)}</td><td class="nw"><button class="btn pri sm" data-a="admEditSave" data-id="${esc(u.email)}">Salvar</button> <button class="btn ghost sm" data-a="admEditOff">Cancelar</button></td></tr>`;
      return `<tr><td>${esc(u.nome)}${u.previsto ? '' : ' <span class="pill p-n" title="Identificado, mas fora da lista de previstos">fora da lista</span>'}</td><td>${esc(u.email)}</td><td>${u.identificado ? '<span class="pill p-ok">Acessou</span>' : '<span class="pill p-info">Previsto</span>'}</td><td>${esc(fmtDate(u.primeiro_acesso))}</td><td>${esc(fmtDate(u.ultimo_acesso))}</td><td>${esc(fmtDate(u.ultima_atividade_util))}</td><td>${u.identificado ? `<span class="pill ${sc}">${esc(sl)}</span>` : '<span class="muted">—</span>'}${u.evidencia_anterior ? `<div class="sm muted" title="Apenas contagem e datas de gravações anteriores ao início da coleta; não é uso medido">pré-coleta: ${u.evidencia_anterior.gravacoes} gravação(ões) até ${esc(fmtDate(u.evidencia_anterior.ultima))}</div>` : ''}</td><td class="sm">${u.recursos_utilizados.length ? u.recursos_utilizados.map(f => esc(rot(f))).join('; ') : '<span class="muted">—</span>'}</td><td class="nw"><button class="btn ghost sm" data-a="admEdit" data-id="${esc(u.email)}">Editar</button> <button class="btn ghost sm" data-a="admDel" data-id="${esc(u.email)}">Excluir</button></td></tr>`; }).join('') || '<tr><td colspan="9" class="muted">Nenhum executivo neste filtro.</td></tr>'}</tbody></table></div></div>`;
  h += `<div class="card"><h3>Recursos e valor gerado</h3><div class="tw"><table><thead><tr><th>Recurso</th><th>Usuários</th><th>Concluídas</th><th>Parciais</th><th>Erros</th><th>Taxa de erro</th><th>Tempo p50</th><th>Tempo p95</th></tr></thead><tbody>${d.recursos.filter(r => r.func !== 'acesso').map(r => `<tr><td>${esc(r.rot)}${r.principal ? ' <span class="pill p-ok">principal</span>' : ''}</td><td>${r.usuarios}</td><td>${r.concluidas}</td><td>${r.parcial}</td><td>${r.erros}</td><td>${admPct(r.taxa_erro)}</td><td>${admMs(r.dur_p50_ms)}</td><td>${admMs(r.dur_p95_ms)}</td></tr>`).join('') || '<tr><td colspan="8" class="muted">Sem eventos no período.</td></tr>'}</tbody></table></div><p class="sm muted">Tempo = duração medida de execuções concluídas (n pequeno ⇒ interpretar com cautela). Não há tempo de tela nem volume de cliques.</p></div>`;
  const sd = d.saude, lista = (a, f) => a.length ? `<ul class="sm">${a.map(f).join('')}</ul>` : '<div class="sm muted">Nenhum.</div>';
  h += `<div class="card"><h3>Saúde da plataforma</h3><div class="grid g2">
    <div><b class="sm">Erros recorrentes (≥3 no período)</b>${lista(sd.recorrentes, x => `<li>${esc(x.rot)}: <code>${esc(x.codigo)}</code> × ${x.n}</li>`)}</div>
    <div><b class="sm">Iniciadas sem conclusão (&gt;10 min, últimas 24 h)</b>${lista(Object.entries(sd.sem_conclusao), ([f, n]) => `<li>${esc(rot(f))}: ${n}</li>`)}</div>
    <div><b class="sm">Integrações indisponíveis (3 últimas chamadas falharam)</b>${lista(sd.integracoes_indisponiveis, x => `<li>${esc(x.rot)} desde ${esc(fmtDate(x.desde))}</li>`)}</div>
    <div><b class="sm">Limite/cota de provedor</b>${lista(sd.limites_provedor, x => `<li>${esc(x.rot)}: <code>${esc(x.codigo)}</code> × ${x.n}</li>`)}</div>
    <div><b class="sm">Fila de OCR (por estado)</b>${sd.filas?.ocr ? lista(Object.entries(sd.filas.ocr), ([e, n]) => `<li>${esc(e)}: ${n}</li>`) : '<div class="sm muted">Indisponível.</div>'}</div>
    <div><b class="sm">Coleta de telemetria</b><ul class="sm"><li>Último evento: ${esc(fmtDate(sd.coleta.ultimo_evento))}</li><li>Eventos no período: ${sd.coleta.eventos_no_periodo}</li><li>Falhas relatadas pelos navegadores: ${sd.coleta.falhas_relatadas_pelos_navegadores}</li><li>Falhas de gravação no servidor: ${d.coleta_servidor.falhas_servidor}${d.coleta_servidor.ultima_falha ? ' (última ' + esc(fmtDate(d.coleta_servidor.ultima_falha)) + ')' : ''}</li></ul></div></div>
    <div class="sm" style="margin-top:8px"><b>Tentativas negadas ao painel (24 h):</b> ${d.tentativas_negadas.ultimas_24h} ${d.tentativas_negadas.ultimas.length ? `<details><summary>últimas</summary><ul>${d.tentativas_negadas.ultimas.map(t => `<li>${esc(fmtDate(t.ts))} — ${esc(t.motivo)} (${esc(t.rota)})${t.usuario ? ' — ' + esc(t.usuario) : ''}</li>`).join('')}</ul></details>` : ''}</div>
    <div class="sm" style="margin-top:8px"><b>Observação de CSP (modo relatório):</b> ${(d.csp || []).length ? `${(d.csp || []).reduce((a, x) => a + x.n, 0)} ocorrência(s) <details><summary>detalhes</summary><ul>${d.csp.map(x => `<li>${esc(x.diretiva)} → ${esc(x.alvo)}: ${esc(x.n)} (último ${esc(fmtDate(x.ultimo))})</li>`).join('')}</ul></details>` : '<span class="muted">nenhuma violação registrada — política ainda em observação, não imposta.</span>'}</div></div>`;
  h += admIntegCard() + admCatCard() + admLemCard(ADMV.lem) + admSugCard(ADMV.sug) + admConviteCard();
  h += admAudCard();
  h += `<div class="card"><h3>Privacidade e retenção</h3><p class="sm">${esc(TEL_AVISO)}</p><p class="sm">Retenção atual: <b>${c.retencao_dias} dias</b> (eventos e tentativas negadas mais antigos são apagados automaticamente; última limpeza: ${esc(fmtDate(d.coleta_servidor.ultima_purga))}).</p><button class="btn ghost sm" data-a="admPurgar">Aplicar retenção agora</button></div>`;
  return h;
}
/* Funil de adoção dos previstos: cada etapa conta quem chegou nela; "parou aqui" lista quem não passou para a seguinte */
function admFunil(us) {
  const P = us.filter(u => u.previsto), ok3 = u => u.importou_carteira, ok4 = u => (u.recursos_principais_cobertura || []).some(f => f !== 'import_carteira');
  const et = [['Convidados (lista de previstos)', P], ['Acessaram', P.filter(u => u.identificado)], ['Importaram a carteira', P.filter(u => u.identificado && ok3(u))], ['Usaram um recurso principal', P.filter(u => u.identificado && ok3(u) && ok4(u))]];
  return et.map(([rot, l], i) => ({ rot, n: l.length, parou: i < et.length - 1 ? l.filter(u => !et[i + 1][1].includes(u)) : [] }));
}
const ADM_FUNIL_DICA = ['Ainda não entraram: reenvie o convite.', 'Entraram e não subiram a planilha da carteira: mostre o primeiro passo.', 'Têm carteira e ainda não usaram fichas, Raio-X, diagnóstico ou pesquisa: indique um cliente para começar.'];
function admFunilCard(us) {
  const F = admFunil(us), tot = F[0].n; if (!tot) return '';
  const fora = us.filter(u => !u.previsto && u.identificado).length;
  return `<div class="card" id="adm-funil"><h3>Funil de adoção <span class="muted sm">(previstos, desde o início da coleta)</span></h3>
  <div class="adm-fun">${F.map((e, i) => `<div class="adm-fe"><div class="row" style="gap:10px"><b class="adm-fn">${e.n}</b><span>${esc(e.rot)}</span><span class="sp"></span><span class="sm muted">${i ? Math.round(e.n / tot * 100) + '% dos convidados' : ''}</span></div><div class="adm-fb"><i style="width:${Math.max(e.n ? 2 : 0, e.n / tot * 100)}%"></i></div>
    ${e.parou.length ? `<details class="sm"><summary><b>${e.parou.length}</b> parou(aram) aqui — ${esc(ADM_FUNIL_DICA[i])}</summary><div class="row" style="gap:6px;flex-wrap:wrap;margin:6px 0"><button class="btn sm" data-a="admFunilCopy" data-i="${i}">Copiar e-mails (${e.parou.length})</button></div><div class="sm muted" style="word-break:break-word">${e.parou.map(u => esc(u.nome || u.email)).join(' · ')}</div></details>` : ''}</div>`).join('')}</div>
  ${fora ? `<p class="sm muted" style="margin-top:8px">Fora da lista de previstos: ${fora} conta(s) acessaram e não entram neste funil.</p>` : ''}</div>`;
}
const ADM_INT_EST = { nao_configurado: ['Não configurado', 'p-off'], nao_testado: ['Configurado, não testado', 'p-info'], conectado: ['Conectado e validado', 'p-ok'], falha_autenticacao: ['Falha de autenticação', 'p-bad'], indisponivel: ['Serviço indisponível', 'p-warn'], intervencao: ['Necessita intervenção', 'p-warn'] };
function admIntegCard() {
  const g = ADMV.integ; if (!g) return '';
  return `<div class="card" id="adm-integ"><div class="row"><h3>Integrações e Inteligência</h3><span class="sp"></span><button class="btn ghost sm" data-a="admIntegReload">Atualizar</button></div>
  <p class="sm muted">O estado vem da última execução real registrada de cada serviço. “Conectado e validado” só aparece quando houve uma execução bem-sucedida; credenciais ficam no servidor e nunca são exibidas.</p>
  <div class="tw"><table><thead><tr><th>Integração</th><th>Estado</th><th>Última verificação</th><th>Observação</th></tr></thead><tbody>${g.itens.map(x => { const e = ADM_INT_EST[x.estado] || [x.estado, 'p-info']; return `<tr><td><b>${esc(x.nome)}</b></td><td><span class="pill ${e[1]}">${esc(e[0])}</span>${x.codigo ? `<div class="sm muted">${esc(x.codigo)}</div>` : ''}</td><td class="sm">${x.ultima ? esc(fmtDate(x.ultima)) : '<span class="muted">nunca</span>'}</td><td class="sm muted">${esc(x.obs || '')}</td></tr>`; }).join('')}</tbody></table></div>
  <h4 style="margin-top:14px">Consumo e cotas <span class="muted sm">(contagem gravada no banco; vale para todas as instâncias)</span></h4>
  <div class="tw"><table><thead><tr><th>Operação</th><th class="num">Hoje</th><th class="num">7 dias</th><th class="num">Usuários (7 dias)</th><th class="num">Maior uso de um usuário hoje</th><th class="num">Limite diário por usuário</th></tr></thead><tbody>${g.consumo.map(c => `<tr><td>${esc(c.rot)}</td><td class="num">${c.hoje}</td><td class="num">${c.sete}</td><td class="num">${c.usuarios}</td><td class="num">${c.pico_usuario_hoje}${c.pico_usuario_hoje >= c.limite ? ' <span class="pill p-warn">no limite</span>' : ''}</td><td class="num">${c.limite}</td></tr>`).join('')}</tbody></table></div>
  <p class="sm muted" style="margin-top:8px">Frequência da leitura das fontes: bloco “Catálogo de soluções”. Aprovação de informações: fila de revisão do catálogo. Registro das ações: “Trilha de auditoria”.</p></div>`;
}
function admAudCard() {
  const a = ADMV.aud; if (!a) return '';
  return `<div class="card" id="adm-aud"><h3>Trilha de auditoria <span class="muted sm">(ações administrativas que alteram algo; guardada por 12 meses)</span></h3>${a.length ? `<details><summary class="sm">${a.length} registro(s) mais recente(s)</summary><div class="tw" style="max-height:320px"><table><thead><tr><th>Quando</th><th>Quem</th><th>Ação</th><th>Detalhe</th><th>Resultado</th></tr></thead><tbody>${a.map(x => `<tr><td class="sm">${esc(fmtDate(x.ts))}</td><td class="sm">${esc(x.usuario)}</td><td class="sm">${esc(x.acao)}</td><td class="sm">${esc(x.detalhe || '')}</td><td>${x.resultado === 'ok' ? '<span class="pill p-ok">ok</span>' : `<span class="pill p-warn">${esc(x.resultado)}</span>`}</td></tr>`).join('')}</tbody></table></div></details>` : '<p class="sm muted">Nenhuma ação registrada ainda.</p>'}</div>`;
}
function admLemCard(l) {
  if (!l) return '';
  if (l.erro) return '<div class="card"><h3>Lembretes (push)</h3><div class="sm muted">Não foi possível consultar os lembretes agora.</div></div>';
  const al = (l.alertas || []).map(a => `<div class="alert d" role="alert"><b>Lembretes:</b> ${esc(a.texto)}</div>`).join('');
  const t7 = l.ultimos_7_dias || {}, lt = x => x === 'manha' ? '09:00' : '14:00';
  const k = [['Aparelhos ativos', l.aparelhos], ['Executivos com lembrete', l.usuarios], ['Enviados (7 dias)', t7.enviados || 0], ['Dispensados: já tinham aberto (7 dias)', t7.pulados_uso || 0], ['Falhas (7 dias)', t7.falhas || 0], ['Com resumo recente (5 dias)', l.com_resumo_recente]];
  return `<div class="card" id="adm-lem"><h3>Lembretes (push) <span class="pill ${l.configurado ? 'p-ok' : 'p-bad'}">${l.configurado ? 'chaves configuradas' : 'chaves ausentes'}</span></h3>${al || '<div class="sm muted">Nenhum alerta.</div>'}
    <div class="grid g3" style="margin-top:8px">${k.map(([r, v]) => `<div class="card"><div class="sm muted">${esc(r)}</div><b style="font-size:1.4em">${esc(v ?? 0)}</b></div>`).join('')}</div>
    ${(l.historico || []).length ? `<details class="sm" style="margin-top:8px"><summary>Últimos turnos (${l.historico.length})</summary><div class="tw"><table><thead><tr><th>Dia</th><th>Turno</th><th class="r">Aparelhos</th><th class="r">Enviados</th><th class="r">Já abriram</th><th class="r">Removidos</th><th class="r">Falhas</th><th class="r">Adiados</th></tr></thead><tbody>${l.historico.map(x => `<tr><td>${esc(x.dia)}</td><td>${lt(x.turno)}</td><td class="r">${x.aparelhos}</td><td class="r">${x.enviados}</td><td class="r">${x.pulados_uso}</td><td class="r">${x.removidos}</td><td class="r">${x.falhas}${x.config_invalida ? ' ⚠' : ''}</td><td class="r">${x.adiados}</td></tr>`).join('')}</tbody></table></div></details>` : '<div class="sm muted" style="margin-top:8px">Nenhum turno registrado ainda.</div>'}
    <div class="sm muted" style="margin-top:6px">Mostra só contagens por turno; não há e-mails nem endereços de aparelho aqui. Envio é tentativa: entrega depende do navegador e do sistema do aparelho.</div></div>`;
}
function admConviteTxt() {
  const u = location.origin;
  return `Olá! A Gestão de Carteira ESN já está no ar: ${u}\n\nEntre com seu e-mail @totvs.com.br (o sistema envia um código por e-mail). Na tela inicial, o quadro "Primeiros passos" guia: importar sua carteira, conectar sua chave de IA, anexar uma ficha e ativar o lembrete das 9h e das 14h.\n\nSua carteira é privada: só você a vê. Termos e privacidade: ${u}/sobre/\n\nQualquer dúvida, é só me chamar.`;
}
function admConviteCard() {
  return `<div class="card" id="adm-convite"><h3>Convite para novos executivos</h3><p class="sm muted">Texto pronto para enviar por e-mail ou chat. Edite à vontade antes de copiar. Quem entra precisa ter e-mail @totvs.com.br; o acesso é liberado pelo Cloudflare Access.</p>
    <textarea id="adm-convite-txt" rows="7" style="width:100%">${esc(admConviteTxt())}</textarea><div class="row" style="margin-top:6px"><button class="btn pri sm" data-a="admCopiarConvite">Copiar texto</button></div></div>`;
}
function admCsv(d) {
  const q = v => '"' + String(v ?? '').replace(/"/g, '""').replace(/^([=+\-@\t\r])/, "'$1") + '"', L = []; /* neutraliza fórmulas ao abrir no Excel */
  L.push(['Relatório administrativo', 'Período', d.periodo.de, d.periodo.ate, 'Cobertura desde', d.cobertura_inicio || ''].map(q).join(';'));
  L.push(['Nome', 'E-mail', 'Primeiro acesso', 'Último acesso', 'Última atividade útil', 'Situação', 'Recursos utilizados'].map(q).join(';'));
  d.usuarios.forEach(u => L.push([u.nome, u.email, u.primeiro_acesso || '', u.ultimo_acesso || '', u.ultima_atividade_util || '', (ADM_SIT[u.situacao] || [u.situacao])[0], u.recursos_utilizados.map(f => d.funcs[f]?.rot || f).join(' | ')].map(q).join(';')));
  L.push(''); L.push(['Recurso', 'Usuários', 'Concluídas', 'Parciais', 'Erros', 'Taxa de erro', 'p50 ms', 'p95 ms'].map(q).join(';'));
  d.recursos.filter(r => r.func !== 'acesso').forEach(r => L.push([r.rot, r.usuarios, r.concluidas, r.parcial, r.erros, r.taxa_erro ?? '', r.dur_p50_ms ?? '', r.dur_p95_ms ?? ''].map(q).join(';')));
  L.push(''); L.push(['Erros recorrentes', 'Código', 'Ocorrências'].map(q).join(';')); d.saude.recorrentes.forEach(x => L.push([x.rot, x.codigo, x.n].map(q).join(';')));
  L.push(''); L.push(['Série', 'Com acesso', 'Com atividade útil', 'Novos'].map(q).join(';')); d.serie.forEach(x => L.push([x.t, x.acessaram, x.ativos, x.novos].map(q).join(';')));
  return '﻿' + L.join('\r\n');
}
function admRosterParse(txt) { return String(txt || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => { const p = l.split(/[;,\t]/).map(x => x.trim()); return { email: p[0], nome: p[1] || '' }; }).filter(x => /@/.test(x.email)); }
const SUG_L = { geral: 'Geral', lembrete: 'Lembrete diário', importacao: 'Importação', oportunidades: 'Oportunidades', briefing: 'Briefing', retornos: 'Retornos e reuniões', outro: 'Outro' };
function admSugCard(s) {
  if (!s || s.erro) return '';
  return `<div class="card"><h3>Sugestões do time <span class="pill ${s.nao_lidas ? 'p-warn' : 'p-info'}">${s.nao_lidas || 0} nova(s)</span></h3>
  <p class="muted sm">Texto livre enviado por cada executivo em Conta → Sugerir melhoria (sem CNPJ nem valores). Apagadas automaticamente após 180 dias.</p>
  ${s.itens && s.itens.length ? `<div class="tw" style="max-height:320px"><table><thead><tr><th>Quando</th><th>Quem</th><th>Área</th><th>Sugestão</th><th></th></tr></thead><tbody>${s.itens.map(x => `<tr class="${x.lida ? 'muted' : ''}"><td class="nw">${esc(dtBR(x.em))}</td><td class="sm">${esc(x.email)}</td><td>${esc(SUG_L[x.area] || x.area)}</td><td class="sm">${esc(x.texto)}</td><td>${x.lida ? '' : `<button class="btn ghost sm" data-a="admSugLida" data-id="${esc(x.id)}">Marcar como lida</button>`}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted sm">Nenhuma sugestão recebida.</p>'}</div>`;
}
/* ===== Catálogo de soluções: fontes oficiais, descoberta em lotes e fila de revisão ===== */
const CAT_FEST = { nao_testada: ['Não testada', 'p-info'], ok: ['Acessível', 'p-ok'], autenticacao_necessaria: ['Exige login', 'p-warn'], indisponivel: ['Indisponível', 'p-bad'], nao_encontrada: ['Não encontrada', 'p-bad'], bloqueada_robots: ['Bloqueada pelo robots.txt', 'p-warn'] };
const CAT_PEST = { pendente: 'Por ler', lida: 'Lida — aguarda revisão', candidata: 'Candidata', irrelevante: 'Irrelevante', inacessivel: 'Inacessível', importada: 'Importada' };
async function admCatLoad(silencioso) { try { ADMV.cat = await admApi('/api/adm/catalogo', { op: 'estado', ...ADMV.catF }); try { ADMV.catMapa = (await admApi('/api/adm/catalogo', { op: 'mapa' })).paginas; } catch { ADMV.catMapa = null; } } catch (e) { ADMV.cat = { erro: e.message }; } if (!silencioso && UI.view === 'adm') render(); }
async function admCatOp(corpo, rotulo) {
  if (ADMV.catBusy) return; ADMV.catBusy = rotulo; render(); let j = null;
  try { j = await admApi('/api/adm/catalogo', corpo); } catch (e) { toast(e.message); }
  ADMV.catBusy = ''; await admCatLoad(true); render(); return j;
}
/* cruzamento fila × Base de Soluções: mesma página = mesma chave de endereço (host + caminho + pageId) usada pelo servidor */
function admCatBaseIdx() { const m = new Map(); for (const r of S.solutions || []) if (!r.arquivado) for (const f of r.fontes || []) { const k = f.u && normUrl(f.u); if (k && !m.has(k)) m.set(k, r); } return m; }
function admCatCob() {
  const idx = admCatBaseIdx(), o = {}; for (const p of ADMV.catMapa || []) { const c = o[p.fonte] = o[p.fonte] || { lidas: 0, naBase: 0, validadas: 0, sinc: [] }, r = idx.get(p.chave); c.lidas++; if (r) { c.naBase++; if (r.status === 'Validado') c.validadas++; if (p.estado === 'lida' || p.estado === 'candidata') c.sinc.push(p.chave); } }
  return { idx, porFonte: o };
}
function admCatCsv() {
  const { idx } = admCatCob(), q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""').replace(/^([=+\-@])/, "'$1") + '"';
  return '﻿' + [['Fonte', 'Título da página', 'Endereço', 'Estado na fila', 'Na Base de Soluções', 'Solução', 'Status de validação', 'Linha', 'Tipo']].concat((ADMV.catMapa || []).map(p => { const r = idx.get(p.chave); return [p.fonte, p.titulo, p.url, CAT_PEST[p.estado] || p.estado, r ? 'sim' : 'não', r?.nome || '', r?.status || '', r?.linha || '', r ? TIPOS[r.tipo] || r.tipo : '']; })).map(l => l.map(q).join(';')).join('\r\n');
}
function admCatCard() {
  const c = ADMV.cat; if (!c) return '';
  if (c.erro) return `<div class="card" id="adm-cat"><h3>Catálogo de soluções — fontes oficiais</h3><div class="alert d">Não foi possível carregar o catálogo: ${esc(c.erro)}</div></div>`;
  const F = ADMV.catF, n = (f, e) => (f.contagem || {})[e] || 0, tot = f => Object.values(f.contagem || {}).reduce((a, b) => a + b, 0), busy = ADMV.catBusy ? 'disabled' : '';
  const sel = Object.keys(ADMV.catSel).filter(k => ADMV.catSel[k] && c.paginas.some(p => p.chave === k));
  const cob = admCatCob(), totSinc = Object.values(cob.porFonte).reduce((a, x) => a + x.sinc.length, 0);
  const fontes = c.fontes.map(f => { const e = CAT_FEST[f.estado] || [f.estado, 'p-info'], t = tot(f), rev = n(f, 'candidata') + n(f, 'irrelevante') + n(f, 'importada');
    return `<tr><td><b>${esc(f.nome)}</b><div class="sm muted" style="word-break:break-all">${esc(f.url)}</div></td><td><span class="pill ${e[1]}">${esc(e[0])}</span>${f.autenticado ? ' <span class="pill p-info">com credencial</span>' : ''}${f.erro ? `<div class="sm muted">${esc(f.erro)}</div>` : ''}<div class="sm muted">Teste: ${esc(f.testada_em ? fmtDate(f.testada_em) : 'nunca')} · Última leitura: ${esc(f.ultima_sinc ? fmtDate(f.ultima_sinc) : 'nunca')}</div></td>
    <td class="sm">${t ? `${t} descoberta(s)<br>${n(f, 'pendente')} por ler · ${n(f, 'lida')} aguardam revisão<br>${n(f, 'candidata')} candidata(s) · ${n(f, 'importada')} importada(s) · ${n(f, 'irrelevante')} irrelevante(s)<br>${n(f, 'inacessivel')} inacessível(is) · revisadas: ${t ? Math.round(rev / t * 100) : 0}%${cob.porFonte[f.id] ? `<br><b>Na Base: ${cob.porFonte[f.id].naBase}</b> de ${cob.porFonte[f.id].lidas} lida(s) · validadas: ${cob.porFonte[f.id].validadas}` : ''}${f.alteradas ? `<br><span class="pill p-warn">${f.alteradas} alterada(s) na fonte</span>` : ''}` : '<span class="muted">Nada descoberto ainda.</span>'}</td>
    <td><div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn sm" data-a="admCatTestar" data-f="${esc(f.id)}" ${busy}>Testar conexão</button><button class="btn sm pri" data-a="admCatDesc" data-f="${esc(f.id)}" ${busy || (f.estado === 'ok' && n(f, 'pendente') ? '' : 'disabled')}>Ler próximo lote (${c.limites.lote})</button>${n(f, 'candidata') + n(f, 'importada') ? `<button class="btn sm" data-a="admCatReler" data-f="${esc(f.id)}" ${busy || (f.estado === 'ok' ? '' : 'disabled')} title="Relê as páginas já revisadas e sinaliza as que mudaram na fonte">Verificar alterações (${c.limites.lote})</button>` : ''}${t ? `<button class="btn sm ghost" data-a="admCatLimpar" data-f="${esc(f.id)}" ${busy}>Limpar fila</button>` : ''}</div></td></tr>`; }).join('');
  const linhas = c.paginas.map(p => `<tr><td><input type="checkbox" data-c="admCatSel" data-k="${esc(p.chave)}" ${ADMV.catSel[p.chave] ? 'checked' : ''} ${p.vista_em ? '' : 'disabled'} aria-label="Selecionar página"></td><td>${esc(p.titulo || '(sem título)')}<div class="sm"><a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer" style="word-break:break-all">${esc(p.url)}</a></div>${(p.trilha || []).length ? `<div class="sm muted">${esc(p.trilha.join(' › '))}</div>` : ''}${cob.idx.get(p.chave) ? `<div class="sm"><span class="pill p-ok">Na Base</span> ${esc(cob.idx.get(p.chave).nome)} — ${esc(cob.idx.get(p.chave).status)}</div>` : ''}${p.mudou ? '<div class="sm"><span class="pill p-warn">Alterada na fonte desde a revisão</span></div>' : ''}${p.erro ? `<div class="sm muted">${esc(p.erro)}</div>` : ''}</td><td class="sm">${esc(p.fonte)} · nível ${p.prof}${p.filhos != null ? ` · ${p.filhos} link(s)` : ''}</td><td class="sm">${esc(CAT_PEST[p.estado] || p.estado)}</td></tr>`).join('');
  const opt = (v, t, cur) => `<option value="${esc(v)}" ${cur === v ? 'selected' : ''}>${esc(t)}</option>`;
  return `<div class="card" id="adm-cat"><h3>Catálogo de soluções — fontes oficiais <span class="muted sm">(descoberta e revisão)</span></h3>
  <p class="sm muted">A leitura é feita pelo servidor, em lotes pequenos, só nos domínios oficiais TOTVS e respeitando o robots.txt de cada fonte. Nada entra na Base de Soluções sozinho: cada página descoberta precisa da sua revisão, e a importação continua passando pela pré-visualização. Fonte que exige login não é contornada.</p>
  <label class="sm" style="display:block;margin:6px 0"><input type="checkbox" data-c="admCatAuto" ${c.auto ? 'checked' : ''}> <b>Leitura agendada</b> — o servidor lê 1 lote por horário agendado, em dias úteis, nas fontes já testadas com sucesso; uma vez por dia verifica alterações nas páginas revisadas. Continua sem importar nada sozinho.</label>
  ${ADMV.catBusy ? `<div class="alert i busy" role="status"><b>${esc(ADMV.catBusy)}</b></div>` : ''}
  <div class="tw"><table><thead><tr><th>Fonte</th><th>Estado</th><th>Cobertura</th><th>Ações</th></tr></thead><tbody>${fontes}</tbody></table></div>
  <h4 style="margin-top:14px">Fila de revisão <span class="muted sm">(${c.total} página(s) no filtro)</span></h4>
  <div class="row" style="gap:8px;flex-wrap:wrap"><select data-c="admCatFonte" aria-label="Fonte">${opt('', 'Todas as fontes', F.fonte)}${c.fontes.map(f => opt(f.id, f.nome, F.fonte)).join('')}</select><select data-c="admCatEst" aria-label="Estado">${opt('', 'Todos os estados', F.estado)}${Object.entries(CAT_PEST).map(([k, v]) => opt(k, v, F.estado)).join('')}</select><input type="text" id="adm-cat-q" placeholder="Buscar por título ou endereço" value="${esc(F.q)}" style="min-width:220px"><button class="btn sm" data-a="admCatBuscar">Buscar</button><label class="sm"><input type="checkbox" data-c="admCatMud" ${F.mudou ? 'checked' : ''}> Só alteradas na fonte</label><span class="sp"></span><button class="btn sm" data-a="admCatSinc" ${totSinc && !ADMV.catBusy ? '' : 'disabled'} title="Marca como importadas as páginas cuja fonte já está em uma solução da Base">Sincronizar com a Base (${totSinc})</button><button class="btn sm ghost" data-a="admCatExport" ${(ADMV.catMapa || []).length ? '' : 'disabled'}>Exportar cobertura (CSV)</button></div>
  ${c.paginas.length ? `<div class="row" style="gap:6px;flex-wrap:wrap;margin:8px 0"><span class="sm muted">${sel.length} selecionada(s):</span><button class="btn sm" data-a="admCatRev" data-e="candidata" ${sel.length ? '' : 'disabled'}>Marcar candidata</button><button class="btn sm" data-a="admCatRev" data-e="irrelevante" ${sel.length ? '' : 'disabled'}>Marcar irrelevante</button><button class="btn sm" data-a="admCatRev" data-e="importada" ${sel.length ? '' : 'disabled'}>Marcar importada</button><button class="btn sm ghost" data-a="admCatRev" data-e="lida" ${sel.length ? '' : 'disabled'}>Voltar para revisão</button><button class="btn sm pri" data-a="admCatImportar" ${sel.length && sel.length <= 3 ? '' : 'disabled'} title="Leva até 3 páginas para a importação por link da Base de Soluções">Abrir na importação (até 3)</button><button class="btn sm ghost" data-a="admCatSelTodas">Selecionar todas da página</button></div>
  <div class="tw"><table><thead><tr><th></th><th>Página</th><th>Origem</th><th>Estado</th></tr></thead><tbody>${linhas}</tbody></table></div>
  <div class="row" style="gap:8px;margin-top:8px"><button class="btn sm ghost" data-a="admCatPag" data-d="-1" ${c.pag > 0 ? '' : 'disabled'}>Anterior</button><span class="sm muted">Página ${c.pag + 1} de ${Math.max(1, Math.ceil(c.total / 100))}</span><button class="btn sm ghost" data-a="admCatPag" data-d="1" ${(c.pag + 1) * 100 < c.total ? '' : 'disabled'}>Próxima</button></div>` : '<p class="sm muted">Nenhuma página neste filtro.</p>'}
  ${c.exec.length ? `<details style="margin-top:10px"><summary class="sm">Últimas execuções</summary><ul class="sm">${c.exec.map(x => `<li>${esc(fmtDate(x.ts))} — ${esc(x.fonte)} · ${esc(x.op)}: ${x.lidas} lida(s), ${x.novas} nova(s), ${x.erros} erro(s)${x.detalhe ? ' — ' + esc(x.detalhe) : ''}</li>`).join('')}</ul></details>` : ''}</div>`;
}
const admCatSelecionadas = () => Object.keys(ADMV.catSel).filter(k => ADMV.catSel[k] && (ADMV.cat?.paginas || []).some(p => p.chave === k));
const ADM_CAT_ACT = {
  admCatTestar: async t => { const j = await admCatOp({ op: 'testar', fonte: t.dataset.f }, 'Testando a conexão com a fonte…'); if (j) toast(j.teste.estado === 'ok' ? `Fonte acessível: ${j.teste.links} link(s) internos encontrados.` : `Fonte não acessível: ${j.teste.erro || j.teste.estado}`); },
  admCatDesc: async t => { const j = await admCatOp({ op: 'descobrir', fonte: t.dataset.f }, 'Lendo o próximo lote de páginas…'); if (j) toast(`${j.lote.lidas} lida(s), ${j.lote.novas} nova(s), ${j.lote.erros} erro(s).${j.lote.parou ? ' ' + j.lote.parou : ''}`); },
  admCatLimpar: async t => { if (!confirm('Remover da fila todas as páginas descobertas desta fonte? A Base de Soluções não é alterada.')) return; const j = await admCatOp({ op: 'limpar', fonte: t.dataset.f, confirmar: t.dataset.f }, 'Limpando a fila…'); if (j) toast(`${j.removidas} página(s) removida(s) da fila.`); },
  admCatRev: async t => { const ch = admCatSelecionadas(); if (!ch.length) return; const j = await admCatOp({ op: 'revisar', chaves: ch, estado: t.dataset.e }, 'Gravando a revisão…'); if (j) { ADMV.catSel = {}; toast(`${j.alteradas} página(s) atualizada(s).`); render(); } },
  admCatImportar: () => { const ch = admCatSelecionadas(), pg = (ADMV.cat?.paginas || []).filter(p => ch.includes(p.chave)).slice(0, 3), us = pg.map(p => p.url); if (!us.length) return; UI.catHint = Object.fromEntries(pg.map(p => [p.chave, (p.trilha || []).filter(Boolean)])); UI.lkUrls = us.join('\n'); UI.view = 'solucoes'; render(); window.scrollTo(0, 0); toast('Links levados para "Importar por link". Confira e confirme a importação.'); },
  admCatReler: async t => { const j = await admCatOp({ op: 'reler', fonte: t.dataset.f }, 'Relendo páginas já revisadas…'); if (j) toast(`${j.releitura.relidas} relida(s), ${j.releitura.alteradas} alterada(s) na fonte, ${j.releitura.erros} erro(s).${j.releitura.parou ? ' ' + j.releitura.parou : ''}`); },
  admCatSinc: async () => { const ch = Object.values(admCatCob().porFonte).flatMap(x => x.sinc); if (!ch.length || ADMV.catBusy) return; ADMV.catBusy = 'Sincronizando a fila com a Base de Soluções…'; render(); let n = 0; try { for (let i = 0; i < ch.length; i += 100) n += (await admApi('/api/adm/catalogo', { op: 'revisar', chaves: ch.slice(i, i + 100), estado: 'importada' })).alteradas; toast(`${n} página(s) marcada(s) como importada(s).`); } catch (e) { toast(e.message); } ADMV.catBusy = ''; await admCatLoad(true); render(); },
  admCatExport: () => { if (!(ADMV.catMapa || []).length) return; TEL.mudo++; Promise.resolve(offer(`cobertura-catalogo-${new Date().toISOString().slice(0, 10)}.csv`, admCatCsv())).finally(() => { TEL.mudo--; }); },
  admCatSelTodas: () => { for (const p of ADMV.cat?.paginas || []) if (p.vista_em) ADMV.catSel[p.chave] = true; render(); },
  admCatBuscar: () => { ADMV.catF.q = document.getElementById('adm-cat-q')?.value || ''; ADMV.catF.pag = 0; admCatLoad(); },
  admCatPag: t => { ADMV.catF.pag = Math.max(0, ADMV.catF.pag + (+t.dataset.d || 0)); admCatLoad(); }
};
const ADM_ACT = {
  admIntegReload: async () => { try { ADMV.integ = await admApi('/api/adm/integracoes'); toast('Estado das integrações atualizado.'); } catch (e) { toast(e.message); } render(); },
  admFunilCopy: t => { const e = admFunil(ADMV.data?.usuarios || [])[+t.dataset.i]; if (e && e.parou.length) admCopiar(e.parou.map(u => u.email).join('; '), `${e.parou.length} e-mail(s) copiado(s).`); },
  admSugLida: async t => { try { await admApi('/api/adm/sugestoes', { id: t.dataset.id }); ADMV.sug = await admApi('/api/adm/sugestoes'); } catch (e) { toast(e.message); } render(); },
  admCopiarConvite: async () => { const t = document.getElementById('adm-convite-txt'); try { await navigator.clipboard.writeText(t ? t.value : admConviteTxt()); toast('Texto copiado.'); } catch { if (t) { t.focus(); t.select(); } toast('Não consegui copiar sozinho: o texto está selecionado, use Ctrl+C.'); } },
  admReload: () => { ADMV.data = null; ADMV.msg = ''; admLoad(); render(); },
  admExport: () => { if (!ADMV.data) return; TEL.mudo++; Promise.resolve(offer(`relatorio-administrativo-${new Date().toISOString().slice(0, 10)}.csv`, admCsv(ADMV.data))).finally(() => { TEL.mudo--; }); },
  admCfgSave: async () => {
    const g = id => document.getElementById(id)?.value, pr = [...document.querySelectorAll('[data-adm-pr]')].filter(x => x.checked).map(x => x.dataset.admPr);
    try { await admApi('/api/adm/config', { inatividade_dias: +g('adm-inat'), sessao_min: +g('adm-sess'), retencao_dias: +g('adm-ret'), principais: pr }); ADMV.msg = 'Critérios salvos.'; } catch (e) { ADMV.msg = '!' + e.message; }
    ADMV.data = null; admLoad(); render();
  },
  admRosterAdd: async () => {
    const itens = admRosterParse(document.getElementById('adm-roster')?.value); if (!itens.length) { ADMV.msg = '!Informe ao menos um e-mail.'; return render(); }
    try { const j = await admApi('/api/adm/roster', { op: 'add', itens }); ADMV.msg = `${j.incluidos} incluído(s)${j.recusados?.length ? '; recusados: ' + j.recusados.join(', ') : ''}.`; ADMV.rosterTxt = ''; } catch (e) { ADMV.msg = '!' + e.message; }
    admAviso();
    ADMV.data = null; admLoad(); render();
  },
  admRosterAdd1: async () => {
    const email = (document.getElementById('adm-r-email')?.value || '').trim().toLowerCase(), nome = (document.getElementById('adm-r-nome')?.value || '').trim(); if (!/^[^@\s]+@[^@\s]+$/.test(email)) { ADMV.msg = '!Informe um e-mail válido.'; admAviso(); return render(); }
    try { const j = await admApi('/api/adm/roster', { op: 'add', itens: [{ email, nome }] }); ADMV.msg = j.incluidos ? `${nome || email} incluído como previsto.` : `!Não incluído: use um e-mail @totvs.com.br${j.recusados?.length ? ' (' + j.recusados.join(', ') + ')' : ''}.`; } catch (e) { ADMV.msg = '!' + e.message; }
    admAviso();
    ADMV.data = null; admLoad(); render();
  },
  admAddFocus: () => { const c = document.getElementById('adm-prev'), i = document.getElementById('adm-r-email'); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'center' }); if (i) setTimeout(() => i.focus(), 250); },
  admEdit: t => { ADMV.edit = t.dataset.id; render(); setTimeout(() => document.getElementById('adm-e-nome')?.focus(), 50); },
  admEditOff: () => { ADMV.edit = ''; render(); },
  admEditSave: async t => {
    const nome = (document.getElementById('adm-e-nome')?.value || '').trim(), ne = (document.getElementById('adm-e-email')?.value || '').trim().toLowerCase();
    try { await admApi('/api/adm/roster', { op: 'edit', email: t.dataset.id, nome, novo_email: ne }); ADMV.msg = 'Dados atualizados.'; ADMV.edit = ''; } catch (e) { ADMV.msg = '!' + e.message; admAviso(); return; }
    admAviso(); ADMV.data = null; admLoad(); render();
  },
  admDel: async t => {
    const u = (ADMV.data?.usuarios || []).find(x => x.email === t.dataset.id); if (!u) return;
    if (!confirm(u.identificado ? `Excluir ${u.nome} (${u.email})?\n\nA pessoa sai da lista e o registro de acesso dela é apagado. Isso não bloqueia o login corporativo nem apaga a carteira dela: se entrar de novo, reaparece como "fora da lista".` : `Excluir ${u.nome} (${u.email}) da lista de previstos?`)) return;
    try { await admApi('/api/adm/roster', { op: 'remove', email: u.email, tudo: true }); ADMV.msg = `${u.nome} excluído(a) da lista.`; } catch (e) { ADMV.msg = '!' + e.message; }
    admAviso(); ADMV.data = null; admLoad(); render();
  },
  admAcc: t => { ADMV.acc = t.dataset.v || ''; render(); },
  admCopyLink: t => admCopiar(t.dataset.v, 'Link do convite copiado.'),
  admCopyPend: () => { const l = (ADMV.data?.usuarios || []).filter(u => !u.identificado).map(u => u.email); if (l.length) admCopiar(l.join('; '), `${l.length} e-mail(s) de quem ainda não acessou copiado(s).`); },
  admRosterRm: async t => { try { await admApi('/api/adm/roster', { op: 'remove', email: t.dataset.id }); ADMV.msg = 'Removido da lista de previstos.'; } catch (e) { ADMV.msg = '!' + e.message; } ADMV.data = null; admLoad(); render(); },
  admPurgar: async () => { try { const j = await admApi('/api/adm/purgar', {}); ADMV.msg = `Retenção aplicada: ${j.eventos} evento(s) e ${j.tentativas} tentativa(s) removidos.`; } catch (e) { ADMV.msg = '!' + e.message; } ADMV.data = null; admLoad(); render(); }
};
function admAviso() { if (ADMV.msg) toast(ADMV.msg.replace(/^!/, '')); } /* a mensagem do painel fica no topo; o aviso flutuante aparece onde a pessoa está */
async function admCopiar(txt, ok) { try { await navigator.clipboard.writeText(txt); toast(ok); } catch { window.prompt('Copie o texto abaixo:', txt); } }
function admChange(t, c, v) {
  if (c === 'admCatFonte' || c === 'admCatEst') { ADMV.catF[c === 'admCatFonte' ? 'fonte' : 'estado'] = v; ADMV.catF.pag = 0; admCatLoad(); return true; }
  if (c === 'admCatAuto') { admCatOp({ op: 'auto', ligar: t.checked }, 'Gravando…').then(j => { if (j) toast(j.auto ? 'Leitura agendada ligada.' : 'Leitura agendada desligada.'); }); return true; }
  if (c === 'admCatMud') { ADMV.catF.mudou = t.checked; ADMV.catF.pag = 0; admCatLoad(); return true; }
  if (c === 'admCatSel') { ADMV.catSel[t.dataset.k] = t.checked; render(); return true; }
  if (c === 'admDias') { ADMV.dias = +v || 30; ADMV.de = ADMV.ate = ''; ADMV.data = null; admLoad(); render(); return true; }
  if (c === 'admDe' || c === 'admAte') { ADMV[c === 'admDe' ? 'de' : 'ate'] = v; if (ADMV.de && ADMV.ate) { ADMV.data = null; admLoad(); } render(); return true; }
  if (c === 'admFunc') { ADMV.func = v; ADMV.data = null; admLoad(); render(); return true; }
  if (c === 'admSit') { ADMV.sit = v; render(); return true; }
  return false;
}
async function admRosterFile(f) {
  try { const txt = await f.text(); ADMV.rosterTxt = txt.slice(0, 40000); const itens = admRosterParse(txt); if (!itens.length) { ADMV.msg = '!Nenhum e-mail encontrado no arquivo.'; return render(); } const j = await admApi('/api/adm/roster', { op: 'import', itens }); ADMV.msg = `${j.incluidos} incluído(s)${j.recusados?.length ? '; recusados: ' + j.recusados.length : ''}.`; ADMV.rosterTxt = ''; } catch (e) { ADMV.msg = '!' + e.message; }
  ADMV.data = null; admLoad(); render();
}
