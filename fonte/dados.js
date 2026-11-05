/* ===== GERENCIAMENTO DE DADOS =====
   Exclusões e reinicialização por escopo. Regras:
   - a limpeza lê o BANCO (não só a memória) e confere o resultado relendo as coleções;
   - operações assíncronas em andamento são invalidadas (DM.epoch) e nada é regravado depois da limpeza;
   - nenhuma rotina de restauração/seed roda sozinha;
   - o catálogo compartilhado nunca é apagado em "Limpar carteira"; em "Zerar" só os registros criados exclusivamente por esta conta. */
const DM = { epoch: 0, locked: false, plan: null, res: null, selCli: '', selDoc: '' };
const META_DADOS = ['files', 'act', 'segOv', 'segSec', 'lastAnalysis', 'mapping', 'consolIgnore', 'refDec', 'lotes'];
const META_CFG = ['weights', 'segMap', 'prodReg', 'mrrPrec', 'mrrPlanComp', 'mrrComp', 'compCrit', 'renovDays', 'regimes', 'alertDays', 'staleDays', 'segUnit', 'mrrTol', 'exec', 'refComp', 'intMap', 'ai', 'apiKey', 'key', 'intEst', 'cnpjCfg'];
const anyDirty = () => dirtyC.size || delC.size || dirtyI.size || delI.size || dirtyS.size || delS.size || dirtyP.size || delP.size || dirtyMeta || Object.values(GCOL).some(g => g.d.size || g.x.size);
const dmClearQueues = () => { clearTimeout(timer); [dirtyC, delC, dirtyI, delI, dirtyS, delS, dirtyP, delP].forEach(s => s.clear()); dirtyMeta = false; Object.values(GCOL).forEach(g => { g.d.clear(); g.x.clear(); }); };
async function flushNow() { // grava tudo o que está pendente e só retorna quando a fila esvaziou (ou falhou)
  clearTimeout(timer);
  for (let i = 0; i < 8; i++) { let w = 0; while (saving && w++ < 200) await new Promise(r => setTimeout(r, 25)); if (!anyDirty()) return true; await flush(); }
  return !anyDirty();
}
const sumC = f => clients().reduce((n, c) => n + f(c), 0);
function dmInv() {
  const mine = S.solutions.filter(r => !r._priv && r.criadoPor === ME.id && (r.hist || []).every(h => !h.por || h.por === ME.id));
  const ai = S.meta.ai || {};
  return { cli: clients().length, fic: sumC(c => (c.fichas || []).length), doc: sumC(c => (c.docs || []).filter(d => !d.prv).length), dec: sumC(c => Object.keys(c.act || {}).length), inb: S.inbox.length, pes: S.pesq.length, mar: S.marcos.length, reg: S.regs.length, cons: S.merges.length, snap: S.msnap.length, log: S.intlog.length, cnp: S.cnpj.length, ins: S.insights.length, ocr: S.ocr.length, hash: (S.meta.files || []).length,
    solPriv: S.solutions.filter(r => r._priv).length, solMine: mine.length, solOutros: S.solutions.filter(r => !r._priv).length - mine.length, mineIds: mine.map(r => r.id), cfg: !!(ai.backendUrl || ai.teste || (S.meta.prodReg && Object.keys(S.meta.prodReg).length) || S.meta.exec || S.meta.regimes) };
}
async function dmPurge(ref) { // apaga TODOS os documentos, relê (em até 4 passadas, com espera) e só dá ok se a coleção continuar vazia
  if (!ref) return { achou: 0, restam: 0, ok: true };
  let achou = 0, n = 0, err = '', restam = 0;
  for (let pass = 0; pass < 4; pass++) {
    const l = await wto(ref.get(), 20000); restam = l.docs.length; if (pass === 0) achou = restam;
    if (!restam) break;
    for (const d of l.docs) { try { await wto(ref.doc(d.id).delete(), 10000); n++; } catch (e) { err = e.message || String(e); } }
    await new Promise(r => setTimeout(r, 400));
  }
  const chk = await wto(ref.get(), 20000); return { achou, apagados: n, restam: chk.docs.length, ok: chk.docs.length === 0, err };
}
function dmCols() { return { clientes: CL, inbox: INB, pesquisas: PES, marcos: GCOL.marcos.ref, regulatorio: GCOL.regulatorio.ref, consolidacoes: GCOL.consol.ref, consolidacoes_snap: GCOL.consolsnap.ref, integ_log: GCOL.integlog.ref, cnpj: GCOL.cnpj.ref, insights: GCOL.insights.ref, ocr: GCOL.ocr.ref, ocrimg: GCOL.ocrimg.ref }; }
function dmResetUI() { UI.sel = null; UI.wiz = null; UI.busy = ''; UI.log = []; UI.fb = null; UI.comp = ''; UI.confirm = null; UI.view = 'importar'; UI.f = { q: '', seg: '', doc: '', fs: '', prio: '', conf: '', dq: '', sort: 'score' }; UI.plan = { q: '', st: '', tipo: '', prio: '' }; UI.segSel = null; UI.bkpAt = null; DM.plan = null; const q = $('#gq'); if (q) q.value = ''; }

