/* ===== MOTOR ÚNICO DE RECOMENDAÇÕES, DIMENSÕES DE CLASSIFICAÇÃO E DECISÕES ===== */
/* Configuração central: pesos ficam em S.meta.weights (DEF_WEIGHTS); cortes de prioridade e limites ficam aqui. */
const CFG = { prio: { alta: 70, media: 45 }, maxInvest: 3, solOpp: { minTerms: 3, minTermsSol: 4, max: 3 } };

/* Quatro dimensões independentes (substituem a mistura de rótulos em um único campo):
   fundamentação (derivada) • validação (decisão) • contratação (derivada + confirmação manual) • situação comercial (decisão). */
const VALID_L = { sugerida: 'Sugerida', investigacao: 'Em investigação', validada: 'Validada', descartada: 'Descartada' };
const SIT_L = { nao_iniciada: 'Não iniciada', descoberta: 'Descoberta', reuniao: 'Reunião', negociacao: 'Negociação', contratada: 'Contratada', encerrada: 'Encerrada' };
const VNIVEL_L = { necessidade: 'Necessidade confirmada', elegibilidade: 'Elegibilidade validada' };
const CONTR_L = { identificada: 'Contratação identificada', nao_identificada: 'Não identificada nos documentos disponíveis', pendente: 'Pendente de confirmação' };
const FUND_L = { segmento: 'Segmento', historico: 'Histórico/cadastro do cliente', documental: 'Evidência documental' };
const oppRid = (key, rule) => `opp:${key}:${rule}`;
const actOpp = (c, rule) => c.act?.[oppRid(c.key, rule)] || {};

function fundOf(o) {
  const ev = o.evInd || [], f = { segmento: (o.setorial || []).some(x => x.tag === 'SETORIAL'), historico: false, documental: false };
  ev.forEach(e => { const s = String(e.src || ''); if (/^Planilha|^Cadastro|Planilha .*linha|^Perfil fiscal|manual|declarad/i.test(s) || o.ruleId === 'retencao') f.historico = true; else f.documental = true; });
  return f;
}
function contrOf(c, o) {
  const m = actOpp(c, o.ruleId).contr; if (m && CONTR_L[m]) return { k: m, manual: true, t: CONTR_L[m] + ' (informada pelo usuário)' };
  if ((o.jaIdent || []).length) return { k: 'identificada', t: `Identificada: ${o.jaIdent.join(', ')}` };
  const fk = c.fstat?.k;
  if (fk !== 'disponivel') return { k: 'pendente', t: `Pendente de confirmação — ficha ${String(FSTAT[fk] || fk || 'não carregada').toLowerCase()}; ausência em ficha não prova ausência de contratação.` };
  return { k: 'nao_identificada', t: 'Não identificada nos documentos disponíveis (a ficha comprova só os itens nela; não prova ausência de contratação).' };
}
function decGet(c, rule) { const a = actOpp(c, rule); return { valid: a.valid || 'sugerida', sit: a.sit || 'nao_iniciada', nivel: a.nivel || '', nota: a.nota || '', contr: a.contr || '', at: a.at || '', hist: a.hist || [], mig: a.mig || null, resp: a.resp || '', prazo: a.prazo || '' }; }
const oppDims = (c, o) => ({ fund: fundOf(o), contr: contrOf(c, o), ...(({ valid, sit, nivel }) => ({ valid, sit, nivel }))(decGet(c, o.ruleId)) });
const oppAtiva = (c, o) => { const d = decGet(c, o.ruleId); return d.valid !== 'descartada' && d.sit !== 'encerrada'; };

