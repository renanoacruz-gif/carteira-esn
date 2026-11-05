/* ===== CONSOLIDAÇÃO DE REGISTROS: auditoria, mesclagem reversível, log ===== */
/* Regras: só se unifica automaticamente o que é inequívoco. Semelhança de nome = candidato, nunca fusão automática.
   Matriz/filial/grupo econômico (mesma raiz de CNPJ) nunca são mesclados. Toda mesclagem grava snapshot antes e é reversível. */
S.merges = []; S.msnap = [];
const IGN = () => (S.meta.consolIgnore ||= {});
GCOL.consol = { arr: () => S.merges, ref: null, d: new Set(), x: new Set() };
GCOL.consolsnap = { arr: () => S.msnap, ref: null, d: new Set(), x: new Set() };
const MAX_SNAP = 40;
const sigOf = o => { const s = JSON.stringify(o); let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return s.length + ':' + h; };
const isEmptyV = v => v == null || v === '' || (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length);
const completeness = c => (c.code ? 3 : 0) + (c.cnpj ? 3 : 0) + (c.fichas?.length || 0) * 2 + (c.docs?.length || 0) * 2 + Object.keys(c.act || {}).length + (c.contratos?.length || 0) * 2 + (c.mrr != null ? 1 : 0);
const ownerOf = c => norm(c.mgmt?.owner || '');
const ownersOk = (a, b) => { const x = ownerOf(a), y = ownerOf(b); return !x || !y || x === y; };
const mainFirst = (a, b) => completeness(b) > completeness(a) ? [b, a] : [a, b];

/* ---------- Snapshots e log ---------- */
function snapPut(mid, role, data) { const r = { id: mid + '_' + role, merge: mid, role, data: clone(data) }; S.msnap.push(r); touchG('consolsnap', r.id); return r; }
const snapGet = (mid, role) => S.msnap.find(x => x.id === mid + '_' + role)?.data;
function logPut(rec) {
  S.merges.unshift(rec); touchG('consol', rec.id);
  const keep = new Set(S.merges.slice(0, MAX_SNAP).map(x => x.id));
  const exp = S.merges.slice(MAX_SNAP).filter(x => !x.expirado); exp.forEach(x => { x.expirado = true; touchG('consol', x.id); });
  S.msnap.filter(s => !keep.has(s.merge)).forEach(s => { S.msnap.splice(S.msnap.indexOf(s), 1); dropG('consolsnap', s.id); });
}

