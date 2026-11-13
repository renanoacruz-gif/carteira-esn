/* ===== CARTEIRA & MRR: análises da exportação "Clientes_ESN" do Empodera (MRR, última venda, quadrantes, produtos, qualidade, histórico) =====
   Cadastro único: a planilha atualiza os clientes do Analisador casados pelo código exato; os campos do Empodera ficam em c.emp (não sobrescrevem
   o cadastro existente); código novo vira cliente; quem some da planilha fica marcado (c.emp.ausente), nunca é apagado. Gestão da conta em c.gst.
   Parâmetros e histórico de importações em S.meta.emp. Cada conta só enxerga a própria carteira (isolamento por conta já existente). */
const EMP_HMAP = [['cod', 'cod'], ['codigo', 'cod'], ['nome razao social', 'razao'], ['razao social', 'razao'], ['nome fantasia', 'fantasia'], ['cnpj', 'cnpj'], ['situacao', 'sit'], ['situacao (protheus)', 'sitP'],
  ['grupo economico', 'grupoEco'], ['grupo empresarial', 'grupoEmp'], ['segmento', 'seg'], ['produto (etiqueta empodera)', 'prod'], ['produto', 'prod'], ['estado', 'uf'], ['uf', 'uf'], ['cidade', 'cidade'], ['regiao', 'regiao'],
  ['esn', 'esn'], ['gsn', 'gsn'], ['mrr contratado', 'mrrC'], ['mrr pagante', 'mrrP'], ['mrr pagante soma grupo emp', 'mrrG'], ['ultima venda produto', 'uvp'], ['ultima venda servico', 'uvs'],
  ['faturamento driva', 'fatD'], ['faturamento empodera', 'fatE'], ['link empodera', 'link']];