/* Única porta de escrita de decisões comerciais (validação, situação, nota, contratação confirmada). */
function decSet(key, rule, patch) {
  const c = S.clients[key]; if (!c) return; c.act ||= {}; const id = oppRid(key, rule), cur = c.act[id] || {}, d = decGet(c, rule), n = { ...d, ...patch };
  if (n.valid !== 'validada') n.nivel = '';
  if (n.valid === 'validada' && !n.nivel) return toast('Informe o nível da validação (necessidade confirmada ou elegibilidade validada).');
  if (n.valid === 'validada' && !String(n.nota).trim()) return toast('Validada exige registrar como foi validada (com quem, quando, fonte).');
  if (n.valid === 'descartada' && !String(n.nota).trim()) return toast('Descartada exige o motivo.');
  if (n.sit === 'contratada' && !String(n.nota).trim()) return toast('Contratada exige a fonte da confirmação (contrato, pedido, ficha).');
  const ch = []; ['valid', 'sit', 'nivel', 'nota', 'contr'].forEach(k => { if ((d[k] || '') !== (n[k] || '')) ch.push(`${k}: ${d[k] || '—'} → ${n[k] || '—'}`); });
  if (!ch.length) return toast('Nenhuma alteração.');
  c.act[id] = { ...cur, valid: n.valid, sit: n.sit, nivel: n.nivel, nota: n.nota, contr: n.contr || undefined, at: nowISO(), hist: [{ at: nowISO(), mudancas: ch, nota: n.nota }, ...(cur.hist || [])].slice(0, 30) };
  touchC(key); render();
}
function decCtl(c, o) {
  const d = decGet(c, o.ruleId), cd = contrOf(c, o);
  return `<div class="dec" data-k="${esc(c.key)}" data-r="${esc(o.ruleId)}"><div class="row sm">
    <label>Validação <select data-f="valid">${Object.entries(VALID_L).map(([k, l]) => optS(k, l, d.valid)).join('')}</select></label>
    <label>Nível <select data-f="nivel"><option value="">—</option>${Object.entries(VNIVEL_L).map(([k, l]) => optS(k, l, d.nivel)).join('')}</select></label>
    <label>Situação comercial <select data-f="sit">${Object.entries(SIT_L).map(([k, l]) => optS(k, l, d.sit)).join('')}</select></label>
    <label>Contratação <select data-f="contr"><option value="">Derivada dos documentos</option>${Object.entries(CONTR_L).map(([k, l]) => optS(k, l, d.contr)).join('')}</select></label></div>
    <div class="row sm"><input type="text" data-f="nota" value="${esc(d.nota)}" placeholder="Nota (obrigatória p/ validada, descartada e contratada: como/quando/fonte)" style="flex:1;min-width:260px"><button class="btn sm" data-a="decOpp">Registrar decisão</button></div>
    <div class="muted sm">${esc(cd.t)}${d.mig ? ` • migrado de ${esc(d.mig.de)} em ${esc(d.mig.em)}${d.mig.revisar ? ' — <b>revisar</b>' : ''}` : ''}${d.at ? ` • decisão em ${esc(fmtDate(d.at))}` : ''}${d.hist.length ? ` • ${d.hist.length} alteração(ões) no histórico` : ''}</div></div>`;
}
function decFromBox(t) { const b = t.closest('.dec'); if (!b) return; const g = f => b.querySelector(`[data-f=${f}]`).value; decSet(b.dataset.k, b.dataset.r, { valid: g('valid'), nivel: g('nivel'), sit: g('sit'), contr: g('contr'), nota: g('nota') }); }
function dimsHtml(c, o) {
  const D = oppDims(c, o), f = Object.entries(D.fund).filter(([, v]) => v).map(([k]) => FUND_L[k]);
  return `<div class="row sm dims"><span class="muted">Fundamentação:</span> ${f.length ? f.map(x => pill(x, 'info')).join(' ') : pill('sem evidência individual — investigação recomendada', 'off')}
  <span class="muted">Validação:</span> ${pill(VALID_L[D.valid] + (D.nivel ? ' — ' + VNIVEL_L[D.nivel] : ''), D.valid === 'validada' ? 'ok' : D.valid === 'descartada' ? 'bad' : 'warn')}
  <span class="muted">Contratação:</span> ${pill(CONTR_L[D.contr.k], D.contr.k === 'identificada' ? 'ok' : 'off')}
  <span class="muted">Situação:</span> ${pill(SIT_L[D.sit], D.sit === 'contratada' ? 'ok' : D.sit === 'encerrada' ? 'off' : 'info')}</div>`;
}