/* ---------- Auditoria ---------- */
function auditClients() {
  const cs = Object.values(S.clients), auto = [], rev = [], rel = [], paired = new Set();
  const pid = (a, b) => [a.key, b.key].sort().join('|');
  const ign = id => IGN()[id];
  const push = (a, b, why, kind) => { const id = pid(a, b); if (paired.has(id)) return; paired.add(id); const [m, d] = mainFirst(a, b); (kind === 'auto' ? auto : rev).push({ id, main: m.key, dup: d.key, why, kind }); };
  const grp = (f) => { const g = new Map(); cs.forEach(c => { const k = f(c); if (k) (g.get(k) || g.set(k, []).get(k)).push(c); }); return [...g.values()].filter(a => a.length > 1); };
  grp(c => c.cnpj).forEach(a => { const [m, ...rest] = [...a].sort((x, y) => completeness(y) - completeness(x)); rest.forEach(d => {
    if (m.code && d.code && m.code !== d.code) push(m, d, 'mesmo CNPJ com códigos TOTVS diferentes', 'rev');
    else if (!ownersOk(m, d)) push(m, d, 'mesmo CNPJ em carteiras de responsáveis diferentes', 'rev');
    else push(m, d, m.code && d.code ? 'mesmo CNPJ e mesmo código' : 'mesmo CNPJ (um dos registros sem código)', 'auto'); }); });
  grp(c => c.code).forEach(a => { const [m, ...rest] = [...a].sort((x, y) => completeness(y) - completeness(x)); rest.forEach(d => {
    if (m.cnpj && d.cnpj && m.cnpj !== d.cnpj) push(m, d, 'mesmo código TOTVS com CNPJs diferentes (possível filial/grupo)', 'rev');
    else if (!ownersOk(m, d)) push(m, d, 'mesmo código em carteiras de responsáveis diferentes', 'rev');
    else push(m, d, 'mesmo código TOTVS (um dos registros sem CNPJ)', 'auto'); }); });
  grp(c => normName(c.name).length >= 4 ? normName(c.name) : '').forEach(a => { for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) { if (a[i].cnpj && a[j].cnpj && a[i].cnpj !== a[j].cnpj) { const id = pid(a[i], a[j]); if (!paired.has(id)) { paired.add(id); rel.push({ id, a: a[i].key, b: a[j].key, why: 'mesmo nome com CNPJs diferentes — tratados como entidades distintas' }); } } else push(a[i], a[j], 'razão social igual, sem identificador comum que confirme', 'rev'); } });
  grp(c => c.cnpj && c.cnpj.length === 14 ? c.cnpj.slice(0, 8) : '').forEach(a => { for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) if (a[i].cnpj !== a[j].cnpj) { const id = pid(a[i], a[j]); if (!paired.has(id)) { paired.add(id); rel.push({ id, a: a[i].key, b: a[j].key, why: 'mesma raiz de CNPJ (matriz/filial/grupo) — nunca mesclados' }); } } });
  return { auto: auto.filter(x => !ign(x.id)), rev: rev.filter(x => !ign(x.id)), rel, ign: [...auto, ...rev].filter(x => ign(x.id)) };
}
function auditDocs() {
  const auto = [], info = [], rev = [], seen = new Map();
  Object.values(S.clients).forEach(c => { ['docs', 'fichas'].forEach(arr => { const by = new Map(); (c[arr] || []).forEach(x => { if (!x.hash) return; if (by.has(x.hash)) auto.push({ id: `${c.key}|${arr}|${x.id}`, key: c.key, arr, keep: by.get(x.hash).id, drop: x.id, nome: x.name || x.file, why: 'mesmo arquivo reenviado (hash idêntico)' }); else by.set(x.hash, x); (seen.get(x.hash) || seen.set(x.hash, []).get(x.hash)).push(c.key); });
      const names = new Map(); (c[arr] || []).forEach(x => { const n = norm(x.name || x.file || ''); if (n) (names.get(n) || names.set(n, []).get(n)).push(x); }); names.forEach(a => { if (new Set(a.map(x => x.hash)).size > 1) info.push({ key: c.key, nome: a[0].name || a[0].file, n: a.length }); }); }); });
  seen.forEach((ks, h) => { const u = [...new Set(ks)]; if (u.length > 1) rev.push({ hash: h, keys: u }); });
  S.inbox.forEach(it => { const h = (it.doc || it.ficha)?.hash; if (!h) return; const owner = Object.values(S.clients).find(c => [...c.docs, ...c.fichas].some(x => x.hash === h)); if (owner) auto.push({ id: `inbox|${it.id}`, key: owner.key, arr: 'inbox', drop: it.id, nome: it.file, why: `conteúdo idêntico já associado a "${owner.name}"` }); });
  return { auto, info, rev };
}
function auditSols() {
  const out = [], seen = new Set();
  S.solutions.filter(r => !r.arquivado).forEach(r => findDups(r, r.id).forEach(d => { if (d.rec.arquivado) return; const ns = nameSim(r.nome, d.rec.nome), sg = norm(r.sigla || ''), ri = norm(r.refId || ''), idEq = (sg && norm(d.rec.sigla || '') === sg) || (ri && norm(d.rec.refId || '') === ri); if (ns < .9 && !idEq) return; /* URL ou termo em comum, isoladamente, não caracteriza duplicidade */ const id = [r.id, d.rec.id].sort().join('|'); if (seen.has(id) || IGN()[id]) return; seen.add(id); const [m, x] = (r.rev || 0) >= (d.rec.rev || 0) ? [r, d.rec] : [d.rec, r]; out.push({ id, main: m.id, dup: x.id, why: d.why.join('; '), score: d.score }); }));
  return out.sort((a, b) => b.score - a.score);
}
function auditOpps() {
  const over = [], orphan = [], mig = [];
  Object.values(S.clients).forEach(c => {
    const o = c.opps || [], rules = new Set(o.map(x => x.ruleId)), keep = new Set(c.oppKeep || []);
    for (let i = 0; i < o.length; i++) for (let j = i + 1; j < o.length; j++) { const a = o[i], b = o[j]; if (a.tipoBase !== b.tipoBase) continue; const sh = a.sols.filter(s => b.sols.some(t => t.id === s.id)); const pk = [a.ruleId, b.ruleId].sort().join('|'); if (sh.length && !keep.has(pk) && oppAtiva(c, a) && oppAtiva(c, b)) over.push({ key: c.key, cliente: c.name, a: a.ruleId, b: b.ruleId, an: a.nome, bn: b.nome, sols: sh.map(s => s.nome || s.id).slice(0, 3), pk }); }
    Object.entries(c.act || {}).forEach(([id, a]) => { const pre = `opp:${c.key}:`; if (!id.startsWith(pre)) return; const rule = id.slice(pre.length); if (a.mig?.revisar) mig.push({ key: c.key, cliente: c.name, rule, nome: (o.find(x => x.ruleId === rule) || {}).nome || rule, de: a.mig.de }); if (!rules.has(rule) && ((a.valid && a.valid !== 'sugerida') || (a.sit && a.sit !== 'nao_iniciada') || a.nota)) orphan.push({ key: c.key, cliente: c.name, rule, valid: a.valid, sit: a.sit }); });
  });
  return { over, orphan, mig };
}

