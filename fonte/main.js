/* ===== EVENTOS E INICIALIZAÇÃO ===== */
const ACT = {
  nav: t => { UI.view = t.dataset.v; UI.sbOpen = false; render(); window.scrollTo(0, 0); },
  hojeOk: t => { setAct(t.dataset.id, t.dataset.k || null, { status: 'Concluído' }); render(); toast('Ação concluída.'); },
  planReabrir: t => { setAct(t.dataset.id, t.dataset.k || null, { status: 'Pendente' }); render(); },
  planSelAll: () => { UI.planSel ||= {}; (UI.planScope || []).forEach(r => { UI.planSel[r.id] = r.key || ''; }); render(); },
  planSelClr: () => { UI.planSel = {}; render(); },
  planBulkGo: () => planBulkGo(UI.planBulk),
  planBulkMe: () => planBulkGo(ME.nome || ME.id),
  fToggle: () => { UI.fOpen = !UI.fOpen; render(); const b = $('#fbtn'); if (b) b.focus(); },
  fApply: () => { UI.fOpen = false; render(); const b = $('#fbtn'); if (b) b.focus(); },
  openTab: (t, e) => { e.preventDefault(); UI.sel = t.dataset.k; UI.view = 'cliente'; UI.ctab = t.dataset.v; render(); window.scrollTo(0, 0); },
  open: (t, e) => { e.preventDefault(); UI.sel = t.dataset.k; UI.view = 'cliente'; render(); window.scrollTo(0, 0); cnAutoAoAbrir(t.dataset.k); },
  openSeg: t => { UI.segSel = t.dataset.id || null; UI.view = 'segmentos'; render(); window.scrollTo(0, 0); },
  more: () => { UI.lim += 300; retbl(); },
  cancelWiz: () => { UI.wiz = null; render(); },
  reassoc: () => { reassocInbox(); render(); },
  dropInbox: t => { rmInbox(t.dataset.id); render(); },
  delF1: t => { UI.confirm = 'del:' + t.dataset.id; render(); }, delF0: () => { UI.confirm = null; render(); }, delF: t => { UI.confirm = null; deleteFicha(t.dataset.k, t.dataset.id); },
  dismErr: t => dismissFichaErr(t.dataset.k, t.dataset.id), markRev: t => markReviewed(t.dataset.k, t.dataset.id),
  refAuto: () => setRefComp(''), filtSem: () => { UI.f = { ...UI.f, fs: 'nao_carregada' }; UI.view = 'clientes'; render(); window.scrollTo(0, 0); },
  ...CE_ACT, ...RX_ACT, ...MKV_ACT, ...SM_ACT, ...SG_ACT, ...SEM_ACT, ...FN_ACT, ...COV_ACT, ...VAL_ACT, ...REL_ACT, ...TK_ACT, ...UT_ACT, ...RD_ACT, ...DOR_ACT, ...DT_ACT, ...ICAP_ACT, ...HK_ACT, solNew, solSave, solCancel: () => { UI.solEdit = null; render(); }, solClose: () => { UI.solSel = null; render(); },
  solView: t => { UI.solSel = t.dataset.id; UI.solEdit = null; render(); window.scrollTo(0, 0); }, solEdit: t => solEditOpen(t.dataset.id),
  solForce: () => { UI.solEdit.d.ackDup = true; solSave(); }, solMerge: t => solMergeInto(t.dataset.id),
  solArq: t => solArchive(t.dataset.id, !!t.dataset.on), solSeed: solRestoreSeed, pendOk: t => solResolvePend(t.dataset.id, +t.dataset.i, !!t.dataset.adopt),
  solLink: t => solAddLink(t.dataset.id, $('#lk-t').value.trim(), $('#lk-u').value.trim()),
  ...LK_ACT, impApply: solImportApply, impCancel: () => { UI.solImp = null; render(); },
  pesqCli: t => pesqPrepare('cliente', t.dataset.k), pesqSeg: t => pesqPrepare('segmento', t.dataset.id), pesqSegBtn: () => pesqPrepare('segmento', $('#ps-seg').value), pesqProd: t => pesqPrepare('produto', t.dataset.id),
  pesqGo: pesqEnviar, pesqNo: () => { UI.pesqReq = null; render(); }, pesqOpen: t => { UI.pesqSel = UI.pesqSel === t.dataset.id ? null : t.dataset.id; render(); },
  pesqRm: t => pesqRemove(t.dataset.id), pesqInc: t => pesqIncorporar(t.dataset.id, +t.dataset.i), pesqDesc: t => pesqDescartar(t.dataset.id, +t.dataset.i),
  aiTest: aiTestRequest, aiPack,
  ctab: t => { UI.ctab = t.dataset.v; render(); },
  evSt: t => { UI.lfOpen = t.dataset.p.split('.').pop(); evAct(t.dataset.k, t.dataset.p, t.dataset.id, t.dataset.st); },
  evAdd: t => { const x = t.dataset.x; UI.lfOpen = t.dataset.p.split('.').pop(); evAdd(t.dataset.k, t.dataset.p, { v: $('#v_' + x).value, cls: $('#c_' + x).value, ref: $('#r_' + x).value }); },
  relAdd: t => { const v = $('#rl_v').value.trim(), m = v.match(/(?:12\.1\.)?(\d{2,4})$/); if (!m || !relKey('12.1.' + m[1])) return toast('Release inválida (ex.: 12.1.2510).'); evAdd(t.dataset.k, 'rel', { v: '12.1.' + m[1], cls: 'FATO', ref: $('#rl_f').value, extra: { produto: $('#rl_p').value, tipo: 'producao' } }); },
  cdocOk: t => cdocConfirm(t.dataset.k, t.dataset.id), cdocRm: t => cdocRemove(t.dataset.k, t.dataset.id),
  flAdd: t => licRegraAdd(t.dataset.k, { perfil: $('#fl_p').value, permitidas: $('#fl_ok').value, restricoes: $('#fl_no').value, fonte: $('#fl_f').value }), flRm: t => licRegraRm(t.dataset.k, t.dataset.id),
  capexAdd: t => capexAdd(t.dataset.k, $('#cx_m').value, $('#cx_v').value, $('#cx_d').value, $('#cx_f').value), capexRm: t => capexRm(t.dataset.k, t.dataset.id),
  fisSave: t => { const c = S.clients[t.dataset.k], ref = $('#fs_fonte').value.trim(), F = c.fis, ch = []; const val = id => $('#' + id)?.value || '';
    const cmp = (cur, v) => (cur?.v || '') !== v; if (cmp(F.regime, val('fs_regime'))) ch.push(['regime', val('fs_regime')]); if (cmp(F.uf, val('fs_uf'))) ch.push(['uf', val('fs_uf')]); if (cmp(F.atividade, val('fs_atividade').trim())) ch.push(['atividade', val('fs_atividade').trim()]);
    Object.keys(OPS).forEach(o => { if (cmp(F.ops[o], val('fs_op_' + o))) ch.push(['op:' + o, val('fs_op_' + o)]); });
    if (!ch.length) return toast('Nenhuma alteração.'); if (!ref) return toast('Informe a fonte das alterações.');
    ch.forEach(([k, v]) => fisPut(c, k, v, { tipo: 'manual', ref }));
    reanalyze([c.key], `Perfil fiscal atualizado (${ch.map(x => x[0].replace('op:', '')).join(', ')})`); render(); },
  roiAdd: t => roiAdd(t.dataset.k, t.dataset.t), roiRm: t => roiRm(t.dataset.k, t.dataset.id),
  execMode: t => { UI.execMode = t.dataset.v; render(); }, execPdf: t => execExport(t.dataset.k),
  shGo: () => { if (shSave($('#sh_url').value, $('#sh_min').value, $('#sh_auto').checked)) shSync(true); }, shNow: () => shSync(true), shOff: () => { if (confirm('Desvincular a planilha? Os clientes e o histórico serão mantidos.')) shUnlink(); },
  fcGo: () => { if (fcSave($('#fc_url').value, $('#fc_min').value, $('#fc_auto').checked)) fcSync(true); }, fcNow: () => fcSync(true), fcOff: () => { if (confirm('Desvincular a planilha do Forecast? O histórico sincronizado será mantido.')) fcUnlink(); },
  fcPer: t => { UI.fc ||= {}; UI.fc.per = t.dataset.v; delete UI.fc.sel; render(); }, fcLinkGo: t => fcLinkConfirm(t.dataset.id, $('#fcl_' + t.dataset.id).value), fcLinkOff: t => fcLink(t.dataset.id, ''), fcLinkSug: t => { if (S.clients[t.dataset.k]) fcLink(t.dataset.id, t.dataset.k); },
  fcSimOpen: (t, e) => { UI.fc ||= {}; setTimeout(() => { UI.fc.simOpen = !!document.getElementById('fc-sim')?.open; }, 0); }, fcSimLimpar: () => { S.meta.fcSim = { pAberto: null, pAssin: null, recBase: '', porOpp: {} }; touchMeta(); render(); },
  empTab: t => { empUI().tab = t.dataset.v; if (t.dataset.ir) UI.view = 'mrr'; render(); window.scrollTo(0, 0); }, empGo: t => empIr(JSON.parse(t.dataset.f)), empBase: t => empSetCfg('baseRecencia', t.dataset.v),
  empXlsx: () => empXlsx(), empPdf: () => empPdf(),
  empApply: () => empAplicar($('#emp_data')?.value), empCancel: () => { empUI().pend = null; render(); }, gstAddI: t => empGstAddI(t.dataset.k), gstDelI: t => empGstDelI(t.dataset.k, t.dataset.id),
  fcMore: () => { UI.fc ||= {}; UI.fc.lim = (UI.fc.lim || 150) + 150; render(); },
  briefOpen: t => { const c = S.clients[t.dataset.k]; UI.ctab = 'briefing'; if (c && !briefFichas(c).length) toast('Para gerar o briefing é necessário anexar a ficha de faturamento do cliente.'); render(); }, briefPdf: t => briefExport(t.dataset.k),
  refOk: t => refApprove(t.dataset.id), refNo: t => refDiscard(t.dataset.id), refAll: () => refApproveOfficial(), recArq: t => recArchive(t.dataset.col, t.dataset.id),
  mkNew: () => recNew('marcos', { produto: $('#mk_p').value, release: /^12\.1\./.test($('#mk_r').value.trim()) ? $('#mk_r').value.trim() : '12.1.' + $('#mk_r').value.trim(), tipo: $('#mk_t').value, data: $('#mk_d').value, fonteT: $('#mk_ft').value, fonteU: $('#mk_fu').value }),
  rgNew: () => { const q = s => [...document.querySelectorAll(s + ':checked')].map(x => x.value); recNew('regulatorio', { nome: $('#rg_n').value.trim(), orgao: $('#rg_o').value, fonteT: $('#rg_ft').value, fonteU: $('#rg_fu').value, publicacao: $('#rg_pub').value, vigencia: $('#rg_vig').value, prazo: $('#rg_pz').value, testesIni: $('#rg_ti').value, testesFim: $('#rg_tf').value, regimes: q('.rg_reg'), ops: q('.rg_op'), acoes: q('.rg_ac'), ufs: $('#rg_ufs').value.split(/[,;\s]+/).map(x => x.toUpperCase()).filter(x => UFS.includes(x)), nota: $('#rg_nota').value }); },
  alSave: () => { setAlerts($('#al_d').value); const sd = +$('#al_s').value; if (sd > 0) { S.meta.staleDays = sd; touchMeta(); render(); } },
  pesqRef: t => pesqPrepare(t.dataset.t),
  confF: t => confirmFicha(t.dataset.k, t.dataset.id, t.dataset.t), rejF: t => rejectFicha(t.dataset.k, t.dataset.id, t.dataset.t),
  expCSV: exportCSV, expXLSX: exportXLSX, expJSON: exportJSON,
  expCli: t => { const c = S.clients[t.dataset.k]; offer(`relatorio-${safeKey(c.code || c.name).slice(0, 40)}.html`, clientReport(c)); },
  expInfo: () => offer('infografico-carteira.html', infographic()),
  wreset: () => { S.meta.weights = { ...DEF_WEIGHTS }; reanalyzeAll(); render(); },
  copyfb: async () => { const ta = $('#fbta'); ta.select(); try { await navigator.clipboard.writeText(ta.value); toast('Copiado.'); } catch { document.execCommand && document.execCommand('copy'); toast('Selecionado — use Ctrl+C.'); } },
  closefb: () => { UI.fb = null; render(); },
  /* rodada 3 */
  tplDown: () => downloadTemplate(),
  impPrev: () => { const m = UI.wiz.map; if (m.name == null && m.code == null && m.cnpj == null) return toast('Mapeie ao menos Razão social, Código ou CNPJ.'); UI.wiz.step = 'prev'; render(); window.scrollTo(0, 0); },
  impBack: () => { UI.wiz.step = null; render(); }, impGo: () => impApplyPlan(),
  segGo: t => { UI.f = { ...UI.f, seg: t.dataset.id }; UI.lim = 200; UI.view = 'clientes'; render(); window.scrollTo(0, 0); },
  segStudy: t => { UI.segStudy = t.dataset.id || null; render(); }, segCfg: () => { UI.segCfg = !UI.segCfg; render(); },
  fclr: t => { if (t.dataset.k === '*') UI.f = { ...UI.f, q: '', seg: '', fs: '', prio: '', conf: '', dq: '', sol: '', est: '', hosp: '', rel: '', ult: '', prox: '', ...EMP_FCLR }; else UI.f[t.dataset.k] = ''; render(); },
  openCad: t => { UI.sel = t.dataset.k; UI.view = 'cliente'; UI.ctab = 'cadastro'; render(); window.scrollTo(0, 0); },
  cadEd: t => { UI.cadEd = t.dataset.k + '|' + t.dataset.f; render(); }, cadCancel: () => { UI.cadEd = null; render(); },
  cadSave: t => { const k = t.dataset.f, v = $('#ce_v')?.value ?? ''; UI.cadEd = null; cadEdit(t.dataset.k, k, k === 'fat' ? v.trim() : v, { ref: $('#ce_f').value, dref: $('#ce_d').value, st: $('#ce_st').value, motivo: $('#ce_m').value, moeda: $('#ce_moeda')?.value, exercicio: $('#ce_ex')?.value?.trim() }); },
  ctNew: t => ctNew(t.dataset.k, $('#ct_new').value),
  ctEd: t => { UI.cadEd = t.dataset.k + '|' + t.dataset.id + '|' + t.dataset.f; render(); },
  ctSave: t => { const o = { ref: $('#cte_f').value, st: $('#cte_st').value, motivo: $('#cte_m').value }, v = $('#cte_v').value; if (!o.ref.trim()) return toast('Informe a fonte (contrato, aditivo…).'); UI.cadEd = null; ctEdit(t.dataset.k, t.dataset.id, t.dataset.f, v, o); },
  decOpp: t => decFromBox(t),
  openOpp: (t, e) => { e.preventDefault(); UI.sel = t.dataset.k; UI.view = 'cliente'; UI.ctab = 'resumo'; render(); window.scrollTo(0, 0); },
  cfRes: t => { const c = S.clients[t.dataset.k], x = (c.cadConf || []).find(y => y.id === t.dataset.id); if (x) { x.res = 'revisado em ' + new Date().toLocaleDateString('pt-BR') + ' (mantido o valor atual)'; touchC(c.key); render(); } },
  solNota: t => { const r = S.solutions.find(x => x.id === t.dataset.id), v = $('#sn_t').value.trim(); if (!r || !v) return toast('Escreva a nota interna.'); r.notasInt = [...(r.notasInt || []), { t: v, at: nowISO() }]; hist(r, 'nota interna', 'Nota comercial interna adicionada (não altera informação oficial)'); touchSol(r.id); render(); },
  solNotaRm: t => { const r = S.solutions.find(x => x.id === t.dataset.id); if (!r) return; r.notasInt.splice(+t.dataset.i, 1); hist(r, 'nota interna', 'Nota comercial interna removida'); touchSol(r.id); render(); },
  r24All: () => { UI.r24 = true; refApproveOfficial(new Set(REF24.all.map(x => x.id))); },
};
document.addEventListener('keydown', e => { if (e.key !== 'Enter' && e.key !== ' ') return; const t = e.target; if (!(t instanceof HTMLElement) || !t.matches('[data-a][tabindex]')) return; e.preventDefault(); t.click(); });
Object.assign(ACT, CONSOL_ACT, SHELL_ACT, PROD_ACT, ACCT_ACT, DM_ACT, LOTE_ACT, IA_ACT, CN_ACT, TD_ACT, MK_ACT, PEND_ACT, OC_ACT, OP_ACT, PR_ACT, ADM_ACT, ADM_CAT_ACT, ADM_REG_ACT, RGF_ACT, BD_ACT, ATU_ACT, PT_ACT, LEM_ACT, ONB_ACT, ONDA2_ACT, ONDA3_ACT, SOLX_ACT); telActWire();
/* Um clique = uma operação: ativações idênticas (mesma ação e alvo) em <350 ms são ignoradas */
let lastClk = { k: '', t: 0 };
document.addEventListener('click', e => { const t = e.target.closest('[data-a]'); if (!t || !ACT[t.dataset.a]) return; if (t.dataset.a === 'open' && e.target.closest('.noopen')) return;
  const d = t.dataset, k = [d.a, d.k, d.id, d.m, d.d, d.f, d.v, d.i].join('|'), now = Date.now(); if (k === lastClk.k && now - lastClk.t < 350) return; lastClk = { k, t: now }; ACT[d.a](t, e); });