/* ---------- Migração de classificações legadas (idempotente, sem perda) ---------- */
const LEG_STATUS = { 'Pendente': {}, 'Em andamento': { valid: 'investigacao', sit: 'descoberta' }, 'Concluído': { sit: 'encerrada', revisar: true }, 'Descartado': { valid: 'descartada', sit: 'encerrada', revisar: true } };
function migrateAct(c) {
  c.act ||= {}; const hoje = today();
  Object.entries(c.act).forEach(([id, a]) => {
    if (!id.startsWith('opp:') || a.status == null || a.valid || a.sit) { if (id.startsWith('opp:') && a.status != null && (a.valid || a.sit)) delete a.status; return; }
    const m = LEG_STATUS[a.status]; if (!m) return; const { revisar, ...set } = m; Object.assign(a, set);
    if (a.status !== 'Pendente') { a.mig = { de: `status "${a.status}" do plano`, em: hoje, revisar: !!revisar }; if (a.valid === 'descartada' && !a.nota) a.nota = 'Migrado de status "Descartado": motivo não registrado.'; }
    delete a.status;
  });
}
/* Une decisões de um id antigo no id canônico preservando as duas (a mais avançada prevalece; a outra vai ao histórico). */
function moveAct(c, fromRule, toRule) {
  const from = oppRid(c.key, fromRule), to = oppRid(c.key, toRule), a = c.act?.[from]; if (!a) return;
  const b = c.act[to], score = x => (x?.valid && x.valid !== 'sugerida' ? 2 : 0) + (x?.sit && x.sit !== 'nao_iniciada' ? 2 : 0) + (x?.nota ? 1 : 0) + (x?.resp || x?.prazo ? 1 : 0);
  if (!b) c.act[to] = { ...a, mig: { ...(a.mig || {}), de: `${a.mig?.de ? a.mig.de + '; ' : ''}oportunidade "${fromRule}" unificada em "${toRule}"`, em: today() } };
  else { const [win, lose] = score(a) > score(b) ? [a, b] : [b, a]; c.act[to] = { ...win, resp: win.resp || lose.resp, prazo: win.prazo || lose.prazo, hist: [...(win.hist || []), { at: nowISO(), mudancas: [`decisão anterior de "${fromRule}"/"${toRule}" preservada: ${lose.valid || 'sugerida'}/${lose.sit || 'nao_iniciada'}`], nota: lose.nota || '' }, ...(lose.hist || [])].slice(0, 30), mig: { de: `unificação "${fromRule}" → "${toRule}"`, em: today(), revisar: score(a) > 0 && score(b) > 0 } }; }
  delete c.act[from];
  if (c.exec?.ok && c.exec.ok['o:' + fromRule] != null) { c.exec.ok['o:' + toRule] = !!(c.exec.ok['o:' + toRule] || c.exec.ok['o:' + fromRule]); delete c.exec.ok['o:' + fromRule]; }
}