/* ---------- Mesclagem de clientes ---------- */
const CF_SCALAR = [['name', 'Razão social'], ['cnpj', 'CNPJ'], ['cnpjRaw', 'CNPJ (texto original)'], ['seg', 'Segmento'], ['city', 'Cidade'], ['size', 'Porte'], ['mrr', 'MRR'], ['productsRaw', 'Produtos'], ['churn', 'Churn'], ['nps', 'NPS'], ['uf', 'UF'], ['regime', 'Regime'], ['release', 'Release']];
function fillDeep(t, s, path, conf) {
  Object.entries(s || {}).forEach(([k, v]) => { const p = path ? path + '.' + k : k;
    if (isEmptyV(t[k])) { if (!isEmptyV(v)) t[k] = clone(v); }
    else if (v && typeof v === 'object' && !Array.isArray(v) && typeof t[k] === 'object' && !Array.isArray(t[k])) fillDeep(t[k], v, p, conf);
    else if (!isEmptyV(v) && JSON.stringify(t[k]) !== JSON.stringify(v)) conf.push(p); });
}
function mergeClients(mk, dk, modo = 'manual', motivo = '') {
  const m = S.clients[mk], d = S.clients[dk]; if (!m || !d || mk === dk) return null;
  const id = 'mg_' + uid(), at = nowISO(), conf = [], res = { fichas: 0, docs: 0, decisoes: 0, contratos: 0, conflitos: 0, hashRepetido: 0 };
  snapPut(id, 'main', freezeClient(m)); snapPut(id, 'dup', freezeClient(d));
  const addConf = (campo, de, para) => { m.cadConf = [{ id: 'cf_' + uid(), campo, de: String(de ?? ''), para: String(para ?? ''), fonte: `consolidação com "${d.name}" (${dk})`, at, res: null }, ...(m.cadConf || [])]; res.conflitos++; };
  if (!m.code && d.code) m.code = d.code;
  CF_SCALAR.forEach(([f, l]) => { const a = m[f], b = d[f]; if (isEmptyV(a) && !isEmptyV(b)) m[f] = b; else if (!isEmptyV(a) && !isEmptyV(b) && String(a).trim().toLowerCase() !== String(b).trim().toLowerCase()) addConf(l, a, b); });
  if (d.notes && d.notes !== m.notes) m.notes = [m.notes, d.notes].filter(Boolean).join('\n');
  if (isEmptyV(m.src) && d.src) m.src = d.src;
  const ids = new Set([...(m.fichas || []), ...(m.docs || []), ...(m.cdocs || [])].map(x => x.id)), hashes = new Set([...(m.fichas || []), ...(m.docs || [])].map(x => x.hash).filter(Boolean));
  ['fichas', 'docs', 'cdocs'].forEach(arr => { m[arr] ||= []; (d[arr] || []).forEach(x => { if (x.hash && hashes.has(x.hash)) { res.hashRepetido++; return; } const y = { ...x }; if (ids.has(y.id)) y.id = uid(); ids.add(y.id); if (y.hash) hashes.add(y.hash); m[arr].push(y); if (arr !== 'cdocs') res[arr]++; }); });
  m.mgmt ||= {}; Object.entries(d.mgmt || {}).forEach(([f, v]) => { if (isEmptyV(v)) return; if (isEmptyV(m.mgmt[f])) m.mgmt[f] = v; else if (f !== 'notes' && m.mgmt[f] !== v) m.mgmt.notes = [m.mgmt.notes, `[consolidação] ${f} no registro anterior: ${v}`].filter(Boolean).join('\n'); });
  if (d.mgmt?.notes && m.mgmt.notes !== d.mgmt.notes && !String(m.mgmt.notes || '').includes(d.mgmt.notes)) m.mgmt.notes = [m.mgmt.notes, d.mgmt.notes].filter(Boolean).join('\n');
  /* decisões comerciais: reescreve o id do cliente; em colisão, a mais avançada prevalece e a outra segue no histórico (moveAct) */
  m.act ||= {};
  Object.entries(d.act || {}).forEach(([aid, a]) => { let nid = aid; if (aid.startsWith(`opp:${dk}:`)) nid = `opp:${mk}:` + aid.slice(`opp:${dk}:`.length); else if (aid.endsWith(':' + dk)) nid = aid.slice(0, -dk.length) + mk; res.decisoes++;
    if (!m.act[nid]) { m.act[nid] = { ...a, mig: { ...(a.mig || {}), de: `${a.mig?.de ? a.mig.de + '; ' : ''}consolidação de "${d.name}"`, em: today() } }; }
    else if (nid.startsWith(`opp:${mk}:`)) { const tmp = '__c' + res.decisoes; m.act[`opp:${mk}:${tmp}`] = a; const rule = nid.slice(`opp:${mk}:`.length); moveAct(m, tmp, rule); const x = m.act[nid], lbl = `decisão de "${d.name}"`; if (x.mig) x.mig.de = `consolidação: ${lbl} unificada à decisão existente`; (x.hist || []).forEach(h => { h.mudancas = (h.mudancas || []).map(z => z.replace(`"${tmp}"/"${rule}"`, lbl)); }); }
    else m.act[nid + '#' + dk] = a; });
  cadInit(m); const cc = []; Object.entries(d.cad || {}).forEach(([k, v]) => { if (isEmptyV(m.cad[k]?.v) && !isEmptyV(v?.v)) m.cad[k] = clone(v); else if (!isEmptyV(v?.v) && JSON.stringify(m.cad[k]?.v) !== JSON.stringify(v.v)) cc.push(k); });
  (d.contratos || []).forEach(ct => { const dup = ctFind(m, ct.ident); const n = clone(ct); n.id = 'ct_' + uid(); if (dup) { n.ident = `${ct.ident || 'principal'} (consolidado de ${d.name})`; addConf('Contrato com identificação igual', dup.ident, n.ident); } n.hist = [{ at, acao: `incorporado na consolidação com "${d.name}"` }, ...(n.hist || [])]; m.contratos.push(n); res.contratos++; });
  Object.entries(d.cadDec || {}).forEach(([k, v]) => { if (!m.cadDec[k]) m.cadDec[k] = v; });
  (d.cadConf || []).forEach(x => m.cadConf.push({ ...x, id: 'cf_' + uid() }));
  m.roi ||= []; (d.roi || []).forEach(s => m.roi.push({ ...s, id: m.roi.some(y => y.id === s.id) ? uid() : s.id }));
  ['fis', 'lic', 'cloud', 'rel', 'exec'].forEach(k => { if (!d[k]) return; if (isEmptyV(m[k])) m[k] = clone(d[k]); else fillDeep(m[k], d[k], k, cc); });
  if (cc.length) addConf('Campos divergentes (mantido o registro principal)', cc.slice(0, 12).join(', '), 'valores do registro absorvido preservados no snapshot da consolidação');
  m.fichaErr = [...(m.fichaErr || []), ...(d.fichaErr || [])].slice(0, 30); m.changes = [...(m.changes || []), ...(d.changes || [])].slice(0, 8);
  (d.reviewFlags || []).forEach(f => { if (!(m.reviewFlags ||= []).some(x => x.solId === f.solId)) m.reviewFlags.push(f); });
  m.prevKeys = [...new Set([...(m.prevKeys || []), dk, ...(d.prevKeys || [])])]; m.oppKeep = [...new Set([...(m.oppKeep || []), ...(d.oppKeep || [])])];
  /* vínculos externos */
  const pesqIds = [], inboxIds = [];
  S.pesq.forEach(p => { if (p.alvoKey === dk) { p.alvoKey = mk; pesqIds.push(p.id); touchPes(p.id); } });
  S.inbox.forEach(it => { let ch = false; (it.cands || []).forEach(cd => { if (cd.key === dk) { cd.key = mk; ch = true; } }); if (ch) { inboxIds.push(it.id); touchI(it.id); } });
  let segMoved = false; if (S.meta.segOv?.[dk]) { if (!S.meta.segOv[mk]) { S.meta.segOv[mk] = S.meta.segOv[dk]; segMoved = true; } delete S.meta.segOv[dk]; touchMeta(); }
  if (UI.sel === dk) UI.sel = mk;
  delete S.clients[dk]; delC.add(dk); dirtyC.delete(dk);
  runAnalysis(m, `Consolidação: "${d.name}" unificado a este cliente`); touchC(mk);
  logPut({ id, at, tipo: 'cliente', modo, mainId: mk, dupId: dk, mainNome: m.name, dupNome: d.name, motivo, prevIds: [dk], res, pesqIds, inboxIds, segMoved, afterSig: sigOf(freezeClient(m)), revertido: null });
  return id;
}

