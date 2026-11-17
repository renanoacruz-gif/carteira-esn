/* ---------- Sincronização entre sessões da carteira privada (rodada 45) ----------
   Problema resolvido: com duas sessões abertas (celular e computador), a última gravação vencia e a outra se perdia sem aviso.
   Como funciona (só no hospedado, onde o servidor guarda a versão de cada documento):
   - cada gravação de cliente e dos ajustes gerais é condicional à versão lida por esta sessão;
   - se outra sessão gravou antes, compara-se campo a campo com a base lida: o que só o outro lado mudou é incorporado,
     o que só este lado mudou é mantido; o que os DOIS mudaram vira decisão do executivo (nada é descartado em silêncio);
   - alterações da outra sessão chegam sozinhas (consulta a cada 45 s e ao voltar para a aba) quando não há edição local pendente.
   Limite conhecido: exclusão de cliente feita na outra sessão só é percebida ao recarregar ou ao editar o mesmo cliente. */
const CBASE = new Map(), SINC = { on: false, conf: {}, metaBase: null }, SINC_SEP = '\u0001';
const SINC_AUTO = ['lastChange', 'changes', 'prevKeys', 'fichaErr']; /* derivados da análise: recalculados, nunca viram decisão */
const SINC_ROT = { name: 'Nome', code: 'Código', cnpj: 'CNPJ', seg: 'Segmento', city: 'Cidade', size: 'Porte', mrr: 'MRR da planilha', productsRaw: 'Produtos da planilha', churn: 'Risco de churn', nps: 'NPS', notes: 'Observações', custom: 'Campos adicionais', edits: 'Edições manuais', usoConf: 'Uso confirmado', site: 'Site', fatos: 'Fatos e dores', sugFatos: 'Sugestões de fatos', aval: 'Avaliações', valid: 'Validações', dorHip: 'Hipóteses de dor', fichas: 'Fichas de faturamento', docs: 'Documentos', mgmt: 'Gestão da conta', act: 'Ações e acompanhamento', uf: 'UF', regime: 'Regime tributário', release: 'Release', lic: 'Licenciamento', cloud: 'Hospedagem', rel: 'Relacionamento', fis: 'Fiscal', roi: 'ROI', exec: 'Diagnóstico executivo', cdocs: 'Documentos contratuais', ext: 'Ids externos', cad: 'Cadastro', contratos: 'Contratos', cadDec: 'Decisões de cadastro', cadConf: 'Conflitos de cadastro', cnpjCad: 'Consulta de CNPJ', reviewFlags: 'Marcas de revisão', oppKeep: 'Oportunidades mantidas', emp: 'Dados do Empodera', gst: 'Gestão', ptRes: 'Desfechos do portfólio', enxVinc: 'Soluções vinculadas', prFill: 'Preenchimento por print', prImp: 'Prints importados' };
const sincObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
function sincH(v) { const s = JSON.stringify(v === undefined ? null : v); let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0).toString(36) + '.' + s.length; }
const SINC_NULO = sincH(null);
function sincHashes(o, fundo) { const r = {}; for (const k of Object.keys(o || {})) { const v = o[k]; r[k] = sincH(v); if (fundo && sincObj(v)) for (const j of Object.keys(v)) r[k + SINC_SEP + j] = sincH(v[j]); } return r; }
/* mescla em três vias por campo. L = local, R = remoto, B = hashes da base lida (null = base desconhecida: toda diferença é conflito).
   Devolve { val: campos a aplicar no local (undefined = remover), tomou: campos vindos do remoto, conf: campos alterados dos dois lados } */
