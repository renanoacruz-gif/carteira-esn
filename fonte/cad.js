/* ===== CADASTRO ESTRATÉGICO, CONTRATOS, INTELIGÊNCIA POR SEGMENTO, MRR, REGRAS EXPLICÁVEIS E QUALIDADE ===== */
const HOSP = { local: 'Servidor local (on-premise)', nuvem_terceiro: 'Nuvem de terceiro', totvs_cloud: 'TOTVS Cloud', hibrido: 'Híbrido', nao_informado: 'Não informado' };
const CAD_F = [['hosp', 'Hospedagem'], ['func', 'Funcionários CLT'], ['fat', 'Faturamento anual do cliente'], ['filiais', 'Filiais'], ['cds', 'Centros de distribuição']];
const CT_F = [['ultRenov', 'Data da última renovação'], ['proxRenov', 'Próxima renovação'], ['indice', 'Índice de reajuste'], ['dataBase', 'Data-base do reajuste']];
const ST_L = { confirmado: 'Confirmado', declarado: 'Declarado' };
const regimesList = () => (S.meta.regimes?.length ? S.meta.regimes : [...REGIMES, 'Outros', 'Não informado']);
const stOf = f => !f ? null : f.st || (f.fonte?.tipo === 'planilha' ? 'declarado' : 'confirmado');

/* ---------- Normalização de valores ---------- */
function normHosp(v) { const n = norm(v); if (!n) return null; if (/n[aã]o inform|^-+$|^n\/?a$/.test(n)) return 'nao_informado'; if (/h[ií]brid/.test(n)) return 'hibrido'; if (/totvs/.test(n)) return 'totvs_cloud'; if (/aws|azure|google|oracle|nuvem|cloud|terceir|datacenter de/.test(n)) return 'nuvem_terceiro'; if (/local|pr[oó]pri|on.?prem|servidor|interno/.test(n)) return 'local'; return Object.keys(HOSP).includes(n) ? n : null; }
function normRegimeL(v) { const n = norm(v); if (!n) return null; if (/n[aã]o inform/.test(n)) return 'Não informado'; const r = normRegime(v); if (r && regimesList().includes(r)) return r; const hit = regimesList().find(x => norm(x) === n); return hit || 'Outros'; }
function nonNegInt(v) { if (v == null || String(v).trim() === '') return null; const s = String(v).trim().replace(/\./g, ''); if (!/^\d+$/.test(s)) return undefined; return parseInt(s, 10); }
function pDate(v) {
  if (v == null || v === '') return null; if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10);
  if (typeof v === 'number' && v > 20000 && v < 80000) { const d = new Date(Math.round((v - 25569) * 864e5)); return d.toISOString().slice(0, 10); }
  const s = String(v).trim(); let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/); if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; return undefined;
}
function parseFat(v) { // valor numérico ou faixa textual; nunca converte faixa em número
  if (v == null || String(v).trim() === '') return null; if (typeof v === 'number') return v >= 0 ? { valor: v } : undefined;
  const s = String(v).trim(); if (/\b(a|até|ate|entre|acima|abaixo|mais de|menos de)\b|[–-]\s*\d|>|</i.test(s) || /mi(lh[aõ]o|lh[oõ]es)?\b|\bmm\b|\bbi\b/i.test(s) && parseNum(s) == null) return { faixa: s };
  const n = parseNum(s); return n != null && n >= 0 ? { valor: n } : { faixa: s };
}
const fatTxt = v => !v ? '—' : v.faixa ? `${v.faixa}${v.moeda ? ' ' + v.moeda : ''}` : (v.moeda && v.moeda !== 'BRL' ? `${v.moeda} ${Number(v.valor).toLocaleString('pt-BR')}` : fmtBRL(v.valor)) + (v.exercicio ? ` (exercício ${v.exercicio})` : '');
const cadTxt = (k, v) => v == null ? '—' : k === 'hosp' ? HOSP[v] || v : k === 'fat' ? fatTxt(v) : ['ultRenov', 'proxRenov', 'dataBase'].includes(k) ? fmtD(v) : String(v);

/* ---------- Modelo: itens estratégicos (Valor | Fonte | Data de referência | Atualização | Confirmado/declarado) ---------- */
function cadInit(c) { c.cad ||= {}; c.contratos ||= []; c.cadDec ||= {}; c.cadConf ||= []; }
function sItem(v, o, prev) {
  return { v, fonte: { tipo: o.tipo || 'manual', ref: o.ref || '', loc: o.loc || '' }, dref: o.dref || null, at: nowISO(), st: o.st || 'declarado',
    hist: [{ at: nowISO(), de: prev?.v ?? null, para: v, st: o.st || 'declarado', fonte: [o.ref, o.loc].filter(Boolean).join(' • '), motivo: o.motivo || '' }, ...(prev?.hist || [])].slice(0, 25) };
}
function cadSetRaw(c, k, v, o) { cadInit(c); const prev = c.cad[k]; if (v == null) { if (prev) { c.cad[k] = { ...prev, v: null, at: nowISO(), hist: [{ at: nowISO(), de: prev.v, para: null, motivo: o.motivo || 'limpo', fonte: o.ref || '' }, ...(prev.hist || [])].slice(0, 25) }; } return; } c.cad[k] = sItem(v, o, prev); }
function ctFind(c, ident) { const n = norm(ident || 'principal'); return c.contratos.find(x => norm(x.ident || 'principal') === n); }
function ctUpsert(c, ident) { cadInit(c); let ct = ctFind(c, ident); if (!ct) { ct = { id: 'ct_' + uid(), ident: ident || 'principal', hist: [{ at: nowISO(), acao: 'contrato registrado' }] }; c.contratos.push(ct); } return ct; }
function ctSetRaw(ct, k, v, o) { const prev = ct[k]; if (v == null) { if (prev) ct[k] = { ...prev, v: null, at: nowISO() }; return; } ct[k] = sItem(v, o, prev); }