const EMP_BUCKETS = [{ k: 'b3', l: 'Até 3 meses', max: 91 }, { k: 'b6', l: '3 a 6 meses', max: 182 }, { k: 'b9', l: '6 a 9 meses', max: 273 }, { k: 'b12', l: '9 a 12 meses', max: 365 }, { k: 'b24', l: '12 a 24 meses', max: 730 }, { k: 'b99', l: 'Mais de 24 meses', max: Infinity }, { k: 'nd', l: 'Sem data', max: null }];
const EMP_QUADS = { Proteger: 'MRR alto sem venda recente: risco de churn ou renegociação. Visitar, revisar contrato e satisfação.', Expandir: 'MRR alto com relacionamento ativo: espaço para cross-sell e upsell.', Reativar: 'MRR menor sem venda recente: reengajar ou revisar o potencial da conta.', Nutrir: 'MRR menor com venda recente: crescer ticket com ofertas complementares.' };
const EMP_QORD = { Proteger: 0, Reativar: 1, Expandir: 2, Nutrir: 3, 'Sem data': 4, Inativo: 5 }, EMP_PORD = { Alta: 0, 'Média': 1, Baixa: 2, '': 3 };
const EMP_FAIXAS = [{ l: 'Acima de 50 mil', min: 50000 }, { l: '10 a 50 mil', min: 10000 }, { l: '5 a 10 mil', min: 5000 }, { l: '1 a 5 mil', min: 1000 }, { l: 'Abaixo de 1 mil', min: 0.01 }, { l: 'Sem MRR', min: -Infinity }];
const EMP_SEG = { manufatura: 'Manufatura', servicos: 'Serviços', logistica: 'Logística', 'construcao e projetos': 'Construção e Projetos', varejo: 'Varejo', educacional: 'Educacional', agroindustria: 'Agroindústria', saude: 'Saúde', distribuicao: 'Distribuição', 'servicos financeiros': 'Serviços Financeiros' };
const EMP_COR = ['var(--ciano2)', 'var(--roxo)', 'var(--lar)', 'var(--ok)', 'var(--rosa)', 'var(--cz)', 'var(--lima)', 'var(--menta)', 'var(--link)', 'var(--bad)'];
const EMP_TABS = [['painel', 'Painel executivo'], ['visao', 'Visão geral'], ['recencia', 'Última venda'], ['lista', 'Lista'], ['produtos', 'Produtos'], ['qualidade', 'Qualidade'], ['dados', 'Importar & histórico']];
const EMP_F0 = () => ({ q: '', sit: 'ativos', seg: '', quad: '', buck: '', prod: '', prio: '' });
/* ---------- utilidades ---------- */
const empP2 = n => String(n).padStart(2, '0');
const empHoje = () => { const d = new Date(); return d.getFullYear() + '-' + empP2(d.getMonth() + 1) + '-' + empP2(d.getDate()); };
const empUtc = iso => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const empDias = (de, ate) => Math.round((empUtc(ate) - empUtc(de)) / 864e5);
const empSum = (a, f) => a.reduce((s, x) => s + (f(x) || 0), 0);
const empBrl = v => 'R$ ' + Math.round(v || 0).toLocaleString('pt-BR');
const empBrlK = v => { v = v || 0; const a = Math.abs(v); return a >= 1e6 ? 'R$ ' + (v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' mi' : a >= 1e3 ? 'R$ ' + (v / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil' : empBrl(v); };
const empPct = (v, d = 1) => ((v || 0) * 100).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) + '%';
const empTempo = d => d == null ? '—' : d < 31 ? d + ' d' : d / 30.44 < 24 ? Math.round(d / 30.44) + ' meses' : (d / 365.25).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' anos';
const empCap = s => String(s || '').toLowerCase().replace(/(^|[\s/(-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
const empSegL = s => s ? (EMP_SEG[norm(s)] || empCap(s)) : 'Sem segmento';
const empPl = (n, s, p) => n + ' ' + (n === 1 ? s : p || s + 's');
function empNum(v) { if (v == null || v === '' || typeof v === 'boolean') return 0; if (typeof v === 'number') return isFinite(v) ? Math.round(v * 100) / 100 : 0; let s = String(v).replace(/R\$|\s/g, ''); if (!s || s === '-') return 0; if (/^-?\d+(\.\d{1,2})?$/.test(s)) return parseFloat(s); s = s.replace(/\./g, '').replace(',', '.'); const n = parseFloat(s); return isFinite(n) ? Math.round(n * 100) / 100 : 0; }
const empTxt = v => { if (v == null || typeof v === 'boolean') return ''; const s = String(v).trim(); return s === '#N/A' || s === 'None' ? '' : s; };
const empCnpj = v => { if (v == null || v === '') return ''; const s = typeof v === 'number' ? String(Math.round(v)) : String(v).replace(/\D/g, ''); return s ? s.padStart(14, '0') : ''; };
function empDate(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date) { if (isNaN(v)) return null; v = new Date(v.getTime() + 432e5); /* +12h: neutraliza o desvio de fuso do SheetJS em datas à meia-noite */ return v.getFullYear() + '-' + empP2(v.getMonth() + 1) + '-' + empP2(v.getDate()); }
  if (typeof v === 'number') { if (v < 20000 || v > 80000) return null; const d = new Date(Math.round((v - 25569) * 864e5)); return d.getUTCFullYear() + '-' + empP2(d.getUTCMonth() + 1) + '-' + empP2(d.getUTCDate()); }
  const s = String(v).trim(); let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (m) return m[3] + '-' + empP2(+m[2]) + '-' + empP2(+m[1]); m = s.match(/^\d{4}-\d{2}-\d{2}/); return m ? m[0] : null;
}
const empIsTag = k => /^(suporte local|restrito|processo judicial|totvs day)$/.test(k) || /^retencao/.test(k) || /^cliente intera/.test(k);
function empParseProd(s) {
  const out = { produtos: [], tags: [] }; if (!s || /^-$|^sem dados$/i.test(String(s).trim())) return out;
  String(s).replace(/TECHFIN\s*\|\s*CONSIGNADO/gi, 'TECHFIN CONSIGNADO').split(/[,|]/).map(t => t.trim()).filter(Boolean).forEach(t => {
    const k = norm(t); if (k === '-' || k === 'sem dados') return;
    if (empIsTag(k)) { if (!out.tags.some(x => x.k === k)) out.tags.push({ k, l: empCap(t).replace(/Totvs/g, 'TOTVS'), sev: /^restrito$|^processo judicial$/.test(k) ? 'crit' : /^retencao/.test(k) ? 'serious' : '' }); }
    else if (!out.produtos.includes(t.toUpperCase())) out.produtos.push(t.toUpperCase());
  }); return out;
}
/* ---------- estado e derivação ---------- */
function empMeta() { const M = S.meta.emp ||= {}; M.cfg = { limiarMrr: 20000, limiarDias: 365, baseRecencia: 'produto', ...(M.cfg || {}) }; M.snaps ||= []; M.dataBase ||= empHoje(); return M; }
const empUI = () => { UI.emp ||= {}; UI.emp.f ||= EMP_F0(); UI.emp.sort ||= { k: 'mrrP', dir: -1 }; return UI.emp; };
const empBucket = d => d == null ? EMP_BUCKETS[6] : EMP_BUCKETS.find(b => b.max != null && d <= b.max);
const empBaseLbl = () => ({ produto: 'produto', servico: 'serviço', recente: 'produto ou serviço' }[empMeta().cfg.baseRecencia] || 'produto');
function empDerive(incluirAusentes = false) {
  const M = empMeta(), base = M.dataBase, cfg = M.cfg, out = [];
  for (const c of Object.values(S.clients)) {
    const e = c.emp; if (!e || (e.ausente && !incluirAusentes)) continue;
    const dp = e.uvp ? Math.max(0, empDias(e.uvp, base)) : null, ds = e.uvs ? Math.max(0, empDias(e.uvs, base)) : null, dr = dp == null ? ds : ds == null ? dp : Math.min(dp, ds);
    const dias = cfg.baseRecencia === 'servico' ? ds : cfg.baseRecencia === 'recente' ? dr : dp, ativo = /^ativo/.test(norm(e.sit)) && !e.ausente, pr = empParseProd(e.prod);
    const quad = !ativo ? 'Inativo' : dias == null ? 'Sem data' : (e.mrrP || 0) >= cfg.limiarMrr ? (dias > cfg.limiarDias ? 'Proteger' : 'Expandir') : (dias > cfg.limiarDias ? 'Reativar' : 'Nutrir');
    out.push({ c, e, g: c.gst || {}, key: c.key, cod: e.cod || c.code, nome: e.fantasia || e.razao || c.name || e.cod, ativo, dp, ds, dr, dias, bucket: empBucket(dias), bp: empBucket(dp), quad, produtos: pr.produtos, tags: pr.tags, gap: Math.max(0, (e.mrrC || 0) - (e.mrrP || 0)) });
  }
  return out;
}
function empTotais(D) {
  const A = D.filter(d => d.ativo), mrrP = empSum(D, d => d.e.mrrP), rank = [...D].sort((a, b) => b.e.mrrP - a.e.mrrP);
  return { n: D.length, ativos: A.length, inativos: D.length - A.length, pagantes: D.filter(d => d.e.mrrP > 0).length, mrrP, mrrC: empSum(D, d => d.e.mrrC), gap: empSum(D, d => d.gap), ticket: A.length ? mrrP / A.length : 0, rank, top5: empSum(rank.slice(0, 5), d => d.e.mrrP) / (mrrP || 1), top10: empSum(rank.slice(0, 10), d => d.e.mrrP) / (mrrP || 1) };
}
function empGroup(arr, f) { const m = new Map(); arr.forEach(x => { const k = f(x); (m.get(k) || m.set(k, []).get(k)).push(x); }); return [...m]; }
/* ---------- importação ---------- */
function empLer(sheets) {
  for (const sh of sheets) for (let i = 0; i < Math.min(sh.rows.length, 12); i++) {
    const m = {}; (sh.rows[i] || []).forEach((cell, j) => { const hit = EMP_HMAP.find(([k]) => k === norm(cell)); if (hit && m[hit[1]] == null) m[hit[1]] = j; });
    if (m.cod == null || m.mrrP == null) continue;
    const g = (r, k) => m[k] == null ? null : r[m[k]], recs = [], vistos = new Set();
    for (const r of sh.rows.slice(i + 1)) {
      const cod = empTxt(g(r, 'cod')).toUpperCase(); if (!cod || vistos.has(cod)) continue; vistos.add(cod);
      const o = { cod, cnpj: empCnpj(g(r, 'cnpj')), mrrC: empNum(g(r, 'mrrC')), mrrP: empNum(g(r, 'mrrP')), mrrG: empNum(g(r, 'mrrG')), uvp: empDate(g(r, 'uvp')), uvs: empDate(g(r, 'uvs')) };
      for (const k of ['razao', 'fantasia', 'sit', 'sitP', 'grupoEco', 'grupoEmp', 'seg', 'prod', 'uf', 'cidade', 'regiao', 'esn', 'gsn', 'fatD', 'fatE', 'link']) o[k] = empTxt(g(r, k));
      recs.push(o);
    }
    return { aba: sh.name, recs };
  }
  throw new Error('Não encontrei uma aba com as colunas "Cód" e "MRR PAGANTE".');
}
const empCodKey = s => String(s || '').trim().toUpperCase();
function empPlano(recs) {
  const cur = new Map(); Object.values(S.clients).forEach(c => { const k = empCodKey(c.emp?.cod || c.code); if (k && !cur.has(k)) cur.set(k, c); });
  const inc = new Set(recs.map(r => r.cod)), novos = recs.filter(r => !cur.has(r.cod)), primeira = recs.filter(r => cur.has(r.cod) && !cur.get(r.cod).emp);
  const mud = recs.filter(r => cur.get(r.cod)?.emp).map(r => ({ r, de: cur.get(r.cod).emp.mrrP || 0 })).filter(x => Math.abs(x.de - x.r.mrrP) > 0.009).sort((a, b) => Math.abs(b.r.mrrP - b.de) - Math.abs(a.r.mrrP - a.de));
  const ausentes = Object.values(S.clients).filter(c => c.emp && !c.emp.ausente && !inc.has(empCodKey(c.emp.cod)));
  return { cur, novos, primeira, mud, ausentes, mrrNovo: empSum(recs, r => r.mrrP), mrrAntes: empSum(Object.values(S.clients).filter(c => c.emp && !c.emp.ausente), c => c.emp.mrrP) };
}
async function empArquivo(file) {
  if (!file) return; const U = empUI();
  try { const t = await readTable(file, await file.arrayBuffer()), res = empLer(t.sheets); if (!res.recs.length) throw new Error('A planilha não tem clientes com código.');
    const m = file.name.match(/(\d{2})[_.-](\d{2})[_.-](\d{4})/); U.pend = { name: file.name, aba: res.aba, recs: res.recs, data: m ? m[3] + '-' + m[2] + '-' + m[1] : empHoje() }; U.tab = 'dados';
  } catch (e) { toast(e.message || 'Arquivo não reconhecido.'); }
  render();
}
function empAplicar(data) {
  const U = empUI(), P = U.pend; if (!P) return; const M = empMeta(), pl = empPlano(P.recs), used = new Set(Object.keys(S.clients)); data = /^\d{4}-\d{2}-\d{2}$/.test(data || '') ? data : P.data;
  for (const r of P.recs) {
    let c = pl.cur.get(r.cod);
    if (!c) { let key = safeKey('c_' + r.cod); if (used.has(key)) { let n = 2; while (used.has(key + '_' + n)) n++; key += '_' + n; } used.add(key);
      c = S.clients[key] = { key, code: r.cod, name: r.fantasia || r.razao || r.cod, cnpj: r.cnpj.length === 14 ? r.cnpj : '', cnpjRaw: '', seg: r.seg, city: r.cidade, size: '', mrr: r.mrrP || null, productsRaw: '', churn: '', nps: '', notes: '', uf: r.uf, regime: '', release: '', fichas: [], docs: [], mgmt: {}, act: {} };
      cadInit(c); c.src = { file: P.name, sheet: P.aba, row: 0 }; runAnalysis(c); pl.cur.set(r.cod, c); }
    const hist = (c.emp?.hist || []).filter(h => h[0] !== data).concat([[data, r.mrrP]]).sort((a, b) => a[0].localeCompare(b[0])).slice(-24);
    c.emp = { ...r, ausente: false, hist }; touchC(c.key);
  }
  pl.ausentes.forEach(c => { c.emp.ausente = true; touchC(c.key); });
  M.dataBase = data; M.fonte = P.name; M.importadoEm = nowISO();
  const D = empDerive(); M.snaps = M.snaps.filter(s => s.data !== data).concat({ data, fonte: P.name, total: D.length, ativos: D.filter(d => d.ativo).length, mrrP: Math.round(empSum(D, d => d.e.mrrP) * 100) / 100, mrrC: Math.round(empSum(D, d => d.e.mrrC) * 100) / 100 }).sort((a, b) => a.data.localeCompare(b.data)).slice(-60);
  U.pend = null; U.tab = 'painel'; touchMeta(); render(); toast(`Importação aplicada: ${empPl(P.recs.length, 'cliente')} (${pl.novos.length} novos, ${pl.mud.length} com MRR alterado, ${pl.ausentes.length} ausentes).`);
}
function empSetCfg(k, v) {
  const M = empMeta();
  if (k === 'dataBase') { if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return render(); M.dataBase = v; }
  else if (k === 'limiarMrr') { const n = empNum(v); if (n > 0) M.cfg.limiarMrr = n; }
  else if (k === 'limiarDias') { const n = Math.round(+v); if (n >= 30) M.cfg.limiarDias = n; }
  else if (k === 'baseRecencia' && ['produto', 'servico', 'recente'].includes(v)) M.cfg.baseRecencia = v;
  touchMeta(); render();
}
/* ---------- gestão da conta (ficha do cliente) ---------- */
function empGstSet(key, f, v) { const c = S.clients[key]; if (!c || !['prioridade', 'proximaAcao', 'dataAcao', 'oportunidade', 'potencial', 'contato'].includes(f)) return; const g = c.gst ||= {}; g[f] = f === 'potencial' ? empNum(v) : String(v || '').trim(); g.em = nowISO(); touchC(key); }
function empGstAddI(key) { const c = S.clients[key], tx = $('#gi_txt')?.value.trim(); if (!c) return; if (!tx) return toast('Descreva o que foi tratado.'); const g = c.gst ||= {}; (g.interacoes ||= []).push({ id: uid(), data: $('#gi_data').value || empHoje(), tipo: $('#gi_tipo').value, texto: tx.slice(0, 600) }); touchC(key); render(); }
function empGstDelI(key, id) { const c = S.clients[key]; if (!c?.gst?.interacoes) return; c.gst.interacoes = c.gst.interacoes.filter(x => x.id !== id); touchC(key); render(); }
function empGestaoTab(c) {
  const g = c.gst || {}, k = kk(c), d = c.emp ? empDerive(true).find(x => x.key === c.key) : null, e = c.emp;
  const fld = (f, l, tp = 'text', w = '') => `<label class="em-fld ${w}"><span>${l}</span><input type="${tp}" data-c="gst" data-k="${k}" data-f="${f}" value="${esc(f === 'potencial' ? (g[f] ? g[f].toLocaleString('pt-BR') : '') : g[f] || '')}"${f === 'potencial' ? ' inputmode="decimal"' : ''}></label>`;
  const st = (l, v, s = '') => `<div class="kpi em-k"><div class="sm muted">${l}</div><b>${v}</b>${s ? `<div class="sm muted">${esc(s)}</div>` : ''}</div>`;
  const ints = [...(g.interacoes || [])].sort((a, b) => b.data.localeCompare(a.data));
  return `${e ? `<div class="card"><div class="row"><h3>Posição no Empodera</h3>${d ? empQuadPill(d.quad) : ''}${e.ausente ? pill('fora da última importação', 'warn') : ''}<span class="sp"></span>${/^https?:\/\//.test(e.link || '') ? `<a class="btn ghost sm" href="${esc(e.link)}" target="_blank" rel="noopener noreferrer">Abrir no Empodera ↗</a>` : ''}</div>
  <div class="grid g4">${st('MRR pagante', fmtBRL(e.mrrP), d.gap > 0.009 ? 'Contratado ' + fmtBRL(e.mrrC) : '')}${st('Últ. venda produto', fmtD(e.uvp), e.uvp ? 'há ' + empTempo(d.dp) : '')}${st('Últ. venda serviço', fmtD(e.uvs), e.uvs ? 'há ' + empTempo(d.ds) : '')}${st('MRR do grupo', e.mrrG ? fmtBRL(e.mrrG) : '—', e.grupoEmp)}</div>
  ${d.produtos.length || d.tags.length ? `<div style="margin-top:8px">${d.produtos.map(p => pill(p, 'off')).join(' ')} ${d.tags.map(t => pill(t.l, t.sev ? 'warn' : 'off')).join(' ')}</div>` : ''}
  ${(e.hist || []).length > 1 ? `<p class="sm muted" style="margin:8px 0 0">Histórico de MRR: ${e.hist.map(h => fmtD(h[0]) + ' ' + empBrl(h[1])).join(' → ')}</p>` : ''}</div>` : `<div class="alert sm">Este cliente ainda não veio em uma planilha do Empodera. Importe a "Clientes_ESN" em Carteira &amp; MRR para ver MRR e últimas vendas.</div>`}
  <div class="card"><h3>Gestão da conta</h3><div class="em-form">
  <label class="em-fld"><span>Prioridade</span><select data-c="gst" data-k="${k}" data-f="prioridade">${['', 'Alta', 'Média', 'Baixa'].map(p => `<option value="${p}" ${p === (g.prioridade || '') ? 'selected' : ''}>${p || '—'}</option>`).join('')}</select></label>
  ${fld('dataAcao', 'Data da próxima ação', 'date')}${fld('proximaAcao', 'Próxima ação', 'text', 'wide')}${fld('oportunidade', 'Oportunidade em pauta', 'text', 'wide')}${fld('potencial', 'Potencial estimado (R$)')}${fld('contato', 'Contato principal')}</div></div>
  <div class="card"><h3>Interações</h3><div class="row" style="gap:6px;flex-wrap:wrap"><input type="date" id="gi_data" value="${empHoje()}" aria-label="Data da interação"><select id="gi_tipo" aria-label="Tipo">${['Reunião', 'Visita', 'Ligação', 'E-mail', 'WhatsApp', 'Proposta', 'Outro'].map(t => `<option>${t}</option>`).join('')}</select><input type="text" id="gi_txt" placeholder="O que foi tratado" style="flex:1;min-width:200px" aria-label="Descrição"><button class="btn pri sm" data-a="gstAddI" data-k="${k}">Registrar</button></div>
  ${ints.length ? `<table class="sm" style="margin-top:8px"><tbody>${ints.map(i => `<tr><td class="nw">${fmtD(i.data)} · ${esc(i.tipo)}</td><td>${esc(i.texto)}</td><td><button class="btn ghost sm" data-a="gstDelI" data-k="${k}" data-id="${esc(i.id)}" aria-label="Excluir interação">${ico('x', 14)}</button></td></tr>`).join('')}</tbody></table>` : '<p class="sm muted" style="margin:8px 0 0">Nenhuma interação registrada.</p>'}</div>`;
}
/* ---------- componentes ---------- */
const empQuadPill = q => `<span class="em-q em-q-${q.replace(' ', '')}">${q}</span>`;
const empGo = f => `data-a="empGo" data-f='${esc(JSON.stringify(f))}'`;
const empOpen = d => `data-a="open" data-k="${esc(d.key)}"`;
const empChip = (d, x = '') => `<button class="em-chip" ${empOpen(d)}>${esc(d.nome)}${x ? ` <small>${esc(x)}</small>` : ''}</button>`;
const empDt = (iso, dias) => iso ? `<div class="nw${dias > empMeta().cfg.limiarDias ? ' em-old' : ''}">${fmtD(iso)}<small>há ${empTempo(dias)}</small></div>` : '—';
const empAcao = g => !g.proximaAcao && !g.dataAcao ? '<span class="muted">—</span>' : `<b>${esc(g.proximaAcao || 'Ação sem descrição')}</b>${g.dataAcao ? `<small class="${g.dataAcao < empHoje() ? 'em-late' : 'muted'}">${g.dataAcao < empHoje() ? 'Vencida · ' : ''}${fmtD(g.dataAcao)}</small>` : ''}`;
function empBars(items, o = {}) {
  if (!items.length) return '<p class="sm muted">Sem dados para exibir.</p>'; const mx = Math.max(...items.map(i => i.v), 0) || 1, fmt = o.fmt || empBrlK;
  return `<div class="em-bars">${items.map(it => `<${it.go ? 'button' : 'div'} class="em-bar${it.go ? ' go' : ''}" ${it.go || ''} title="${esc(it.tip || '')}"><span class="l">${esc(it.l)}</span><span class="t"><i style="width:${it.v > 0 ? Math.max(1.2, it.v / mx * 100) : 0}%;background:${it.color || 'var(--ciano2)'}"></i></span><span class="v"><b>${fmt(it.v)}</b>${it.sub ? `<small>${esc(it.sub)}</small>` : ''}</span></${it.go ? 'button' : 'div'}>`).join('')}</div>${o.legend ? `<div class="em-leg">${o.legend.map(([c, t]) => `<span><i style="background:${c}"></i>${t}</span>`).join('')}</div>` : ''}`;
}
function empRosca(items, total) {
  if (!items.length) return '<p class="sm muted">Sem dados para exibir.</p>'; const R = 90, r = 54; let a0 = -Math.PI / 2;
  const arcs = items.map((it, i) => { const a1 = a0 + it.n / (total || 1) * Math.PI * 2 - (items.length > 1 ? 0.0001 : 0.001), big = a1 - a0 > Math.PI ? 1 : 0, p = (a, q) => (100 + q * Math.cos(a)).toFixed(2) + ' ' + (100 + q * Math.sin(a)).toFixed(2);
    const d = `M${p(a0, R)}A${R} ${R} 0 ${big} 1 ${p(a1, R)}L${p(a1, r)}A${r} ${r} 0 ${big} 0 ${p(a0, r)}Z`; a0 += it.n / (total || 1) * Math.PI * 2; return `<path d="${d}" fill="${EMP_COR[i % EMP_COR.length]}" stroke="var(--card)" stroke-width="2" style="cursor:pointer" ${empGo({ seg: it.s, sit: 'todos' })}><title>${esc(it.l)}: ${empPl(it.n, 'cliente')} · ${empPct(it.n / (total || 1))} · ${fmtBRL(it.v)}</title></path>`; });
  return `<div class="em-donut"><svg viewBox="0 0 200 200" width="200" height="200" role="img" aria-label="Distribuição de clientes por segmento">${arcs.join('')}<text x="100" y="100" text-anchor="middle" class="em-dn">${total}</text><text x="100" y="120" text-anchor="middle" class="em-ax">clientes</text></svg><ul>${items.map((it, i) => `<li><i style="background:${EMP_COR[i % EMP_COR.length]}"></i><span>${esc(it.l)}</span><b>${it.n}</b><small>${empPct(it.n / (total || 1), 0)}</small></li>`).join('')}</ul></div>`;
}
function empColunas(items, total) {
  if (!items.length) return '<p class="sm muted">Sem dados para exibir.</p>'; const W = 640, H = 290, m = { t: 22, r: 8, b: 56, l: 54 }, mx = Math.max(...items.map(d => d.v)) || 1, step = (W - m.l - m.r) / items.length, bw = Math.min(64, step * 0.62), y = v => H - m.b - v / mx * (H - m.b - m.t);
  const ticks = [0, .25, .5, .75, 1].map(f => f * mx);
  return `<svg viewBox="0 0 ${W} ${H}" class="em-svg" role="img" aria-label="MRR pagante por segmento">${ticks.map(v => `<line x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}" class="em-grid"/><text x="${m.l - 6}" y="${y(v) + 4}" text-anchor="end" class="em-ax">${v ? empBrlK(v).replace('R$ ', '') : '0'}</text>`).join('')}
  ${items.map((d, i) => { const cx = m.l + step * i + step / 2, lb = d.l.length > 16 ? d.l.slice(0, 15) + '…' : d.l; return `<rect x="${cx - bw / 2}" y="${y(d.v)}" width="${bw}" height="${Math.max(0, H - m.b - y(d.v))}" rx="3" class="em-col" ${empGo({ seg: d.s, sit: 'todos' })}><title>${esc(d.l)}: ${fmtBRL(d.v)} · ${empPl(d.n, 'cliente')} · ${empPct(d.v / (total || 1))}</title></rect><text x="${cx}" y="${y(d.v) - 6}" text-anchor="middle" class="em-lb">${empBrlK(d.v).replace('R$ ', '')}</text><text x="${cx}" y="${H - m.b + 16}" text-anchor="middle" class="em-ax" transform="rotate(-18 ${cx} ${H - m.b + 16})">${esc(lb)}</text>`; }).join('')}</svg>`;
}
function empScatter(pts) {
  if (!pts.length) return '<p class="sm muted">Sem clientes com MRR e data de venda para posicionar.</p>'; const cfg = empMeta().cfg, W = 800, H = 400, m = { t: 18, r: 22, b: 46, l: 70 };
  const xmin = Math.max(5, Math.min(cfg.limiarDias * 0.5, Math.min(...pts.map(d => Math.max(5, d.dias))) * 0.8)), xmax = Math.max(cfg.limiarDias * 2, Math.max(...pts.map(d => d.dias)) * 1.25), ymax = Math.max(cfg.limiarMrr * 1.4, Math.max(...pts.map(d => d.e.mrrP)) * 1.08);
  const x = v => m.l + (Math.log(Math.min(Math.max(v, xmin), xmax)) - Math.log(xmin)) / (Math.log(xmax) - Math.log(xmin)) * (W - m.l - m.r), y = v => H - m.b - Math.min(v, ymax) / ymax * (H - m.b - m.t), xT = x(cfg.limiarDias), yT = y(cfg.limiarMrr);
  const tx = [[7, '1 sem'], [30, '1 mês'], [91, '3 m'], [182, '6 m'], [365, '1 ano'], [730, '2 anos'], [1826, '5 anos'], [3652, '10 anos'], [7305, '20 anos']].filter(t => t[0] >= xmin && t[0] <= xmax), ty = [0, .25, .5, .75, 1].map(f => f * ymax);
  const lab = [...pts.filter(d => d.quad === 'Proteger').sort((a, b) => b.e.mrrP - a.e.mrrP).slice(0, 6), ...pts.filter(d => d.quad === 'Expandir').sort((a, b) => b.e.mrrP - a.e.mrrP).slice(0, 4)], placed = [];
  const labels = lab.sort((a, b) => y(a.e.mrrP) - y(b.e.mrrP)).map(d => { const px = x(d.dias), nm = d.nome.length > 22 ? d.nome.slice(0, 21) + '…' : d.nome, w = nm.length * 6.6, right = px + 10 + w < W - m.r, lx = right ? px + 10 : px - 10; let ly = y(d.e.mrrP) + 4; for (const p of placed) if (Math.abs(p.y - ly) < 13 && Math.abs(p.x - lx) < w) ly = p.y + 13; placed.push({ x: lx, y: ly }); return `<text x="${lx}" y="${ly}" text-anchor="${right ? 'start' : 'end'}" class="em-lb" style="pointer-events:none">${esc(nm)}</text>`; }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="em-svg" role="img" aria-label="Matriz de clientes: MRR pagante por tempo desde a última venda"><rect x="${xT}" y="${m.t}" width="${Math.max(0, W - m.r - xT)}" height="${Math.max(0, yT - m.t)}" class="em-zone"/>
  ${ty.map(v => `<line x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}" class="em-grid"/><text x="${m.l - 8}" y="${y(v) + 4}" text-anchor="end" class="em-ax">${v ? empBrlK(v).replace('R$ ', '') : '0'}</text>`).join('')}${tx.map(t => `<line x1="${x(t[0])}" x2="${x(t[0])}" y1="${m.t}" y2="${H - m.b}" class="em-grid"/><text x="${x(t[0])}" y="${H - m.b + 18}" text-anchor="middle" class="em-ax">${t[1]}</text>`).join('')}
  <text x="${(m.l + W - m.r) / 2}" y="${H - 6}" text-anchor="middle" class="em-ax">Tempo desde a última venda de ${empBaseLbl()} (escala logarítmica)</text><line x1="${xT}" x2="${xT}" y1="${m.t}" y2="${H - m.b}" class="em-thr"/><line x1="${m.l}" x2="${W - m.r}" y1="${yT}" y2="${yT}" class="em-thr"/>
  ${[['Expandir', m.l + 8, m.t + 16, 'start'], ['Proteger', W - m.r - 8, m.t + 16, 'end'], ['Nutrir', m.l + 8, H - m.b - 10, 'start'], ['Reativar', W - m.r - 8, H - m.b - 10, 'end']].map(q => `<text x="${q[1]}" y="${q[2]}" text-anchor="${q[3]}" class="em-ql">${q[0]}</text>`).join('')}
  ${[...pts].sort((a, b) => (a.quad === 'Proteger') - (b.quad === 'Proteger')).map(d => `<circle cx="${x(d.dias)}" cy="${y(d.e.mrrP)}" r="6" class="em-pt${d.quad === 'Proteger' ? ' p' : ''}" ${empOpen(d)}><title>${esc(d.nome)} · ${fmtBRL(d.e.mrrP)} · últ. produto ${fmtD(d.e.uvp)} · últ. serviço ${fmtD(d.e.uvs)} · ${d.quad}</title></circle>`).join('')}${labels}</svg>`;
}
function empLinha(snaps) {
  const W = 800, H = 230, m = { t: 20, r: 30, b: 34, l: 70 }, t0 = empUtc(snaps[0].data), t1 = empUtc(snaps[snaps.length - 1].data), vs = snaps.map(s => s.mrrP), lo = Math.min(...vs), hi = Math.max(...vs), pd = (hi - lo) * 0.15 || hi * 0.05 || 1, y0 = Math.max(0, lo - pd), y1 = hi + pd;
  const x = s => m.l + (t1 === t0 ? 0.5 : (empUtc(s.data) - t0) / (t1 - t0)) * (W - m.l - m.r), y = v => H - m.b - (v - y0) / (y1 - y0) * (H - m.b - m.t);
  return `<svg viewBox="0 0 ${W} ${H}" class="em-svg" role="img" aria-label="Evolução do MRR pagante por importação">${[0, .5, 1].map(f => { const v = y0 + f * (y1 - y0); return `<line x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}" class="em-grid"/><text x="${m.l - 8}" y="${y(v) + 4}" text-anchor="end" class="em-ax">${empBrlK(v).replace('R$ ', '')}</text>`; }).join('')}
  <polyline points="${snaps.map(s => x(s) + ',' + y(s.mrrP)).join(' ')}" class="em-line"/>${snaps.map(s => `<circle cx="${x(s)}" cy="${y(s.mrrP)}" r="5" class="em-pt"><title>${fmtD(s.data)}: ${fmtBRL(s.mrrP)} · ${s.total} clientes · ${s.ativos} ativos</title></circle><text x="${x(s)}" y="${H - 10}" text-anchor="middle" class="em-ax">${fmtD(s.data).slice(0, 5)}</text>`).join('')}</svg>`;
}
/* ---------- telas ---------- */
function empClusterDatas(D, campo, janela, min) { const arr = D.filter(d => d.e[campo]).map(d => ({ d, t: empUtc(d.e[campo]) })).sort((a, b) => a.t - b.t); let best = null, j = 0; for (let i = 0; i < arr.length; i++) { while (arr[i].t - arr[j].t > janela * 864e5) j++; const n = i - j + 1; if (n >= min && (!best || n > best.n)) best = { n, de: arr[j].d.e[campo], ate: arr[i].d.e[campo], itens: arr.slice(j, i + 1).map(a => a.d) }; } return best; }
function empMesmoDia(D, campo, min) { const g = empGroup(D.filter(d => d.e[campo]), d => d.e[campo]).filter(x => x[1].length >= min).sort((a, b) => b[1].length - a[1].length); return g[0] ? { data: g[0][0], itens: g[0][1] } : null; }
function empSegs(D) { return empGroup(D, d => d.e.seg || '').map(([s, v]) => ({ s, l: empSegL(s), v: empSum(v, d => d.e.mrrP), n: v.length })).sort((a, b) => b.v - a.v || b.n - a.n); }
function empPainel() {
  const D = empDerive(), T = empTotais(D), segs = empSegs(D), top = T.rank.slice(0, 5).filter(d => d.e.mrrP > 0), st = empSum(top, d => d.e.mrrP), k = (l, v, s) => `<div class="kpi em-k"><div class="sm muted">${l}</div><b>${v}</b><div class="sm muted">${s}</div></div>`;
  return `<div class="grid g3">${k('MRR total pagante', fmtBRL(T.mrrP), 'Contratado ' + fmtBRL(T.mrrC))}${k('Clientes ativos na carteira', T.ativos, 'de ' + empPl(T.n, 'cliente'))}${k('Ticket médio (MRR / cliente)', fmtBRL(T.ticket), 'MRR pagante ÷ clientes ativos')}</div>
  <div class="grid g2"><div class="card"><h3>MRR por segmento</h3><p class="sm muted">MRR pagante total (R$)</p>${empColunas(segs, T.mrrP)}</div><div class="card"><h3>Distribuição de clientes por segmento</h3><p class="sm muted">Quantidade de clientes na carteira</p>${empRosca([...segs].sort((a, b) => b.n - a.n), T.n)}</div></div>
  <div class="card"><h3>Top 5 clientes em receita recorrente (MRR)</h3>${top.length ? `<div class="tbl-wrap"><table class="sm"><thead><tr><th>Pos.</th><th>Cliente</th><th>Segmento</th><th class="r">MRR pagante</th><th class="r">% carteira</th></tr></thead><tbody>${top.map((d, i) => `<tr class="em-click" ${empOpen(d)}><td><b>${i + 1}º</b></td><td>${esc(d.nome)}</td><td>${esc(empSegL(d.e.seg))}</td><td class="r">${fmtBRL(d.e.mrrP)}</td><td class="r">${empPct(d.e.mrrP / (T.mrrP || 1), 2)}</td></tr>`).join('')}</tbody><tfoot><tr><td colspan="3"><b>Total top 5</b></td><td class="r"><b>${fmtBRL(st)}</b></td><td class="r"><b>${empPct(st / (T.mrrP || 1), 2)}</b></td></tr></tfoot></table></div>` : '<p class="sm muted">Sem clientes com MRR.</p>'}</div>`;
}
function empLeituras(D, T) {
  const out = [], cfg = empMeta().cfg, tot = T.mrrP || 1, nm = a => a.map(d => esc(d.nome)).join(', '), add = (sev, h) => out.push({ sev, h });
  const t5 = T.rank.slice(0, 5).filter(d => d.e.mrrP > 0); if (t5.length) add('i', `As 5 maiores contas concentram <b>${empPct(T.top5)}</b> do MRR pagante: ${nm(t5)}.`);
  const prot = D.filter(d => d.quad === 'Proteger').sort((a, b) => b.e.mrrP - a.e.mrrP); if (prot.length) add('w', `<b>${empPl(prot.length, 'conta')}</b> com MRR ≥ ${empBrlK(cfg.limiarMrr)} ${prot.length > 1 ? 'estão' : 'está'} sem venda de ${empBaseLbl()} há mais de ${empTempo(cfg.limiarDias)} e ${prot.length > 1 ? 'somam' : 'soma'} <b>${empBrlK(empSum(prot, d => d.e.mrrP))}</b> (${empPct(empSum(prot, d => d.e.mrrP) / tot)} do MRR). Maiores: ${prot.slice(0, 3).map(d => esc(d.nome) + ' (' + empBrlK(d.e.mrrP) + ')').join(', ')}.`);
  const gap = D.filter(d => d.gap > 0.009).sort((a, b) => b.gap - a.gap); if (gap.length) add('w', `MRR contratado supera o pagante em <b>${empBrl(T.gap)}</b> em ${empPl(gap.length, 'cliente')} — maiores: ${gap.slice(0, 3).map(d => esc(d.nome) + ' (' + empBrl(d.gap) + ')').join(', ')}. Verificar descontos, carência ou inadimplência.`);
  const grp = D.filter(d => d.e.mrrG - d.e.mrrP > 0.009).sort((a, b) => (b.e.mrrG - b.e.mrrP) - (a.e.mrrG - a.e.mrrP)); if (grp.length) add('i', `${empPl(grp.length, 'cliente')} em grupos com <b>${empBrl(empSum(grp, d => d.e.mrrG - d.e.mrrP))}</b> de MRR em outras empresas do grupo (${nm(grp.slice(0, 3))}) — mapear decisores do grupo.`);
  const semP = D.filter(d => d.ativo && d.e.mrrP > 0 && !d.produtos.length).sort((a, b) => b.e.mrrP - a.e.mrrP); if (semP.length) add('i', `<b>${empPl(semP.length, 'cliente pagante', 'clientes pagantes')}</b> (${empBrlK(empSum(semP, d => d.e.mrrP))}) sem etiqueta de produto no Empodera, ex.: ${nm(semP.slice(0, 3))}.`);
  const crit = D.filter(d => d.ativo && d.tags.some(t => t.sev === 'crit')); if (crit.length) add('c', `<b>${empPl(crit.length, 'cliente')}</b> com etiqueta Restrito/Processo judicial ${crit.length > 1 ? 'somam' : 'soma'} <b>${empBrlK(empSum(crit, d => d.e.mrrP))}</b>: ${nm(crit)}.`);
  const lp = empClusterDatas(D, 'uvp', 21, 6); if (lp && empDias(lp.ate, empMeta().dataBase) > 90) add('i', `<b>${lp.n} clientes</b> têm a última venda de produto entre ${fmtD(lp.de)} e ${fmtD(lp.ate)} — padrão de lote (possível renovação ou aditivo em massa). Confirmar se houve venda real.`);
  const ls = empMesmoDia(D, 'uvs', 4); if (ls) add('i', `<b>${ls.itens.length} clientes</b> com última venda de serviço no mesmo dia (${fmtD(ls.data)}) — provável lançamento recorrente (ex.: SCC), não venda nova.`);
  const sg = empSegs(D); if (sg.length > 1) add('i', `${esc(sg[0].l)} e ${esc(sg[1].l)} respondem por <b>${empPct((sg[0].v + sg[1].v) / tot)}</b> do MRR pagante.`);
  return out;
}
function empVisao() {
  const M = empMeta(), D = empDerive(), T = empTotais(D), A = D.filter(d => d.ativo), antigos = A.filter(d => d.dp != null && d.dp > 365), hj = empHoje();
  const acoes = empDerive(true).filter(d => d.g.proximaAcao || d.g.dataAcao).sort((a, b) => (a.g.dataAcao || '9999').localeCompare(b.g.dataAcao || '9999')), venc = acoes.filter(d => d.g.dataAcao && d.g.dataAcao < hj).length;
  const prev = M.snaps.length > 1 ? M.snaps[M.snaps.length - 2] : null, k = (l, v, s, go = '', w = '') => `<${go ? 'button' : 'div'} class="kpi em-k ${w}" ${go}><div class="sm muted">${l}</div><b>${v}</b><div class="sm muted">${s}</div></${go ? 'button' : 'div'}>`;
  const ins = empLeituras(D, T); let acc = 0;
  const top = T.rank.slice(0, 10).filter(d => d.e.mrrP > 0).map(d => { acc += d.e.mrrP; return { l: d.nome, v: d.e.mrrP, sub: empPct(d.e.mrrP / (T.mrrP || 1)) + ' · acum. ' + empPct(acc / (T.mrrP || 1)), color: d.quad === 'Proteger' ? 'var(--lar)' : '', go: empOpen(d), tip: empSegL(d.e.seg) + ' · ' + d.quad }; });
  const rec = EMP_BUCKETS.map(b => { const v = A.filter(d => d.bp.k === b.k); return { b, l: b.l, v: empSum(v, d => d.e.mrrP), n: v.length, sub: empPl(v.length, 'cliente'), color: b.k === 'nd' ? 'var(--cz)' : b.max > 365 ? 'var(--lar)' : '', go: v.length && M.cfg.baseRecencia === 'produto' ? empGo({ buck: b.k }) : '' }; }).filter(x => x.n || x.b.k !== 'nd');
  const fx = EMP_FAIXAS.map(f => { const v = D.filter(d => EMP_FAIXAS.find(z => (d.e.mrrP || 0) >= z.min) === f); return { l: f.l, v: v.length, sub: empBrlK(empSum(v, d => d.e.mrrP)) }; }).filter(x => x.v);
  return `<div class="em-kpis">${k('MRR pagante', empBrl(T.mrrP), prev ? (T.mrrP - prev.mrrP >= 0 ? '+' : '') + empBrlK(T.mrrP - prev.mrrP) + ' vs ' + fmtD(prev.data) : 'Contratado ' + empBrl(T.mrrC))}${k('Contratado − pagante', empBrl(T.gap), empPl(D.filter(d => d.gap > 0.009).length, 'cliente') + ' com diferença', 'data-a="empTab" data-v="qualidade"')}${k('Clientes ativos', T.ativos + ' de ' + T.n, T.inativos + ' inativos · ' + T.pagantes + ' pagantes', 'data-a="empTab" data-v="lista"')}${k('Ticket médio', empBrl(T.ticket), 'MRR ÷ clientes ativos')}${k('Concentração top 5', empPct(T.top5), 'Top 10: ' + empPct(T.top10))}${k('Sem venda de produto +12m', empBrl(empSum(antigos, d => d.e.mrrP)), empPl(antigos.length, 'cliente ativo', 'clientes ativos') + ' · ' + empPct(empSum(antigos, d => d.e.mrrP) / (T.mrrP || 1)) + ' do MRR', 'data-a="empTab" data-v="recencia"', 'w')}${k('Próximas ações', acoes.length, venc ? empPl(venc, 'vencida') : 'nenhuma vencida')}</div>
  <div class="grid g2"><div class="card"><h3>Leituras da carteira</h3><p class="sm muted">Recalculadas a cada importação ou edição</p><ul class="em-ins">${ins.map(i => `<li class="${i.sev}"><p>${i.h}</p></li>`).join('')}</ul></div>
  <div class="card"><h3>Agenda de próximas ações</h3><p class="sm muted">Definidas na aba "Gestão da conta" de cada cliente</p>${acoes.length ? acoes.slice(0, 12).map(d => `<button class="em-ag" ${empOpen(d)}><span class="${!d.g.dataAcao ? '' : d.g.dataAcao < hj ? 'em-late' : ''}"><b>${d.g.dataAcao ? fmtD(d.g.dataAcao).slice(0, 5) : 'Sem data'}</b><small>${d.g.dataAcao ? (d.g.dataAcao < hj ? 'Vencida' : d.g.dataAcao === hj ? 'Hoje' : d.g.dataAcao.slice(0, 4)) : ''}</small></span><span><b>${esc(d.nome)}</b><small>${esc(d.g.proximaAcao || '—')}</small></span>${d.g.prioridade ? pill(d.g.prioridade, d.g.prioridade === 'Alta' ? 'warn' : 'off') : ''}</button>`).join('') + (acoes.length > 12 ? `<p class="sm muted">+ ${acoes.length - 12} ações — veja na Lista, coluna "Próxima ação".</p>` : '') : '<p class="sm muted">Nenhuma próxima ação registrada. Abra um cliente e defina a próxima ação e a data.</p>'}</div></div>
  <div class="grid g2"><div class="card"><h3>MRR pagante por segmento</h3><p class="sm muted">Clique para ver os clientes do segmento</p>${empBars(empSegs(D).map(s => ({ ...s, sub: empPl(s.n, 'cliente') + ' · ' + empPct(s.v / (T.mrrP || 1)), go: empGo({ seg: s.s, sit: 'todos' }) })))}</div>
  <div class="card"><h3>Concentração — 10 maiores contas</h3><p class="sm muted">Participação no MRR pagante · acumulado à direita</p>${empBars(top, { legend: [['var(--lar)', 'Proteger (MRR alto, venda antiga)'], ['var(--ciano2)', 'Demais']] })}</div>
  <div class="card"><h3>Tempo desde a última venda de produto</h3><p class="sm muted">MRR pagante dos clientes ativos por faixa</p>${empBars(rec, { legend: [['var(--ciano2)', 'Até 12 meses'], ['var(--lar)', 'Mais de 12 meses'], ['var(--cz)', 'Sem data']] })}</div>
  <div class="card"><h3>Clientes por faixa de MRR</h3><p class="sm muted">Quantidade de clientes e MRR somado</p>${empBars(fx, { fmt: v => empPl(v, 'cliente') })}</div></div>`;
}
function empRecencia() {
  const M = empMeta(), cfg = M.cfg, A = empDerive().filter(d => d.ativo), totA = empSum(A, d => d.e.mrrP) || 1, semData = A.filter(d => d.dias == null).length, zero = A.filter(d => d.dias != null && !(d.e.mrrP > 0)).length;
  const fila = A.filter(d => d.quad === 'Proteger' || d.quad === 'Reativar').sort((a, b) => EMP_QORD[a.quad] - EMP_QORD[b.quad] || b.e.mrrP - a.e.mrrP);
  const segs = empGroup(A, d => d.e.seg || '').sort((a, b) => empSum(b[1], d => d.e.mrrP) - empSum(a[1], d => d.e.mrrP)), bks = EMP_BUCKETS.filter(b => A.some(d => d.bucket.k === b.k)), maxN = Math.max(1, ...segs.flatMap(([, v]) => bks.map(b => v.filter(d => d.bucket.k === b.k).length)));
  return `<div class="row" style="gap:6px;margin-bottom:10px;flex-wrap:wrap"><span class="sm muted">Base da recência:</span>${[['produto', 'Venda de produto'], ['servico', 'Venda de serviço'], ['recente', 'Mais recente']].map(([v, l]) => `<button class="btn ${cfg.baseRecencia === v ? 'pri' : 'ghost'} sm" data-a="empBase" data-v="${v}">${l}</button>`).join('')}</div>
  <div class="em-quads">${Object.keys(EMP_QUADS).map(q => { const v = A.filter(d => d.quad === q); return `<button class="em-quad${q === 'Proteger' ? ' w' : ''}" ${empGo({ quad: q })}>${empQuadPill(q)}<b>${empBrl(empSum(v, d => d.e.mrrP))}</b><small>${empPl(v.length, 'cliente')} · ${empPct(empSum(v, d => d.e.mrrP) / totA)} do MRR</small><p>${EMP_QUADS[q]}</p></button>`; }).join('')}</div>
  <div class="card"><div class="row" style="flex-wrap:wrap;gap:8px"><h3>Matriz MRR × tempo desde a última venda</h3><span class="sp"></span><label class="sm">MRR alto a partir de <input data-c="empcfg" data-k="limiarMrr" inputmode="decimal" value="${cfg.limiarMrr.toLocaleString('pt-BR')}" style="width:100px" aria-label="Limiar de MRR"></label><label class="sm">Venda antiga após <input data-c="empcfg" data-k="limiarDias" type="number" min="30" step="1" value="${cfg.limiarDias}" style="width:76px" aria-label="Limiar em dias"> dias</label></div>
  <p class="sm muted">Base: última venda de ${empBaseLbl()} até ${fmtD(M.dataBase)}.${semData ? ` ${semData} ativo(s) sem data ficam fora.` : ''}${zero ? ` ${zero} ativo(s) sem MRR ficam fora.` : ''}</p>${empScatter(A.filter(d => d.dias != null && d.e.mrrP > 0))}<div class="em-leg"><span><i style="background:var(--lar)"></i>Proteger (MRR alto, venda antiga)</span><span><i style="background:var(--ciano2)"></i>Demais clientes ativos</span></div></div>
  <div class="grid g2"><div class="card"><h3>Fila de prioridade</h3><p class="sm muted">Proteger e Reativar, ordenados por MRR</p>${fila.length ? `<div class="tbl-wrap"><table class="sm em-t"><thead><tr><th>Cliente</th><th class="r">MRR pagante</th><th>Últ. produto</th><th>Últ. serviço</th><th>Próxima ação</th></tr></thead><tbody>${fila.map(d => `<tr class="em-click" ${empOpen(d)}><td><b>${esc(d.nome)}</b><br>${empQuadPill(d.quad)}</td><td class="r">${empBrl(d.e.mrrP)}</td><td>${empDt(d.e.uvp, d.dp)}</td><td>${empDt(d.e.uvs, d.ds)}</td><td class="em-ac">${empAcao(d.g)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="sm muted">Nenhum cliente em Proteger ou Reativar com os limiares atuais.</p>'}</div>
  <div class="card"><h3>Recência por segmento</h3><p class="sm muted">Nº de clientes ativos por faixa · clique para ver os clientes</p>${segs.length ? `<div class="tbl-wrap"><table class="sm em-heat"><thead><tr><th>Segmento</th>${bks.map(b => `<th>${b.l.replace(' meses', 'm').replace('Mais de ', '+').replace('Até ', '≤').replace(' a ', '–')}</th>`).join('')}</tr></thead><tbody>${segs.map(([s, v]) => `<tr><td>${esc(empSegL(s))}</td>${bks.map(b => { const it = v.filter(d => d.bucket.k === b.k), n = it.length; return n ? `<td class="hc" style="background:color-mix(in srgb,var(--ciano2) ${Math.round(18 + n / maxN * 72)}%,transparent);cursor:pointer" ${empGo({ seg: s, buck: b.k })} title="${esc(empSegL(s))} · ${b.l}: ${fmtBRL(empSum(it, d => d.e.mrrP))}">${n}</td>` : '<td class="hc muted">·</td>'; }).join('')}</tr>`).join('')}</tbody></table></div>` : '<p class="sm muted">Sem clientes ativos.</p>'}</div></div>`;
}
const EMP_COLS = [
  { k: 'nome', l: 'Cliente', s: d => d.nome, c: d => `<b>${esc(d.nome)}</b><small class="muted">${esc(d.cod)}${d.e.cidade ? ' · ' + esc(empCap(d.e.cidade)) : ''}</small>` },
  { k: 'seg', l: 'Segmento', s: d => empSegL(d.e.seg), c: d => esc(empSegL(d.e.seg)) },
  { k: 'sit', l: 'Situação', s: d => (d.ativo ? 0 : 1) + (d.e.sit || ''), c: d => d.e.ausente ? pill('fora da importação', 'warn') : pill(empCap(d.e.sit || (d.ativo ? 'Ativo' : 'Inativo')), d.ativo ? 'ok' : 'off') },
  { k: 'mrrP', l: 'MRR pagante', n: 1, s: d => d.e.mrrP, c: d => fmtBRL(d.e.mrrP) },
  { k: 'gap', l: 'Contrat. − pag.', n: 1, s: d => d.gap, c: d => d.gap > 0.009 ? fmtBRL(d.gap) : '—' },
  { k: 'uvp', l: 'Últ. venda produto', s: d => d.dp ?? 1e9, c: d => empDt(d.e.uvp, d.dp) },
  { k: 'uvs', l: 'Últ. venda serviço', s: d => d.ds ?? 1e9, c: d => empDt(d.e.uvs, d.ds) },
  { k: 'quad', l: 'Quadrante', s: d => EMP_QORD[d.quad], c: d => empQuadPill(d.quad) },
  { k: 'prio', l: 'Prioridade', s: d => EMP_PORD[d.g.prioridade || ''], c: d => d.g.prioridade ? pill(d.g.prioridade, d.g.prioridade === 'Alta' ? 'warn' : 'off') : '—' },
  { k: 'acao', l: 'Próxima ação', s: d => d.g.dataAcao || (d.g.proximaAcao ? '9998' : '9999'), c: d => `<div class="em-ac">${empAcao(d.g)}</div>` },
  { k: 'tags', l: 'Etiquetas', s: d => -d.tags.length, c: d => d.tags.map(t => pill(t.l, t.sev ? 'warn' : 'off')).join(' ') || '—' }];
function empFiltrar(Dall) {
  const f = empUI().f, q = norm(f.q);
  return Dall.filter(d => !(f.sit === 'ativos' && !d.ativo) && !(f.sit === 'inativos' && (d.ativo || d.e.ausente)) && !(f.sit === 'ausentes' && !d.e.ausente) && !(f.sit !== 'ausentes' && d.e.ausente) && !(f.seg && (d.e.seg || '') !== f.seg) && !(f.quad && d.quad !== f.quad) && !(f.buck && d.bucket.k !== f.buck)
    && !(f.prod && !(d.produtos.includes(f.prod) || d.tags.some(t => t.k === f.prod) || (f.prod === '__sem' && !d.produtos.length))) && !(f.prio && (f.prio === '__sem' ? d.g.prioridade : d.g.prioridade !== f.prio))
    && !(q && !norm([d.nome, d.e.razao, d.cod, d.e.cnpj, d.e.cidade, d.e.prod, d.e.grupoEmp, d.g.proximaAcao].join(' ')).includes(q)));
}
function empLinhas() { const U = empUI(), col = EMP_COLS.find(c => c.k === U.sort.k) || EMP_COLS[3]; return empFiltrar(empDerive(true)).sort((a, b) => { const va = col.s(a), vb = col.s(b); return (typeof va === 'string' ? va.localeCompare(vb, 'pt-BR') : va - vb) * U.sort.dir; }); }
function empLista() {
  const U = empUI(), f = U.f, D = empDerive(), rows = empLinhas(), pset = new Set(), tset = new Map(); D.forEach(d => { d.produtos.forEach(p => pset.add(p)); d.tags.forEach(t => tset.set(t.k, t.l)); });
  const sel = (k, items) => `<select data-c="empf" data-k="${k}" aria-label="${k}">${items.map(([v, l]) => `<option value="${esc(v)}" ${v === f[k] ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  return `<div class="row" style="gap:6px;flex-wrap:wrap;margin-bottom:10px"><input data-i="empq" type="search" placeholder="Buscar cliente, código, CNPJ, cidade…" value="${esc(f.q)}" style="min-width:220px;flex:1" aria-label="Buscar">
  ${sel('sit', [['ativos', 'Ativos'], ['todos', 'Todos'], ['inativos', 'Inativos'], ['ausentes', 'Fora da última importação']])}${sel('seg', [['', 'Todos os segmentos'], ...[...new Set(D.map(d => d.e.seg || ''))].sort((a, b) => empSegL(a).localeCompare(empSegL(b))).filter(Boolean).map(s => [s, empSegL(s)])])}${sel('quad', [['', 'Todos os quadrantes'], ...Object.keys(EMP_QORD).map(q => [q, q])])}${sel('buck', [['', 'Últ. venda (' + empBaseLbl() + '): todas'], ...EMP_BUCKETS.map(b => [b.k, b.l])])}${sel('prod', [['', 'Todos os produtos'], ...[...pset].sort().map(p => [p, p]), ...[...tset].sort().map(([k, l]) => [k, 'Etiqueta: ' + l]), ['__sem', 'Sem etiqueta de produto']])}${sel('prio', [['', 'Qualquer prioridade'], ['Alta', 'Prioridade alta'], ['Média', 'Prioridade média'], ['Baixa', 'Prioridade baixa'], ['__sem', 'Sem prioridade']])}
  <button class="btn ghost sm" data-a="empClear">Limpar filtros</button><button class="btn ghost sm" data-a="empXlsx">Exportar seleção (.xlsx)</button></div>
  <div class="card"><div class="tbl-wrap"><table class="sm em-t"><thead><tr>${EMP_COLS.map(c => `<th class="em-sort${c.n ? ' r' : ''}" data-a="empSort" data-k="${c.k}">${c.l}${U.sort.k === c.k ? (U.sort.dir > 0 ? ' ↑' : ' ↓') : ''}</th>`).join('')}</tr></thead>
  <tbody>${rows.length ? rows.map(d => `<tr class="em-click${d.e.ausente ? ' aus' : ''}" ${empOpen(d)}>${EMP_COLS.map(c => `<td class="${c.n ? 'r' : ''}">${c.c(d)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${EMP_COLS.length}" class="muted">Nenhum cliente com estes filtros.</td></tr>`}</tbody>
  <tfoot><tr><td colspan="3"><b>${empPl(rows.length, 'cliente')}</b></td><td class="r"><b>${fmtBRL(empSum(rows, d => d.e.mrrP))}</b></td><td class="r"><b>${fmtBRL(empSum(rows, d => d.gap))}</b></td><td colspan="${EMP_COLS.length - 5}"></td></tr></tfoot></table></div></div>
  <p class="sm muted">Clique em um cliente para abrir a ficha. Prioridade, próxima ação e interações ficam na aba "Gestão da conta".</p>`;
}
async function empXlsx() {
  if (!(await vend('xlsx'))) return toast('Biblioteca de planilhas indisponível.'); const rows = empLinhas(); if (!rows.length) return toast('Nenhum cliente na seleção.');
  const linhas = rows.map(d => { const e = d.e, g = d.g; return { 'Cód': d.cod, 'Nome fantasia': e.fantasia, 'Razão social': e.razao, 'CNPJ': e.cnpj, 'Situação': e.sit, 'Situação (Protheus)': e.sitP, 'Segmento': e.seg, 'Produtos (etiqueta)': e.prod, 'UF': e.uf, 'Cidade': e.cidade, 'Região': e.regiao, 'Grupo econômico': e.grupoEco, 'Grupo empresarial': e.grupoEmp, 'ESN': e.esn, 'GSN': e.gsn,
    'MRR contratado': e.mrrC, 'MRR pagante': e.mrrP, 'MRR pagante grupo': e.mrrG, 'Contratado − pagante': Math.round(d.gap * 100) / 100, 'Última venda produto': e.uvp ? fmtD(e.uvp) : '', 'Dias desde venda produto': d.dp ?? '', 'Última venda serviço': e.uvs ? fmtD(e.uvs) : '', 'Dias desde venda serviço': d.ds ?? '', 'Quadrante': d.quad,
    'Prioridade': g.prioridade || '', 'Próxima ação': g.proximaAcao || '', 'Data da ação': g.dataAcao ? fmtD(g.dataAcao) : '', 'Oportunidade em pauta': g.oportunidade || '', 'Potencial (R$)': g.potencial || '', 'Contato principal': g.contato || '', 'Interações': (g.interacoes || []).map(i => fmtD(i.data) + ' [' + i.tipo + '] ' + i.texto).join(' | '), 'Fora da última importação': e.ausente ? 'Sim' : '', 'Link Empodera': e.link }; });
  const wb = XLSX.utils.book_new(), ws = XLSX.utils.json_to_sheet(linhas); ws['!cols'] = Object.keys(linhas[0]).map(k => ({ wch: Math.min(40, Math.max(10, k.length + 2)) })); XLSX.utils.book_append_sheet(wb, ws, 'Carteira'); XLSX.writeFile(wb, 'Carteira_ESN_' + empMeta().dataBase + '.xlsx');
}
function empProdutos() {
  const A = empDerive().filter(d => d.ativo), pm = new Map(), tm = new Map(); A.forEach(d => { d.produtos.forEach(p => { const o = pm.get(p) || { n: 0, m: 0 }; o.n++; o.m += d.e.mrrP; pm.set(p, o); }); d.tags.forEach(t => { const o = tm.get(t.k) || { t, it: [] }; o.it.push(d); tm.set(t.k, o); }); });
  const pen = [...pm].map(([p, o]) => ({ l: p, v: o.n, m: o.m })).sort((a, b) => b.v - a.v || b.m - a.m), sv = { crit: 0, serious: 1, '': 2 }, tl = [...tm.values()].sort((a, b) => sv[a.t.sev] - sv[b.t.sev] || b.it.length - a.it.length);
  const semP = A.filter(d => !d.produtos.length).sort((a, b) => b.e.mrrP - a.e.mrrP), cl = A.filter(d => d.produtos.length).sort((a, b) => b.e.mrrP - a.e.mrrP), chips = it => `<div class="em-chips">${[...it].sort((a, b) => b.e.mrrP - a.e.mrrP).map(d => empChip(d, empBrlK(d.e.mrrP))).join('')}</div>`;
  return `<div class="grid g2"><div class="card"><h3>Penetração por produto</h3><p class="sm muted">Clientes ativos com o produto · MRR desses clientes</p>${empBars(pen.map(x => ({ ...x, sub: empBrlK(x.m) + ' · ' + empPct(x.v / (A.length || 1), 0) + ' da base', go: empGo({ prod: x.l }) })), { fmt: v => empPl(v, 'cliente') })}</div>
  <div class="card"><h3>Etiquetas de atenção e relacionamento</h3><p class="sm muted">Sinais registrados no Empodera</p>${tl.map(o => `<div class="em-qr">${pill(o.t.l, o.t.sev ? 'warn' : 'off')} <b>${empPl(o.it.length, 'cliente')} · ${empBrlK(empSum(o.it, d => d.e.mrrP))}</b>${chips(o.it)}</div>`).join('') || (semP.length ? '' : '<p class="sm muted">Nenhuma etiqueta de relacionamento nos clientes ativos.</p>')}${semP.length ? `<div class="em-qr">${pill('Sem etiqueta de produto', 'off')} <b>${empPl(semP.length, 'cliente')} · ${empBrlK(empSum(semP, d => d.e.mrrP))}</b><p class="sm muted">A etiqueta de produto está vazia no Empodera: completar para mapear a base instalada.</p>${chips(semP)}</div>` : ''}</div></div>
  <div class="card"><h3>Matriz cliente × produto</h3><p class="sm muted">Clientes ativos ordenados por MRR · coluna vazia = espaço para oferta</p>${cl.length ? `<div class="tbl-wrap"><table class="sm em-mx"><thead><tr><th>Cliente</th><th class="r">MRR</th>${pen.map(p => `<th class="rot"><span>${esc(p.l)}</span></th>`).join('')}</tr></thead><tbody>${cl.map(d => `<tr class="em-click" ${empOpen(d)}><td><b>${esc(d.nome)}</b></td><td class="r">${empBrlK(d.e.mrrP)}</td>${pen.map(p => `<td class="dot">${d.produtos.includes(p.l) ? `<i title="${esc(p.l)}"></i>` : ''}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '<p class="sm muted">Sem clientes com etiqueta de produto.</p>'}</div>`;
}
function empRegras() {
  const Dall = empDerive(true), D = Dall.filter(d => !d.e.ausente), R = [], add = (id, sev, titulo, desc, itens, extra = () => '') => R.push({ id, sev, titulo, desc, itens, extra }), inat = s => /^inativo/.test(norm(s));
  add('aus', 'warn', 'Fora da última importação', 'Estavam na carteira mas não vieram na planilha mais recente (troca de ESN, baixa ou exclusão). Não entram nos indicadores e não são apagados.', Dall.filter(d => d.e.ausente));
  add('sitdiv', 'serious', 'Situação Empodera × Protheus divergente', 'Um sistema indica ativo e o outro inativo.', D.filter(d => d.e.sitP && inat(d.e.sit) !== inat(d.e.sitP)), d => d.e.sit + ' × ' + d.e.sitP);
  add('semmrr', 'serious', 'Ativo sem MRR pagante', 'Cliente ativo com MRR zerado — confirmar se há recorrente ou se deve ser inativado.', D.filter(d => d.ativo && !(d.e.mrrP > 0)), d => d.e.sit);
  add('nome', 'warn', 'Nome fantasia ausente', 'O nome exibido usa a razão social. Corrigir no cadastro de origem.', D.filter(d => !d.e.fantasia), d => d.cod);
  add('gap', 'info', 'MRR contratado maior que o pagante', 'Diferença entre contrato e cobrança: descontos, carência ou pendência financeira.', D.filter(d => d.gap > 0.009).sort((a, b) => b.gap - a.gap), d => empBrl(d.gap));
  add('semdata', 'warn', 'Ativo sem data de última venda de produto', 'Sem data não há como medir a recência comercial do cliente.', D.filter(d => d.ativo && !d.e.uvp), d => d.e.uvs ? 'serviço ' + fmtD(d.e.uvs) : 'sem datas');
  add('semprod', 'info', 'Sem etiqueta de produto', 'Etiqueta vazia ("-" ou sem dados) no Empodera.', D.filter(d => d.ativo && !d.produtos.length).sort((a, b) => b.e.mrrP - a.e.mrrP), d => empBrlK(d.e.mrrP));
  add('semfat', 'info', 'Sem faixa de faturamento', 'Faturamento Driva e Empodera vazios — dificulta a segmentação por porte.', D.filter(d => !d.e.fatD && !d.e.fatE));
  add('dup', 'warn', 'Mesmo CNPJ raiz em códigos diferentes', 'Possível duplicidade ou filial cadastrada como cliente separado.', empGroup(D.filter(d => d.e.cnpj && d.e.cnpj.length === 14), d => d.e.cnpj.slice(0, 8)).filter(x => x[1].length > 1).flatMap(x => x[1]), d => d.e.cnpj.slice(0, 8));
  add('grupo', 'info', 'Grupo empresarial com MRR fora deste cliente', 'O MRR do grupo é maior que o do cliente — há outras empresas do grupo na base TOTVS.', D.filter(d => d.e.mrrG - d.e.mrrP > 0.009), d => '+' + empBrl(d.e.mrrG - d.e.mrrP));
  const lp = empClusterDatas(D, 'uvp', 21, 6); if (lp && empDias(lp.ate, empMeta().dataBase) > 90) add('lotep', 'info', 'Datas de venda de produto em lote', `${lp.n} clientes com última venda de produto entre ${fmtD(lp.de)} e ${fmtD(lp.ate)} — confirmar se foram vendas reais ou ajuste contratual em massa.`, lp.itens, d => fmtD(d.e.uvp));
  const ls = empMesmoDia(D, 'uvs', 4); if (ls) add('lotes', 'info', 'Datas de venda de serviço no mesmo dia', `${ls.itens.length} clientes com última venda de serviço em ${fmtD(ls.data)} — provável lançamento recorrente (ex.: SCC).`, ls.itens);
  return R;
}
const empQualN = () => new Set(empRegras().filter(r => r.sev !== 'info').flatMap(r => r.itens.map(d => d.key))).size;
function empQualidade() {
  const R = empRegras(), com = R.filter(r => r.itens.length), ok = R.filter(r => !r.itens.length), sv = { serious: ['Corrigir', 'warn'], warn: ['Revisar', 'warn'], info: ['Observar', 'off'] };
  return `<p class="sm muted">Inconsistências detectadas automaticamente na planilha. Clique no cliente para abrir a ficha.</p>${com.map(r => `<div class="card em-qr" id="emq-${r.id}"><div class="row"><h3>${esc(r.titulo)}</h3>${pill(sv[r.sev][0], sv[r.sev][1])}<span class="sp"></span><b class="em-n">${r.itens.length}</b></div><p class="sm muted">${esc(r.desc)}</p><div class="em-chips">${r.itens.map(d => empChip(d, r.extra(d))).join('')}</div></div>`).join('')}${ok.length ? `<div class="card"><h3>Sem ocorrências</h3><p class="sm muted">${ok.map(r => esc(r.titulo)).join(' · ')}</p></div>` : ''}`;
}
function empDados() {
  const M = empMeta(), U = empUI(), P = U.pend, snaps = M.snaps; let prev = '';
  if (P) { const pl = empPlano(P.recs), lst = (a, f) => a.length ? `<ul class="sm">${a.slice(0, 8).map(x => `<li>${f(x)}</li>`).join('')}${a.length > 8 ? `<li>+ ${a.length - 8} outros</li>` : ''}</ul>` : '', nm = r => esc(r.fantasia || r.razao || r.cod);
    prev = `<div class="card em-prev"><h3>Importar ${esc(P.name)}</h3><div class="em-stat"><div><b>${P.recs.length}</b>clientes na planilha</div><div><b>${pl.novos.length}</b>novos no Analisador</div><div><b>${pl.primeira.length}</b>já cadastrados (1ª vez do Empodera)</div><div><b>${pl.mud.length}</b>com MRR alterado</div><div><b>${pl.ausentes.length}</b>ausentes</div></div>
    <p class="sm">MRR pagante: <b>${fmtBRL(pl.mrrAntes)}</b> → <b>${fmtBRL(pl.mrrNovo)}</b> (${pl.mrrNovo - pl.mrrAntes >= 0 ? '+' : ''}${fmtBRL(pl.mrrNovo - pl.mrrAntes)})</p>
    ${pl.novos.length ? `<p class="sm"><b>Novos:</b></p>${lst(pl.novos, r => nm(r) + ' · ' + empBrl(r.mrrP))}` : ''}${pl.mud.length ? `<p class="sm"><b>Maiores variações de MRR:</b></p>${lst(pl.mud, x => nm(x.r) + ': ' + empBrl(x.de) + ' → ' + empBrl(x.r.mrrP))}` : ''}${pl.ausentes.length ? `<p class="sm"><b>Ausentes nesta planilha</b> (ficam marcados, não são apagados):</p>${lst(pl.ausentes, c => esc(c.emp.fantasia || c.name))}` : ''}
    <div class="row" style="gap:8px;flex-wrap:wrap;margin-top:8px"><label class="sm">Data-base desta planilha <input type="date" id="emp_data" value="${P.data}"></label><span class="sp"></span><button class="btn ghost" data-a="empCancel">Cancelar</button><button class="btn pri" data-a="empApply">Aplicar importação</button></div>
    <p class="sm muted">Aba lida: ${esc(P.aba)}. Clientes são casados pelo código exato; o cadastro, as fichas e a gestão da conta do Analisador são preservados.</p></div>`; }
  return `${prev}<div class="grid g2"><div class="card"><h3>Importar planilha atualizada</h3><p class="sm muted">Exportação "Clientes_ESN" do Empodera (.xlsx)</p><label class="em-drop"><input type="file" data-c="empfile" accept=".xlsx,.xls,.xlsm,.csv" hidden><b>Clique para escolher a planilha</b><span>Antes de aplicar, você vê o resumo: clientes novos, alterados e ausentes, e a variação do MRR.</span></label>${M.fonte ? `<p class="sm muted" style="margin-top:8px">Última importação: ${esc(M.fonte)} · data-base ${fmtD(M.dataBase)}</p>` : ''}</div>
  <div class="card"><h3>Parâmetros da análise</h3><p class="sm muted">Usados na matriz de atenção e nas leituras</p><div class="em-form"><label class="em-fld"><span>Data-base da planilha</span><input type="date" data-c="empcfg" data-k="dataBase" value="${M.dataBase}"></label><label class="em-fld"><span>MRR alto a partir de (R$)</span><input data-c="empcfg" data-k="limiarMrr" inputmode="decimal" value="${M.cfg.limiarMrr.toLocaleString('pt-BR')}"></label><label class="em-fld"><span>Venda antiga após (dias)</span><input type="number" min="30" step="1" data-c="empcfg" data-k="limiarDias" value="${M.cfg.limiarDias}"></label><label class="em-fld"><span>Base da recência</span><select data-c="empcfg" data-k="baseRecencia">${[['produto', 'Venda de produto'], ['servico', 'Venda de serviço'], ['recente', 'Mais recente (produto ou serviço)']].map(([v, l]) => `<option value="${v}" ${v === M.cfg.baseRecencia ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div></div></div>
  <div class="card"><h3>Evolução do MRR pagante</h3><p class="sm muted">Um ponto por importação (data-base)</p>${snaps.length > 1 ? empLinha(snaps) : `<p class="sm muted">${snaps.length ? 'A linha de evolução aparece a partir da 2ª importação. Primeira posição: ' + empBrl(snaps[0].mrrP) + ' em ' + fmtD(snaps[0].data) + '.' : 'Nenhuma importação registrada.'}</p>`}
  ${snaps.length ? `<div class="tbl-wrap"><table class="sm"><thead><tr><th>Data-base</th><th>Fonte</th><th class="r">Clientes</th><th class="r">Ativos</th><th class="r">MRR pagante</th><th class="r">Variação</th><th class="r">MRR contratado</th></tr></thead><tbody>${[...snaps].reverse().map((s, i, a) => { const p = a[i + 1], dv = p ? s.mrrP - p.mrrP : null; return `<tr><td>${fmtD(s.data)}</td><td class="muted">${esc(s.fonte || '—')}</td><td class="r">${s.total}</td><td class="r">${s.ativos}</td><td class="r">${fmtBRL(s.mrrP)}</td><td class="r">${dv == null ? '—' : (dv >= 0 ? '+' : '') + fmtBRL(dv)}</td><td class="r">${fmtBRL(s.mrrC)}</td></tr>`; }).join('')}</tbody></table></div>` : ''}</div>`;
}
function vMrr() {
  const U = empUI(), tem = Object.values(S.clients).some(c => c.emp); if (!tem) U.tab = 'dados';
  const tab = EMP_TABS.some(t => t[0] === U.tab) ? U.tab : 'painel', nq = tem ? empQualN() : 0, nc = tem ? empDerive().length : 0;
  const T = { painel: empPainel, visao: empVisao, recencia: empRecencia, lista: empLista, produtos: empProdutos, qualidade: empQualidade, dados: empDados };
  return `<div class="em-v">${tem ? `<div class="ctabs">${EMP_TABS.map(([k, l]) => `<button data-a="empTab" data-v="${k}" class="${tab === k ? 'on' : ''}">${l}${k === 'lista' && nc ? ` <small>${nc}</small>` : k === 'qualidade' && nq ? ` <small>${nq}</small>` : ''}</button>`).join('')}</div>` : '<p class="sm muted">Importe a exportação "Clientes_ESN" do Empodera para ver MRR, última venda, quadrantes de atenção, produtos e qualidade dos dados da sua carteira.</p>'}${T[tab]()}</div>`;
}