function sincMerge(L, R, B, fundo) {
  const val = {}, tomou = [], conf = [], hb = k => B ? (B[k] ?? SINC_NULO) : null;
  for (const f of new Set([...Object.keys(L || {}), ...Object.keys(R || {})])) {
    const hl = sincH(L[f]), hr = sincH(R[f]); if (hl === hr) continue;
    if (!B) { if (!SINC_AUTO.includes(f)) conf.push(f); continue; }
    const lc = hl !== hb(f), rc = hr !== hb(f);
    if (rc && !lc) { val[f] = R[f]; tomou.push(f); continue; }
    if (!rc) continue;
    if (SINC_AUTO.includes(f)) continue;
    if (fundo && sincObj(L[f]) && sincObj(R[f])) { /* um nível abaixo (ajustes gerais): só conflita o subitem alterado nos dois lados */
      const m = { ...L[f] }; let mudou = false;
      for (const j of new Set([...Object.keys(L[f]), ...Object.keys(R[f])])) {
        const sl = sincH(L[f][j]), sr = sincH(R[f][j]); if (sl === sr) continue; const sb = hb(f + SINC_SEP + j), slc = sl !== sb, src = sr !== sb;
        if (src && !slc) { if (j in R[f]) m[j] = R[f][j]; else delete m[j]; mudou = true; } else if (src && slc) conf.push(f + '.' + j);
      }
      if (mudou) { val[f] = m; tomou.push(f); } continue;
    }
    conf.push(f);
  }
  return { val, tomou, conf };
}
const sincAplicar = (alvo, val) => { for (const f of Object.keys(val)) { if (val[f] === undefined) delete alvo[f]; else alvo[f] = clone(val[f]); } };
const sincRot = f => SINC_ROT[f] || f;
function sincIniciar() { /* chamado ao fim da carga: guarda a base e liga a escuta de outras sessões */
  SINC.on = !!(META && typeof META.setV === 'function'); if (!SINC.on) return;
  Object.values(S.clients).forEach(c => CBASE.set(c.key, sincHashes(freezeClient(c))));
  SINC.metaBase = sincHashes(sincMetaDoc(), true);
  let t = null, n = 0; const avisar = () => { clearTimeout(t); t = setTimeout(() => { const q = n; n = 0; if (!/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '')) render(); toast(q ? `Carteira atualizada a partir de outra sessão (${q} cliente(s)).` : 'Ajustes gerais atualizados a partir de outra sessão.'); }, 600); };
  try {
    CL.onSnapshot?.(snap => { (snap?.docs || []).forEach(d => {
      const R = clone(d.data()), k = R && R.key; if (!k || dirtyC.has(k) || delC.has(k) || SINC.conf[k]) return; /* com edição local pendente, a mescla acontece na gravação */
      const ref = CL.doc(k), v = ref.ver(); if (!d.at || (v && d.at <= v)) return; /* é a própria gravação desta sessão (ou mais antiga) */
      S.clients[k] = R; ref.adotar(d.at); runAnalysis(R); CBASE.set(k, sincHashes(freezeClient(R))); n++; avisar();
    }); });
    META.onSnapshot?.(d => {
      const v = META.ver(); if (dirtyMeta || !d.at || (v && d.at <= v)) return;
      const R = clone(d.data()); sincMetaAplicar(sincMerge(sincMetaDoc(), sincMetaPlano(R), SINC.metaBase, true).val); META.adotar(d.at); SINC.metaBase = sincHashes(sincMetaDoc(), true); reanalyzeAll(false); avisar();
    });
  } catch { /* sem escuta: a mescla continua valendo na gravação */ }
}
/* ---- clientes ---- */
async function sincPushC(k) {
  const c = S.clients[k], ref = CL.doc(k); if (!SINC.on) { await ref.set(freezeClient(c)); return; }
  let L = freezeClient(c);
  for (let t = 0; t < 2; t++) {
    try { await ref.setV(L); CBASE.set(k, sincHashes(L)); if (SINC.conf[k]) delete SINC.conf[k]; return; }
    catch (e) {
      if (e.code !== 'conflito') throw e;
      if (!e.atual) { sincSegurar(k, { excl: true, at: '', campos: [] }); return; }
      const m = sincMerge(L, e.atual, CBASE.get(k) || null);
      sincAplicar(c, m.val); if (m.tomou.length) runAnalysis(c);
      if (m.conf.length) { sincSegurar(k, { R: e.atual, at: e.at, campos: m.conf }); return; }
      ref.adotar(e.at); CBASE.set(k, sincHashes(e.atual)); L = freezeClient(c);
      if (t === 0) { log(`"${c.name}": alterações feitas em outra sessão foram incorporadas (${m.tomou.map(sincRot).join(', ') || 'sem diferença de conteúdo'}).`, 'ok'); setTimeout(() => { toast(`"${c.name}" também foi alterado em outra sessão: as duas alterações foram mantidas.`); render(); }, 0); }
    }
  }
  throw Object.assign(new Error('registro em alteração contínua em outra sessão'), { code: 'conflito' });
}
function sincSegurar(k, x) { const a = SINC.conf[k], novo = !a || a.at !== x.at || a.campos.join() !== x.campos.join(); SINC.conf[k] = x; if (novo) setTimeout(() => { const c = S.clients[k]; toast(x.excl ? `"${c?.name || k}" foi excluído em outra sessão. Decida o que fazer na ficha do cliente.` : `"${c?.name || k}" foi alterado em outra sessão nos mesmos campos. Nada foi perdido: decida qual versão vale.`); render(); }, 0); }
function sincDecidir(k, lado) {
  const x = SINC.conf[k], c = S.clients[k]; if (!x || !c) return; const ref = CL.doc(k); delete SINC.conf[k];
  if (x.excl) { if (lado === 'outro') { delete S.clients[k]; dirtyC.delete(k); CBASE.delete(k); ref.adotar(''); if (UI.sel === k) { UI.sel = null; UI.view = 'clientes'; } log(`Cliente "${c.name}" removido desta sessão (já havia sido excluído em outra).`, 'ok'); render(); return; } ref.adotar(''); CBASE.delete(k); touchC(k); render(); return; }
  if (lado === 'outro') sincAplicar(c, Object.fromEntries(x.campos.map(f => [f, x.R[f]])));
  ref.adotar(x.at); CBASE.set(k, sincHashes(x.R)); runAnalysis(c, lado === 'outro' ? 'Versão da outra sessão adotada' : ''); touchC(k);
  log(`"${c.name}": conflito entre sessões resolvido (${lado === 'outro' ? 'versão da outra sessão' : 'versão desta sessão'}) em ${x.campos.map(sincRot).join(', ')}.`, 'ok'); render();
}
function sincBanner(c) {
  const x = SINC.conf[c.key]; if (!x) return '';
  const bt = `<div class="row" style="margin-top:6px"><button class="btn pri" data-a="sincMeu" data-k="${esc(c.key)}">${x.excl ? 'Manter o cliente' : 'Manter a versão desta sessão'}</button><button class="btn ghost" data-a="sincOutro" data-k="${esc(c.key)}">${x.excl ? 'Remover também aqui' : 'Usar a versão da outra sessão'}</button></div>`;
  if (x.excl) return `<div class="alert b" role="alert"><b>Este cliente foi excluído em outra sessão.</b><div class="sm">As alterações feitas aqui ainda não foram gravadas. Escolha manter o cliente (ele volta a existir) ou removê-lo também desta sessão.</div>${bt}</div>`;
  return `<div class="alert b" role="alert"><b>Este cliente foi alterado em outra sessão nos mesmos campos.</b><div class="sm">Campos em conflito: <b>${x.campos.map(f => esc(sincRot(f))).join(', ')}</b>. O restante já foi unido automaticamente. As alterações desta sessão nesses campos <b>ainda não foram gravadas</b>: se você recarregar a página antes de decidir, vale a versão da outra sessão.</div>${bt}</div>`;
}
function sincFaixa() {
  const ks = Object.keys(SINC.conf).filter(k => S.clients[k]); if (!ks.length || (UI.view === 'cliente' && ks.length === 1 && ks[0] === UI.sel)) return '';
  return `<div class="alert b" role="alert"><b>${ks.length} cliente(s) alterado(s) em outra sessão aguardam a sua decisão.</b> <span class="sm">${ks.slice(0, 6).map(k => `<button class="btn ghost sm" data-a="sincAbrir" data-k="${esc(k)}">${esc(S.clients[k].name)}</button>`).join(' ')}${ks.length > 6 ? ' …' : ''}</span></div>`;
}
/* ---- ajustes gerais (um documento só) ---- */
const sincMetaDoc = () => ({ ...S.meta, files: S.meta.files.slice(-400), '~kbExtra': S.kbExtra });
const sincMetaPlano = d => ({ ...((d && d.meta) || {}), '~kbExtra': (d && d.kbExtra) || { solutions: [] } });
function sincMetaAplicar(val) { for (const f of Object.keys(val)) { if (f === '~kbExtra') S.kbExtra = clone(val[f] || { solutions: [] }); else if (val[f] === undefined) delete S.meta[f]; else S.meta[f] = clone(val[f]); } S.meta.weights = { ...DEF_WEIGHTS, ...(S.meta.weights || {}) }; S.meta.files ||= []; S.meta.segOv ||= {}; S.meta.act ||= {}; }
async function sincPushMeta() {
  const doc = () => clone({ meta: { ...S.meta, files: S.meta.files.slice(-400) }, kbExtra: S.kbExtra });
  if (!SINC.on) { await META.set(doc()); return; }
  for (let t = 0; t < 2; t++) {
    try { await META.setV(doc()); SINC.metaBase = sincHashes(sincMetaDoc(), true); return; }
    catch (e) {
      if (e.code !== 'conflito') throw e;
      if (!e.atual) { META.adotar(''); continue; }
      const m = sincMerge(sincMetaDoc(), sincMetaPlano(e.atual), SINC.metaBase, true), cf = m.conf.filter(f => f !== 'lastAnalysis');
      sincMetaAplicar(m.val); META.adotar(e.at); SINC.metaBase = sincHashes(sincMetaPlano(e.atual), true);
      if (t === 0 && (m.tomou.length || cf.length)) { if (cf.length) log(`Ajustes gerais alterados nas duas sessões (${cf.join(', ')}): mantida a versão desta sessão nesses itens; os demais foram unidos.`, 'warn'); setTimeout(() => { if (cf.length) toast(`${cf.length} ajuste(s) geral(is) também alterado(s) em outra sessão: mantida a versão desta sessão. Detalhe no registro de atividades.`); reanalyzeAll(false); render(); }, 0); }
    }
  }
  throw Object.assign(new Error('ajustes gerais em alteração contínua em outra sessão'), { code: 'conflito' });
}
const SINC_ACT = {
  sincMeu: t => sincDecidir(t.dataset.k, 'meu'),
  sincOutro: t => { const x = SINC.conf[t.dataset.k]; if (x && !confirm(x.excl ? 'Remover este cliente também desta sessão? As alterações feitas aqui serão descartadas.' : 'Usar a versão da outra sessão nos campos em conflito? As alterações desta sessão nesses campos serão descartadas.')) return; sincDecidir(t.dataset.k, 'outro'); },
  sincAbrir: t => { UI.sel = t.dataset.k; UI.view = 'cliente'; render(); },
};
