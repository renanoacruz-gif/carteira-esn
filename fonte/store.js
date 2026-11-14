/* ===== ESTADO, PERSISTÊNCIA, IMPORTAÇÃO, EXPORTAÇÃO ===== */
const S = { meta: { lastAnalysis: null, weights: { ...DEF_WEIGHTS }, files: [], segOv: {}, act: {}, mapping: null }, clients: {}, inbox: [], kbExtra: { solutions: [] }, solutions: seedSolutions(), pesq: [], marcos: [], regs: [], intlog: [], cnpj: [], insights: [], ocr: [], ocrimg: [] };
const UI = { view: 'importar', sel: null, f: { q: '', seg: '', doc: '', fs: '', prio: '', conf: '', dq: '', sort: 'score' }, lim: 200, wiz: null, log: [], segSel: null, plan: { q: '', st: '', tipo: '', prio: '' }, comp: '', persist: 'memória (sem persistência neste ambiente)', busy: '', fb: null, confirm: null, solSel: null, solEdit: null, solImp: null, solFeed: (() => { try { return localStorage.getItem('gc_solfeed') === '1' || navigator.webdriver === true; } catch { return false; } })(), solQ: '', solF: { tipo: '', st: '', arq: '', rs: '', grupo: '' }, pesqSel: null };
let META = null, CL = null, INB = null, DL = null, SOL = null, PES = null, SOLC = null, SNOTE = null, SCONT = null;
const ME = { id: '', nome: '', ok: false }; /* conta ativa (identidade da plataforma) */
const GCOL = { marcos: { arr: () => S.marcos, ref: null, d: new Set(), x: new Set() }, regulatorio: { arr: () => S.regs, ref: null, d: new Set(), x: new Set() }, integlog: { arr: () => S.intlog, ref: null, d: new Set(), x: new Set() }, cnpj: { arr: () => S.cnpj, ref: null, d: new Set(), x: new Set() }, insights: { arr: () => S.insights, ref: null, d: new Set(), x: new Set() }, ocr: { arr: () => S.ocr, ref: null, d: new Set(), x: new Set() }, ocrimg: { arr: () => S.ocrimg, ref: null, d: new Set(), x: new Set() } };
function touchG(col, id) { GCOL[col].d.add(id); GCOL[col].x.delete(id); sched(); }
function dropG(col, id) { GCOL[col].d.delete(id); GCOL[col].x.add(id); sched(); }
/* Item 24: as imagens do OCR/prints (coleção ocrimg, em partes) NÃO são lidas na abertura; cada imagem é lida só quando alguém a usa (ver original, ampliar, enviar ao OCR), por partes `${rec.id}_${i}` (rec.n). */
const OCI = { p: new Map(), falha: new Set() };
const ocrimgOk = rec => { if (!rec || !rec.n) return true; let k = 0; for (const x of S.ocrimg) if (x.ocrId === rec.id) k++; return k >= rec.n; };
function ocrimgEnsure(rec) {
  if (ocrimgOk(rec)) return Promise.resolve(true);
  if (OCI.p.has(rec.id)) return OCI.p.get(rec.id);
  const ep = DM.epoch, ref = GCOL.ocrimg.ref, have = new Set(S.ocrimg.map(x => x.id)), ids = [];
  for (let i = 0; i < rec.n; i++) { const id = `${rec.id}_${i}`; if (!have.has(id) && !GCOL.ocrimg.x.has(id)) ids.push(id); }
  OCI.falha.delete(rec.id);
  const p = (async () => {
    try {
      const got = await poolRun(ids.map(id => () => wto(ref.doc(id).get(), 20000)), 5);
      if (ep !== DM.epoch) return false;
      const ja = new Set(S.ocrimg.map(x => x.id));
      got.forEach(d => { if (d && d.exists) { const v = clone(d.data()); if (v && !ja.has(v.id)) { ja.add(v.id); S.ocrimg.push(v); } } });
      const ok = ocrimgOk(rec); if (!ok) OCI.falha.add(rec.id); return ok;
    } catch (e) { OCI.falha.add(rec.id); throw e; } finally { OCI.p.delete(rec.id); }
  })();
  OCI.p.set(rec.id, p); return p;
}
const ocrimgDrop = rec => { for (let i = 0; i < (rec.n || 0); i++) dropG('ocrimg', `${rec.id}_${i}`); S.ocrimg.filter(x => x.ocrId === rec.id).forEach(x => dropG('ocrimg', x.id)); S.ocrimg = S.ocrimg.filter(x => x.ocrId !== rec.id); };
const dirtyC = new Set(), delC = new Set(), dirtyI = new Set(), delI = new Set(), dirtyS = new Set(), delS = new Set(), dirtyP = new Set(), delP = new Set(); let dirtyMeta = false, saving = false, timer = null;
const wto = (p, ms) => Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error('tempo esgotado')), ms))]);
const clone = o => JSON.parse(JSON.stringify(o));
const log = (t, k = '') => { UI.log.unshift({ t, k, at: new Date().toLocaleTimeString('pt-BR') }); UI.log = UI.log.slice(0, 80); };