document.addEventListener('change', async e => {
  const t = e.target, c = t.dataset.c, id = t.id; const files = t.files ? [...t.files] : null;
  if (c === 'dmCli') { DM.selCli = t.value; DM.plan = null; render(); return; }
  if (c === 'dmZ') { (DM.z ||= {})[t.dataset.f] = t.checked; render(); return; }
  if (id === 'f-cart' && files?.length) { await loadPortfolio(files[0]); t.value = ''; return; }
  if (id === 'f-fic' && files?.length) { const fs = files; t.value = ''; await ingestLote(fs, 'ficha'); return; }
  if (id === 'f-doc' && files?.length) { const fs = files; t.value = ''; const im = fs.filter(f => /\.(png|jpe?g|webp)$/i.test(f.name)), tx = fs.filter(f => !im.includes(f)); if (im.length) await ocrPrep(im); if (tx.length) await ingestLote(tx, 'doc'); return; }
  if (id === 'f-prints' && files?.length) { const fs = files, k = t.dataset.k || UI.sel; t.value = ''; await prAdd(fs, k); return; }
  if (id === 'f-ocr' && files?.length) { const fs = files; t.value = ''; await ocrPrep(fs); return; }
  if (id === 'f-sol' && files?.length) { await solImportFiles(files); t.value = ''; return; }
  if (id === 'f-lk' && files?.length) { await aiImportFile(files[0]); t.value = ''; return; }
  if ((id === 'f-ai' || id === 'f-ai2') && files?.length) { await aiImportFile(files[0]); t.value = ''; return; }
  if (id === 'adm-roster-f' && files?.length) { await admRosterFile(files[0]); t.value = ''; return; }
  if (id === 'f-bak' && files?.length) { await importBackup(files[0]); t.value = ''; return; }
  if (!c) return; const v = t.value;
  if (c === 'prtxt') { prTexto(t.dataset.id, v); return; }
  if (c === 'lkopt') { LK_OPT()[t.dataset.f] = Math.max(0, +v || 0); return; }
  if (c === 'valOrig' && files?.length) { valOrig(t.dataset.k, t.dataset.id, files[0]); t.value = ''; return; }
  if (ptChange(t, c, v) || admChange(t, c, v) || iaChange(t, c, v) || cnChange(t, c, v) || mkChange(t, c, v) || smChange(t, c, v) || ocChange(t, c, v)) return;
  switch (c) {
    case 'attach': await ingest(files, t.dataset.t, t.dataset.k); t.value = ''; break;
    case 'wsheet': { const w = UI.wiz; w.si = +v; w.h = detectHeader(w.sheets[w.si].rows); w.map = autoMap((w.sheets[w.si].rows[w.h] || []).map(String)); render(); break; }
    case 'whead': { const w = UI.wiz; w.h = Math.max(0, +v - 1); w.map = autoMap((w.sheets[w.si].rows[w.h] || []).map(String)); render(); break; }
    case 'wmap': { if (v === '') delete UI.wiz.map[t.dataset.k]; else UI.wiz.map[t.dataset.k] = +v; render(); break; }
    case 'assign': if (v) assignInbox(t.dataset.id, v); break;
    case 'comp': UI.comp = v; render(); break;
    case 'fseg': UI.f.seg = v; retbl(); break;
    case 'ffs': UI.f.fs = v; retbl(); break;
    case 'sf': { const d = UI.solEdit.d; d[t.dataset.f] = v; if (t.dataset.f === 'tipo') render(); break; }
    case 'sfm': { const d = UI.solEdit.d, a = d[t.dataset.f], x = t.dataset.v; d[t.dataset.f] = t.checked ? [...new Set([...a, x])] : a.filter(y => y !== x); break; }
    case 'sfb': UI.solEdit.d[t.dataset.f] = t.checked; break;
    case 'solf': UI.solF[t.dataset.f] = v; render(); break;
    case 'impAct': { const x = UI.solImp.items[+t.dataset.fi].cands[+t.dataset.ci]; x.act = v; if (v === 'mesclar' && !x.target) x.target = x.dups[0]?.id || ''; render(); break; }
    case 'impTgt': { UI.solImp.items[+t.dataset.fi].cands[+t.dataset.ci].target = v; render(); break; }
    case 'prodsem': prodRegSet(t.dataset.id, { semTexto: t.checked }); break;
    case 'prodexcl': prodRegSet(t.dataset.id, { excl: t.value.split(/[,;\n]+/) }); break;
    case 'prodtxt': UI.prodTxt = t.value; render(); break;
    case 'impNome': LK_EDIT.nome(t, v); break;
    case 'impFin': LK_EDIT.fin(t, v); break;
    case 'impCh': { UI.solImp.items[+t.dataset.fi].cands[+t.dataset.ci].choices[t.dataset.f] = v; break; }
    case 'pesqAcao': { const it = S.pesq.find(x => x.id === t.dataset.id).resposta.itens[+t.dataset.i]; it.acao = v; break; }
    case 'aimodel': aiCfg().modelo = v; touchMeta(); render(); break;
    case 'aiweb': aiCfg().buscaWeb = t.checked; touchMeta(); render(); break;
    case 'aiurl': aiCfg().backendUrl = v.trim(); touchMeta(); render(); break;
    case 'pq': UI.pesqReq[t.dataset.f] = v; render(); break;
    case 'pqinc': UI.pesqReq.incluirProdutos = t.checked; render(); break;
    case 'cdoc': if (files?.length) { await ingestCdoc(files, t.dataset.k, t.dataset.t); t.value = ''; } break;
    case 'relTipo': relRetipo(t.dataset.k, t.dataset.id, v); break;
    case 'flPreco': { const c = S.clients[t.dataset.k], P = c.lic.precos, f = t.dataset.f; if (f === 'viavel') licPreco(t.dataset.k, 'viavel', t.checked); else if (f === 'fonte') { ['full', 'light'].forEach(k => { if (P[k]) { P[k].fonte = v; P[k].cls = v ? 'DADO DO CLIENTE' : 'PREMISSA MANUAL'; } }); touchC(c.key); render(); } else licPreco(t.dataset.k, f, v, P.full?.fonte || P.light?.fonte || ''); break; }
    case 'tco': if (t.dataset.g === 'horiz') tcoSet(t.dataset.k, 'horiz', null, v); else tcoSet(t.dataset.k, t.dataset.g, t.dataset.f, v); break;
    case 'tcoCls': tcoMeta(t.dataset.k, t.dataset.g, t.dataset.f, 'cls', v); break;
    case 'tcoF': tcoMeta(t.dataset.k, t.dataset.g, t.dataset.f, 'fonte', v); break;
    case 'roiI': roiInp(t.dataset.k, t.dataset.id, t.dataset.f, t.dataset.p, v); break;
    case 'roiF': roiFl(t.dataset.k, t.dataset.id, t.dataset.f, t.type === 'checkbox' ? t.checked : v); break;
    case 'roiShare': { const s = S.clients[t.dataset.k]?.roi.find(x => x.id === t.dataset.id); if (s) { s.share = t.checked; touchC(t.dataset.k); render(); } break; }
    case 'execOk': execSet(t.dataset.k, 'ok:' + t.dataset.id, t.checked); render(); break;
    case 'briefComp': UI.briefComp = v; render(); break;
    case 'execV': execSet(t.dataset.k, 'val:' + t.dataset.f, t.checked); render(); break;
    case 'execT': execSet(t.dataset.k, t.dataset.f, v); render(); break;
    case 'execG': { S.meta.exec ||= {}; S.meta.exec[t.dataset.f] = t.type === 'checkbox' ? t.checked : v; touchMeta(); render(); break; }
    case 'recEd': UI.edMotivo = $('#ed_motivo')?.value || ''; recEdit(t.dataset.col, t.dataset.id, t.dataset.f, v, UI.edMotivo); break;
    case 'refcomp': setRefComp(v); break;
    case 'fcomp': setFichaComp(t.dataset.k, t.dataset.id, v); break;
    case 'replF': if (files?.length) { await ingest(files, 'ficha', t.dataset.k, { replaceId: t.dataset.id }); t.value = ''; } break;
    case 'moveF': { const q = norm(v).replace(/[^a-z0-9]/g, ''); const d = Object.values(S.clients).find(x => x.key !== t.dataset.k && ((x.code && norm(x.code).replace(/[^a-z0-9]/g, '') === q) || (x.cnpj && x.cnpj === digits(v)) || normName(x.name) === normName(v))); if (!d) { toast('Cliente não encontrado por código, CNPJ ou razão social exata.'); break; } moveFicha(t.dataset.k, t.dataset.id, d.key); break; }
    case 'fprio': UI.f.prio = v; retbl(); break;
    case 'fconf': UI.f.conf = v; retbl(); break;
    case 'fsort': UI.f.sort = v; retbl(); break;
    case 'fdq': UI.f.dq = v; retbl(); break;
    case 'fsol': case 'fest': case 'fhosp': case 'frel': case 'fult': case 'fprox': UI.f[c.slice(1)] = v; UI.lim = 200; retbl(); break;
    case 'intMapSet': case 'extSet': INT_ACT[c](t); break;
    case 'segUnit': S.meta.segUnit = v; touchMeta(); render(); break;
    case 'mrrComp': if (v && !/^\d{4}-\d{2}$/.test(v)) return toast('Use AAAA-MM.'); S.meta.mrrComp = v || null; touchMeta(); render(); break;
    case 'mrrPlanComp': if (v && !/^\d{4}-\d{2}$/.test(v)) return toast('Use AAAA-MM.'); S.meta.mrrPlanComp = v || null; touchMeta(); render(); break;
    case 'mrrPrec': S.meta.mrrPrec = v; touchMeta(); render(); break;
    case 'mrrTol': S.meta.mrrTol = Math.max(0, Math.min(100, +v || 0)); touchMeta(); render(); break;
    case 'renovDays': { const a = String(v).split(/[,;\s]+/).map(Number).filter(x => x > 0 && x <= 730); if (!a.length) return toast('Informe ao menos um prazo em dias.'); S.meta.renovDays = [...new Set(a)].sort((x, y) => y - x); touchMeta(); render(); break; }
    case 'segMap': { S.meta.segMap ||= {}; if (v) S.meta.segMap[t.dataset.raw] = v; else delete S.meta.segMap[t.dataset.raw]; touchMeta(); reanalyzeAll(true, 'Mapeamento de segmentos alterado'); render(); break; }
    case 'compCrit': { S.meta.compCrit ||= {}; S.meta.compCrit[t.dataset.k] = t.checked; touchMeta(); render(); break; }
    case 'regimes': { const a = [...new Set(String(v).split(/\n+/).map(x => x.trim()).filter(Boolean))]; ['Outros', 'Não informado'].forEach(x => { if (!a.includes(x)) a.push(x); }); S.meta.regimes = a; touchMeta(); render(); break; }
    case 'impRes': { UI.wiz.res[t.dataset.i] = v; render(); break; }
    case 'impCf': { UI.wiz.cf[t.dataset.id] = v; break; }
    case 'impClear': { UI.wiz.opt = { ...(UI.wiz.opt || {}), clear: t.checked }; render(); break; }
    case 'solCob': fnSolCob(t.dataset.id, v); break;
    case 'ptipo': UI.plan.tipo = v; render(); break;
    case 'pprio': UI.plan.prio = v; render(); break;
    case 'pst': UI.plan.st = v; render(); break;
    case 'kind': case 'vi': { const cl = S.clients[t.dataset.k], f = cl.fichas.find(x => x.id === t.dataset.f), it = f.items.find(x => x.id === t.dataset.i); if (c === 'kind') { it.kind = v; it.kindMode = 'manual'; } else it.vi = +v; reanalyze([cl.key]); render(); break; }
    case 'segov': { if (v) S.meta.segOv[t.dataset.k] = v; else delete S.meta.segOv[t.dataset.k]; touchMeta(); reanalyze([t.dataset.k]); render(); break; }
    case 'mg': { const cl = S.clients[t.dataset.k]; cl.mgmt[t.dataset.f] = v; touchC(cl.key); if (t.dataset.f === 'notes') { reanalyze([cl.key]); render(); } break; }
    case 'opf': { const f = OPF(); f[t.dataset.f] = v; f.lim = 30; render(); break; }
    case 'psel': { UI.planSel ||= {}; if (t.checked) UI.planSel[t.dataset.id] = t.dataset.k || ''; else delete UI.planSel[t.dataset.id]; const b = $('#pbar'); if (b) b.outerHTML = planBulkBar(UI.planScope || []); break; }
    case 'mrrRef': { if (v && !/^\d{4}-(0[1-9]|1[0-2])$/.test(v)) return toast('Use AAAA-MM.'); if (S.meta.mrrComp) { S.meta.mrrComp = v || null; touchMeta(); } setRefComp(v); break; }
    case 'act': setAct(t.dataset.id, t.dataset.k || null, { [t.dataset.f]: v }); break;
    case 'wt': { S.meta.weights[t.dataset.k] = Math.max(0, +v || 0); reanalyzeAll(); render(); break; }
    case 'empfile': if (files?.length) { await empArquivo(files[0]); t.value = ''; } break;
    case 'empcfg': empSetCfg(t.dataset.k, v); break;
    case 'fe': if (t.dataset.k in EMP_FCLR) { UI.f[t.dataset.k] = v; UI.lim = 200; retbl(); } break;
    case 'gst': empGstSet(t.dataset.k, t.dataset.f, v); break;
    case 'fcmes': case 'fctri': { UI.fc ||= {}; UI.fc.sel = v; render(); break; }
    case 'fcfst': case 'fcftipo': { UI.fc ||= {}; UI.fc[c.slice(3)] = v; render(); break; }
    case 'fcsort': { UI.fc ||= {}; UI.fc.sort = v; render(); break; }
    case 'fcsim': { const M = fcSim(), f = t.dataset.f; if (f === 'recBase') M.recBase = ['mensal', 'anual'].includes(v) ? v : ''; else if (f === 'pAberto' || f === 'pAssin') { const n = fcPct(v); if (v !== '' && n == null) toast('Probabilidade deve ser um número de 0 a 100.'); M[f] = n; } UI.fc ||= {}; UI.fc.simOpen = true; touchMeta(); render(); break; }
    case 'fcsimopp': { const M = fcSim(), n = fcPct(v); if (v !== '' && n == null) toast('Probabilidade deve ser um número de 0 a 100.'); if (n == null) delete M.porOpp[t.dataset.id]; else M.porOpp[t.dataset.id] = n; UI.fc ||= {}; UI.fc.simOpen = true; touchMeta(); render(); break; }
  }
});
/* Item 04: renders caros disparados por digitação são agrupados (140 ms); o estado (UI.*) é atualizado a cada tecla e só o render é adiado. deb.flush(k) executa já. */
const deb = (k, fn, ms = 140) => { clearTimeout(deb.t[k]); deb.f[k] = fn; deb.t[k] = setTimeout(() => { delete deb.f[k]; fn(); }, ms); };
deb.t = {}; deb.f = {}; deb.flush = k => { if (deb.f[k]) { clearTimeout(deb.t[k]); const fn = deb.f[k]; delete deb.f[k]; fn(); } };
const reRender = sel => { const n = $(sel), p = n && document.activeElement === n ? n.selectionStart : null; render(); if (p !== null) { const m = $(sel); if (m) { m.focus(); m.setSelectionRange(p, p); } } };
document.addEventListener('input', e => {
  const t = e.target; if (t.dataset.i === 'dmword' && DM.plan) { DM.plan.word = t.value; const b = $('[data-a=dmGo]'); if (b) b.disabled = t.value.trim().toUpperCase() !== DM_NEEDWORD[DM.plan.t]; return; }
  if (t.dataset.i === 'bktoken') { BK.token = t.value.trim(); BK.direto = null; return; }
  if (t.dataset.i === 'tdq') { TD_VIEW.q = t.value; deb('tdq', () => reRender('[data-i=tdq]')); return; }
  if (t.dataset.i === 'cnq') { UI.cn.q = t.value; return; }
  if (t.dataset.i === 'fq') { UI.f.q = t.value; UI.lim = 200; deb('fq', retbl); }
  if (t.dataset.i === 'pbulk') { UI.planBulk = t.value; return; }
  if (t.dataset.i === 'lkurls') { UI.lkUrls = t.value; return; }
  if (t.dataset.i === 'prodq') { UI.prodQ = t.value; deb('prodq', () => reRender('[data-i=prodq]')); }
  if (t.dataset.i === 'ptq') { const U = ptUI(); U.q = t.value; U.pag = 0; deb('ptq', () => reRender('[data-i=ptq]')); return; }
  if (t.dataset.i === 'ptcq') { ptUI().cq = t.value; deb('ptcq', () => reRender('[data-i=ptcq]')); return; }
  if (t.dataset.i === 'solq') { UI.solQ = t.value; deb('solq', () => reRender('[data-i=solq]')); }
  if (t.dataset.i === 'pq') { UI.plan.q = t.value; deb('pq', () => reRender('[data-i=pq]')); }
  if (t.dataset.i === 'fcq') { UI.fc ||= {}; UI.fc.q = t.value; deb('fcq', () => reRender('[data-i=fcq]')); }
});
['dragover', 'dragleave', 'drop'].forEach(ev => document.addEventListener(ev, e => {
  const d = e.target.closest?.('[data-drop]'); if (!d) return; e.preventDefault(); d.classList.toggle('ov', ev === 'dragover');
  if (ev === 'drop' && e.dataTransfer?.files?.length) { const inp = $('#' + d.dataset.drop); const dt = new DataTransfer(); [...e.dataTransfer.files].forEach(f => dt.items.add(f)); inp.files = dt.files; inp.dispatchEvent(new Event('change', { bubbles: true })); }
}));
render(); { const t0 = Date.now(); initStore().finally(() => telAbertura(t0)); }