/* edição manual (exige fonte) */
function cadEdit(key, k, raw, o) {
  const c = S.clients[key]; if (!c) return; cadInit(c); if (!String(o.ref || '').trim()) return toast('Informe a fonte da informação (documento, conversa registrada, planilha…).');
  let v = raw;
  if (k === 'hosp') v = raw || null; else if (['func', 'filiais', 'cds'].includes(k)) { v = nonNegInt(raw); if (v === undefined) return toast('Informe um número inteiro não negativo.'); }
  else if (k === 'fat') { const p = parseFat(raw); if (p === undefined) return toast('Faturamento inválido.'); v = p ? { ...p, moeda: (o.moeda || 'BRL').toUpperCase(), exercicio: o.exercicio || null } : null; }
  else if (k === 'regime') { const r = raw ? normRegimeL(raw) : null; fisPut(c, 'regime', r, { tipo: 'manual', ref: o.ref.trim() }, { cls: o.st === 'confirmado' ? 'FATO' : 'NECESSITA VALIDAÇÃO', extra: { st: o.st || 'declarado', dref: o.dref || null, raw } }); reanalyze([key], `Regime: ${r || '(limpo)'}`); return render(); }
  if (o.dref && pDate(o.dref) === undefined) return toast('Data de referência inválida.');
  cadSetRaw(c, k, v, { tipo: 'manual', ref: o.ref.trim(), dref: o.dref ? pDate(o.dref) : null, st: o.st, motivo: o.motivo }); reanalyze([key], `Cadastro estratégico: ${CAD_F.find(x => x[0] === k)?.[1] || k}`); render();
}
function ctEdit(key, ctId, k, raw, o) {
  const c = S.clients[key]; cadInit(c); const ct = c.contratos.find(x => x.id === ctId); if (!ct) return; if (!String(o.ref || '').trim()) return toast('Informe a fonte (contrato, aditivo, e-mail registrado…).');
  let v = raw ? String(raw).trim() : null; if (k !== 'indice' && v) { const d = pDate(v); if (!d) return toast('Data inválida (use AAAA-MM-DD ou DD/MM/AAAA).'); v = d; }
  ctSetRaw(ct, k, v, { tipo: 'manual', ref: o.ref.trim(), st: o.st, dref: null, motivo: o.motivo }); ct.hist = [{ at: nowISO(), acao: `${CT_F.find(x => x[0] === k)[1]}: ${v ?? '(limpo)'}` }, ...(ct.hist || [])].slice(0, 25); reanalyze([key], 'Dados contratuais atualizados'); render();
}
function ctNew(key, ident) { const c = S.clients[key]; cadInit(c); if (!String(ident || '').trim()) return toast('Identifique o contrato (número ou nome).'); if (ctFind(c, ident)) return toast('Já existe contrato com esse identificador.'); ctUpsert(c, ident.trim()); touchC(key); render(); }

/* ---------- MRR com competência de referência e precedência ---------- */
const mrrComp = () => S.meta.mrrComp || refCompOf(S);
const mrrTol = () => S.meta.mrrTol ?? 10;
function mrrOf(c) {
  const comp = mrrComp(), fic = recurringByComp(c)[comp], planOk = c.mrr != null && !!S.meta.mrrPlanComp && S.meta.mrrPlanComp === comp, plan = planOk ? c.mrr : null, prec = S.meta.mrrPrec || 'ficha';
  let v = null, origem = null, div = false;
  if (fic != null && plan != null) { div = Math.abs(fic - plan) / Math.max(Math.abs(fic), Math.abs(plan), 1) * 100 > mrrTol(); [v, origem] = prec === 'planilha' ? [plan, 'planilha'] : [fic, 'ficha']; }
  else if (fic != null) [v, origem] = [fic, 'ficha']; else if (plan != null) [v, origem] = [plan, 'planilha'];
  return { v, origem, comp, div, fic: fic ?? null, plan, semComp: c.mrr != null && !planOk };
}

/* ---------- Segmentação: unidade de contagem, mapa editável, principal + secundários ---------- */
const UNIT_L = { conta: 'Conta (código TOTVS; sem código, CNPJ)', estabelecimento: 'Estabelecimento (CNPJ completo)', grupo: 'Grupo econômico (raiz do CNPJ, 8 dígitos)' };
const segUnit = () => S.meta.segUnit || 'conta';
function unitOf(c, u = segUnit()) {
  if (u === 'grupo') return c.cnpj ? 'g:' + c.cnpj.slice(0, 8) : c.code ? 'c:' + c.code : 'k:' + c.key;
  if (u === 'estabelecimento') return c.cnpj ? 'e:' + c.cnpj : c.code ? 'c:' + c.code : 'k:' + c.key;
  return c.code ? 'c:' + c.code : c.cnpj ? 'e:' + c.cnpj : 'k:' + c.key;
}
const SEG_NONE = 'none';
function segRawValues() { const m = {}; clients().forEach(c => String(c.seg || '').split(/[;|\/]+/).map(x => x.trim()).filter(Boolean).forEach(x => { const k = norm(x); (m[k] ||= { raw: x, n: 0 }).n++; })); return Object.entries(m).sort((a, b) => b[1].n - a[1].n); }
function segOfRaw(raw) { const n = norm(raw); if (!n) return null; const mp = S.meta.segMap || {}; if (mp[n]) return mp[n] === SEG_NONE ? null : mp[n]; if (/^(outros?|geral|n\/?a|nao informado|-)$/.test(n)) return null; return KB.segments.find(s => s.re.test(n))?.id || null; }
function hasDecl(c) { return c.cad && Object.values(c.cad).some(x => x?.v != null && stOf(x) === 'declarado') || stOf(c.fis?.regime) === 'declarado' || (c.contratos || []).some(ct => CT_F.some(([k]) => ct[k]?.v != null && stOf(ct[k]) === 'declarado')); }