/* ---------- Motor único ---------- */
const rescore = o => { o.score = scoreOpp(o, S.meta.weights); o.conf = confLevel(o); o.prio = prioLabel(o.score); return o; };
const uniqBy = (arr, f) => { const s = new Set(); return arr.filter(x => { const k = f(x); if (s.has(k)) return false; s.add(k); return true; }); };
function mergeOpp(a, b, origemB) {
  a.evInd = uniqBy([...(a.evInd || []), ...(b.evInd || [])], e => e.text); a.setorial = uniqBy([...(a.setorial || []), ...(b.setorial || [])], e => e.text);
  a.sols = uniqBy([...(a.sols || []), ...(b.sols || [])], s => s.id); a.extraBase = [...new Set([...(a.extraBase || []), ...(b.extraBase || [])])];
  ['deps', 'perg', 'escopo', 'natureza', 'jaIdent'].forEach(k => { const m = [...new Set([...(a[k] || []), ...(b[k] || [])])]; if (m.length) a[k] = m; });
  Object.keys(a.crit).forEach(k => { a.crit[k] = Math.max(a.crit[k] ?? 0, b.crit?.[k] ?? 0); });
  if (b.modo === 'evidencia') a.modo = 'evidencia'; if (!a.validar && b.validar) a.validar = b.validar;
  a.aliases = [...new Set([...(a.aliases || []), b.ruleId, ...(b.aliases || [])])]; a.origens = [...new Set([...(a.origens || ['regras']), origemB])]; return rescore(a);
}
const solObjs = names => S.solutions.filter(s => !s.arquivado && names.includes(s.nome)).map(solLegacy);
function oppFromCad(c, ruleId, base, crit) {
  const has = id => (c.productsIdent || []).some(p => p.id === id), sols = base.sols || [];
  const o = mkOpp(c, { ruleId, tipo: base.tipoBase || 'Otimização', tipoBase: base.tipoBase || 'Otimização', modo: 'investigacao', natureza: ['PROCESSO'], escopo: [], impacto: 'HIPÓTESE: impacto não quantificado; nenhuma economia, elegibilidade ou necessidade é presumida.', jaIdent: sols.filter(s => has(s.id)).map(s => s.nome), ...base }, crit);
  o.origens = ['cadastro']; return o;
}
const CAD_TARGET = { regime: ['regulatorio', 'reforma'], logistica: ['logistica'] };
function unifyOpps(c, list) {
  const snap0 = JSON.stringify([c.act || {}, c.cadDec || {}, c.exec?.ok || {}]); const by = new Map(); list.forEach(o => by.set(o.ruleId, o));
  /* (1) mesma necessidade fiscal vinda de dois motores: "reforma" (regras fixas) + "regulatorio" (marcos oficiais) */
  const ref = by.get('reforma'), reg = by.get('regulatorio');
  if (ref && reg) { mergeOpp(reg, ref, 'regras fixas'); by.delete('reforma'); }
  if (ref || reg) { const keep = by.get('regulatorio') ? 'regulatorio' : 'reforma'; if (keep === 'regulatorio') moveAct(c, 'reforma', 'regulatorio'); }
  /* (2) regras do cadastro entram no mesmo motor */
  const cr = cadRules(c), dq = dataQuality(c); c.cadMap = {};
  const evOf = r => r.evid.map(t => ({ cls: 'FATO', text: t, src: 'Cadastro estratégico' }));
  const contratos = cr.R.filter(r => r.id.startsWith('ct_'));
  cr.R.forEach(r => {
    if (r.id.startsWith('ct_') || r.fin) return;
    let target = (CAD_TARGET[r.id] || []).map(id => by.get(id)).find(Boolean);
    if (target) { target.evInd = uniqBy([...target.evInd, ...evOf(r)], e => e.text); target.deps = [...new Set([...(target.deps || []), ...r.deps])]; target.perg = [...new Set([...(target.perg || []), ...r.perg])]; target.origens = [...new Set([...(target.origens || ['regras']), 'cadastro'])]; rescore(target); c.cadMap[r.id] = target.ruleId; return; }
    if (r.id === 'regime') { c.cadMap[r.id] = null; return; } /* regime isolado é contexto de descoberta, não oportunidade */
    const rid = r.id, sols = solObjs(r.sols);
    const o = oppFromCad(c, rid, { tipoBase: 'Otimização', nome: r.titulo, problema: `INVESTIGAÇÃO RECOMENDADA (indício, sem necessidade confirmada): ${r.hip}`, evInd: evOf(r), sols, deps: r.deps, perg: r.perg, acao: r.acao, contratacao: (c.productsIdent || []).map(p => p.nome) }, { evidencia: 1, aderencia: sols.length ? 2 : 1, impacto: 2, urgencia: 0, viabilidade: 1, dados: dq });
    by.set(rid, o); c.cadMap[r.id] = rid;
  });
  if (contratos.length) {
    const t = by.get('retencao'), ev = contratos.flatMap(evOf);
    if (t) { t.evInd = uniqBy([...t.evInd, ...ev], e => e.text); t.perg = [...new Set([...(t.perg || []), ...contratos.flatMap(r => r.perg)])]; t.origens = [...new Set([...(t.origens || ['regras']), 'cadastro'])]; rescore(t); contratos.forEach(r => c.cadMap[r.id] = 'retencao'); }
    else { const o = oppFromCad(c, 'contratos', { tipoBase: 'Retenção', nome: 'Revisão contratual (renovação e reajuste)', problema: `HIPÓTESE DE NECESSIDADE com indício individual: ${contratos[0].hip}`, evInd: ev, sols: [], deps: [...new Set(contratos.flatMap(r => r.deps))], perg: [...new Set(contratos.flatMap(r => r.perg))], acao: contratos[0].acao, contratacao: (c.productsIdent || []).map(p => p.nome) }, { evidencia: 3, aderencia: 2, impacto: 2, urgencia: 2, viabilidade: 2, dados: dq }); o.modo = 'evidencia'; by.set('contratos', o); contratos.forEach(r => c.cadMap[r.id] = 'contratos'); }
  }
  /* (3) decisões legadas (cadDec) migram para a fonte única; classificações do plano migram para as dimensões */
  Object.entries(c.cadDec || {}).forEach(([rid, d]) => { const t = c.cadMap[rid]; if (t === undefined || t === null) return; const id = oppRid(c.key, t); c.act ||= {};
    if (d.st && d.st !== 'indicio' && !c.act[id]?.valid) c.act[id] = { ...(c.act[id] || {}), valid: 'validada', nivel: d.st, nota: d.nota || '', at: d.at || nowISO(), hist: d.hist || [], mig: { de: `decisão do cadastro "${DEC_L[d.st] || d.st}"`, em: today() } };
    delete c.cadDec[rid]; });
  migrateAct(c);
  if (JSON.stringify([c.act || {}, c.cadDec || {}, c.exec?.ok || {}]) !== snap0) touchC(c.key);
  /* (4) idempotência: mesmo cliente + mesma necessidade (tipo/título) + mesmas soluções = UMA oportunidade, mesmo vinda de registros de solução repetidos ou de geradores diferentes.
     Escopos diferentes com o mesmo produto têm título/necessidade distintos e NÃO são unidos. Evidências, deps, perguntas e decisão manual são preservadas (mergeOpp/moveAct). */
  const canon = s => String(s.nome || s.id || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/^totvs\s+/, '').replace(/[^a-z0-9]/g, '') || String(s.id);
  const nomeKey = o => String(o.nome || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
  const sigOf = o => `${o.tipoBase || o.tipo}|${nomeKey(o)}|${[...new Set((o.sols || []).map(canon))].sort().join('+')}`;
  const snap1 = JSON.stringify([c.act || {}, c.exec?.ok || {}]); const grp = new Map(); [...by.values()].forEach(o => { const k = sigOf(o); (grp.get(k) || grp.set(k, []).get(k)).push(o); });
  grp.forEach(g => { if (g.length < 2) return; g.sort((x, y) => (y.score - x.score) || String(x.ruleId).localeCompare(String(y.ruleId))); const w = g[0]; g.slice(1).forEach(l => { mergeOpp(w, l, 'duplicata unificada'); moveAct(c, l.ruleId, w.ruleId); by.delete(l.ruleId); }); });
  if (JSON.stringify([c.act || {}, c.exec?.ok || {}]) !== snap1) touchC(c.key);
  const out = [...by.values()].map(o => { o.tipo = o.tipoBase || o.tipo; return o; });
  return out.sort((a, b) => b.score - a.score);
}