/* ---------- Mesclagem de soluções ---------- */
function mergeSolutions(mainId, dupId, modo = 'manual', motivo = '') {
  const m = S.solutions.find(x => x.id === mainId), d = S.solutions.find(x => x.id === dupId); if (!m || !d || m === d) return null;
  const id = 'mg_' + uid(), at = nowISO(); snapPut(id, 'main', m); snapPut(id, 'dup', d);
  const c = clone(d); c.fontes = (c.fontes || []).map(f => ({ ...f, origem: f.origem || 'registro consolidado' })); c.termos = [...new Set([...(c.termos || []), d.nome, d.sigla].filter(Boolean))];
  const r = mergeCand(m, c, { tipo: 'depois', categoria: 'depois', linha: 'depois' }, { f: `consolidação com "${d.nome}"` });
  if (!m.sigla && d.sigla) m.sigla = d.sigla; if (!m.refId && d.refId) m.refId = d.refId;
  m.notasInt = [...(m.notasInt || []), ...(d.notasInt || [])]; m.prevIds = [...new Set([...(m.prevIds || []), d.id, ...(d.prevIds || [])])];
  hist(m, 'consolidado', `Registro "${d.nome}" (${d.id}) unificado; ${r.added} item(ns) incorporado(s)${r.notes.length ? '; ' + r.notes.join('; ') : ''}`);
  d.arquivado = true; d.mescladoEm = m.id; d.rev = (d.rev || 0) + 1; d.atualizadoEm = today(); hist(d, 'mesclado', `Unificado em "${m.nome}" (${m.id}). Registro preservado como arquivado.`);
  Object.values(S.clients).forEach(cl => { (cl.reviewFlags || []).forEach(f => { if (f.solId === d.id) f.solId = m.id; }); (cl.reviewFlags ||= []); cl.reviewFlags = cl.reviewFlags.filter((f, i, a) => a.findIndex(y => y.solId === f.solId) === i); });
  touchSol(m.id); touchSol(d.id);
  const n = solChanged(m, 'consolidada'); reanalyzeAll(true, 'Consolidação de soluções');
  logPut({ id, at, tipo: 'solucao', modo, mainId, dupId, mainNome: m.nome, dupNome: d.nome, motivo, prevIds: [d.id], res: { itens: r.added, clientesSinalizados: n }, afterSig: sigOf(m), revertido: null });
  return id;
}