/* ---------- Completude (não é potencial comercial) ---------- */
const COMP_DEF = [['code', 'Código TOTVS'], ['cnpj', 'CNPJ válido'], ['seg', 'Segmento definido'], ['mrr', 'MRR da competência de referência'], ['ficha', 'Ficha de faturamento utilizável'], ['regime', 'Regime tributário'], ['hosp', 'Hospedagem'], ['release', 'Release em produção confirmada'], ['contrato', 'Dados contratuais (renovação ou reajuste)'], ['func', 'Funcionários CLT'], ['fat', 'Faturamento anual'], ['filiais', 'Filiais / centros de distribuição']];
const compCrit = () => { const d = S.meta.compCrit || {}; return COMP_DEF.filter(([k]) => d[k] !== false); };
const relConf = c => evOk(c.rel).some(e => e.extra?.tipo === 'producao');
const ctHas = c => (c.contratos || []).some(ct => CT_F.some(([k]) => ct[k]?.v != null));
function compTest(c, k) {
  const cv = x => c.cad?.[x]?.v;
  switch (k) { case 'code': return !!c.code; case 'cnpj': return !!(c.cnpj && validCnpj(c.cnpj)); case 'seg': return !!c.segInfo?.id; case 'mrr': return mrrOf(c).v != null; case 'ficha': return !partial(c);
    case 'regime': { const v = c.fis?.regime?.v; return !!v && v !== 'Não informado'; } case 'hosp': return !!cv('hosp') && cv('hosp') !== 'nao_informado'; case 'release': return relConf(c); case 'contrato': return ctHas(c);
    case 'func': return cv('func') != null; case 'fat': return cv('fat') != null; case 'filiais': return cv('filiais') != null || cv('cds') != null; }
  return false;
}
function complet(c) { const cr = compCrit(); const ok = cr.filter(([k]) => compTest(c, k)), miss = cr.filter(([k]) => !compTest(c, k)); return { pct: cr.length ? Math.round(ok.length / cr.length * 100) : 100, ok, miss, n: cr.length }; }
const STRAT = ['regime', 'hosp', 'release', 'contrato', 'func', 'fat', 'filiais'];
const stratIncomplete = c => compCrit().some(([k]) => STRAT.includes(k) && !compTest(c, k));
const DQF = { sem_ficha: 'Sem ficha', sem_segmento: 'Sem segmento', sem_hosp: 'Sem hospedagem', sem_release: 'Sem release confirmada', sem_regime: 'Sem regime', sem_contrato: 'Sem dados contratuais', com_conflitos: 'Com conflitos', fontes_revisar: 'Com fontes a revisar' };
function fontesRevisar(c) { return hasDecl(c) || (c.reviewFlags || []).length > 0 || evCand(c.rel).length > 0 || (c.fis?.cand || []).some(e => e.st === 'candidato') || (c.cad && Object.values(c.cad).some(x => x?.v != null && isStale(x.at))); }
function dqTest(c, k) {
  switch (k) { case 'sem_ficha': return c.fstat?.k === 'nao_carregada'; case 'sem_segmento': return !c.segInfo?.id; case 'sem_hosp': return !compTest(c, 'hosp'); case 'sem_release': return !relConf(c); case 'sem_regime': return !compTest(c, 'regime'); case 'sem_contrato': return !ctHas(c);
    case 'com_conflitos': return (c.conflicts || []).length > 0 || (c.cadConf || []).some(x => !x.res) || mrrOf(c).div; case 'fontes_revisar': return fontesRevisar(c); }
  return true;
}

/* ---------- Inteligência por segmento ---------- */
const oppFund = o => o.modo === 'evidencia' && (o.evInd || []).some(e => e.cls === 'FATO');
function segIntel() {
  const u = segUnit(), units = new Map(); clients().forEach(c => { const k = unitOf(c, u); (units.get(k) || units.set(k, []).get(k)).push(c); });
  const R = {}, tot = { units: units.size, mrr: 0, known: 0, members: 0, mixed: 0, div: 0, semComp: 0 };
  const row = id => R[id] ||= { id, units: 0, mrr: 0, known: 0, members: 0, ficha: 0, incompl: 0, opps: 0, div: 0, mixed: 0, sec: 0, orig: { ficha: 0, planilha: 0 }, dupId: 0 };
  units.forEach(cs => {
    const cnt = {}; cs.forEach(c => { const s = c.segInfo?.id || SEG_NONE; cnt[s] = (cnt[s] || 0) + 1; }); const seg = Object.entries(cnt).sort((a, b) => b[1] - a[1] || (a[0] === SEG_NONE) - (b[0] === SEG_NONE))[0][0];
    const r = row(seg); r.units++; if (Object.keys(cnt).length > 1) { r.mixed++; tot.mixed++; }
    const seen = new Set(); cs.forEach(c => { const id = c.code || c.cnpj || c.key; if (seen.has(id)) { r.dupId++; return; } seen.add(id); const m = mrrOf(c); r.members++; tot.members++; if (m.v != null) { r.mrr += m.v; r.known++; r.orig[m.origem]++; tot.mrr += m.v; tot.known++; } if (m.div) { r.div++; tot.div++; } if (m.semComp) tot.semComp++; });
    if (cs.some(c => !partial(c))) r.ficha++; if (cs.some(stratIncomplete)) r.incompl++;
    r.opps += cs.reduce((a, c) => a + (c.opps || []).filter(oppFund).length, 0);
    const secs = new Set(cs.flatMap(c => c.segInfo?.sec || [])); secs.delete(seg); secs.forEach(s => row(s).sec++);
  });
  const rows = Object.values(R).filter(r => r.units || r.sec).sort((a, b) => (a.id === SEG_NONE) - (b.id === SEG_NONE) || b.units - a.units);
  return { u, rows, tot };
}