function freezeClient(c) {
  const o = clone({ foraPlanilha: c.foraPlanilha || null, key: c.key, code: c.code, name: c.name, cnpj: c.cnpj, cnpjRaw: c.cnpjRaw, seg: c.seg, city: c.city, size: c.size, mrr: c.mrr, productsRaw: c.productsRaw, churn: c.churn, nps: c.nps, notes: c.notes, custom: c.custom || [], edits: c.edits || {}, usoConf: c.usoConf || {}, site: c.site || '', fatos: c.fatos || [], sugFatos: c.sugFatos || [], semIA: c.semIA || null, aval: c.aval || {}, valid: c.valid || {}, dorHip: c.dorHip || [], dtConf: c.dtConf || {}, src: c.src, fichas: c.fichas, docs: (c.docs || []).filter(d => !d.prv), prFill: c.prFill || {}, prImp: c.prImp || [], mgmt: c.mgmt, act: c.act, uf: c.uf, regime: c.regime, release: c.release, lic: c.lic, cloud: c.cloud, rel: c.rel, fis: c.fis, roi: c.roi, exec: c.exec, cdocs: c.cdocs, iid: c.iid, ext: c.ext || {}, cad: c.cad || {}, contratos: c.contratos || [], cadDec: c.cadDec || {}, cadConf: c.cadConf || [], cnpjCad: c.cnpjCad || null, insRef: c.insRef || [], fichaErr: c.fichaErr || [], lastChange: c.lastChange || null, changes: c.changes || [], reviewFlags: c.reviewFlags || [], prevKeys: c.prevKeys || [], oppKeep: c.oppKeep || [], emp: c.emp || null, gst: c.gst || null, ptRes: c.ptRes || null });
  let n = JSON.stringify(o).length;
  if (n > 235000) { o.docs.forEach(d => d.text = d.text.slice(0, 3000)); (o.cdocs || []).forEach(d => d.text = d.text.slice(0, 3000)); o.docTrunc = true; n = JSON.stringify(o).length; }
  if (n > 235000 && o.lic?.matriz?.rows) { o.lic.matriz.rows = o.lic.matriz.rows.slice(0, 150); o.lic.matriz.trunc = true; n = JSON.stringify(o).length; }
  if (n > 235000) { o.fichas.forEach(f => { if (f.tab) { f.tab.sheets.forEach(s => { s.rows = s.rows.slice(0, 80); s.trunc = true; }); } }); n = JSON.stringify(o).length; }
  if (n > 235000) { o.fichas.forEach(f => f.items = f.items.slice(0, 60)); o.fichaTrunc = true; }
  return o;
}
function touchC(k) { dirtyC.add(k); delC.delete(k); sched(); }
function touchMeta() { dirtyMeta = true; sched(); }
function touchI(id) { dirtyI.add(id); delI.delete(id); sched(); }
function touchSol(id) { dirtyS.add(id); delS.delete(id); sched(); }
function touchPes(id) { dirtyP.add(id); delP.delete(id); sched(); }
function sched() { clearTimeout(timer); timer = setTimeout(flush, DM_DELAY); }
const DM_DELAY = 300; /* atraso curto de gravação; além disso grava ao ocultar/fechar a página */
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && META) { clearTimeout(timer); flush(); } });
addEventListener('pagehide', () => { if (META) { clearTimeout(timer); flush(); } });
/* Concorrência limitada (D1/Worker): processa fns com até `conc` em voo; após o 1º erro não inicia novas, aguarda as em voo e propaga o 1º erro (sem rejeição solta). */
async function poolRun(fns, conc = 5) {
  const out = new Array(fns.length); let i = 0, err = null, bad = false;
  await Promise.all(Array.from({ length: Math.min(conc, fns.length) }, async () => { while (!bad && i < fns.length) { const j = i++; try { out[j] = await fns[j](); } catch (e) { if (!bad) { bad = true; err = e; } } } }));
  if (bad) throw err; return out;
}
async function flush() {
  if (!META) return; if (saving) { sched(); return; } saving = true;
  try {
    let left = dirtyC.size + delC.size + Object.values(GCOL).reduce((n, g) => n + (g.ref ? g.d.size + g.x.size : 0), 0);
    const tick = () => { if (--left >= 0 && total > 5) { UI.persist = `salvando ${left}…`; paintStatus(); } }, total = left; if (total > 5) { UI.persist = `salvando ${total}…`; paintStatus(); }
    await poolRun([
      ...[...dirtyC].map(k => async () => { dirtyC.delete(k); if (S.clients[k]) { try { await CL.doc(k).set(freezeClient(S.clients[k])); } catch (e) { dirtyC.add(k); throw e; } } tick(); }),
      ...[...delC].map(k => async () => { delC.delete(k); try { await CL.doc(k).delete(); } catch (e) { delC.add(k); throw e; } tick(); })
    ]);
    for (const id of [...dirtyI]) { dirtyI.delete(id); const it = S.inbox.find(x => x.id === id); if (it) await INB.doc(id).set(clone(it)); }
    for (const id of [...delI]) { delI.delete(id); try { await INB.doc(id).delete(); } catch (e) { delI.add(id); throw e; } }
    for (const id of [...dirtyS]) { dirtyS.delete(id); const r = S.solutions.find(x => x.id === id); if (r) { try { await pushSol(r); } catch (e) { dirtyS.add(id); throw e; } } }
    for (const id of [...delS]) { delS.delete(id); if (SOL) await SOL.doc(id).delete(); } /* só o espaço privado: o catálogo compartilhado nunca é apagado por esta rotina */
    for (const id of [...dirtyP]) { dirtyP.delete(id); const r = S.pesq.find(x => x.id === id); if (r && PES) await PES.doc(id).set(clone(r)); }
    for (const id of [...delP]) { delP.delete(id); try { if (PES) await PES.doc(id).delete(); } catch (e) { delP.add(id); throw e; } }
    await poolRun(Object.values(GCOL).filter(g => g.ref).flatMap(g => [
      ...[...g.d].map(id => async () => { g.d.delete(id); const r = g.arr().find(x => x.id === id); if (r) { try { await g.ref.doc(id).set(clone(r)); } catch (e) { g.d.add(id); throw e; } } tick(); }),
      ...[...g.x].map(id => async () => { g.x.delete(id); try { await g.ref.doc(id).delete(); } catch (e) { g.x.add(id); throw e; } tick(); })
    ]));
    if (dirtyMeta) { dirtyMeta = false; await META.set(clone({ meta: { ...S.meta, files: S.meta.files.slice(-400) }, kbExtra: S.kbExtra })); }
    UI.persist = 'salvo (carteira privada + catálogo compartilhado)';
  } catch (e) { UI.persist = 'ERRO ao salvar: ' + (e.code === 'tempo_esgotado' ? e.message : (e.code || e.message)); toast('Falha ao salvar: ' + (e.message || e.code)); }
  saving = false; paintStatus();
}
async function initStore() {
  try { DL = window.claude ? await wto(claude.use('downloads'), 10000) : null; } catch { DL = null; }
  try {
    if (!window.claude) throw new Error('sem runtime');
    const [db, user] = await Promise.all([wto(claude.use('db'), 10000), wto(claude.use('user'), 10000)]);
    const id = user && await wto(user.id(), 10000);
    if (db && id) {
      ME.id = id; ME.ok = true; await meLoad(user); SOLC = db.collection('catalogo');
      META = db.doc('data/users/' + id + '/carteira'); CL = META.collection('clientes'); INB = META.collection('inbox'); SOL = META.collection('solucoes'); PES = META.collection('pesquisas'); GCOL.marcos.ref = META.collection('marcos'); GCOL.regulatorio.ref = META.collection('regulatorio'); GCOL.consol.ref = META.collection('consolidacoes'); GCOL.consolsnap.ref = META.collection('consolidacoes_snap'); SNOTE = META.collection('solnotas'); GCOL.integlog.ref = META.collection('integ_log'); GCOL.cnpj.ref = META.collection('cnpj'); GCOL.insights.ref = META.collection('insights'); GCOL.ocr.ref = META.collection('ocr'); GCOL.ocrimg.ref = META.collection('ocrimg'); SCONT = window.__HOSTED__ ? db.collection('catalogo_conteudo') : META.collection('solconteudo');
      /* leituras em paralelo (máx. 5 em voo); tudo é aplicado só depois que todas concluem, na ordem original — falha em qualquer uma mantém o comportamento anterior (modo memória) */
      const T = 10000, G = k => () => wto(GCOL[k].ref.get(), T), byAt = (a, b) => (b.at || '').localeCompare(a.at || ''), docs = q => q.docs.map(d => clone(d.data()));
      const [m, cl, inb, cat, priv, notes, pes, marcos, regs, merges, msnap, intlog, cnpj, insights, ocr] = await poolRun([
        () => wto(META.get(), T), () => wto(CL.get(), T), () => wto(INB.get(), T), () => wto(SOLC.get(), T), () => wto(SOL.get(), T), () => wto(SNOTE.get(), T).catch(() => null), () => wto(PES.get(), T),
        G('marcos'), G('regulatorio'), G('consol'), G('consolsnap'), G('integlog'), G('cnpj'), G('insights'), G('ocr')
      ], 5);
      if (m.exists) { const d = clone(m.data()); Object.assign(S.meta, d.meta || {}); S.meta.weights = { ...DEF_WEIGHTS, ...(S.meta.weights || {}) }; S.meta.files ||= []; S.meta.segOv ||= {}; S.meta.act ||= {}; S.kbExtra = d.kbExtra || { solutions: [] }; }
      cl.docs.forEach(d => { const c = clone(d.data()); S.clients[c.key] = c; });
      S.inbox = docs(inb);
      loadSolutions(catalogBuild(cat, priv, notes));
      S.pesq = docs(pes).sort(byAt);
      S.marcos = docs(marcos); S.regs = docs(regs); S.merges = docs(merges).sort(byAt); S.msnap = docs(msnap); S.intlog = docs(intlog).sort(byAt); S.cnpj = docs(cnpj).sort(byAt); S.insights = docs(insights).sort(byAt); S.ocr = docs(ocr).sort(byAt); S.ocrimg = []; /* imagens: sob demanda (ocrimgEnsure) */ ensureIids();
      UI.persist = 'salvo (carteira privada + catálogo compartilhado)';
      catalogWatch(); reanalyzeAll(false); setTimeout(() => { try { radarAuto(); } catch { } }, 4000);
      if (Object.keys(S.clients).length) UI.view = 'geral';
    } else { UI.persist = 'memória (db indisponível: use Backup JSON)'; loadSolutions([]); }
  } catch (e) { META = null; SOL = PES = null; loadSolutions([]); UI.persist = 'memória (db indisponível: ' + e.message + ') — use Backup JSON'; }
  render(); setTimeout(() => vendPrefetch('xlsx'), 3000);
}
function runAnalysis(c, reason) {
  c.fichas ||= []; c.docs ||= []; c.mgmt ||= {}; c.act ||= {}; c.fichaErr ||= []; c.changes ||= []; c.reviewFlags ||= []; c.iid ||= 'cli_' + uid(); c.ext ||= {};
  if (typeof prSyncDocs === 'function') prSyncDocs(c); const before = reason && c.opps ? snapOf(c) : null; analyzeClient(c, S);
  if (before) { const items = diffSnap(before, snapOf(c)); if (items.length) { c.lastChange = { at: new Date().toISOString(), reason, items }; c.changes = [c.lastChange, ...c.changes].slice(0, 8); } }
}
function reanalyzeAll(stamp = true, reason = '') { Object.values(S.clients).forEach(c => { runAnalysis(c, reason); if (reason) touchC(c.key); }); if (stamp) { S.meta.lastAnalysis = new Date().toISOString(); touchMeta(); } }
function reanalyze(keys, reason = '') { keys.forEach(k => { if (S.clients[k]) { runAnalysis(S.clients[k], reason); touchC(k); } }); S.meta.lastAnalysis = new Date().toISOString(); touchMeta(); }
function setRefComp(v) { if (v && !/^\d{4}-(0[1-9]|1[0-2])$/.test(v)) return toast('Competência inválida (use AAAA-MM).'); S.meta.refComp = v || ''; reanalyzeAll(true); render(); }
function idx() { return buildIndex(S.clients); }