/* ---- operação genérica protegida: bloqueia gravações, invalida o que estava em andamento, grava e confere ---- */
async function dmRun(label, fn) {
  if (DM.locked) return toast('Outra operação de dados está em andamento.');
  DM.locked = true; DM.epoch++; DM.res = { label, at: new Date().toISOString(), itens: [], ok: true }; UI.busy = label + '…'; render();
  try {
    dmClearQueues(); let w = 0; while (saving && w++ < 200) await new Promise(r => setTimeout(r, 25)); dmClearQueues();
    await fn(DM.res);
  } catch (e) { DM.res.ok = false; DM.res.itens.push({ k: 'Erro', t: e.message || String(e), bad: true }); }
  DM.locked = false; UI.busy = ''; dmClearQueues(); render(); toast(DM.res.ok ? label + ': concluído e conferido no banco.' : label + ': NÃO concluído — veja o relatório em Gerenciamento de dados.');
}
const dmChk = (res, nome, r) => { res.itens.push({ k: nome, t: `${r.achou} no banco → ${r.restam} restante(s)${r.err ? ' • erro: ' + r.err : ''}`, bad: !r.ok }); if (!r.ok) res.ok = false; };
async function dmSaveMeta(res) { // grava o documento principal já limpo e confere
  const m = { meta: { ...S.meta, files: (S.meta.files || []).slice(-400) }, kbExtra: S.kbExtra };
  if (META) { await wto(META.set(clone(m)), 15000); const g = await wto(META.get(), 15000), d = g.exists ? g.data() : null; const okm = !!d && (d.meta.files || []).length === (m.meta.files || []).length && Object.keys(d.meta.act || {}).length === Object.keys(m.meta.act || {}).length; res.itens.push({ k: 'Documento principal', t: okm ? 'regravado e conferido' : 'divergência ao reler', bad: !okm }); if (!okm) res.ok = false; }
}