/* ---------- Lembretes contratuais (internos; somente datas confirmadas) ---------- */
const renovDays = () => (S.meta.renovDays?.length ? S.meta.renovDays : [180, 90, 30]).slice().sort((a, b) => b - a);
function ctReminders(c) {
  const out = []; (c.contratos || []).forEach(ct => [['proxRenov', 'Renovação contratual'], ['dataBase', 'Data-base do reajuste']].forEach(([k, l]) => {
    const f = ct[k]; if (!f?.v) return; const st = stOf(f), d = daysTo(f.v);
    if (st !== 'confirmado') { out.push({ c, ct, k, l, data: f.v, d, nivel: 'declarada', msg: `${l} ${fmtD(f.v)} declarada — confirme a data com o contrato para gerar lembrete.` }); return; }
    if (d < 0) { out.push({ c, ct, k, l, data: f.v, d, nivel: 'passada', msg: `${l} em ${fmtD(f.v)} já passou. Periodicidade não é presumida: confirme a próxima data.` }); return; }
    const lim = renovDays()[0]; if (d <= lim) { const fx = renovDays().filter(x => d <= x).pop(); out.push({ c, ct, k, l, data: f.v, d, nivel: 'alerta', fx, msg: `${l} em ${fmtD(f.v)} (${d} dias; aviso de ${fx} dias).` }); }
  })); return out;
}

/* ---------- Regras explicáveis ---------- */
const DEC_L = { indicio: 'Indício', necessidade: 'Necessidade confirmada', elegibilidade: 'Elegibilidade validada' };
function solIfExists(...ids) { return ids.map(id => S.solutions.find(s => s.id === id && !s.arquivado)).filter(Boolean).map(s => s.nome); }
function cadRules(c) {
  cadInit(c); consInit(c); const R = [], Q = [], CTX = [], cv = k => c.cad[k]?.v, src = f => f ? `${fonteTxt(f.fonte)}${f.dref ? ' • ref. ' + fmtD(f.dref) : ''} • ${ST_L[stOf(f)]}` : '';
  const reg = c.fis.regime;
  if (!reg?.v || reg.v === 'Não informado') Q.push('Qual o regime tributário do cliente? (critério para avaliar eventos regulatórios — nunca isolado)');
  else R.push({ id: 'regime', titulo: 'Regime tributário como critério regulatório', evid: [`Regime: ${reg.v} — ${src(reg)}`], hip: 'O regime é um dos critérios de aplicabilidade de eventos regulatórios. Sozinho não indica urgência, Bloco K nem impacto da Reforma Tributária.', sols: solIfExists('cfgtrib', 'sigafis'), deps: ['Operações realizadas (NF-e, NFS-e, CT-e, folha)', 'Atividade, UF e cadastros fiscais'], perg: ['Quais documentos fiscais o cliente emite e em quais UFs?', 'Há apuração com particularidades setoriais (ex.: produção, monofásicos)?'], acao: 'Completar o perfil fiscal na aba Fiscal e regulatório antes de qualquer conclusão.', fin: false });
  const h = cv('hosp');
  if (!h || h === 'nao_informado') Q.push('Onde o ambiente do ERP está hospedado (servidor local, nuvem de terceiro, TOTVS Cloud, híbrido)?');
  else if (h === 'local' || h === 'nuvem_terceiro') R.push({ id: 'cloud', titulo: 'Investigação de Cloud', evid: [`Hospedagem: ${HOSP[h]} — ${src(c.cad.hosp)}`], hip: 'Ambiente fora da TOTVS Cloud: vale investigar custos, riscos e responsabilidades atuais. Não é elegibilidade nem economia.', sols: solIfExists('cloud'), deps: ['Levantamento de infraestrutura, incidentes, backup, recuperação e custos (aba Contratação → Infraestrutura)', 'Proposta e condições comerciais oficiais'], perg: ['Quem responde hoje por backup, monitoramento e atualização?', 'Houve indisponibilidades nos últimos 12 meses?', 'Quais custos de infraestrutura são conhecidos?'], acao: 'Preencher o levantamento de infraestrutura com fontes; TCO só com valores informados.', fin: false });
  else CTX.push(`Hospedagem: ${HOSP[h]} — ${src(c.cad.hosp)}.`);
  if (!relConf(c)) Q.push(evCand(c.rel).length ? 'Confirmar a release em produção (há valor declarado ou mencionado aguardando confirmação na aba Tecnologia).' : 'Levantamento pendente: qual release do Protheus está em produção? (evidência: tela "Sobre" ou relatório de ambiente)');
  const fu = cv('func'); if (fu != null) CTX.push(`Funcionários CLT: ${fu}${c.cad.func.dref ? ' (ref. ' + fmtD(c.cad.func.dref) + ')' : ''} — usado só como contexto; nenhuma recomendação deriva do número de funcionários.`);
  const fa = cv('fat'); if (fa != null) { CTX.push(`Faturamento anual do cliente: ${fatTxt(fa)} — indicador de porte; não é receita TOTVS.`);
    const fins = (c.opps || []).flatMap(o => o.sols).filter(s => S.solutions.find(r => r.id === s.id)?.financeira); if (fins.length) R.push({ id: 'fin_porte', titulo: 'Ofertas financeiras: porte não define elegibilidade', evid: [`Faturamento anual: ${fatTxt(fa)} — ${src(c.cad.fat)}`, `Ofertas financeiras sugeridas: ${[...new Set(fins.map(s => s.nome))].join(', ')}`], hip: 'Porte é apenas contexto. Critérios oficiais de elegibilidade, limite e aprovação de crédito não são deduzidos.', sols: [], deps: ['Critérios oficiais da oferta financeira (fonte TOTVS/Techfin)', 'Análise de crédito pela instituição responsável'], perg: ['O cliente já passou por análise de crédito da oferta?'], acao: 'Validar critérios oficiais antes de mencionar condições.', fin: true }); }
  else Q.push('Qual o faturamento anual do cliente (valor ou faixa, moeda e exercício)? — indicador de porte, separado da receita TOTVS.');
  const fl = cv('filiais'), cd = cv('cds');
  if (fl == null && cd == null) Q.push('Quantas filiais e centros de distribuição o cliente possui?');
  else if ((cd ?? 0) >= 1 || (fl ?? 0) >= 2) R.push({ id: 'logistica', titulo: 'Complexidade logística (investigar antes de WMS, TMS ou GFE)', evid: [fl != null ? `Filiais: ${fl} — ${src(c.cad.filiais)}` : null, cd != null ? `Centros de distribuição: ${cd} — ${src(c.cad.cds)}` : null].filter(Boolean), hip: 'Mais de uma unidade ou CD é indício de complexidade, não de necessidade. Investigar volume, armazenagem, separação, transporte e fretes.', sols: solIfExists('sigawms', 'sigatms', 'totvsgfe'), deps: ['Volume movimentado e número de SKUs', 'Processo atual de armazenagem e separação', 'Modelo de transporte (frota própria × contratada) e gestão de fretes'], perg: ['Qual o volume diário de pedidos/expedições por CD?', 'Como é feita a separação (papel, coletor, sistema)?', 'O transporte é próprio ou contratado? Como os fretes são conferidos?'], acao: 'Registrar as respostas antes de sugerir WMS, TMS ou GFE.', fin: false });
  if (!(c.contratos || []).length) Q.push('Quais contratos o cliente mantém (identificação, última renovação, próxima renovação, índice e data-base do reajuste)?');
  (c.contratos || []).forEach(ct => {
    if (!ct.proxRenov?.v && ct.ultRenov?.v) Q.push(`Contrato ${ct.ident}: última renovação em ${fmtD(ct.ultRenov.v)}; qual a próxima? (periodicidade não é presumida)`);
    if (!ct.indice?.v) Q.push(`Contrato ${ct.ident}: qual índice de reajuste se aplica? (não presumido)`); if (!ct.dataBase?.v) Q.push(`Contrato ${ct.ident}: qual a data-base do reajuste? (pode diferir da renovação)`);
    const rem = ctReminders({ contratos: [ct] }).filter(x => x.nivel === 'alerta'); if (!rem.length) return;
    const ctx = [(c.churn || '').trim() ? `sinal de risco na planilha (${c.churn})` : null, (c.opps || []).length ? `${c.opps.length} oportunidade(s) mapeada(s)` : null].filter(Boolean);
    R.push({ id: 'ct_' + ct.id, titulo: `Revisão contratual — ${ct.ident}`, evid: rem.map(x => `${x.l}: ${fmtD(x.data)} (${x.d} dias) — ${src(ct[x.k])}`), hip: ctx.length ? `Janela de revisão contratual com contexto: ${ctx.join('; ')}. Avaliar retenção${(c.opps || []).length ? ' e expansão' : ''}.` : 'Janela de revisão contratual; sem contexto adicional para retenção ou expansão.', sols: [], deps: ['Condições contratuais vigentes (contrato/aditivos)', 'Histórico de relacionamento'], perg: ['Há insatisfações ou pendências que afetem a renovação?', 'O índice de reajuste aplicado é conhecido pelo cliente?'], acao: 'Lembrete interno: preparar revisão antes da data (sem envio externo).', fin: false });
  });
  return { R, Q: [...new Set(Q)], CTX };
}

