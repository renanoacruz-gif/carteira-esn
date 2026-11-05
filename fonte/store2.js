/* ===== AÇÕES: contratos, evidências, perfil fiscal, marcos, regulatório, ROI, diagnóstico ===== */
const CDOC_K = { contrato: 'Contrato', aditivo: 'Aditivo', matriz: 'Matriz de acesso' };
const fmtCell = v => v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? '').slice(0, 20);
async function ingestCdoc(files, key, kind) {
  const c = S.clients[key]; if (!c) return; consInit(c); UI.busy = 'Lendo documentos contratuais…'; render(); const names = [];
  for (const file of files) {
    try {
      const buf = await readBuf(file), hash = await sha(buf);
      if (c.cdocs.some(d => d.hash === hash)) { toast(`${file.name}: arquivo idêntico já anexado a este cliente.`); continue; }
      if (kind === 'matriz') { loadMatriz(c, file, await readTable(file, buf), hash); names.push(file.name); continue; }
      const units = await toUnits(file, buf), lines = units.flatMap(u => u.lines), text = units.map(u => u.text).join('\n');
      const cn = [...new Set((text.match(CNPJ_RE) || []).map(digits).filter(validCnpj))];
      const v = validateIdentity({ cnpjs: cn }, text, key, idx());
      const d = { id: uid(), kind, name: file.name, hash, at: nowISO(), text: text.slice(0, 12000), trunc: text.length > 12000, state: v.state === 'confirmado' ? 'confirmado' : 'divergente', by: v.by, divergencia: v.divergencia || null };
      c.cdocs.push(d); extractLic(c, lines, d); names.push(file.name);
      log(`✔ ${file.name}: ${CDOC_K[kind]} anexado a "${c.name}"${d.state === 'divergente' ? ' — identificação divergente, revisão necessária' : ''}.`, d.state === 'divergente' ? 'bad' : 'ok');
    } catch (e) { log(`✖ ${file.name}: ${e.message}`, 'bad'); toast(`${file.name}: ${e.message}`); }
  }
  reanalyze([key], names.length ? `Documento contratual: ${names.join(', ')}` : ''); UI.busy = ''; render();
}
function loadMatriz(c, file, t, hash) {
  const sh = t.sheets.find(s => s.rows.filter(r => r.some(x => String(x ?? '').trim())).length > 1); if (!sh) throw new Error('Matriz sem dados.');
  const h = detectHeader(sh.rows), hd = (sh.rows[h] || []).map(x => norm(x)), used = new Set();
  const col = re => { const i = hd.findIndex((x, j) => !used.has(j) && re.test(x)); if (i >= 0) used.add(i); return i; };
  const ci = {}; ci.ult = col(/[uú]ltimo|data d[eo] (acesso|login)|login em/); ci.u = col(/usu[aá]rio|login|nome|colaborador/); ci.perfil = col(/perfil|licen[cç]a|tipo de (licen|acesso)|grupo de acesso/); ci.cargo = col(/cargo|fun[cç][aã]o|departamento|[aá]rea/); ci.ativ = col(/atividade|rotina|m[oó]dulo|menu|programa|acesso|transa/);
  if (ci.u < 0 || ci.perfil < 0) throw new Error('Matriz de acesso: colunas de usuário e de perfil/licença não encontradas.');
  const all = sh.rows.slice(h + 1).filter(r => String(r[ci.u] ?? '').trim());
  const g = (r, k, n) => ci[k] >= 0 ? (k === 'ult' ? fmtCell(r[ci[k]]) : String(r[ci[k]] ?? '').trim().slice(0, n)) : '';
  c.lic.matriz = { file: file.name, at: nowISO(), hash, sheet: sh.name, cols: Object.fromEntries(Object.entries(ci).map(([k, i]) => [k, i >= 0 ? String(sh.rows[h][i]) : null])), total: all.length, trunc: all.length > 400, rows: all.slice(0, 400).map(r => ({ u: g(r, 'u', 60), cargo: g(r, 'cargo', 60), perfil: g(r, 'perfil', 40), ativ: g(r, 'ativ', 240), ult: g(r, 'ult') })) };
  c.cdocs.push({ id: uid(), kind: 'matriz', name: file.name, hash, at: nowISO(), text: '', state: 'confirmado', by: 'anexada neste cliente (tabela sem identificação do cliente: vínculo informado pelo usuário)' });
  log(`✔ ${file.name}: matriz de acesso com ${all.length} usuário(s)${all.length > 400 ? ' (400 lidos)' : ''}.`, 'ok');
}
function cdocConfirm(key, id) { const c = S.clients[key], d = c?.cdocs.find(x => x.id === id); if (!d) return; d.state = 'confirmado'; d.by += ' + confirmado manualmente após revisão'; d.divergencia = null; reanalyze([key], `Documento contratual confirmado: ${d.name}`); render(); }
function cdocRemove(key, id) {
  const c = S.clients[key], d = c?.cdocs.find(x => x.id === id); if (!d) return; c.cdocs = c.cdocs.filter(x => x.id !== id);
  const strip = a => a.filter(e => !(e.fonte?.doc === id && e.st === 'candidato')).map(e => { if (e.fonte?.doc === id) evH(e, `documento de origem "${d.name}" removido (registro preservado)`); return e; });
  LIC_F.forEach(([k]) => c.lic.f[k] = strip(c.lic.f[k])); c.lic.itens = strip(c.lic.itens); if (d.kind === 'matriz' && c.lic.matriz?.hash === d.hash) c.lic.matriz = null;
  reanalyze([key], `Documento contratual removido: ${d.name}`); render();
}
/* ---------- Evidências genéricas ---------- */
const getPath = (c, p) => p.split('.').reduce((o, k) => o?.[k], c);
function evAct(key, path, id, st) {
  const c = S.clients[key]; const arr = getPath(c, path); const e = arr?.find(x => x.id === id); if (!e) return; evSet(e, st);
  if (path === 'fis.cand' && st === 'confirmado') { const k = e.extra.campo, v = e.extra.valor, f = { tipo: 'documento', ref: e.fonte.ref, loc: e.fonte.loc };
    fisPut(c, k, k === 'regime' ? v : 'sim', f); }
  if (path === 'rel' && st === 'confirmado' && e.extra?.tipo !== 'producao') { evH(e, `tipo alterado de "${REL_TIPO[e.extra.tipo]}" para produção na confirmação`); e.extra.tipo = 'producao'; }
  reanalyze([key], st === 'confirmado' ? `Informação confirmada: ${e.v}` : ''); render();
}
function relRetipo(key, id, tipo) { const c = S.clients[key], e = c?.rel.find(x => x.id === id); if (!e) return; evH(e, 'classificação alterada', 'usuário', e.extra.tipo, tipo); e.extra.tipo = tipo; reanalyze([key]); render(); }
function evAdd(key, path, o) {
  const c = S.clients[key]; consInit(c); const arr = getPath(c, path); if (!arr || !String(o.v || '').trim()) return toast('Informe o valor.'); if (!String(o.ref || '').trim()) return toast('Informe a fonte (documento, reunião, e-mail ou link).');
  arr.push(mkEv(o.v, { st: 'confirmado', cls: o.cls || 'FATO', tipo: /^https?:/.test(o.ref) ? (isOfficialUrl(o.ref) ? 'oficial' : 'pesquisa') : 'manual', ref: o.ref, u: /^https?:/.test(o.ref) ? o.ref : '', por: 'registro manual', extra: o.extra || null, sig: 'manual|' + uid() }));
  reanalyze([key], `Informação registrada: ${o.v}`); render();
}
/* Gravação única de campos fiscais (regime, UF, atividade, operações): usada pelo formulário fiscal, pela confirmação de candidatos e pelo cadastro estratégico */
function fisPut(c, campo, v, f, o = {}) {
  consInit(c);
  if (campo.startsWith('op:')) { const k = campo.slice(3); c.fis.ops[k] = v ? fld(v, 'FATO', f, c.fis.ops[k]) : null; }
  else c.fis[campo] = v ? { ...fld(v, o.cls || 'FATO', f, c.fis[campo]), ...(o.extra || {}) } : null;
}
/* ---------- Licenciamento ---------- */
function licRegraAdd(key, o) {
  const c = S.clients[key]; if (!o.perfil?.trim() || !o.permitidas?.trim()) return toast('Informe o perfil e as rotinas/módulos permitidos.'); if (!o.fonte?.trim()) return toast('Regra sem fonte não é aceita (contrato, aditivo ou documentação oficial).');
  c.lic.regras.push({ id: uid(), perfil: o.perfil.trim(), permitidas: o.permitidas.trim(), restricoes: (o.restricoes || '').trim(), fonte: { t: o.fonte.trim(), u: /^https?:/.test(o.fonte.trim()) ? o.fonte.trim() : '', d: today() }, cls: 'FATO', at: nowISO() });
  reanalyze([key], `Regra de perfil registrada: ${o.perfil}`); render();
}
function licRegraRm(key, id) { const c = S.clients[key]; c.lic.regras = c.lic.regras.filter(r => r.id !== id); reanalyze([key], 'Regra de perfil removida'); render(); }
function licPreco(key, k, v, fonte) { const c = S.clients[key]; const P = c.lic.precos; if (k === 'meses') P.meses = Math.max(1, +v || 12); else if (k === 'viavel') P.viavel = !!v; else P[k] = v === '' || v == null ? null : { v: parseNum(v) ?? +v, cls: fonte ? 'DADO DO CLIENTE' : 'PREMISSA MANUAL', fonte: fonte || '' }; touchC(key); render(); }
function tcoSet(key, grp, k, v, cls, fonte) { const c = S.clients[key], T = c.cloud.tco; if (grp === 'horiz') T.horiz = v; else { const n = v === '' ? null : (parseNum(v) ?? (isNaN(+v) ? null : +v)); T[grp][k] = n == null ? undefined : { v: n, cls: cls || T[grp][k]?.cls || 'PREMISSA MANUAL', fonte: fonte ?? T[grp][k]?.fonte ?? '' }; if (n == null) delete T[grp][k]; } touchC(key); render(); }
function tcoMeta(key, grp, k, prop, v) { const c = S.clients[key], e = c.cloud.tco[grp][k]; if (!e) return toast('Informe o valor primeiro.'); e[prop] = v; touchC(key); render(); }
function capexAdd(key, mes, v, desc, fonte) { const c = S.clients[key]; if (!(+mes > 0) || parseNum(v) == null && isNaN(+v)) return toast('Informe mês e valor.'); if (!fonte?.trim()) return toast('Renovação de hardware exige evidência (idade, capacidade, laudo, orçamento).'); c.cloud.tco.capex.push({ id: uid(), mes: +mes, v: parseNum(v) ?? +v, desc: desc || 'Renovação de hardware', fonte, cls: 'DADO DO CLIENTE' }); touchC(key); render(); }
function capexRm(key, id) { const c = S.clients[key]; c.cloud.tco.capex = c.cloud.tco.capex.filter(x => x.id !== id); touchC(key); render(); }
/* ---------- ROI ---------- */
function roiAdd(key, tipo) { const c = S.clients[key]; consInit(c); const s = roiNew(tipo); c.roi.push(s); UI.roiSel = s.id; touchC(key); render(); }
function roiRm(key, id) { const c = S.clients[key]; c.roi = c.roi.filter(s => s.id !== id); touchC(key); render(); }
function roiInp(key, id, k, prop, v) { const s = S.clients[key]?.roi.find(x => x.id === id); if (!s) return; const f = s.inp[k] ||= { cls: 'PREMISSA MANUAL', fonte: '' }; if (['cons', 'base', 'oti'].includes(prop)) f[prop] = v === '' ? null : (parseNum(v) ?? (isNaN(+v) ? null : +v)); else f[prop] = v; s.upd = nowISO(); touchC(key); render(); }
function roiFl(key, id, k, v) { const s = S.clients[key]?.roi.find(x => x.id === id); if (!s) return; s.fl[k] = v; s.upd = nowISO(); touchC(key); render(); }
/* ---------- Diagnóstico executivo ---------- */
function execSet(key, k, v) { const c = S.clients[key]; consInit(c); if (k.startsWith('ok:')) c.exec.ok[k.slice(3)] = v; else if (k.startsWith('val:')) c.exec.valores[k.slice(4)] = v; else c.exec[k] = v; touchC(key); }
/* ---------- Marcos e regulatório ---------- */
const refDec = () => (S.meta.refDec ||= {});
function refPending() {
  const D = refDec(), P = [];
  REFPKG.marcos.forEach(m => { if (!D[m.id]) P.push({ id: m.id, kind: 'marco', origem: 'Pacote de referência ' + fmtD(REFPKG.consultadoEm), d: m }); });
  REFPKG.regs.forEach(r => { if (!D[r.id]) P.push({ id: r.id, kind: 'reg', origem: 'Pacote de referência ' + fmtD(REFPKG.consultadoEm), d: r }); });
  REFPKG.sols.forEach(s => { if (!D[s.id]) P.push({ id: s.id, kind: s.kind, origem: 'Pacote de referência ' + fmtD(REFPKG.consultadoEm), d: s }); });
  (S.marcos || []).filter(m => m.st === 'pendente').forEach(m => P.push({ id: m.id, kind: 'marco', origem: m.origem, d: m, ai: true }));
  (S.regs || []).filter(r => r.st === 'pendente').forEach(r => P.push({ id: r.id, kind: 'reg', origem: r.origem, d: r, ai: true }));
  return P;
}
const histRec = (r, acao, det = {}) => { r.hist = [{ at: nowISO(), acao, ...det }, ...(r.hist || [])].slice(0, 40); };
function refApprove(id, batch) {
  const p = refPending().find(x => x.id === id); if (!p) return;
  if (p.ai) { const arr = p.kind === 'marco' ? S.marcos : S.regs; const r = arr.find(x => x.id === id); r.st = 'aprovado'; histRec(r, 'aprovado pelo usuário'); touchG(p.kind === 'marco' ? 'marcos' : 'regulatorio', id); }
  else if (p.kind === 'marco' || p.kind === 'reg') { const col = p.kind === 'marco' ? 'marcos' : 'regulatorio', arr = p.kind === 'marco' ? S.marcos : S.regs; const rid = (p.kind === 'marco' ? 'mk_' : 'rg_') + p.d.id.replace(/^[mr]_/, '');
    const ex = arr.find(x => x.id === rid); const rec = { ...JSON.parse(JSON.stringify(p.d)), id: rid, pkgId: p.d.id, st: 'aprovado', consultadoEm: REFPKG.consultadoEm, origem: p.origem, hist: ex?.hist || [] };
    if (ex) { histRec(rec, 'atualizado a partir do pacote de referência', { de: JSON.stringify({ data: ex.data, vigencia: ex.vigencia, prazo: ex.prazo }), para: JSON.stringify({ data: rec.data, vigencia: rec.vigencia, prazo: rec.prazo }) }); Object.assign(ex, rec); } else { histRec(rec, 'aprovado (pacote de referência)'); arr.push(rec); }
    touchG(col, rid); }
  else applySolPkg(p.d);
  refDec()[id] = 'aprovado'; touchMeta(); if (batch) return; reanalyzeAll(true, 'Base de referência aprovada: ' + id); render();
}
function applySolPkg(it) {
  const now = REFPKG.consultadoEm, J = o => JSON.parse(JSON.stringify(o));
  const setOrPend = (r, set, f) => Object.entries(set || {}).forEach(([k, v]) => { if (v == null || v === '') return; if (!r[k]) r[k] = v; else if (String(r[k]) !== String(v)) r.pend = [...(r.pend || []), { campo: k, atual: r[k], novo: v, f: f || 'pacote de referência', at: nowISO(), resolvido: false }]; });
  if (it.kind === 'solfix') { const r = S.solutions.find(s => s.id === it.alvo); if (!r) { toast(`Registro "${it.alvo}" não existe mais na base: correção ignorada.`); return; }
    if (!(r.pend || []).some(p => !p.resolvido && p.campo === it.campo && p.novo === it.novo)) r.pend = [...(r.pend || []), { campo: it.campo, atual: r[it.campo], novo: it.novo, f: it.fonte?.t || 'pacote de referência', nota: it.nota, at: nowISO(), resolvido: false }];
    if (it.fonte?.u && !r.fontes.some(f => f.u === it.fonte.u)) r.fontes.push({ ...it.fonte }); hist(r, 'correção sugerida', `${it.campo}: "${r[it.campo]}" → sugerido "${it.novo}" (pendente de decisão; nada substituído)`, it.fonte?.t); solChanged(r, 'correção sugerida (pendente)'); return; }
  if (it.kind === 'sol') { const ex = S.solutions.find(s => s.id === it.rec.id) || (it.rec.sigla ? S.solutions.find(s => s.sigla && s.sigla === it.rec.sigla) : null);
    if (ex) { toast('Solução já existe na base: complementada.'); mergeCand(ex, { ...candBase(''), ...J(it.rec), fontes: it.rec.fontes }, { tipo: 'depois', categoria: 'depois', linha: 'depois' }, { f: 'pacote de referência' });
      setOrPend(ex, { sigla: it.rec.sigla, refId: it.rec.refId, codOferta: it.rec.codOferta, grupo: it.rec.grupo, refStatus: it.rec.refStatus, refNota: it.rec.refNota, finalidade: it.rec.finalidade }); ex.processos = [...new Set([...(ex.processos || []), ...(it.rec.processos || [])])]; ex.lacunas = [...new Set([...(ex.lacunas || []), ...(it.rec.lacunas || [])])]; solChanged(ex, 'pacote de referência'); return; }
    const r = newSol({ ...J(it.rec), origem: 'pacote de referência ' + now, atualizadoEm: now }); hist(r, 'criado', `Aprovado pelo usuário a partir do pacote de referência consultado em ${fmtD(now)}${r.refId ? ' (referência ' + r.refId + ')' : ''}`); S.solutions.push(r); solChanged(r, 'criado (pacote de referência)'); return; }
  let r = S.solutions.find(s => s.id === it.alvo); if (!r) { toast(`Registro "${it.alvo}" não existe mais na base: complemento ignorado.`); return; }
  const c = { ...candBase(''), ...J(it.rec), fontes: it.rec.fontes }; mergeCand(r, c, { tipo: 'depois', categoria: it.rec.categoria ? 'depois' : 'manter', linha: 'manter' }, { f: 'pacote de referência' });
  setOrPend(r, it.set, 'pacote de referência ' + now); if (it.rec.processos?.length) r.processos = [...new Set([...(r.processos || []), ...it.rec.processos])];
  if (it.rec.financeira) r.financeira = true; if (it.rec.disponibilidade && !r.disponibilidade) r.disponibilidade = it.rec.disponibilidade; solChanged(r, 'complementada (pacote de referência)');
}
function refDiscard(id) { const p = refPending().find(x => x.id === id); if (!p) return; if (p.ai) { const arr = p.kind === 'marco' ? S.marcos : S.regs; const r = arr.find(x => x.id === id); r.st = 'descartado'; histRec(r, 'descartado pelo usuário'); touchG(p.kind === 'marco' ? 'marcos' : 'regulatorio', id); } refDec()[id] = 'descartado'; touchMeta(); render(); }
function refApproveOfficial(only) { // only: Set opcional de ids (ex.: pacote 2024); a mesma rotina atende todos os pontos de acesso
  const L = refPending().filter(p => !p.ai && (!only || only.has(p.id)) && (p.d.fonte?.oficial || p.d.rec?.oficial || (p.d.fonte?.u && isOfficialUrl(p.d.fonte.u)) || (p.d.rec?.fontes || []).some(f => isOfficialUrl(f.u)))); if (!L.length) return toast('Nenhum item pendente com fonte oficial.');
  UI.batch = []; try { L.forEach(p => refApprove(p.id, true)); } finally { const B = UI.batch; UI.batch = null; reanalyzeAll(true, `Base de referência: ${L.length} item(ns) aprovados`);
    B.forEach(([r, motivo]) => Object.values(S.clients).forEach(c => { if ((c.opps || []).some(o => o.sols.some(s => s.id === r.id)) || (c.productsIdent || []).some(p => p.id === r.id)) { c.reviewFlags = [{ solId: r.id, nome: r.nome, rev: r.rev, motivo, at: nowISO() }, ...(c.reviewFlags || []).filter(x => x.solId !== r.id)].slice(0, 20); touchC(c.key); } })); }
  log(`${L.length} item(ns) de fonte oficial aprovados. Itens de fonte secundária continuam pendentes.`, 'ok'); render();
}
function recEdit(col, id, campo, v, motivo) {
  const arr = col === 'marcos' ? S.marcos : S.regs, r = arr.find(x => x.id === id); if (!r) return; const de = getPath(r, campo);
  if (String(de ?? '') === String(v ?? '')) return; if (!String(motivo || '').trim()) return toast('Informe o motivo/fonte da alteração (ex.: prorrogação publicada em …).');
  const ks = campo.split('.'); let o = r; ks.slice(0, -1).forEach(k => o = o[k] ||= {}); o[ks[ks.length - 1]] = v || null; r.consultadoEm = today(); histRec(r, 'alterado', { campo, de: de ?? null, para: v || null, motivo });
  touchG(col, id); reanalyzeAll(true, `${col === 'marcos' ? 'Marco' : 'Evento regulatório'} atualizado: ${campo}`); render();
}
function recNew(col, o) {
  const arr = col === 'marcos' ? S.marcos : S.regs; if (!o.fonteT?.trim()) return toast('Registro sem fonte não é aceito.');
  const base = { id: (col === 'marcos' ? 'mk_' : 'rg_') + uid(), st: 'aprovado', origem: 'registro manual', consultadoEm: today(), fonte: { t: o.fonteT.trim(), u: o.fonteU?.trim() || '', oficial: isOfficialUrl(o.fonteU || '') || /gov\.br|planalto|in\.gov/.test(o.fonteU || '') }, hist: [] };
  const rec = col === 'marcos' ? { ...base, produto: o.produto || 'Protheus', release: o.release, tipo: o.tipo || 'Expiração do release', data: o.data || null, obs: o.obs || '' }
    : { ...base, nome: o.nome, orgao: o.orgao || '', publicacao: o.publicacao || null, vigencia: o.vigencia || null, prazo: o.prazo || null, testes: o.testesIni ? { ini: o.testesIni, fim: o.testesFim || null, desc: 'Período de testes' } : null, criterios: { regimes: o.regimes || [], ufs: o.ufs || [], ops: o.ops || [], nota: o.nota || '' }, acoes: o.acoes || [], confianca: 'média' };
  if (col === 'marcos' && !relKey(rec.release)) return toast('Release inválida (formato 12.1.xxxx).'); if (col === 'regulatorio' && !rec.nome) return toast('Informe a obrigação ou mudança.');
  histRec(rec, 'registrado manualmente'); arr.push(rec); touchG(col, rec.id); reanalyzeAll(true, 'Registro de referência incluído'); UI.refNew = null; render();
}
function recArchive(col, id) { const arr = col === 'marcos' ? S.marcos : S.regs, r = arr.find(x => x.id === id); if (!r) return; r.st = r.st === 'arquivado' ? 'aprovado' : 'arquivado'; histRec(r, r.st === 'arquivado' ? 'arquivado (histórico preservado)' : 'reativado'); touchG(col, id); reanalyzeAll(true, 'Registro de referência ' + r.st); render(); }
function setAlerts(v) { const a = String(v).split(/[,;\s]+/).map(Number).filter(x => x > 0 && x <= 730); if (!a.length) return toast('Informe ao menos um prazo em dias.'); S.meta.alertDays = [...new Set(a)].sort((x, y) => y - x); touchMeta(); reanalyzeAll(true); render(); }