/* ---- escopos ---- */
function dmMemCarteira() {
  S.clients = {}; S.inbox = []; S.pesq = []; S.marcos = []; S.regs = []; S.merges = []; S.msnap = []; S.intlog = []; S.cnpj = []; S.insights = []; S.ocr = []; S.ocrimg = [];
  META_DADOS.forEach(k => { delete S.meta[k]; }); S.meta.files = []; S.meta.act = {}; S.meta.segOv = {};
}
const dmDefaultCfg = () => { META_CFG.forEach(k => { delete S.meta[k]; }); S.meta.weights = { ...DEF_WEIGHTS }; try { localStorage.removeItem('sb.col'); } catch { } UI.sbCol = false; };
async function dmPurgeAllCart(res) {
  const cols = dmCols(); for (const [n, ref] of Object.entries(cols)) dmChk(res, 'Coleção ' + n, await dmPurge(ref));
}
async function dmDoCarteira() { await dmRun('Limpar toda a carteira', async res => { await dmPurgeAllCart(res); dmMemCarteira(); await dmSaveMeta(res); dmResetUI(); }); }
async function dmDoCfg() { await dmRun('Limpar configurações e credenciais', async res => { dmDefaultCfg(); await dmSaveMeta(res); res.itens.push({ k: 'Credenciais', t: 'URL e identificação do backend removidas deste app. A chave da IA nunca esteve aqui: para revogá-la, remova o segredo no próprio backend (ex.: wrangler secret delete).' }); }); }
async function dmDoZero(sc) {
  await dmRun('Zerar aplicação individual', async res => {
    const inv = dmInv();
    if (sc.cart) { await dmPurgeAllCart(res); dmMemCarteira(); }
    if (sc.cfg) dmDefaultCfg();
    if (sc.priv) { dmChk(res, 'Soluções privadas', await dmPurge(SOL)); dmChk(res, 'Notas internas de soluções', await dmPurge(SNOTE)); dmChk(res, 'Conteúdo integral importado (TDN/links)', await dmPurge(window.__HOSTED__ ? null : SCONT)); S.solutions = S.solutions.filter(r => !r._priv); S.solutions.forEach(r => { delete r.notasInt; }); }
    if (sc.cat === 'mine') { // só o que esta conta criou e ninguém mais alterou; o resto do catálogo compartilhado permanece
      let n = 0; for (const id of inv.mineIds) { await wto(SOLC.doc(id).delete(), 10000); const rr = S.solutions.find(x => x.id === id); if (rr?.conteudoRef) await scDelete(id, rr.conteudoRef.chunks); n++; }
      const chk = await wto(SOLC.get(), 15000), left = inv.mineIds.filter(id => chk.docs.some(d => d.id === id));
      S.solutions = S.solutions.filter(r => !inv.mineIds.includes(r.id)); if (left.length) res.ok = false;
      res.itens.push({ k: 'Catálogo compartilhado', t: `${n} registro(s) criado(s) só por você removido(s); ${inv.solOutros} de outras contas ou com alterações de terceiros preservado(s)${left.length ? ' • FALHOU em ' + left.length : ''}`, bad: !!left.length });
    } else if (sc.cart || sc.cfg || sc.priv) res.itens.push({ k: 'Catálogo compartilhado', t: 'não alterado' });
    await dmSaveMeta(res); dmResetUI();
  });
}
async function dmDelCliente(key) {
  const c = S.clients[key]; if (!c) return;
  await dmRun('Excluir cliente', async res => {
    const hashes = [...(c.fichas || []), ...(c.docs || [])].map(x => x.hash).filter(Boolean), nome = c.name;
    delete S.clients[key]; await wto(CL.doc(key).delete(), 10000);
    const p = S.pesq.filter(x => x.alvoKey === key); for (const x of p) await wto(PES.doc(x.id).delete(), 10000); S.pesq = S.pesq.filter(x => x.alvoKey !== key);
    S.inbox.forEach(it => { if ((it.cands || []).some(cd => cd.key === key)) { it.cands = it.cands.filter(cd => cd.key !== key); dirtyI.add(it.id); } });
    const ms = S.merges.filter(m => m.mainId === key || m.dupId === key || (m.prevIds || []).includes(key)); for (const m of ms) { dropG('consol', m.id); S.msnap.filter(s => s.merge === m.id).forEach(s => dropG('consolsnap', s.id)); }
    S.merges = S.merges.filter(m => !ms.includes(m)); S.msnap = S.msnap.filter(s => !ms.some(m => m.id === s.merge));
    delete (S.meta.segOv || {})[key]; delete (S.meta.segSec || {})[key]; Object.keys(S.meta.consolIgnore || {}).forEach(k => { if (k.includes(key)) delete S.meta.consolIgnore[k]; });
    hashes.forEach(h => dropHash(h)); if (UI.sel === key) UI.sel = null; DM.plan = null; touchMeta();
    await flushNow(); const g = await wto(CL.doc(key).get(), 10000);
    res.itens.push({ k: 'Cliente', t: `${nome}: ${g.exists ? 'AINDA EXISTE no banco' : 'removido do banco'} • ${hashes.length} arquivo(s) liberado(s) para novo envio • ${p.length} pesquisa(s) de IA • ${ms.length} registro(s) de consolidação`, bad: g.exists }); if (g.exists) res.ok = false;
  });
}
async function dmDelDoc(key, id) {
  const c = S.clients[key], d = c?.docs.find(x => x.id === id); if (!d) return;
  await dmRun('Excluir documento', async res => { c.docs = c.docs.filter(x => x.id !== id); dropHash(d.hash); touchC(key); touchMeta(); runAnalysis(c, 'Documento excluído: ' + d.name); touchC(key); await flushNow(); res.itens.push({ k: 'Documento', t: `${d.name} removido de ${c.name}; arquivo liberado para novo envio.` }); });
}
async function dmDelFichaPlan(key, id) {
  const c = S.clients[key], f = c?.fichas.find(x => x.id === id); if (!f) return;
  await dmRun('Excluir ficha', async res => { deleteFicha(key, id); await flushNow(); res.itens.push({ k: 'Ficha', t: `${f.file} removida de ${c.name}; indicadores recalculados.` }); });
}