/* ---------- Importação da carteira com prévia, correspondência e conflitos ---------- */
const STRAT_IMP = { hosp: 'hosp', func: 'func', fat: 'fat', filiais: 'filiais', cds: 'cds' };
const CT_IMP = ['ultRenov', 'proxRenov', 'indice', 'dataBase'];
function impVal(k, raw, row, get) {
  const s = String(raw ?? '').trim(); if (!s && !(raw instanceof Date) && typeof raw !== 'number') return { empty: true };
  switch (k) {
    case 'cnpj': { const cn = normCnpj(raw); return cn.length === 14 && validCnpj(cn) ? { v: cn } : { v: cn, warn: 'CNPJ inválido' }; }
    case 'mrr': { const n = parseNum(raw); return n == null ? { warn: 'MRR não numérico', skip: true } : { v: n }; }
    case 'hosp': { const h = normHosp(raw); return h ? { v: h } : { warn: `Hospedagem não reconhecida ("${s}")`, skip: true }; }
    case 'func': case 'filiais': case 'cds': { const n = nonNegInt(raw); return n === undefined ? { warn: `Valor inválido em ${k} ("${s}"): use inteiro não negativo`, skip: true } : { v: n }; }
    case 'fat': { const p = parseFat(raw); if (!p) return { warn: 'Faturamento inválido', skip: true }; const moeda = String(get('moeda') || 'BRL').trim().toUpperCase() || 'BRL', ex = String(get('exerc') || '').trim() || null; return { v: { ...p, moeda, exercicio: ex } }; }
    case 'ultRenov': case 'proxRenov': case 'dataBase': { const d = pDate(raw); return d ? { v: d } : { warn: `Data inválida em ${k} ("${s}")`, skip: true }; }
    case 'dref': { const d = pDate(raw); return d ? { v: d } : { warn: 'Data de referência inválida', skip: true }; }
    default: return { v: raw instanceof Date ? raw.toISOString().slice(0, 10) : s };
  }
}
const BASIC_K = ['code', 'name', 'cnpj', 'seg', 'city', 'uf', 'size', 'mrr', 'products', 'churn', 'nps', 'notes', 'regime', 'release'];
const PROP = { products: 'productsRaw' };
const curBasic = (c, k) => c ? c[PROP[k] || k] : undefined;
function cadCur(c, k) { if (!c) return null; if (k === 'regime') return c.fis?.regime || null; if (k === 'release') { const e = evOk(c.rel || []).find(x => x.extra?.tipo === 'producao' && x.fonte?.tipo !== 'planilha'); return e ? { v: e.v, st: 'confirmado' } : null; } return c.cad?.[k] || null; }
function impPlan() {
  const w = UI.wiz, sh = w.sheets[w.si], rows = sh.rows, m = w.map; w.res ||= {}; w.cf ||= {}; w.opt ||= { clear: false };
  const get = (r, k) => m[k] == null ? '' : r[m[k]] ?? '';
  const byCode = new Map(), byCn = new Map(); clients().forEach(c => { if (c.code) (byCode.get(c.code) || byCode.set(c.code, []).get(c.code)).push(c); if (c.cnpj) (byCn.get(c.cnpj) || byCn.set(c.cnpj, []).get(c.cnpj)).push(c); });
  const seenId = new Map(), out = [];
  for (let i = w.h + 1; i < rows.length; i++) {
    const r = rows[i]; if (!r || r.every(x => String(x ?? '').trim() === '')) continue;
    const g = k => get(r, k), code = String(g('code')).trim(), cn = normCnpj(g('cnpj')), name = String(g('name')).trim();
    const P = { i, line: i + 1, code, cnpj: cn, name, ch: [], cf: [], warn: [], keep: 0, act: 'novo', target: null, cands: [] };
    if (!name && !code && !cn) { P.act = 'ignorar'; P.warn.push('linha sem identificação (código, CNPJ ou razão social)'); out.push(P); continue; }
    const idk = code ? 'c:' + code : cn.length === 14 ? 'j:' + cn : 'n:' + normName(name); P.idk = idk;
    const cident = norm(String(g('contrato') || '').trim() || 'principal'), first = seenId.get(idk);
    if (first && m.contrato != null && !first.cts.has(cident)) { P.cont = first.P; first.cts.add(cident); }
    else if (first) { P.dupOf = first.line; P.act = w.res[i] || 'ignorar'; P.warn.push(`identificador repetido no arquivo (linha ${first.line})`); } else seenId.set(idk, { line: i + 1, P, cts: new Set([cident]) });
    const a = code ? byCode.get(code) || [] : [], b = cn.length === 14 ? byCn.get(cn) || [] : []; const cands = [...new Map([...a, ...b].map(c => [c.key, c])).values()];
    P.cands = cands.map(c => ({ key: c.key, name: c.name, by: [a.includes(c) ? 'código' : '', b.includes(c) ? 'CNPJ' : ''].filter(Boolean).join(' + ') }));
    if (!P.dupOf) { if (cands.length > 1) { P.amb = true; const ch = w.res[i]; P.act = ch && ch !== 'auto' ? (S.clients[ch] ? 'atualizar' : ch) : 'pendente'; if (S.clients[ch]) P.target = ch; }
      else if (cands.length === 1) { P.act = w.res[i] === 'ignorar' ? 'ignorar' : 'atualizar'; P.target = cands[0].key; }
      else if (!code && cn.length !== 14) { const nm = clients().filter(c => normName(c.name) === normName(name)); if (nm.length) { P.warn.push(`razão social igual a ${nm.length} cliente(s) existente(s), sem código/CNPJ para confirmar — criado como novo salvo escolha`); P.cands = nm.map(c => ({ key: c.key, name: c.name, by: 'razão social (sugestão)' })); P.amb = true; const ch = w.res[i]; P.act = ch && S.clients[ch] ? 'atualizar' : ch || 'novo'; if (S.clients[ch]) P.target = ch; } } }
    if (w.res[i] === 'novo') { P.act = 'novo'; P.target = null; } if (w.res[i] === 'ignorar') P.act = 'ignorar';
    if (P.cont) { P.act = P.cont.act; P.target = P.cont.target; P.amb = false; P.cands = []; }
    const c = P.target ? S.clients[P.target] : null;
    if (c && code && c.code && c.code !== code) P.cf.push({ k: 'code', l: 'Código TOTVS', de: c.code, para: code, id: i + '|code' });
    if (c && cn.length === 14 && c.cnpj && c.cnpj !== cn) P.cf.push({ k: 'cnpj', l: 'CNPJ', de: fmtCnpj(c.cnpj), para: fmtCnpj(cn), id: i + '|cnpj' });
    const dref = m.dref != null ? impVal('dref', g('dref'), r, g) : { empty: true }; if (dref.warn) P.warn.push(dref.warn); P.dref = dref.v || null;
    FIELDS.forEach(f => { const k = f.k; if (m[k] == null || ['dref', 'moeda', 'exerc', 'contrato'].includes(k)) return; const val = impVal(k, g(k), r, g); if (val.warn) P.warn.push(val.warn); if (val.skip) return;
      const strat = STRAT_IMP[k] || k === 'regime' || k === 'release', ct = CT_IMP.includes(k);
      if (val.empty) { if (w.opt.clear && c) { const cur = ct ? null : strat ? cadCur(c, k)?.v : curBasic(c, k); if (cur != null && cur !== '') P.ch.push({ k, l: f.l, de: cur, para: null, clear: true }); } else if (c) P.keep++; return; }
      if (ct) { const ident = String(g('contrato') || '').trim() || 'principal', cur = c ? ctFind(c, ident)?.[k] : null; const nv = val.v;
        if (cur?.v === nv) return; if (cur?.v != null && stOf(cur) === 'confirmado') P.cf.push({ k, l: `${f.l} (contrato ${ident})`, de: cadTxt(k, cur.v), para: cadTxt(k, nv), id: i + '|' + k, ct: ident, v: nv }); else P.ch.push({ k, l: `${f.l} (contrato ${ident})`, de: cur?.v ?? null, para: nv, ct: ident }); return; }
      if (strat) { let nv = val.v; if (k === 'regime') nv = normRegimeL(nv); const cur = cadCur(c, k); const cmp = x => JSON.stringify(x ?? null);
        if (k === 'release') { if (cur?.v && relNorm(String(nv).replace(/^.*12\.1\./, '')) !== cur.v) P.cf.push({ k, l: 'Release em produção', de: cur.v, para: nv, id: i + '|' + k, v: nv, info: 'release confirmada permanece; valor da planilha entra como declarado' }); else P.ch.push({ k, l: f.l, de: curBasic(c, 'release') || null, para: nv }); return; }
        if (cmp(cur?.v) === cmp(nv)) return; if (cur?.v != null && stOf(cur) === 'confirmado') P.cf.push({ k, l: f.l, de: cadTxt(k, cur.v), para: cadTxt(k, nv), id: i + '|' + k, v: nv }); else P.ch.push({ k, l: f.l, de: cur?.v ?? null, para: nv }); return; }
      if (['code', 'cnpj'].includes(k) && c) return; const cur = curBasic(c, k); if (String(cur ?? '') === String(val.v ?? '')) return; P.ch.push({ k, l: f.l, de: cur ?? null, para: val.v }); });
    out.push(P);
  }
  const sum = { novo: 0, atualizar: 0, igual: 0, ignorar: 0, pendente: 0, cf: 0, keep: 0, warn: 0 };
  out.forEach(P => { if (P.cont) { sum.cont = (sum.cont || 0) + 1; sum.cf += P.cf.length; sum.keep += P.keep; sum.warn += P.warn.length; return; } if (P.act === 'atualizar' && !P.ch.length && !P.cf.length) sum.igual++; else if (sum[P.act] != null) sum[P.act]++; sum.cf += P.cf.length; sum.keep += P.keep; sum.warn += P.warn.length; });
  return { rows: out, sum };
}
function impApplyPlan(opt = {}) {
  const w = UI.wiz, sh = w.sheets[w.si], m = w.map, plan = impPlan(); if (plan.sum.pendente) return toast(`${plan.sum.pendente} linha(s) com correspondência ambígua: escolha o cliente, "novo" ou "ignorar" antes de confirmar.`);
  const get = (r, k) => m[k] == null ? '' : sh.rows[r][m[k]] ?? ''; const used = new Set(Object.keys(S.clients)), created = new Map(); let add = 0, upd = 0, ign = 0, kept = 0, rep = 0; const matched = new Set();
  plan.rows.forEach(P => {
    if (P.act === 'ignorar' || P.act === 'pendente') { ign++; (P.cands || []).forEach(x => matched.add(x.key)); return; }
    let c = P.target ? S.clients[P.target] : P.cont ? created.get(P.idk) : null;
    if (!c) { let key = safeKey(P.code ? 'c_' + P.code : P.cnpj.length === 14 ? 'j_' + P.cnpj : 'n_' + normName(P.name).replace(/ /g, '-')); if (used.has(key)) { let n = 2; while (used.has(key + '_' + n)) n++; key += '_' + n; } used.add(key);
      c = S.clients[key] = { key, code: P.code, name: P.name, cnpj: P.cnpj.length === 14 ? P.cnpj : '', cnpjRaw: P.cnpj && P.cnpj.length !== 14 ? String(get(P.i, 'cnpj')) : '', seg: '', city: '', size: '', mrr: null, productsRaw: '', churn: '', nps: '', notes: '', uf: '', regime: '', release: '', fichas: [], docs: [], mgmt: {}, act: {} }; created.set(P.idk, c); add++; } else if (!P.cont) upd++;
    cadInit(c); c.src = { file: w.name, sheet: sh.name, row: P.line }; const o = { tipo: 'planilha', ref: `Planilha ${w.name}`, loc: `linha ${P.line}`, dref: P.dref, st: 'declarado' };
    P.ch.forEach(x => {
      if (CT_IMP.includes(x.k)) { const ct = ctUpsert(c, x.ct); ctSetRaw(ct, x.k, x.para, o); ct.hist = [{ at: nowISO(), acao: `importação: ${x.l} = ${x.para ?? '(limpo)'}` }, ...(ct.hist || [])].slice(0, 25); return; }
      if (STRAT_IMP[x.k]) { cadSetRaw(c, x.k, x.para, { ...o, motivo: x.clear ? 'célula vazia com opção "limpar" marcada' : '' }); return; }
      if (x.k === 'regime') { c.regime = x.para ? String(get(P.i, 'regime')).trim() : ''; if (!x.para && c.fis?.regime?.fonte?.tipo === 'planilha') c.fis.regime = null; return; }
      if (x.k === 'release') { c.release = x.para ?? ''; return; }
      const fe = x.k === 'mrr' ? 'mrr' : PROP[x.k] || x.k;
      if (c.edits?.[fe] && String(c[fe] ?? '') !== String(x.para ?? '')) { c.cadConf = [{ id: 'cf_' + uid(), campo: x.l, de: String(c[fe] ?? ''), para: String(x.para ?? ''), fonte: `${o.ref} • ${o.loc} (campo editado manualmente)`, at: nowISO(), res: null }, ...(c.cadConf || [])].slice(0, 30); kept++; return; }
      if (x.k === 'mrr') { c.mrr = x.para; return; } c[PROP[x.k] || x.k] = x.para ?? '';
    });
    P.cf.forEach(x => { const d = w.cf[x.id] || 'manter'; if (x.k === 'release') { c.release = x.para; return; }
      c.cadConf = [{ id: 'cf_' + uid(), campo: x.l, de: String(x.de), para: String(x.para), fonte: `${o.ref} • ${o.loc}`, at: nowISO(), res: d === 'substituir' ? 'substituído pelo usuário na importação' : null }, ...(c.cadConf || [])].slice(0, 30);
      if (d !== 'substituir') { kept++; return; } rep++;
      if (x.k === 'code') c.code = P.code; else if (x.k === 'cnpj') c.cnpj = P.cnpj; else if (CT_IMP.includes(x.k)) ctSetRaw(ctUpsert(c, x.ct), x.k, x.v, o); else if (x.k === 'regime') { c.regime = x.v; c.fis.regime = { ...fld(x.v, 'NECESSITA VALIDAÇÃO', { tipo: 'planilha', ref: o.ref, loc: o.loc }, c.fis.regime), st: 'declarado' }; } else cadSetRaw(c, x.k, x.v, { ...o, motivo: 'substituição escolhida na importação' }); });
    matched.add(c.key); touchC(c.key);
  });
  S.meta.mapping = m; if (!w.fromSheet) S.meta.files.push({ id: uid(), name: w.name, kind: 'carteira', at: nowISO(), hash: 'carteira:' + w.name + ':' + sh.rows.length });
  const res = { add, upd, ign, kept, rep, keep: plan.sum.keep }; if (w.fromSheet) shAfterApply(w, plan, matched, res);
  reanalyzeAll(); reassocInbox();
  log(`Carteira ${w.fromSheet ? 'sincronizada (planilha do Google)' : 'importada'}: ${add} novo(s), ${upd} atualizado(s), ${ign} linha(s) ignorada(s); ${plan.sum.keep} campo(s) preservado(s) por célula vazia; conflitos: ${kept} mantido(s), ${rep} substituído(s).`, 'ok');
  UI.wiz = null; if (!opt.silent) { UI.view = 'geral'; render(); }
  return res;
}