/* ---------- Carteira ---------- */
async function loadPortfolio(file) {
  try {
    UI.busy = 'Lendo ' + file.name + '…'; render();
    const buf = await readBuf(file); const t = await readTable(file, buf);
    const sheets = t.sheets.filter(s => s.rows.some(r => r.some(c => String(c).trim() !== '')));
    if (!sheets.length) throw new Error('Arquivo sem dados.');
    if (empPreparar(file.name, sheets, true)) { log(`"${file.name}" reconhecida como exportação Clientes_ESN do Empodera: encaminhada para Carteira & MRR.`, 'ok'); UI.busy = ''; UI.view = 'mrr'; render(); return; }
    const si = 0, h = detectHeader(sheets[si].rows);
    UI.wiz = { name: file.name, sheets, si, h, map: autoMap((sheets[si].rows[h] || []).map(String)) };
    log(`Carteira "${file.name}" lida: ${sheets.length} aba(s). Confira o mapeamento de colunas.`, 'ok');
  } catch (e) { log('✖ ' + file.name + ': ' + e.message, 'bad'); toast(e.message); }
  UI.busy = ''; render();
}
function normCnpj(raw) { let d = digits(raw); if (d.length === 13 && validCnpj('0' + d)) d = '0' + d; return d; }

/* ---------- Documentos ---------- */
const extOf = n => (n.split('.').pop() || '').toLowerCase();
function tableUnits(sh) {
  const h = detectHeader(sh.rows), hdr = (sh.rows[h] || []).map(x => norm(x)), mc = hdr.map(x => /valor|pre[cç]o|total|mensal|r\$|desconto|imposto|l[ií]quido|montante|\bval\b|val_|vlr|vl_|liqd|unit/.test(x));
  const fmt = (v, ci) => v instanceof Date ? v.toLocaleDateString('pt-BR') : typeof v === 'number' ? ((mc[ci] || !Number.isInteger(v)) ? v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(v)) : String(v ?? '').trim();
  return sh.rows.map((r, i) => { const cells = r.map(fmt).filter(x => x !== ''); if (!cells.length) return null; const text = cells.join('   '); return { lines: [{ text, loc: `aba ${sh.name} • linha ${i + 1}` }], text }; }).filter(Boolean);
}
/* Instantâneo tabular da ficha (XLSX/CSV): mantém colunas e valores brutos para o briefing pré-reunião. Limites: 300 linhas × 24 colunas por aba. */
function tabSnap(sheets) {
  const cell = v => v instanceof Date ? v.toISOString().slice(0, 10) : typeof v === 'number' ? v : String(v ?? '').trim().slice(0, 120);
  return { sheets: sheets.map(sh => { const h = detectHeader(sh.rows), rows = []; let trunc = false;
    sh.rows.forEach((r, i) => { const c = r.slice(0, 24).map(cell); if (!c.some(x => x !== '')) return; if (rows.length >= 300) { trunc = true; return; } rows.push({ n: i + 1, c }); });
    return { name: sh.name, h, rows, trunc }; }).filter(s => s.rows.length > 1) };
}
function pickTab(tab, ls) { /* só as linhas que pertencem a esta ficha (arquivo dividido entre clientes) + cabeçalho */
  if (!tab?.sheets?.length) return null; const want = new Set(ls.map(l => l.loc));
  const sheets = tab.sheets.map(s => ({ ...s, rows: s.rows.filter(r => r.n === s.h + 1 || want.has(`aba ${s.name} • linha ${r.n}`)) })).filter(s => s.rows.length > 1);
  return sheets.length ? { sheets } : null;
}
async function toUnits(file, buf) {
  const ext = extOf(file.name);
  if (ext === 'pdf') {
    const { lines } = await readPdf(buf); if (!lines.length) throw new Error('PDF sem camada de texto (provável escaneado). Fichas e documentos de cliente não são enviados a OCR por IA (contêm dados do cliente): use uma versão com texto.');
    const by = {}; lines.forEach(l => (by[l.p] ||= []).push({ text: l.text, loc: `p. ${l.p}` }));
    return Object.values(by).map(ls => ({ lines: ls, text: ls.map(l => l.text).join('\n') }));
  }
  if (ext === 'docx') { const ls = await readDocx(buf); return ls.map(l => ({ lines: [l], text: l.text })); }
  if (ext === 'txt' || ext === 'md') return decodeText(buf).split(/\r?\n/).map((t, i) => t.trim() ? { lines: [{ text: t.trim(), loc: `linha ${i + 1}` }], text: t.trim() } : null).filter(Boolean);
  if (['xlsx', 'xls', 'csv'].includes(ext)) { const t = await readTable(file, buf); const us = t.sheets.flatMap(tableUnits); us.tab = tabSnap(t.sheets); return us; }
  throw new Error('formato não suportado (PDF, DOCX, XLSX, XLS, CSV, TXT, MD).');
}
function groupUnits(units, ix) {
  const whole = matchDoc(units.map(u => u.text).join('\n'), ix), conf = whole.cands.filter(c => c.state === 'confirmado');
  if (conf.length > 1 && conf.filter(c => c.role === 'faturado').length === 1 && conf.every(c => c.role === 'faturado' || c.role === 'citado')) return [{ units, split: false }]; /* um cliente rotulado como faturado; os demais só citados: não dividir */
  const un = units.map(u => ({ u, r: resolveMatch(matchDoc(u.text, ix)) }));
  const keys = new Set(un.filter(x => x.r.key).map(x => x.r.key));
  if (keys.size < 2) return [{ units, split: false }];
  const gs = []; let cur = null;
  un.forEach(({ u, r }) => {
    if (r.key && (!cur || cur.key !== r.key)) { cur = { key: r.key, units: [], split: true, inferred: 0 }; gs.push(cur); }
    if (!cur) { cur = { key: null, units: [], split: true, inferred: 0 }; gs.push(cur); }
    if (!r.key) cur.inferred++; cur.units.push(u);
  });
  return gs;
}
const locRange = ls => ls.length ? (ls[0].loc === ls[ls.length - 1].loc ? ls[0].loc : `${ls[0].loc} → ${ls[ls.length - 1].loc}`) : '';
function makeFicha(file, ls, hash, extra = {}, tab = null) {
  const x = extractFicha(ls, { file }); if (x.items.length > 150) { x.itemsTrunc = x.items.length; x.items = x.items.slice(0, 150); }
  const tb = pickTab(tab, ls);
  return { id: uid(), file, loc: locRange(ls), hash, at: new Date().toISOString(), matchText: ls.map(l => l.text).join('\n').slice(0, 3000), ...x, ...(tb ? { tab: tb } : {}), ...extra };
}
const TOTVS_ROOT = '53113791';
function hashOwner(hash) {
  for (const c of Object.values(S.clients)) { if ([...c.fichas, ...c.docs].some(x => x.hash === hash)) return `cliente "${c.name}"`; }
  return S.inbox.some(i => (i.ficha || i.doc)?.hash === hash) ? 'pendências (sem cliente)' : '';
}
function dropHash(hash) { // libera o hash quando nenhum registro o usa mais, permitindo novo envio do arquivo
  const used = Object.values(S.clients).some(c => [...c.fichas, ...c.docs].some(x => x.hash === hash)) || S.inbox.some(i => (i.ficha || i.doc)?.hash === hash);
  if (!used) { S.meta.files = S.meta.files.filter(x => x.hash !== hash); touchMeta(); }
}
/* Valida a identificação do documento contra o cliente selecionado (CNPJ, código TOTVS ou razão social) */
function validateIdentity(fi, text, key, ix) {
  const c = S.clients[key], m = matchDoc(text, ix), nameOf = k => S.clients[k]?.name || k;
  const others = m.cands.filter(x => x.key !== key && x.state === 'confirmado'), self = m.cands.find(x => x.key === key);
  const cn = (fi.cnpjs || []).filter(x => !x.startsWith(TOTVS_ROOT));
  if (others.length) return { state: 'divergente', key, by: 'anexada manualmente neste cliente', divergencia: { tipo: 'outro_cliente', keys: others.map(x => x.key), msg: `O documento identifica outro cliente: ${others.map(x => `${nameOf(x.key)} (${x.by})`).join('; ')}.` } };
  if (c.cnpj && cn.length && !cn.includes(c.cnpj) && cn.some(x => x.slice(0, 8) === c.cnpj.slice(0, 8))) return { state: 'divergente', key, by: 'anexada manualmente neste cliente', divergencia: { tipo: 'filial', keys: [], msg: `O documento é de outro estabelecimento do mesmo grupo (${cn.filter(x => x.slice(0, 8) === c.cnpj.slice(0, 8)).map(fmtCnpj).join(', ')}) — matriz ou filial em relação a ${fmtCnpj(c.cnpj)}. Confirme se deve entrar neste cliente.` } };
  if (c.cnpj && cn.length && !cn.includes(c.cnpj)) return { state: 'divergente', key, by: 'anexada manualmente neste cliente', divergencia: { tipo: 'cnpj', keys: [], msg: `CNPJ no documento (${cn.map(fmtCnpj).join(', ')}) diferente do cliente (${fmtCnpj(c.cnpj)}).` } };
  if (self) return { state: 'confirmado', key, by: `anexada neste cliente; identificação conferida no documento (${self.by})` };
  return { state: 'divergente', key, by: 'anexada manualmente neste cliente', divergencia: { tipo: 'ausente', keys: [], msg: 'Nenhum identificador do cliente (código TOTVS, CNPJ ou razão social) encontrado no documento — não foi possível conferir.' } };
}
const INFLIGHT = new Set(); /* hashes em leitura: dois arquivos idênticos em paralelo não entram duas vezes */
let PLACE_SINK = null; /* registra, durante a colocação síncrona, onde cada ficha/documento foi parar */
/* Processa UM arquivo. Devolve {st:'ok'|'dup'|'cancel', n, out, hash, owner}; erros são lançados. */
async function ingestOne(file, kind, forceKey, opts, ctx) {
  const fc = forceKey && S.clients[forceKey];
  const buf = await readBuf(file); const hash = await sha(buf); if (ctx.ep !== DM.epoch) return { st: 'cancel' }; /* limpeza ocorreu durante a leitura: nada é gravado */
  if (S.meta.files.some(x => x.hash === hash) || INFLIGHT.has(hash)) { return { st: 'dup', hash, owner: hashOwner(hash) }; }
  INFLIGHT.add(hash);
  try {
    const units = await toUnits(file, buf); if (ctx.ep !== DM.epoch) return { st: 'cancel' };
    const ix = idx(); let n = 0; const out = []; PLACE_SINK = out;
    try {
      if (kind === 'doc') {
        const text = units.map(u => u.text).join('\n'); const doc = { id: uid(), name: file.name, hash, at: new Date().toISOString(), text: text.slice(0, 12000), trunc: text.length > 12000 };
        let rs; if (forceKey) { const vd = validateIdentity({ cnpjs: (text.match(CNPJ_RE) || []).map(digits).filter(x => x.length === 14 && validCnpj(x)) }, text, forceKey, ix); rs = vd.divergencia && vd.divergencia.tipo !== 'ausente' ? { state: 'sugerido', key: forceKey, by: 'anexado no cliente, mas ' + vd.divergencia.msg } : { state: 'confirmado', key: forceKey, by: 'manual (anexado no cliente)' }; } else rs = resolveMatch(matchDoc(text, ix));
        placeDoc(doc, rs, ctx.touched); n = 1;
      } else if (forceKey) {
        const ls = units.flatMap(u => u.lines), text = units.map(u => u.text).join('\n'); const fi = makeFicha(file.name, ls, hash, {}, units.tab);
        const v = validateIdentity(fi, text, forceKey, ix); if (v.divergencia) fi.divergencia = v.divergencia;
        const dupComps = fichaComps(fi).filter(cp => (fc.fichas || []).some(f => f.id !== opts.replaceId && usableF(f) && fichaComps(f).includes(cp))); if (dupComps.length) fi.dupComps = dupComps;
        placeFicha(fi, v, ctx.touched); n = 1;
        if (opts.replaceId) { const old = fc.fichas.find(f => f.id === opts.replaceId); if (old) { fc.fichas = fc.fichas.filter(f => f.id !== opts.replaceId); dropHash(old.hash); } }
      } else {
        const groups = groupUnits(units, ix);
        for (const g of groups) {
          const ls = g.units.flatMap(u => u.lines); const text = g.units.map(u => u.text).join('\n');
          const fi = makeFicha(file.name, ls, hash, g.split ? { splitFromBatch: true, inferredLines: g.inferred || 0 } : {}, units.tab);
          if (!fi.items.length && g.split && !g.key) continue;
          placeFicha(fi, resolveMatch(matchDoc(text, ix)), ctx.touched); n++;
        }
      }
    } finally { PLACE_SINK = null; }
    S.meta.files.push({ id: uid(), name: file.name, kind, hash, at: new Date().toISOString(), n }); ctx.touched.forEach(k => touchC(k)); touchMeta();
    return { st: 'ok', n, out, hash };
  } finally { INFLIGHT.delete(hash); }
}
async function ingest(files, kind, forceKey, opts = {}) {
  const ctx = { ep: DM.epoch, touched: new Set() }, fc = forceKey && S.clients[forceKey], names = []; UI.busy = 'Processando documentos…';
  if (fc) { fc.proc = (fc.proc || 0) + files.length; fc.fstat = fichaStatus(fc, refCompOf(S)); }
  render();
  for (const file of files) {
    try {
      const r = await ingestOne(file, kind, forceKey, opts, ctx); if (r.st === 'cancel') { UI.busy = ''; return; }
      if (r.st === 'dup') { log(`↷ ${file.name}: arquivo idêntico já importado${r.owner ? ' (em ' + r.owner + ')' : ''} — ignorado.`); if (fc) toast(`${file.name}: arquivo idêntico já importado${r.owner ? ' em ' + r.owner : ''}.`); continue; }
      names.push(file.name); log(`✔ ${file.name}: ${r.n} ${kind === 'doc' ? 'documento' : 'ficha(s)'} processado(s).`, 'ok');
    } catch (e) {
      log(`✖ ${file.name}: ${e.message}`, 'bad');
      if (fc) { fc.fichaErr = [{ id: uid(), file: file.name, at: new Date().toISOString(), msg: e.message, kind }, ...(fc.fichaErr || [])].slice(0, 10); ctx.touched.add(fc.key); }
    } finally { if (fc) fc.proc = Math.max(0, (fc.proc || 0) - 1); }
  }
  if (ctx.ep !== DM.epoch) { UI.busy = ''; return; }
  reanalyze([...ctx.touched], names.length ? `${kind === 'doc' ? 'Documento' : 'Ficha'} processado(a): ${names.join(', ')}` : (ctx.touched.size ? 'Falha no processamento do arquivo' : '')); UI.busy = ''; touchMeta(); render();
}
function placeFicha(fi, res, touched) {
  const c = res.key && S.clients[res.key];
  if (c && (res.state === 'confirmado' || res.state === 'sugerido' || res.state === 'divergente')) { c.fichas.push({ ...fi, state: res.state, by: res.by }); touched.add(c.key); PLACE_SINK?.push({ st: res.state, key: c.key, cli: c.name, by: res.by, msg: res.state === 'divergente' ? (fi.divergencia?.msg || 'divergência de identificação') : '' }); }
  else { const it = { id: uid(), kind: 'ficha', file: fi.file, loc: fi.loc, ficha: fi, cands: res.cands || [], note: res.note || 'Nenhum cliente identificado por CNPJ, código ou razão social.' }; S.inbox.push(it); touchI(it.id); PLACE_SINK?.push({ st: 'inbox', id: it.id, msg: it.note, cands: (it.cands || []).map(x => S.clients[x.key]?.name).filter(Boolean) }); }
}
function placeDoc(doc, res, touched) {
  const c = res.key && S.clients[res.key];
  if (c && (res.state === 'confirmado' || res.state === 'sugerido')) { c.docs.push({ ...doc, state: res.state, by: res.by }); touched.add(c.key); PLACE_SINK?.push({ st: res.state, key: c.key, cli: c.name, by: res.by }); }
  else { const it = { id: uid(), kind: 'doc', file: doc.name, loc: '', doc, cands: res.cands || [], note: res.note || 'Nenhum cliente identificado.' }; S.inbox.push(it); touchI(it.id); PLACE_SINK?.push({ st: 'inbox', id: it.id, msg: it.note, cands: (it.cands || []).map(x => S.clients[x.key]?.name).filter(Boolean) }); }
}
function reassocInbox() { // revalida pendências com a carteira atual; só vincula automaticamente com identificador exato único
  const ix = idx(), touched = new Set();
  [...S.inbox].forEach(it => {
    const text = it.kind === 'ficha' ? (it.ficha.matchText || it.ficha.items.map(x => x.desc).join('\n') + '\n' + it.ficha.cnpjs.join(' ')) : it.doc.text; const res = resolveMatch(matchDoc(text, ix));
    if (res.state === 'confirmado') { it.kind === 'ficha' ? placeFicha(it.ficha, res, touched) : placeDoc(it.doc, res, touched); rmInbox(it.id); }
    else { it.cands = res.cands || []; touchI(it.id); }
  }); if (touched.size) { reanalyze([...touched], 'Pendência associada automaticamente após importar a carteira'); log(`Pendências reavaliadas: ${touched.size} cliente(s) atualizado(s).`, 'ok'); }
}
function rmInbox(id) { S.inbox = S.inbox.filter(x => x.id !== id); dirtyI.delete(id); delI.add(id); sched(); }
function assignInbox(id, key) {
  const it = S.inbox.find(x => x.id === id), c = S.clients[key]; if (!it || !c) return; const t = new Set(); const res = { state: 'confirmado', key, by: 'manual (definido pelo usuário)' };
  it.kind === 'ficha' ? placeFicha(it.ficha, res, t) : placeDoc(it.doc, res, t); rmInbox(id); reanalyze([...t], 'Documento associado manualmente: ' + it.file); render();
}
function confirmFicha(key, fid, kind) { const c = S.clients[key]; const f = (kind === 'doc' ? c.docs : c.fichas).find(x => x.id === fid); if (!f) return; const was = f.state; f.state = 'confirmado'; f.by = (f.by || '') + ' + confirmado manualmente' + (was === 'divergente' ? ' após revisão da divergência' : ''); reanalyze([key], 'Ficha confirmada: ' + (f.file || f.name)); render(); }
function rejectFicha(key, fid, kind) {
  const c = S.clients[key]; const arr = kind === 'doc' ? c.docs : c.fichas; const i = arr.findIndex(x => x.id === fid); if (i < 0) return; const [f] = arr.splice(i, 1);
  const it = kind === 'doc' ? { id: uid(), kind: 'doc', file: f.name, loc: '', doc: f, cands: [], note: `Vínculo com "${c.name}" removido pelo usuário.` } : { id: uid(), kind: 'ficha', file: f.file, loc: f.loc, ficha: f, cands: [], note: `Vínculo com "${c.name}" removido pelo usuário.` };
  S.inbox.push(it); touchI(it.id); reanalyze([key], 'Ficha removida do cliente: ' + (f.file || f.name)); render();
}
function moveFicha(key, fid, toKey) { // ficha anexada ao cliente errado → cliente correto
  const c = S.clients[key], d = S.clients[toKey], i = c?.fichas.findIndex(x => x.id === fid); if (!c || !d || i < 0 || key === toKey) return; const [f] = c.fichas.splice(i, 1);
  delete f.divergencia; f.state = 'confirmado'; f.by = `reassociada manualmente (de "${c.name}")`; d.fichas.push(f); reanalyze([key, toKey], 'Ficha reassociada: ' + f.file); log(`Ficha ${f.file}: movida de "${c.name}" para "${d.name}".`, 'ok'); render();
}
function deleteFicha(key, fid) {
  const c = S.clients[key], i = c?.fichas.findIndex(x => x.id === fid); if (!c || i < 0) return; const [f] = c.fichas.splice(i, 1); dropHash(f.hash); reanalyze([key], 'Ficha excluída: ' + f.file); render();
}
function setFichaComp(key, fid, v) {
  const f = S.clients[key]?.fichas.find(x => x.id === fid); if (!f) return; if (v && !/^\d{4}-(0[1-9]|1[0-2])$/.test(v)) return toast('Competência inválida.');
  f.comp = v || null; f.compMode = v ? 'manual (informada pelo usuário)' : null; f.compAt = v ? new Date().toISOString() : null; (f.items || []).forEach(it => { if (!it.comp || it.compMode === 'manual (informada pelo usuário)' || !v) { it.comp = v || null; it.compMode = f.compMode; } });
  reanalyze([key], 'Competência informada manualmente: ' + f.file); render();
}
function dismissFichaErr(key, id) { const c = S.clients[key]; if (!c) return; c.fichaErr = (c.fichaErr || []).filter(e => e.id !== id); reanalyze([key]); render(); }
function markReviewed(key, solId) { const c = S.clients[key]; if (!c) return; c.reviewFlags = (c.reviewFlags || []).filter(x => x.solId !== solId); touchC(key); render(); }