/* ---------- Duplicidade de documentos (mesmo arquivo reenviado) ---------- */
function dedupDoc(x) {
  const id = 'mg_' + uid(), at = nowISO();
  if (x.arr === 'inbox') { const it = S.inbox.find(i => i.id === x.drop); if (!it) return null; snapPut(id, 'dup', it); S.inbox = S.inbox.filter(i => i !== it); delI.add(it.id); dirtyI.delete(it.id); }
  else { const c = S.clients[x.key], e = c?.[x.arr]?.find(y => y.id === x.drop); if (!e) return null; snapPut(id, 'dup', e); c[x.arr] = c[x.arr].filter(y => y !== e); touchC(c.key); runAnalysis(c, 'Consolidação: arquivo duplicado removido'); }
  logPut({ id, at, tipo: 'documento', modo: 'auto', mainId: x.key, dupId: x.drop, mainNome: S.clients[x.key]?.name || '', dupNome: x.nome, motivo: x.why, arr: x.arr, prevIds: [x.drop], res: {}, revertido: null });
  return id;
}

/* ---------- Reversão ---------- */
function mergeStale(g) {
  if (g.tipo === 'cliente') { const m = S.clients[g.mainId]; return !m || sigOf(freezeClient(m)) !== g.afterSig; }
  if (g.tipo === 'solucao') { const m = S.solutions.find(x => x.id === g.mainId); return !m || sigOf(m) !== g.afterSig; }
  return false;
}
function revertMerge(id) {
  const g = S.merges.find(x => x.id === id); if (!g || g.revertido || g.expirado) return false;
  if (g.tipo === 'cliente') {
    const sm = snapGet(id, 'main'), sd = snapGet(id, 'dup'); if (!sm || !sd) return false;
    S.clients[g.mainId] = clone(sm); S.clients[g.dupId] = clone(sd); delC.delete(g.dupId); touchC(g.mainId); touchC(g.dupId);
    (g.pesqIds || []).forEach(pid => { const p = S.pesq.find(x => x.id === pid); if (p) { p.alvoKey = g.dupId; touchPes(pid); } });
    (g.inboxIds || []).forEach(iid => { const it = S.inbox.find(x => x.id === iid); if (it) { (it.cands || []).forEach(cd => { if (cd.key === g.mainId) cd.key = g.dupId; }); touchI(iid); } });
    if (g.segMoved) { S.meta.segOv[g.dupId] = S.meta.segOv[g.mainId]; delete S.meta.segOv[g.mainId]; touchMeta(); }
    runAnalysis(S.clients[g.mainId]); runAnalysis(S.clients[g.dupId]);
  } else if (g.tipo === 'solucao') {
    const sm = snapGet(id, 'main'), sd = snapGet(id, 'dup'); if (!sm || !sd) return false;
    [sm, sd].forEach(s => { const i = S.solutions.findIndex(x => x.id === s.id); if (i >= 0) S.solutions[i] = clone(s); else S.solutions.push(clone(s)); touchSol(s.id); });
    reanalyzeAll(true, 'Reversão de consolidação de soluções');
  } else if (g.tipo === 'documento') {
    const e = snapGet(id, 'dup'); if (!e) return false;
    if (g.arr === 'inbox') { if (!S.inbox.some(i => i.id === e.id)) { S.inbox.push(clone(e)); touchI(e.id); } }
    else { const c = S.clients[g.mainId]; if (!c) return false; (c[g.arr] ||= []).push(clone(e)); touchC(c.key); runAnalysis(c, 'Reversão: arquivo restaurado'); }
  }
  g.revertido = nowISO(); touchG('consol', g.id); return true;
}