/* ---------- Modelo de importação (XLSX sem dados) ---------- */
const TPL = [['Código TOTVS', 'Identificador da conta. Usado para atualizar o cliente certo.', 'texto'], ['Razão social', 'Nome do cliente.', 'texto'], ['CNPJ', 'Com ou sem máscara. Também usado na correspondência.', '00.000.000/0000-00'], ['Segmento', 'Texto livre; mais de um segmento separado por ";" (o primeiro é o principal).', 'texto'], ['Cidade', '', 'texto'], ['UF', 'Sigla da UF.', 'XX'],
  ['Porte', '', 'texto'], ['MRR (recorrente TOTVS)', 'Receita recorrente TOTVS. Informe a competência na tela de Visão geral.', 'número'], ['Produtos', 'Produtos/módulos contratados.', 'texto'], ['Regime tributário', 'Lucro Real, Lucro Presumido, Simples Nacional, … "Não informado" ou "Outros".', 'texto'], ['Release Protheus em produção', 'Entra como DECLARADA; alertas só após confirmação.', '12.1.xxxx'],
  ['Hospedagem', 'local | nuvem de terceiro | TOTVS Cloud | híbrido | não informado', 'texto'], ['Funcionários CLT', 'Inteiro não negativo.', 'número inteiro'], ['Faturamento anual do cliente', 'Valor ou faixa. NÃO é receita TOTVS.', 'número ou faixa'], ['Moeda', 'Padrão BRL.', 'BRL'], ['Exercício', 'Ano fiscal do faturamento.', 'AAAA'],
  ['Filiais', 'Inteiro não negativo.', 'número inteiro'], ['Centros de distribuição', 'Inteiro não negativo (separado de filiais).', 'número inteiro'], ['Data de referência', 'Data a que se referem funcionários, faturamento, filiais e CDs.', 'DD/MM/AAAA'],
  ['Contrato', 'Identificador do contrato. Vários contratos: uma linha por contrato com o mesmo código TOTVS.', 'texto'], ['Última renovação', 'Data ligada ao contrato informado.', 'DD/MM/AAAA'], ['Próxima renovação', 'Não é calculada: informe a data.', 'DD/MM/AAAA'], ['Índice de reajuste', 'Ex.: IPCA, IGP-M (não presumido).', 'texto'], ['Data-base do reajuste', 'Pode ser diferente da renovação.', 'DD/MM/AAAA'],
  ['Churn / risco', '', 'texto'], ['NPS', '', 'texto'], ['Observações', '', 'texto']];