/* ---------- Base de Soluções ---------- */
function loadSolutions(saved) {
  S.meta.seedIds ||= []; const byId = new Map(saved.map(r => [r.id, r])), out = [...saved], seeds = seedSolutions(); let chg = false;
  seeds.forEach(sd => { if (!byId.has(sd.id) && !S.meta.seedIds.includes(sd.id)) { out.push(sd); touchSol(sd.id); chg = true; } });
  const ids = [...new Set([...S.meta.seedIds, ...seeds.map(x => x.id)])]; if (ids.length !== S.meta.seedIds.length) { S.meta.seedIds = ids; chg = true; }
  if (!S.meta.kbMigrated && (S.kbExtra?.solutions || []).length) {
    S.kbExtra.solutions.forEach(k => { const r = newSol({ nome: k.nome, funcionalidades: k.finalidade ? [{ t: k.finalidade, o: 'catálogo anexado (migrado)', f: k.fonte?.t || '', loc: '' }] : [], termos: String(k.kw || '').split(/[,;|]+/).map(x => x.trim()).filter(Boolean), limites: k.limites || '', origem: 'catálogo anexado (migrado)', fontes: [{ t: k.fonte?.t || 'Catálogo anexado', u: k.fonte?.u || '', d: k.fonte?.d || null, origem: 'catálogo anexado (migrado)' }], publicoTxt: k.publico || '' });
      hist(r, 'migrado', 'Item do catálogo anexado antes da Base de Soluções.'); out.push(r); touchSol(r.id); });
    chg = true; log(`Catálogo anexado anteriormente migrado para a Base de Soluções (${S.kbExtra.solutions.length} itens, status NECESSITA VALIDAÇÃO).`, 'ok');
  }
  if (!S.meta.kbMigrated) { S.meta.kbMigrated = true; chg = true; }
  S.solutions = out; if (chg) touchMeta();
}
function solChanged(r, motivo) {
  if (UI.batch) { UI.batch.push([r, motivo]); touchSol(r.id); return 0; }
  const id = r.id, aff = c => (c.opps || []).some(o => o.sols.some(s => s.id === id)) || (c.productsIdent || []).some(p => p.id === id);
  const pre = new Set(Object.values(S.clients).filter(aff).map(c => c.key));
  reanalyzeAll(true, `Base de soluções: ${r.nome} (${motivo})`);
  let n = 0; Object.values(S.clients).forEach(c => { if (pre.has(c.key) || aff(c)) { c.reviewFlags = [{ solId: id, nome: r.nome, rev: r.rev, motivo, at: new Date().toISOString() }, ...(c.reviewFlags || []).filter(x => x.solId !== id)].slice(0, 20); touchC(c.key); n++; } });
  touchSol(id); return n;
}
function solDraft(r) { // rascunho de edição (textos multilinha)
  return { id: r?.id || null, nome: r?.nome || '', tipo: r?.tipo || 'produto', categoria: r?.categoria || '', linha: r?.linha || '', segmentos: [...(r?.segmentos || [])], necessidades: [...(r?.necessidades || [])],
    termos: (r?.termos || []).join(', '), dores: (r?.dores || []).map(x => x.t).join('\n'), funcionalidades: (r?.funcionalidades || []).map(x => x.t).join('\n'), prerequisitos: preToLines(r?.prerequisitos), financeira: !!r?.financeira,
    integracoes: intToLines(r?.integracoes), fontes: fontesToLines(r?.fontes), fornecedor: r?.fornecedor || 'TOTVS', disponibilidade: r?.disponibilidade || '', limites: r?.limites || '', status: r?.status || 'NECESSITA VALIDAÇÃO', oficial: !!r?.oficial, ackDup: false, sigla: r?.sigla || '', refId: r?.refId || '', codOferta: r?.codOferta || '', grupo: r?.grupo || '', refStatus: r?.refStatus || '', refNota: r?.refNota || '', finalidade: r?.finalidade || '', processos: (r?.processos || []).join('\n'), ciclo: r?.ciclo || '', entrega: r?.entrega || '', comercial: r?.comercial || '', dependencias: (r?.dependencias || []).join('\n'), complementares: (r?.complementares || []).join('; ') };
}
function solErrors(d) {
  const e = []; if (!d.nome.trim()) e.push('Nome é obrigatório.');
  const fs = fontesFromLines(d.fontes); if (!fs.length) e.push('Informe ao menos uma fonte (título | URL | data) — todo registro precisa de origem rastreável.');
  if (d.tipo === 'servico') { if (!d.fornecedor.trim()) e.push('Serviço: informe o fornecedor.'); if (!d.disponibilidade.trim()) e.push('Serviço: informe a disponibilidade comercial.'); }
  if (d.oficial && !fs.some(f => f.u && isOfficialUrl(f.u))) e.push('Marcar como oferta oficial TOTVS exige ao menos uma fonte em domínio oficial TOTVS (totvs.com, tdn.totvs.com, centraldeatendimento.totvs.com).');
  if (d.status === 'Validado' && !fs.length) e.push('Status Validado exige fonte.');
  if (['corrigida', 'ambigua', 'nao_localizada'].includes(d.refStatus) && !String(d.refNota || '').trim()) e.push('Situação de validação corrigida/ambígua/não localizada exige a explicação com a fonte (campo "Nota de validação").'); return e;
}
function applyDraft(r, d) {
  const old = JSON.stringify([r.nome, r.tipo, r.categoria, r.linha, r.segmentos, r.necessidades, r.termos, r.dores.map(x => x.t), r.funcionalidades.map(x => x.t), r.prerequisitos.map(x => x.t), intToLines(r.integracoes), fontesToLines(r.fontes), r.fornecedor, r.disponibilidade, r.limites, r.status, r.oficial, r.sigla, r.refId, r.codOferta, r.grupo, r.refStatus, r.refNota, r.finalidade, r.processos, r.ciclo || '', r.entrega || '', r.comercial || '', r.dependencias || [], r.complementares || []]);
  r.nome = d.nome.trim(); r.tipo = d.tipo; r.categoria = d.categoria.trim(); r.linha = d.linha.trim(); r.segmentos = d.segmentos; r.necessidades = d.necessidades; r.termos = d.termos.split(/[,;\n]+/).map(x => x.trim()).filter(Boolean);
  r.dores = lines2items(d.dores, r.dores); r.funcionalidades = lines2items(d.funcionalidades, r.funcionalidades); r.prerequisitos = preFromLines(d.prerequisitos, r.prerequisitos); r.financeira = !!d.financeira;
  r.integracoes = intFromLines(d.integracoes, r.integracoes); r.fontes = fontesFromLines(d.fontes, r.fontes); r.fornecedor = d.fornecedor.trim(); r.disponibilidade = d.disponibilidade.trim(); r.limites = d.limites.trim(); r.status = d.status; r.oficial = !!d.oficial && (r.tipo !== 'servico' || r.fontes.some(f => f.u && isOfficialUrl(f.u)));
  r.sigla = (d.sigla || '').trim().toUpperCase(); r.refId = (d.refId || '').trim(); r.codOferta = (d.codOferta || '').trim(); r.grupo = (d.grupo || '').trim(); r.refStatus = d.refStatus || ''; r.refNota = (d.refNota || '').trim(); r.finalidade = (d.finalidade || '').trim(); r.processos = String(d.processos || '').split(/\n+/).map(x => x.trim()).filter(Boolean);
  r.ciclo = CICLO_SOL.includes(d.ciclo) ? d.ciclo : ''; r.entrega = String(d.entrega || '').trim().slice(0, 120); r.comercial = String(d.comercial || '').trim().slice(0, 120); r.dependencias = String(d.dependencias || '').split(/\n+/).map(x => x.trim().slice(0, 200)).filter(Boolean).slice(0, 20); r.complementares = String(d.complementares || '').split(/[;\n]+/).map(x => x.trim().slice(0, 120)).filter(Boolean).slice(0, 20);
  const now = JSON.stringify([r.nome, r.tipo, r.categoria, r.linha, r.segmentos, r.necessidades, r.termos, r.dores.map(x => x.t), r.funcionalidades.map(x => x.t), r.prerequisitos.map(x => x.t), intToLines(r.integracoes), fontesToLines(r.fontes), r.fornecedor, r.disponibilidade, r.limites, r.status, r.oficial, r.sigla, r.refId, r.codOferta, r.grupo, r.refStatus, r.refNota, r.finalidade, r.processos, r.ciclo || '', r.entrega || '', r.comercial || '', r.dependencias || [], r.complementares || []]);
  return old !== now;
}
function solSave() {
  const ed = UI.solEdit; if (!ed) return; const d = ed.d, errs = solErrors(d); if (errs.length) { ed.errs = errs; return render(); }
  if (!d.id) {
    const cand = { ...candBase(''), nome: d.nome.trim(), sigla: (d.sigla || '').trim(), refId: (d.refId || '').trim(), termos: d.termos.split(/[,;\n]+/).map(x => x.trim()).filter(Boolean), fontes: fontesFromLines(d.fontes) }; const dups = findDups(cand);
    if (dups.length && !d.ackDup) { ed.dups = dups.map(x => ({ id: x.rec.id, nome: x.rec.nome, why: x.why.join(', '), arq: x.rec.arquivado })); ed.errs = []; return render(); }
    const r = newSol({ origem: 'manual' }); applyDraft(r, d); r.origem = 'manual'; r.fontes.forEach(f => f.origem ||= 'manual'); hist(r, 'criado', 'Cadastro manual'); S.solutions.push(r); const n = solChanged(r, 'criado');
    log(`Solução "${r.nome}" cadastrada. ${n} diagnóstico(s) sinalizado(s) para revisão.`, 'ok'); UI.solEdit = null; UI.solSel = r.id; return render();
  }
  const r = S.solutions.find(x => x.id === d.id); if (!r) return; const ch = applyDraft(r, d);
  if (ch) { r.rev++; r.atualizadoEm = today(); hist(r, 'editado', 'Edição manual'); const n = solChanged(r, 'editada'); log(`Solução "${r.nome}" atualizada (rev ${r.rev}). ${n} diagnóstico(s) sinalizado(s) para revisão.`, 'ok'); } else toast('Nenhuma alteração.');
  UI.solEdit = null; render();
}
function solMergeInto(targetId) { // salva rascunho de novo cadastro como complemento de existente
  const ed = UI.solEdit, d = ed.d, r = S.solutions.find(x => x.id === targetId); if (!r) return; const errs = solErrors(d); if (errs.length) { ed.errs = errs; return render(); }
  const tmp = newSol(); applyDraft(tmp, d); const c = { ...tmp, fontes: tmp.fontes.map(f => ({ ...f, origem: f.origem || 'manual (complemento)' })) };
  const res = mergeCand(r, c, { tipo: 'depois', categoria: 'depois', linha: 'depois' }); const n = solChanged(r, 'complementada'); log(`"${r.nome}" complementada: ${res.added} item(ns) novo(s). ${n} diagnóstico(s) sinalizado(s).`, 'ok'); UI.solEdit = null; UI.solSel = r.id; render();
}
function solArchive(id, on) { const r = S.solutions.find(x => x.id === id); if (!r) return; r.arquivado = on; r.rev++; r.atualizadoEm = today(); hist(r, on ? 'arquivado' : 'restaurado', on ? 'Arquivada: deixa de ser usada nas análises (registro e histórico preservados).' : 'Restaurada.'); const n = solChanged(r, on ? 'arquivada' : 'restaurada'); toast(`${on ? 'Arquivada' : 'Restaurada'}. ${n} diagnóstico(s) sinalizado(s).`); render(); }
function solResolvePend(id, idx, adopt) {
  const r = S.solutions.find(x => x.id === id), p = r?.pend?.[idx]; if (!p) return; if (adopt) { if (p.itens) { const st = { n: 0 }; addItems(r.funcionalidades, p.itens, st); } else if (['tipo', 'categoria', 'linha', 'finalidade', 'limites'].includes(p.campo)) r[p.campo] = p.novo; r.rev++; r.atualizadoEm = today(); } p.resolvido = true; hist(r, 'conflito resolvido', `${p.campo}: ${adopt ? `adotado "${String(p.novo).slice(0, 80)}"` : `mantido "${String(p.atual).slice(0, 80)}"`}`, p.f); solChanged(r, 'conflito resolvido'); render();
}
function solAddLink(id, titulo, url) {
  const r = S.solutions.find(x => x.id === id); if (!r) return; if (!/^https?:\/\//i.test(url)) return toast('URL inválida (use http/https).');
  if (r.fontes.some(f => normUrl(f.u) === normUrl(url))) return toast('Link já registrado neste registro.');
  r.fontes.push({ t: titulo || hostOf(url), u: url, d: today(), origem: 'link registrado manualmente (' + (isOfficialUrl(url) ? 'domínio oficial TOTVS' : 'domínio externo') + ')' }); r.rev++; r.atualizadoEm = today(); hist(r, 'link', 'Link registrado: ' + url); solChanged(r, 'link adicionado'); render();
}
/* Importação com prévia */
async function solImportFiles(files) {
  UI.busy = 'Extraindo materiais…'; render(); const items = [], errs = [];
  for (const file of files) {
    try { const r = await extractSolutionsFile(file); const cands = r.cands.slice(0, 200).map(c => { const dups = findDups(c); const best = dups[0]; const act = best && best.score >= .85 ? 'mesclar' : 'criar';
      return { c, dups: dups.slice(0, 4).map(x => ({ id: x.rec.id, nome: x.rec.nome, score: x.score, why: x.why.join(', ') })), act, target: best?.rec.id || '', choices: { tipo: 'depois', categoria: 'depois', linha: 'depois' } }; });
      items.push({ file: file.name, aviso: r.aviso, cands }); log(`✔ ${file.name}: ${cands.length} candidato(s) extraído(s) — revise antes de incorporar.`, 'ok'); }
    catch (e) { errs.push({ file: file.name, msg: e.message }); log(`✖ ${file.name}: ${e.message}`, 'bad'); }
  }
  UI.solImp = { items: [...(UI.solImp?.items || []), ...items], errs: [...(UI.solImp?.errs || []), ...errs] }; UI.busy = ''; render();
}
function impConflicts(x) { // conflitos entre o candidato e o registro-alvo
  const r = x.act === 'mesclar' && S.solutions.find(s => s.id === x.target); if (!r) return []; const out = [];
  for (const k of ['tipo', 'categoria', 'linha']) if (x.c[k] && r[k] && x.c[k] !== r[k]) out.push({ campo: k, atual: r[k], novo: x.c[k] });
  (x.c.integracoes || []).forEach(i => { const o = r.integracoes.find(y => norm(y.sistema) === norm(i.sistema) && y.estado !== i.estado && y.estado !== 'nao_verificada' && i.estado !== 'nao_verificada'); if (o) out.push({ campo: 'integração ' + i.sistema, atual: o.estado === 'confirmada' ? 'integra' : 'NÃO integra', novo: i.estado === 'confirmada' ? 'integra' : 'NÃO integra' }); });
  return out;
}
function solImportApply() {
  const imp = UI.solImp; if (!imp) return; let cr = 0, mg = 0, ig = 0; const tocados = [], novas = new Set();
  imp.items.forEach(it => it.cands.forEach(x => {
    if (x.act === 'ignorar') { ig++; return; }
    if (x.act === 'mesclar') { const r = S.solutions.find(s => s.id === x.target); if (!r) { ig++; return; } mergeCand(r, x.c, x.choices, { f: it.file }); tocados.push(r); mg++; }
    else { const r = createFromCand(x.c); S.solutions.push(r); tocados.push(r); novas.add(r.id); cr++; }
  }));
  const uniq = [...new Set(tocados)]; uniq.forEach(r => touchSol(r.id));
  imp.items.forEach(it => it.cands.forEach(x => { if (x.act === 'ignorar' || !x.c.conteudoNovo) return; const r = x.act === 'mesclar' ? S.solutions.find(s => s.id === x.target) : tocados.find(t => novas.has(t.id) && t.nome === x.c.nome); if (r) tdCommit(r, x.c.conteudoNovo); }));
  const ids = new Set(uniq.map(r => r.id)); const pre = new Set(Object.values(S.clients).filter(c => (c.opps || []).some(o => o.sols.some(s => ids.has(s.id))) || (c.productsIdent || []).some(p => ids.has(p.id))).map(c => c.key));
  reanalyzeAll(true, `Base de soluções: importação de materiais (${cr} nova(s), ${mg} complementada(s))`);
  Object.values(S.clients).forEach(c => { const hit = (c.opps || []).some(o => o.sols.some(s => ids.has(s.id))) || (c.productsIdent || []).some(p => ids.has(p.id)); if (pre.has(c.key) || hit) { uniq.filter(r => S.solutions.includes(r)).forEach(r => { c.reviewFlags = [{ solId: r.id, nome: r.nome, rev: r.rev, motivo: novas.has(r.id) ? 'nova solução importada' : 'importação de materiais', at: new Date().toISOString() }, ...(c.reviewFlags || []).filter(f => f.solId !== r.id)].slice(0, 20); }); touchC(c.key); } });
  imp.items.forEach(it => { if (it.pid) { const rec = S.pesq.find(x => x.id === it.pid); if (rec) { rec.status = it.cands.some(x => x.act !== 'ignorar') ? 'incorporada' : 'descartada'; touchPes(rec.id); } } });
  log(`Importação concluída: ${cr} criada(s), ${mg} complementada(s), ${ig} ignorada(s).`, 'ok'); if (uniq.length) UI.solSel = uniq[0].id; UI.solImp = null; render();
}
function solNew() { UI.solEdit = { d: solDraft(null), errs: [], dups: null }; UI.view = 'solucoes'; UI.solSel = null; render(); }
function solEditOpen(id) { const r = S.solutions.find(x => x.id === id); if (!r) return; UI.solEdit = { d: solDraft(r), errs: [], dups: null }; render(); }
function solRestoreSeed() { // restaura apenas registros iniciais removidos/alterados? Não sobrescreve: só recria os ausentes
  const have = new Set(S.solutions.map(x => x.id)); const add = seedSolutions().filter(x => !have.has(x.id)); add.forEach(r => { S.solutions.push(r); touchSol(r.id); }); if (add.length) solChanged(add[0], 'base inicial restaurada'); toast(add.length ? add.length + ' registro(s) iniciais recriados.' : 'Nada a restaurar.'); render();
}
/* ---------- Plano de ação ---------- */
const actOf = (rowId, key) => (key ? S.clients[key]?.act?.[rowId] : S.meta.act[rowId]) || {};
function setAct(rowId, key, patch) { if (key) { const c = S.clients[key]; c.act[rowId] = { ...(c.act[rowId] || {}), ...patch }; touchC(key); } else { S.meta.act[rowId] = { ...(S.meta.act[rowId] || {}), ...patch }; touchMeta(); } }
const evText = o => o.evInd.length ? o.evInd.slice(0, 2).map(e => `${e.text} [${e.src}]`).join(' | ') + (o.evInd.length > 2 ? ` (+${o.evInd.length - 2} indícios no detalhe do cliente)` : '') : 'Sem indício individual — investigação recomendada (evidência setorial/regulatória).';
function planRows() {
  const rows = [];
  Object.values(S.clients).forEach(c => {
    c.opps.forEach(o => rows.push({ id: `opp:${c.key}:${o.ruleId}`, key: c.key, tipo: o.tipo, prio: o.prio, score: o.score, conf: o.conf, cliente: c.name, evid: evText(o), acao: o.acao, dec: decGet(c, o.ruleId), fund: Object.entries(fundOf(o)).filter(([, v]) => v).map(([k]) => FUND_L[k]).join(' + ') || 'sem evidência individual' }));
    const v = (t, ev, acao, p = 0) => rows.push({ id: `val:${t}:${c.key}`, key: c.key, tipo: 'Validação', prio: 'Validação', score: -1 - p, conf: '—', cliente: c.name, evid: ev, acao });
    Object.keys(c.act || {}).filter(k => k.startsWith('ins:')).forEach(k => { const iid = k.split(':')[1], ins = S.insights.find(x => x.id === iid); if (ins) rows.push({ id: k, key: c.key, tipo: 'Mercado', prio: 'Mercado', score: -1.5, conf: '—', cliente: c.name, evid: `Contexto de mercado (não é evidência individual): ${ins.titulo}${ins.fonte?.url ? ' [' + ins.fonte.url + ']' : ''}`, acao: ins.acao || 'Usar como gancho de abordagem e validar a necessidade com o cliente.' }); });
    if (c.doc.k === 'nao_anexada') v('ficha', 'Nenhuma ficha de faturamento anexada a este cliente (não identificado nos documentos).', 'Anexar a ficha de faturamento do cliente.', 3);
    if (c.doc.k === 'sugerida') v('assoc', 'Ficha associada apenas por razão social/código sem rótulo (vínculo sugerido).', 'Confirmar ou rejeitar a associação da ficha.', 0);
    if (c.conflicts.length) v('conf', c.conflicts.map(x => x.text).join(' | '), 'Resolver divergência entre planilha e ficha.', 1);
    if (['inferido', 'ausente', 'nao_mapeado'].includes(c.segInfo.mode)) v('seg', c.segInfo.ev, 'Confirmar/definir o segmento do cliente.', 2);
  });
  S.inbox.forEach(it => rows.push({ id: `val:inbox:${it.id}`, key: null, tipo: 'Validação', prio: 'Validação', score: -0.5, conf: '—', cliente: '(sem cliente associado)', evid: `${it.file}${it.loc ? ' • ' + it.loc : ''}: ${it.note}`, acao: 'Associar o documento a um cliente da carteira.' }));
  return rows.sort((a, b) => b.score - a.score);
}

/* ---------- Exportações ---------- */
/* Anti "CSV injection": célula de texto iniciada por = + - @ (ou TAB/CR) ganha apóstrofo; números e datas legítimos (ex.: -12,5; +55 11...) ficam intactos. */
const csvSafe = v => { v = String(v ?? ''); return /^[=+\-@\t\r]/.test(v) && !/^([+-]?\d+([.,]\d+)*(%|\s?[A-Za-z$]{0,3})?|-)$/.test(v.trim()) ? "'" + v : v; };
function toCSV(head, rows) { const q = v => { v = csvSafe(v); return /[";\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }; return '﻿' + [head, ...rows].map(r => r.map(q).join(';')).join('\r\n'); }
async function offer(name, data) {
  if (!DL) { UI.fb = { name, data: typeof data === 'string' ? data : null }; render(); toast(typeof data === 'string' ? 'Download indisponível: copie o conteúdo abaixo.' : 'Download indisponível neste ambiente.'); return; }
  try { await DL.save({ filename: name, data }); toast('Arquivo oferecido: ' + name); }
  catch (e) { if (e.code === 'declined') toast('Download cancelado.'); else toast('Falha no download (' + (e.code || e.message) + ').'); }
}
const planHead = ['Prioridade', 'Score', 'Confiança da análise', 'Tipo', 'Cliente', 'Evidência', 'Ação', 'Responsável', 'Prazo', 'Validação / Situação'];
function planArr() { return planRows().map(r => { const a = actOf(r.id, r.key); return [r.prio, r.score >= 0 ? r.score : '', r.conf, r.tipo, r.cliente, r.evid, r.acao, a.resp || '', a.prazo || '', r.dec ? `${VALID_L[r.dec.valid]} / ${SIT_L[r.dec.sit]}` : a.status || 'Pendente']; }); }
function exportCSV() { offer('plano-de-acao.csv', toCSV(planHead, planArr())); }
async function exportXLSX() {
  if (!(await vend('xlsx'))) return toast('Biblioteca XLSX indisponível.');
  const wb = XLSX.utils.book_new(); const add = (n, h, r) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([h, ...r]), n);
  add('Plano de ação', planHead, planArr());
  const cs = Object.values(S.clients);
  add('Clientes', ['Código', 'Cliente', 'CNPJ', 'Segmento (planilha)', 'Segmento usado', 'Origem do segmento', 'Cidade', 'Porte', 'MRR planilha', 'Ficha (conferência)', 'Status da ficha', 'Última competência', 'Conflitos', 'Maior score', 'Análise parcial'], cs.map(c => [c.code, c.name, fmtCnpj(c.cnpj), c.seg, KB.segments.find(s => s.id === c.segInfo.id)?.nome || '', c.segInfo.mode, c.city, c.size, c.mrr, c.doc.l, c.fstat.l, c.fstat.last || '', c.conflicts.length, c.topScore ?? '', partial(c) ? 'sim' : '']));
  add('Base de soluções', ['Nome', 'Tipo', 'Categoria', 'Linha', 'Fornecedor', 'Disponibilidade comercial', 'Oferta oficial TOTVS', 'Status', 'Atualizado em', 'Fontes', 'Arquivada'], S.solutions.map(r => [r.nome, TIPOS[r.tipo], r.categoria, r.linha, r.fornecedor, r.disponibilidade, r.oficial ? 'sim' : 'não confirmada', r.status, r.atualizadoEm, (r.fontes || []).map(f => `${f.t} ${f.u || ''} ${f.d || ''}`).join(' | '), r.arquivado ? 'sim' : '']));
  add('Oportunidades', ['Cliente', 'Tipo', 'Oportunidade', 'Score', 'Prioridade', 'Confiança', 'Evidência individual', 'Evidência setorial/regulatória', 'Soluções (base oficial)', 'Contratação identificada', 'Dependências', 'Perguntas de descoberta', 'Próxima ação'],
    cs.flatMap(c => c.opps.map(o => [c.name, o.tipo, o.nome, o.score, o.prio, o.conf, evText(o), o.setorial.map(x => `${x.tag}: ${x.text} (${x.fonte.t}, ${x.fonte.d || 'sem data'}, ${x.fonte.u})`).join(' | '), o.sols.map(s => `${s.nome} (${s.fonte.t}; consulta ${s.consulta})`).join(' | '), o.contratacao.join(', ') || 'não identificado nos documentos', o.deps.join(' | '), o.perg.join(' | '), o.acao])));
  add('Itens de ficha', ['Cliente', 'Arquivo', 'Local', 'Competência', 'Descrição', 'Classe', 'Origem da classe', 'Valor', 'Duplicado'], cs.flatMap(c => c.fichas.filter(f => f.state !== 'sugerido').flatMap(f => f.items.map(i => [c.name, f.file, i.loc, i.comp || f.comp || '', i.desc, KIND_LABEL[i.kind], i.kindMode, i.vals[i.vi], i.dup ? 'sim' : '']))));
  add('Pendências', ['Arquivo', 'Local', 'Motivo'], S.inbox.map(i => [i.file, i.loc, i.note]));
  offer('analise-carteira.xlsx', new Blob([XLSX.write(wb, { type: 'array', bookType: 'xlsx' })]));
}
function exportJSON() { UI.bkpAt = new Date().toISOString(); setTimeout(render, 0); offer('carteira-backup.json', JSON.stringify({ versao: 3, proprietario: { id: ME.id || null, nome: ME.nome || null }, app: 'Gestão de Carteira TOTVS ESN', aviso: 'Backup sem credenciais: chaves de API nunca são armazenadas por este aplicativo.', exportadoEm: new Date().toISOString(), meta: S.meta, kbExtra: S.kbExtra, solutions: S.solutions, pesq: S.pesq, marcos: S.marcos, regs: S.regs, merges: S.merges, msnap: S.msnap, cnpj: S.cnpj, insights: S.insights, clients: Object.values(S.clients).map(freezeClient), inbox: S.inbox }, null, 1)); }
async function importBackup(file, ok) {
  try {
    const j = JSON.parse(decodeText(await readBuf(file))); if (!j.clients) throw new Error('JSON sem "clients".');
    if (!ok && backupAskOwner(j, file)) return;
    S.meta = { ...S.meta, ...j.meta, weights: { ...DEF_WEIGHTS, ...(j.meta?.weights || {}) } }; S.kbExtra = j.kbExtra || { solutions: [] }; if (Array.isArray(j.solutions)) backupSols(j.solutions); else S.meta.kbMigrated = S.meta.kbMigrated ?? false; if (Array.isArray(j.pesq)) { S.pesq.forEach(r => delP.add(r.id)); S.pesq = j.pesq; S.pesq.forEach(r => touchPes(r.id)); }
    if (Array.isArray(j.marcos)) { S.marcos.forEach(r => dropG('marcos', r.id)); S.marcos = j.marcos; S.marcos.forEach(r => touchG('marcos', r.id)); }
    if (Array.isArray(j.regs)) { S.regs.forEach(r => dropG('regulatorio', r.id)); S.regs = j.regs; S.regs.forEach(r => touchG('regulatorio', r.id)); } delete S.meta.apiKey; delete S.meta.key; Object.keys(S.clients).forEach(k => { delC.add(k); dirtyC.delete(k); }); S.inbox.forEach(i => { delI.add(i.id); dirtyI.delete(i.id); }); S.merges.forEach(r => dropG('consol', r.id)); S.msnap.forEach(r => dropG('consolsnap', r.id)); S.merges = Array.isArray(j.merges) ? j.merges : []; S.msnap = Array.isArray(j.msnap) ? j.msnap : []; S.cnpj.forEach(r => dropG('cnpj', r.id)); S.cnpj = Array.isArray(j.cnpj) ? j.cnpj : []; S.cnpj.forEach(r => touchG('cnpj', r.id)); S.insights.forEach(r => dropG('insights', r.id)); S.insights = Array.isArray(j.insights) ? j.insights : []; S.insights.forEach(r => touchG('insights', r.id)); S.merges.forEach(r => touchG('consol', r.id)); S.msnap.forEach(r => touchG('consolsnap', r.id)); S.clients = {}; j.clients.forEach(c => { S.clients[c.key] = c; touchC(c.key); }); S.inbox = j.inbox || []; S.inbox.forEach(i => touchI(i.id));
    reanalyzeAll(); log(`Backup restaurado: ${j.clients.length} clientes.`, 'ok'); UI.view = 'geral';
  } catch (e) { log('✖ Backup: ' + e.message, 'bad'); toast(e.message); } render();
}