/* ---------- Execução ---------- */
function consolAuto() {
  const ac = auditClients().auto, ad = auditDocs().auto; let nc = 0, nd = 0;
  ad.forEach(x => { if (dedupDoc(x)) nd++; });
  ac.forEach(x => { if (S.clients[x.main] && S.clients[x.dup] && mergeClients(x.main, x.dup, 'auto', x.why)) nc++; });
  return { nc, nd };
}

/* ---------- Interface ---------- */
const cName = k => S.clients[k]?.name || k;
const cLine = c => `<b>${esc(c.name)}</b> <span class="muted sm">${esc(c.code || 'sem código')} • ${c.cnpj ? esc(c.cnpj) : 'sem CNPJ'} • resp.: ${esc(c.mgmt?.owner || '—')} • ${(c.fichas?.length || 0) + (c.docs?.length || 0)} arquivo(s)</span>`;
function vConsol() {
  const C = auditClients(), D = auditDocs(), Sx = auditSols(), O = auditOpps();
  const nAuto = C.auto.length + D.auto.length, nRev = C.rev.length + Sx.length + O.over.length + O.orphan.length + O.mig.length;
  let h = `<div class="card"><h2>Consolidação de registros</h2><p class="sm">Auditoria de duplicidades em clientes, documentos, soluções e oportunidades. Só se unifica automaticamente o inequívoco (mesmo CNPJ/código, mesmo arquivo). Semelhança de nome é apenas candidata. Matriz, filial e grupo econômico nunca são mesclados. Toda mesclagem guarda um snapshot e pode ser revertida.</p>
  <div class="row"><span>${pill(nAuto + ' unificação(ões) segura(s)', nAuto ? 'info' : 'off')}</span><span>${pill(nRev + ' caso(s) para revisão', nRev ? 'warn' : 'off')}</span><span class="sp"></span><button class="btn ghost" data-a="expJSON" ${clients().length ? '' : 'disabled'}>Baixar backup</button><button class="btn pri" data-a="csAuto1" ${nAuto ? '' : 'disabled'}>Executar unificações seguras</button></div></div>`;
  /* clientes */
  h += `<div class="card"><h3>Clientes <span class="muted sm">${C.auto.length} segura(s) • ${C.rev.length} para revisão • ${C.rel.length} relacionado(s) sem mesclagem</span></h3>`;
  if (!C.auto.length && !C.rev.length) h += `<p class="sm muted">Nenhuma duplicidade de cliente encontrada.</p>`;
  C.auto.forEach(x => h += `<div class="card" style="margin:6px 0;border-left:4px solid var(--ok)"><div class="sm">${pill('segura', 'ok')} ${esc(x.why)}</div><div class="sm">Principal: ${cLine(S.clients[x.main])}<br>Absorvido: ${cLine(S.clients[x.dup])}</div></div>`);
  C.rev.forEach(x => { const a = S.clients[x.main], b = S.clients[x.dup]; h += `<div class="card" style="margin:6px 0;border-left:4px solid var(--lar)"><div class="sm">${pill('revisar', 'warn')} ${esc(x.why)}</div><div class="sm">A: ${cLine(a)}<br>B: ${cLine(b)}</div><div class="row"><button class="btn ghost" data-a="csMergeC" data-m="${esc(a.key)}" data-d="${esc(b.key)}" data-w="${esc(x.why)}">Manter A e absorver B</button><button class="btn ghost" data-a="csMergeC" data-m="${esc(b.key)}" data-d="${esc(a.key)}" data-w="${esc(x.why)}">Manter B e absorver A</button><button class="btn ghost" data-a="csIgn" data-id="${esc(x.id)}">São registros distintos</button></div></div>`; });
  if (C.rel.length) h += `<details><summary class="sm muted">Relacionados mantidos separados (${C.rel.length})</summary><ul class="sm">${C.rel.slice(0, 60).map(x => `<li>${esc(cName(x.a))} × ${esc(cName(x.b))} — ${esc(x.why)}</li>`).join('')}</ul></details>`;
  if (C.ign.length) h += `<details><summary class="sm muted">Marcados como distintos (${C.ign.length})</summary><ul class="sm">${C.ign.map(x => `<li>${esc(cName(x.main))} × ${esc(cName(x.dup))} <a href="#" data-a="csUnign" data-id="${esc(x.id)}">reconsiderar</a></li>`).join('')}</ul></details>`;
  h += `</div>`;
  /* documentos */
  h += `<div class="card"><h3>Documentos <span class="muted sm">${D.auto.length} reenvio(s) idêntico(s) • ${D.info.length} nome(s) com versões diferentes • ${D.rev.length} em mais de um cliente</span></h3>`;
  if (!D.auto.length && !D.info.length && !D.rev.length) h += `<p class="sm muted">Nenhum documento duplicado.</p>`;
  if (D.auto.length) h += `<ul class="sm">${D.auto.slice(0, 40).map(x => `<li>${esc(x.nome)} — ${esc(cName(x.key))}: ${esc(x.why)}</li>`).join('')}</ul>`;
  if (D.info.length) h += `<p class="sm muted">Versões/competências diferentes com o mesmo nome são preservadas: ${D.info.slice(0, 8).map(x => `${esc(x.nome)} (${esc(cName(x.key))}, ${x.n})`).join('; ')}${D.info.length > 8 ? '…' : ''}</p>`;
  if (D.rev.length) h += `<p class="sm muted">Mesmo arquivo em clientes diferentes (não alterado, pode ser legítimo): ${D.rev.slice(0, 6).map(x => x.keys.map(cName).map(esc).join(' + ')).join('; ')}</p>`;
  h += `</div>`;
  /* soluções */
  h += `<div class="card"><h3>Base de Soluções <span class="muted sm">${Sx.length} candidata(s) — nunca unificadas automaticamente</span></h3>`;
  if (!Sx.length) h += `<p class="sm muted">Nenhum par de soluções com alta semelhança.</p>`;
  Sx.slice(0, 40).forEach(x => { const a = S.solutions.find(r => r.id === x.main), b = S.solutions.find(r => r.id === x.dup); h += `<div class="card" style="margin:6px 0;border-left:4px solid var(--lar)"><div class="sm">${pill(Math.round(x.score * 100) + '%', 'warn')} ${esc(x.why)}</div><div class="sm"><b>${esc(a.nome)}</b> <span class="muted">${esc(a.linha || '')} • rev ${a.rev || 0} • ${(a.fontes || []).length} fonte(s)</span><br><b>${esc(b.nome)}</b> <span class="muted">${esc(b.linha || '')} • rev ${b.rev || 0} • ${(b.fontes || []).length} fonte(s)</span></div><div class="row"><button class="btn ghost" data-a="csMergeS" data-m="${esc(a.id)}" data-d="${esc(b.id)}" data-w="${esc(x.why)}">Manter “${esc(a.nome.slice(0, 28))}”</button><button class="btn ghost" data-a="csMergeS" data-m="${esc(b.id)}" data-d="${esc(a.id)}" data-w="${esc(x.why)}">Manter “${esc(b.nome.slice(0, 28))}”</button><button class="btn ghost" data-a="csIgn" data-id="${esc(x.id)}">São distintas</button></div></div>`; });
  h += `</div>`;
  /* oportunidades */
  h += `<div class="card"><h3>Oportunidades e decisões <span class="muted sm">${O.over.length} sobreposição(ões) • ${O.orphan.length} decisão(ões) sem oportunidade atual • ${O.mig.length} migrada(s) a revisar</span></h3><p class="sm muted">Oportunidades são recalculadas por um único motor; decisões comerciais (validações, descartes, contratações) ficam em um só registro por oportunidade e nunca são apagadas.</p>`;
  if (!O.over.length && !O.orphan.length && !O.mig.length) h += `<p class="sm muted">Nada a revisar.</p>`;
  O.over.slice(0, 30).forEach(x => h += `<div class="sm" style="margin:6px 0"><b>${esc(x.cliente)}</b>: “${esc(x.an)}” × “${esc(x.bn)}” compartilham ${esc(x.sols.join(', '))}. <button class="btn ghost" data-a="csKeep" data-k="${esc(x.key)}" data-id="${esc(x.pk)}">Escopos distintos — manter separadas</button></div>`);
  O.orphan.slice(0, 30).forEach(x => h += `<div class="sm" style="margin:6px 0"><b>${esc(x.cliente)}</b>: decisão (${esc(x.valid || 'sugerida')}/${esc(x.sit || 'nao_iniciada')}) em “${esc(x.rule)}” preservada, sem oportunidade correspondente na análise atual.</div>`);
  O.mig.slice(0, 30).forEach(x => h += `<div class="sm" style="margin:6px 0"><b>${esc(x.cliente)}</b>: “${esc(x.nome)}” — migrado de ${esc(x.de)}. <button class="btn ghost" data-a="csMigOk" data-k="${esc(x.key)}" data-id="${esc(x.rule)}">Marcar como revisado</button></div>`);
  h += `</div>`;
  /* log */
  h += `<div class="card"><h3>Histórico de consolidações <span class="muted sm">${S.merges.length}</span></h3>`;
  if (!S.merges.length) h += `<p class="sm muted">Nenhuma consolidação realizada.</p>`;
  S.merges.slice(0, 40).forEach(g => { const stale = UI.confirm === 'rv:' + g.id && mergeStale(g);
    h += `<div class="sm" style="margin:6px 0;border-bottom:1px solid var(--bd);padding-bottom:6px">${pill(g.tipo, 'info')} ${pill(g.modo === 'auto' ? 'automática' : 'manual', g.modo === 'auto' ? 'ok' : 'off')} <b>${esc(g.dupNome)}</b> → <b>${esc(g.mainNome)}</b> <span class="muted">${esc(fmtDate(g.at))} • ID anterior: ${esc((g.prevIds || []).join(', '))}${g.motivo ? ' • ' + esc(g.motivo) : ''}${g.tipo === 'cliente' ? ` • ${g.res.fichas} ficha(s), ${g.res.docs} doc(s), ${g.res.decisoes} decisão(ões), ${g.res.contratos} contrato(s), ${g.res.conflitos} conflito(s) p/ revisão` : ''}</span> `
      + (g.revertido ? pill('revertida ' + fmtDate(g.revertido), 'off') : g.expirado ? pill('snapshot expirado', 'off') : UI.confirm === 'rv:' + g.id ? `<button class="btn dng" data-a="csRev" data-id="${esc(g.id)}">Confirmar reversão${stale ? ' (descarta alterações posteriores)' : ''}</button><button class="btn ghost" data-a="csRev0">Cancelar</button>` : `<button class="btn ghost" data-a="csRev1" data-id="${esc(g.id)}">Reverter</button>${stale ? ' <span class="muted">alterado após a mesclagem</span>' : ''}`) + `</div>`; });
  return h + `</div>`;
}
const CONSOL_ACT = {
  csAuto1: () => { UI.confirm = 'csauto'; render(); }, csAuto0: () => { UI.confirm = null; render(); },
  csAuto2: () => { UI.confirm = null; exportJSON(); const r = consolAuto(); toast(`Unificado: ${r.nc} cliente(s), ${r.nd} arquivo(s) duplicado(s). Backup baixado; reversão disponível no histórico.`); log(`Consolidação automática: ${r.nc} cliente(s), ${r.nd} documento(s).`, 'ok'); render(); },
  csMergeC: t => { if (mergeClients(t.dataset.m, t.dataset.d, 'manual', t.dataset.w)) toast('Clientes unificados. Reversível no histórico.'); render(); },
  csMergeS: t => { if (mergeSolutions(t.dataset.m, t.dataset.d, 'manual', t.dataset.w)) toast('Soluções unificadas (registro absorvido arquivado e preservado).'); render(); },
  csIgn: t => { IGN()[t.dataset.id] = nowISO(); touchMeta(); render(); },
  csUnign: (t, e) => { e.preventDefault(); delete IGN()[t.dataset.id]; touchMeta(); render(); },
  csKeep: t => { const c = S.clients[t.dataset.k]; if (!c) return; c.oppKeep = [...new Set([...(c.oppKeep || []), t.dataset.id])]; touchC(c.key); render(); },
  csMigOk: t => { const c = S.clients[t.dataset.k], a = c?.act?.[oppRid(c.key, t.dataset.id)]; if (a?.mig) { a.mig.revisar = false; a.mig.revisadoEm = today(); touchC(c.key); } render(); },
  csRev1: t => { UI.confirm = 'rv:' + t.dataset.id; render(); }, csRev0: () => { UI.confirm = null; render(); },
  csRev: t => { UI.confirm = null; toast(revertMerge(t.dataset.id) ? 'Mesclagem revertida.' : 'Não foi possível reverter (snapshot indisponível).'); render(); },
};