async function downloadTemplate() {
  if (!(await vend('xlsx'))) return toast('Biblioteca XLSX indisponível neste ambiente.');
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([TPL.map(x => x[0])]), 'Carteira');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Coluna', 'Instrução', 'Formato'], ...TPL, [], ['Regras gerais', 'Células vazias preservam o valor existente (a menos que a opção "limpar" seja marcada na prévia). Valores importados entram como DECLARADOS. Informações confirmadas não são substituídas sem sua escolha. Colunas podem ter outros nomes e ficar em qualquer ordem: o mapeamento é conferido na prévia. Planilhas antigas (sem as novas colunas) continuam aceitas.', '']]), 'Instruções');
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }); offer('modelo-carteira-totvs.xlsx', new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
}

/* ---------- Migração: release vinda da planilha passa a "declarada" (não confirmada automaticamente) ---------- */
function migrateDecl(c) {
  (c.rel || []).forEach(e => { if (e.fonte?.tipo === 'planilha' && e.st === 'confirmado' && !(e.hist || []).some(h => h.por === 'usuário' && /confirm/.test(h.acao))) { e.st = 'candidato'; e.cls = 'NECESSITA VALIDAÇÃO'; e.conf = null; e.extra = { ...(e.extra || {}), decl: true }; evH(e, 'reclassificado: valor declarado na planilha aguarda confirmação', 'regra de cadastro'); } });
  if (c.fis?.regime && !c.fis.regime.st) c.fis.regime.st = c.fis.regime.fonte?.tipo === 'planilha' ? 'declarado' : 'confirmado';
}