/* ---- planos (o que será removido) ---- */
function dmPlanItems(p) {
  const inv = dmInv();
  if (p.t === 'cli') { const c = S.clients[p.key]; if (!c) return []; return [['Cliente', c.name], ['Fichas de faturamento', (c.fichas || []).length], ['Documentos', (c.docs || []).filter(d => !d.prv).length], ['Decisões e plano de ação', Object.keys(c.act || {}).length], ['Pesquisas de IA do cliente', S.pesq.filter(x => x.alvoKey === p.key).length], ['Registros de consolidação ligados', S.merges.filter(m => m.mainId === p.key || m.dupId === p.key).length], ['Arquivos liberados para novo envio', 'sim']]; }
  if (p.t === 'cart') return [['Clientes', inv.cli], ['Fichas', inv.fic], ['Documentos', inv.doc], ['Decisões', inv.dec], ['Pendências de associação', inv.inb], ['Pesquisas de IA', inv.pes], ['Marcos e regulatório', inv.mar + inv.reg], ['Consolidações e snapshots', inv.cons + inv.snap], ['Registro de integrações', inv.log], ['Consultas de CNPJ (histórico/cache)', inv.cnp], ['Insights de mercado', inv.ins], ['Hashes de arquivos (dedupe)', inv.hash], ['Catálogo compartilhado', 'NÃO é alterado'], ['Configurações', 'NÃO são alteradas']];
  if (p.t === 'cfg') return [['Configuração de IA / backend (URL, ID da chave, teste)', 'removida'], ['Pesos, critérios, regimes, cadastro de produtos, competências, integrações', 'voltam ao padrão'], ['Preferências locais (menu recolhido)', 'removidas'], ['Chave da IA', 'não está no app: revogue no backend'], ['Carteira e catálogo', 'NÃO são alterados']];
  if (p.t === 'zero') return [['Carteira e histórico', p.cart ? `${inv.cli} cliente(s), ${inv.fic} ficha(s), ${inv.doc} doc(s)…` : 'mantidos'], ['Configurações e credenciais', p.cfg ? 'removidas' : 'mantidas'], ['Soluções privadas e notas internas', p.priv ? `${inv.solPriv} privada(s)` : 'mantidas'], ['Catálogo compartilhado', p.cat === 'mine' ? `remove ${inv.solMine} registro(s) criado(s) só por você; preserva ${inv.solOutros} de terceiros` : 'não alterado']];
  return [];
}
const DM_TXT = { cli: 'Excluir cliente e dados relacionados', cart: 'Limpar toda a carteira', cfg: 'Limpar configurações e credenciais', zero: 'Zerar aplicação individual' };
const DM_NEEDWORD = { cart: 'APAGAR', zero: 'ZERAR' };
function dmPlanPanel() {
  const p = DM.plan; if (!p) return ''; const it = dmPlanItems(p), w = DM_NEEDWORD[p.t], bk = UI.bkpAt && Date.parse(UI.bkpAt) >= p.since;
  return `<div class="alert dm-plan" role="alertdialog" aria-labelledby="dmpt"><h3 id="dmpt">${DM_TXT[p.t]} — o que será removido</h3><table class="tbl sm"><tbody>${it.map(([a, b]) => `<tr><td>${esc(a)}</td><td><b>${esc(String(b))}</b></td></tr>`).join('')}</tbody></table>
  <p class="sm">${bk ? '<span class="pill p-ok">Backup baixado</span>' : '<span class="pill p-warn">Backup não baixado</span>'} Recomendado antes de excluir. O backup não inclui credenciais.</p>
  ${w ? `<label class="sm">Digite <b>${w}</b> para confirmar <input id="dmword" data-i="dmword" autocomplete="off" value="${esc(p.word || '')}" style="max-width:140px"></label>` : ''}
  <div class="row" style="margin-top:8px"><button class="btn ghost sm" data-a="expJSON" ${clients().length || S.solutions.some(r => r._priv) ? '' : 'disabled'}>Baixar backup</button><span class="sp"></span><button class="btn ghost sm" data-a="dmCancel">Cancelar</button><button class="btn dng sm" data-a="dmGo" ${w && (p.word || '').trim().toUpperCase() !== w ? 'disabled' : ''}>Confirmar exclusão</button></div></div>`;
}
function vDados() {
  const inv = dmInv(), cs = clients().sort((a, b) => a.name.localeCompare(b.name)), sel = S.clients[DM.selCli] ? DM.selCli : '';
  const opt = cs.map(c => `<option value="${esc(c.key)}" ${c.key === sel ? 'selected' : ''}>${esc(c.name)}${c.code ? ' • ' + esc(c.code) : ''}</option>`).join(''), cc = sel ? S.clients[sel] : null;
  let h = `<div class="grid2"><div class="card"><h3>Inventário do que está salvo</h3><div class="kv sm">${[['Clientes', inv.cli], ['Fichas', inv.fic], ['Documentos', inv.doc], ['Decisões', inv.dec], ['Pendências', inv.inb], ['Pesquisas de IA', inv.pes], ['Consolidações', inv.cons], ['Soluções privadas', inv.solPriv], ['Catálogo (criadas por você / outras)', inv.solMine + ' / ' + inv.solOutros]].map(([a, b]) => `<div><span class="muted">${a}</span><b>${b}</b></div>`).join('')}</div><p class="muted sm">Cada exclusão apresenta o que será removido, oferece backup e, depois de executada, relê o banco para conferir. Nada é restaurado ou recriado sozinho.</p></div>
  <div class="card"><h3>Excluir cliente e dados relacionados</h3><label class="sm">Cliente<select data-c="dmCli"><option value="">— selecione —</option>${opt}</select></label><div class="row" style="margin-top:8px"><button class="btn dng sm" data-a="dmPlan" data-t="cli" ${sel ? '' : 'disabled'}>Excluir cliente…</button></div>
  ${cc ? `<h4 style="margin-top:12px">Fichas e documentos de ${esc(cc.name)}</h4>${[...(cc.fichas || []).map(f => ['f', f.id, f.file + (f.loc ? ' • ' + f.loc : '')]), ...(cc.docs || []).filter(d => !d.prv).map(d => ['d', d.id, d.name])].map(([t, id, n]) => `<div class="row sm" style="justify-content:space-between"><span>${t === 'f' ? 'Ficha' : 'Documento'} — ${esc(n)}</span><button class="btn ghost sm" data-a="dmDelItem" data-t="${t}" data-k="${esc(sel)}" data-id="${esc(id)}">Excluir</button></div>`).join('') || '<p class="muted sm">Sem fichas ou documentos.</p>'}` : ''}</div></div>`;
  h += `<div class="card"><h3>Limpeza em lote</h3><div class="row"><button class="btn dng sm" data-a="dmPlan" data-t="cart">Limpar toda a carteira…</button><button class="btn dng sm" data-a="dmPlan" data-t="cfg">Limpar configurações e credenciais…</button></div>
  <h4 style="margin-top:12px">Zerar aplicação individual</h4><div class="sm"><label><input type="checkbox" data-c="dmZ" data-f="cart" ${DM.z?.cart ? 'checked' : ''}> Carteira e histórico</label><br><label><input type="checkbox" data-c="dmZ" data-f="cfg" ${DM.z?.cfg ? 'checked' : ''}> Configurações e credenciais</label><br><label><input type="checkbox" data-c="dmZ" data-f="priv" ${DM.z?.priv ? 'checked' : ''}> Soluções privadas e notas internas (${inv.solPriv})</label><br><label><input type="checkbox" data-c="dmZ" data-f="cat" ${DM.z?.cat ? 'checked' : ''}> Catálogo compartilhado: remover só os ${inv.solMine} registro(s) criado(s) exclusivamente por você</label></div>
  <p class="muted sm">O catálogo é compartilhado entre contas: registros de outras contas, ou alterados por elas, nunca são apagados. "Limpar carteira" não toca no catálogo.</p><button class="btn dng sm" data-a="dmPlan" data-t="zero" ${DM.z && (DM.z.cart || DM.z.cfg || DM.z.priv || DM.z.cat) ? '' : 'disabled'}>Zerar selecionados…</button></div>`;
  h += dmPlanPanel();
  if (DM.res) h += `<div class="card ${DM.res.ok ? '' : 'dm-bad'}"><h3>Relatório: ${esc(DM.res.label)} ${DM.res.ok ? '<span class="pill p-ok">conferido</span>' : '<span class="pill p-bad">falhou</span>'}</h3><table class="tbl sm"><tbody>${DM.res.itens.map(i => `<tr><td>${esc(i.k)}</td><td style="${i.bad ? 'color:var(--bad)' : ''}">${esc(i.t)}</td></tr>`).join('')}</tbody></table><p class="muted sm">${fmtDate(DM.res.at)}</p></div>`;
  return h;
}
const DM_ACT = {
  dmPlan: t => { const ty = t.dataset.t; DM.plan = { t: ty, key: DM.selCli, since: Date.now() - 1, word: '' }; if (ty === 'zero') Object.assign(DM.plan, { cart: !!DM.z?.cart, cfg: !!DM.z?.cfg, priv: !!DM.z?.priv, cat: DM.z?.cat ? 'mine' : 'none' }); UI.bkpAt = null; render(); },
  dmCancel: () => { DM.plan = null; render(); },
  dmGo: () => { const p = DM.plan; if (!p) return; const w = DM_NEEDWORD[p.t]; if (w && (p.word || '').trim().toUpperCase() !== w) return toast('Digite a palavra de confirmação.'); DM.plan = null; ({ cli: () => dmDelCliente(p.key), cart: dmDoCarteira, cfg: dmDoCfg, zero: () => dmDoZero(p) })[p.t](); },
  dmDelItem: t => { const { t: ty, k, id } = t.dataset; ty === 'f' ? dmDelFichaPlan(k, id) : dmDelDoc(k, id); }
};
