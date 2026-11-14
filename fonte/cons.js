/* ===== GESTÃO CONSULTIVA: evidências, contratação, releases, regulatório, ROI, ecossistema ===== */
const CLS5 = ['FATO', 'INFERÊNCIA', 'ESTIMATIVA', 'HIPÓTESE', 'NECESSITA VALIDAÇÃO'];
const nowISO = () => new Date().toISOString();
/* ---------- Modelo de evidência ---------- */
function mkEv(v, o = {}) {
  const conf = o.st === 'confirmado';
  return { id: 'e_' + uid(), v: String(v ?? '').slice(0, 400), cls: o.cls || (conf ? 'FATO' : 'INFERÊNCIA'), st: o.st || 'candidato',
    fonte: { tipo: o.tipo || 'documento', ref: o.ref || '', loc: o.loc || '', u: o.u || '', doc: o.doc || '' }, trecho: String(o.trecho || '').slice(0, 260),
    at: nowISO(), conf: conf ? (o.conf || nowISO()) : null, extra: o.extra || null, sig: o.sig || '',
    hist: [{ at: nowISO(), acao: conf ? 'registrado e confirmado' : 'registrado como candidato', por: o.por || 'extração automática' }] };
}
const evH = (e, acao, por = 'usuário', de, para) => { e.hist = [{ at: nowISO(), acao, por, ...(de !== undefined ? { de, para } : {}) }, ...(e.hist || [])].slice(0, 25); };
function evSet(e, st) { const was = e.st; e.st = st; if (st === 'confirmado') { if (e.cls === 'INFERÊNCIA') e.cls = 'FATO'; e.conf = nowISO(); } evH(e, st === 'confirmado' ? 'confirmado' : st === 'descartado' ? 'descartado' : 'reaberto', 'usuário', was, st); }
const evOk = a => (a || []).filter(e => e.st === 'confirmado');
const cdocOk = (c, e) => !e.fonte?.doc || (c.cdocs || []).find(d => d.id === e.fonte.doc)?.state === 'confirmado';
const evCand = a => (a || []).filter(e => e.st === 'candidato');
const fld = (v, cls, fonte, prev) => ({ v, cls, fonte, at: nowISO(), hist: [{ at: nowISO(), acao: prev ? 'alterado' : 'registrado', de: prev?.v ?? null, para: v, fonte: fonte?.ref || fonte?.tipo || '' }, ...(prev?.hist || [])].slice(0, 25) });
const fonteTxt = f => !f ? '—' : [f.tipo === 'planilha' ? 'Planilha' : f.tipo === 'manual' ? 'Registro manual' : f.tipo === 'oficial' ? 'Fonte oficial' : f.tipo === 'pesquisa' ? 'Pesquisa' : 'Documento', f.ref, f.loc].filter(Boolean).join(' • ');

const LIC_F = [['modelo', 'Modelo comercial'], ['modalidade', 'Modalidade contratual'], ['metrica', 'Métrica de licenciamento'], ['hospedagem', 'Hospedagem'], ['vigencia', 'Vigência'], ['renovacao', 'Renovação'], ['reajuste', 'Reajuste'], ['condicao', 'Condição corporativa / grupo']];
const CLOUD_F = [['atual', 'Infraestrutura atual'], ['servidores', 'Servidores: idade e capacidade'], ['incidentes', 'Incidentes e indisponibilidades'], ['custos', 'Custos conhecidos'], ['resp', 'Responsabilidades (backup, monitoramento, atualização)'], ['disp', 'Disponibilidade exigida / SLA atual'], ['backup', 'Backup (frequência, teste de restauração)'], ['recup', 'Recuperação (RPO/RTO, plano de contingência)'], ['integ', 'Integrações e latência'], ['restr', 'Restrições (regulatórias, contratuais, legados)']];
const REGIMES = ['Lucro Real', 'Lucro Presumido', 'Lucro Arbitrado', 'Simples Nacional', 'MEI', 'Imune/Isento'];
const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
const OPS = { nfe: 'Emite NF-e/NFC-e', cte: 'Emite CT-e/MDF-e', nfse: 'Emite NFS-e (prestador de serviços)', naoicms: 'Não é contribuinte do ICMS', folha: 'Folha própria (eSocial)', rural: 'Adquire produção rural', cadpj: 'Cadastra clientes/fornecedores PJ (CNPJ)', monof: 'Operações monofásicas (ex.: combustíveis)' };
const ACOES_REG = { diagnostico: 'Diagnóstico de preparação', cadastros: 'Revisão de cadastros e classificações fiscais', parametrizacao: 'Revisão de parametrizações (inclusive TES, quando pertinente)', testes: 'Testes de processos e integrações', atualizacao: 'Atualização tecnológica (release/pacotes)', treinamento: 'Treinamento e acompanhamento' };
function consInit(c) {
  c.lic ||= {}; c.lic.f ||= {}; LIC_F.forEach(([k]) => c.lic.f[k] ||= []); c.lic.itens ||= []; c.lic.regras ||= []; c.lic.precos ||= { meses: 12, viavel: false };
  c.cloud ||= {}; c.cloud.f ||= {}; CLOUD_F.forEach(([k]) => c.cloud.f[k] ||= []); c.cloud.tco ||= { horiz: '12, 36, 60', a: {}, p: {}, capex: [] };
  c.rel ||= []; c.fis ||= { regime: null, uf: null, atividade: null, ops: {}, cand: [] }; c.fis.ops ||= {}; c.fis.cand ||= [];
  c.roi ||= []; c.exec ||= {}; c.exec.ok ||= {}; c.exec.valores ||= { interno: true, cliente: false }; c.cdocs ||= [];
}

/* ---------- Extração de contratos/aditivos ---------- */
const LIC_RE = {
  modelo: /(subscri[cç][aã]o|assinatura mensal|licen[cç]a (de uso )?perp[eé]tua|cess[aã]o (de direito )?de uso|\bcdu\b|\bsaas\b|smart ?erp|licen[cç]a tempor[aá]ria)/i,
  modalidade: /modalidade[^\n:]{0,25}:\s*[^\n]{3,60}/i,
  metrica: /(usu[aá]rios? nomead\w*|acessos? simult[aâ]ne\w*|usu[aá]rios? simult[aâ]ne\w*|faixa de faturamento|receita bruta anual|por cpu|por core|por (n[uú]mero de )?funcion[aá]rios|colaboradores ativos|por cnpj|por filial|por transa[cç][aã]o|por documento emitido|\bsmse?\b)/i,
  hospedagem: /(totvs cloud|cloud prime|cloud dedicad\w*|nuvem (da )?totvs|data ?center pr[oó]prio|servidor(es)? pr[oó]prio\w*|on-?premise|infraestrutura (do cliente|pr[oó]pria)|hospedad[oa] (em|na|no|pelo|pela)[^\n.]{0,40}|\baws\b|\bazure\b|google cloud|oracle cloud)/i,
  vigencia: /(vig[eê]ncia[^\n.]{0,80}|prazo (contratual|de vig[eê]ncia)[^\n.]{0,60}|pelo prazo de [^\n.]{0,40})/i,
  renovacao: /(renova[cç][aã]o[^\n.]{0,70}|renovad[oa] automaticamente[^\n.]{0,40})/i,
  reajuste: /(reajust\w*[^\n.]{0,80}|\b(igp-?m|ipca|inpc|igp-?di)\b[^\n.]{0,40})/i,
  condicao: /(contrato corporativo|acordo corporativo|grupo econ[oô]mico|empresas do (mesmo )?grupo|contrato[- ]m[aã]e|master agreement|coligadas)/i
};
const QTD_RE = /(\d{1,5})\s*(usu[aá]rios?|licen[cç]as?|acessos?|users?)\b|(?:qtd\.?|quantidade)\D{0,8}(\d{1,5})/i;
const PERFIL_RE = /\b(full|light|lgt|corporativ[oa]|determinad[oa]|ondemand|on demand)\b/i;
function extractLic(c, lines, doc) {
  const add = (k, v, l) => { const sig = `${k}|${norm(v)}`; const arr = c.lic.f[k]; if (arr.some(e => e.sig === sig)) return; if (arr.filter(e => e.fonte.ref === doc.name).length >= 6) return; arr.push(mkEv(v.trim(), { ref: doc.name, loc: l.loc, trecho: l.text, sig, doc: doc.id })); };
  lines.forEach(l => {
    for (const [k, re] of Object.entries(LIC_RE)) { const m = l.text.match(re); if (m) add(k, k === 'modalidade' ? m[0].split(':').slice(1).join(':').trim() || m[0] : m[0], l); }
    const p = prodPatterns().find(pp => pp.re.test(l.text)), q = l.text.match(QTD_RE), pf = l.text.match(PERFIL_RE);
    if (p && (q || pf)) { const qtd = q ? +(q[1] || q[3]) : null, perfil = pf ? pf[1] : ''; const sig = `item|${p.id}|${qtd}|${norm(perfil)}|${norm(l.text).slice(0, 60)}`;
      if (!c.lic.itens.some(e => e.sig === sig)) c.lic.itens.push(mkEv(`${p.nome}${qtd != null ? ' — ' + qtd + ' ' + (q[2] || 'un.') : ''}${perfil ? ' — perfil ' + perfil : ''}`, { ref: doc.name, loc: l.loc, trecho: l.text, sig, doc: doc.id, extra: { produto: p.nome, modulo: l.text.replace(/\s+/g, ' ').slice(0, 80), qtd, perfil } })); }
  });
}
/* ---------- Releases ---------- */
const REL_RE = /\b(?:p?12\.1\.(\d{2}(?:\d{2})?)|release\s+(?:12\.1\.)?(2[1-9][01]\d))\b/gi;
const relNorm = n => '12.1.' + n;
function relKey(r) { const m = String(r || '').match(/12\.1\.(\d+)/); if (!m) return null; const n = +m[1]; return n < 100 ? n : 100 + n; }
const REL_PROD = /(em produ[cç][aã]o|ambiente (atual|de produ[cç][aã]o)|vers[aã]o atual|release atual|atualmente|rodando|instalad\w*|em uso|utiliza\w*|encontra-se|est[aá] (na|no) (release|vers[aã]o))/i;
const REL_DEST = /(\bdestino\b|planejad\w*|previst\w*|pretend\w*|\balvo\b|homologa[cç][aã]o d[ao] nova)/i;
const REL_HIST = /(anterior|antig\w*|\bera\b|\bfoi\b|desde|migrad[oa] de|vinha)/i;
function relContext(text, idx, len) {
  const pre = text.slice(Math.max(0, idx - 80), idx), near = pre.slice(-28), post = text.slice(idx + len, idx + len + 30);
  if (/\bpara\s*(a\s*|o\s*)?(release\s*|vers[aã]o\s*)?$/i.test(near)) return 'destino';
  if (/\bde\s*(a\s*|o\s*)?(release\s*|vers[aã]o\s*)?$/i.test(near) && /\bpara\b/i.test(post)) return 'historica';
  if (REL_DEST.test(pre + post)) return 'destino'; if (REL_PROD.test(pre + post)) return 'producao'; if (REL_HIST.test(pre)) return 'historica';
  return 'mencao';
}
const REL_TIPO = { producao: 'possível produção', destino: 'release de destino', historica: 'menção histórica', mencao: 'menção sem contexto' };
function relProduct(text, idx, c) {
  const w = text.slice(Math.max(0, idx - 120), idx + 60);
  if (/protheus/i.test(w)) return 'Protheus'; if (/\brm\b|linha rm/i.test(w)) return 'RM'; if (/datasul/i.test(w)) return 'Datasul';
  return baseLines(c)[0] || 'Linha não identificada';
}
function baseLines(c) { const m = { protheus: 'Protheus', rm_linha: 'RM', datasul: 'Datasul', winthor: 'Winthor', logix: 'Logix' }; return [...new Set((c.productsIdent || []).map(p => m[p.id]).filter(Boolean))]; }
function relSources(c) {
  const out = []; if (c.notes) out.push({ t: c.notes, ref: 'Planilha (Observações)', loc: `linha ${c.src?.row || '?'}` }); if (c.productsRaw) out.push({ t: c.productsRaw, ref: 'Planilha (Produtos)', loc: `linha ${c.src?.row || '?'}` });
  (c.docs || []).forEach(d => out.push({ t: d.text, ref: d.name, loc: '' })); (c.cdocs || []).filter(d => d.state === 'confirmado').forEach(d => out.push({ t: d.text, ref: d.name, loc: '' }));
  fichasOk(c).forEach(f => out.push({ t: f.matchText || '', ref: f.file, loc: f.loc || '' })); if (c.mgmt?.notes) out.push({ t: c.mgmt.notes, ref: 'Observações manuais', loc: '' });
  return out;
}
function relSync(c) {
  if (c.release && !c.rel.some(e => e.fonte.tipo === 'planilha' && e.v === relNorm(String(c.release).replace(/^.*12\.1\./, '')))) {
    const m = String(c.release).match(/12\.1\.(\d+)|^(\d{2,4})$/); if (m) { const r = relNorm(m[1] || m[2]); c.rel.filter(e => e.fonte.tipo === 'planilha' && e.st === 'candidato').forEach(e => { e.st = 'substituido'; evH(e, 'substituído por nova importação da planilha', 'importação'); });
      /* tipo 'planilha' é mantido (a lógica de cadCur/relSync depende dele); só o rótulo exibido muda quando a release veio de print */
      const pf = c.prFill?.release && String(c.prFill.release.para) === String(c.release) ? c.prFill.release : null;
      c.rel.push(mkEv(r, { st: 'candidato', cls: 'NECESSITA VALIDAÇÃO', tipo: 'planilha', ref: pf ? `Print ${pf.imagem || ''}`.trim() : `Planilha ${c.src?.file || ''}`, loc: pf ? 'campo preenchido por print' : `linha ${c.src?.row || '?'} (coluna release)`, trecho: String(c.release), sig: 'planilha|' + r, por: pf ? 'preenchimento por print' : 'importação da planilha', extra: { produto: baseLines(c)[0] || 'Protheus', tipo: 'producao', decl: true } })); }
  }
  relSources(c).forEach(s => { const t = String(s.t || ''); let m; REL_RE.lastIndex = 0; let n = 0;
    while ((m = REL_RE.exec(t)) && n < 12) { n++; const r = relNorm(m[1] || m[2]); const tipo = relContext(t, m.index, m[0].length), produto = relProduct(t, m.index, c), sig = `${r}|${tipo}|${s.ref}`;
      if (c.rel.some(e => e.sig === sig)) continue; c.rel.push(mkEv(r, { ref: s.ref, loc: s.loc, trecho: t.slice(Math.max(0, m.index - 70), m.index + m[0].length + 40).replace(/\s+/g, ' '), sig, extra: { produto, tipo } })); } });
}
/* ---------- Perfil fiscal ---------- */
const normUF = v => { const u = String(v || '').trim().toUpperCase(); return UFS.includes(u) ? u : null; };
const normRegime = v => { const n = norm(v); return /real/.test(n) ? 'Lucro Real' : /presumid/.test(n) ? 'Lucro Presumido' : /arbitrad/.test(n) ? 'Lucro Arbitrado' : /simples/.test(n) ? 'Simples Nacional' : /\bmei\b|microempreendedor/.test(n) ? 'MEI' : /imune|isent/.test(n) ? 'Imune/Isento' : null; };
const FIS_RE = [['regime', /lucro real|lucro presumido|lucro arbitrado|simples nacional|\bmei\b/i], ['op:nfse', /nfs-?e|nota fiscal de servi/i], ['op:nfe', /\bnfc?-?e\b|nota fiscal eletr/i], ['op:cte', /\bct-?e\b|\bmdf-?e\b/i], ['op:folha', /folha de pagamento|esocial/i], ['op:rural', /produtor rural|produ[cç][aã]o rural/i], ['op:monof', /combust[ií]ve|monof[aá]sic/i]];
function fisSync(c) {
  const src = f => ({ tipo: 'planilha', ref: `Planilha ${c.src?.file || ''}`, loc: `linha ${c.src?.row || '?'}` });
  const uf = normUF(c.uf); if (uf && (!c.fis.uf || (c.fis.uf.fonte?.tipo === 'planilha' && c.fis.uf.v !== uf))) c.fis.uf = fld(uf, 'FATO', src(), c.fis.uf);
  const rg = c.regime ? normRegimeL(c.regime) : null; if (rg && !c.fis.regime) c.fis.regime = { ...fld(rg, 'FATO', src(), null), st: 'declarado', raw: c.regime };
  relSources(c).filter(s => !/^Planilha \(Produtos\)$/.test(s.ref)).forEach(s => FIS_RE.forEach(([k, re]) => { const m = String(s.t || '').match(re); if (!m) return; const v = k === 'regime' ? normRegime(m[0]) : k; const sig = `${k}|${v}|${s.ref}`; if (!v || c.fis.cand.some(e => e.sig === sig)) return;
    c.fis.cand.push(mkEv(k === 'regime' ? `Regime: ${v}` : OPS[k.slice(3)], { ref: s.ref, loc: s.loc, trecho: String(s.t).slice(Math.max(0, m.index - 60), m.index + 60).replace(/\s+/g, ' '), sig, extra: { campo: k, valor: v } })); }));
}
/* ---------- Marcos de release ---------- */
const daysTo = d => d ? Math.round((new Date(d + 'T12:00:00') - new Date(today() + 'T12:00:00')) / 864e5) : null;
const alertDays = () => (S.meta.alertDays?.length ? S.meta.alertDays : [180, 90, 30]).slice().sort((a, b) => b - a);
const staleDays = () => S.meta.staleDays || 90;
const isStale = d => !d || -daysTo(String(d).slice(0, 10)) > staleDays();
const marcosOk = () => (S.marcos || []).filter(m => m.st === 'aprovado');
function marcoFor(prod, rel) { const k = relKey(rel); return marcosOk().filter(m => norm(m.produto) === norm(prod) && relKey(m.release) === k).sort((a, b) => (b.consultadoEm || '').localeCompare(a.consultadoEm || ''))[0] || null; }
function alertLevel(d) { if (d == null) return null; if (d < 0) return { k: 'expirado', l: `expirado há ${-d} dia(s)`, sev: 3 }; const A = alertDays(); let hit = null; A.forEach(x => { if (d <= x) hit = x; }); return hit != null ? { k: 'alerta', l: `faltam ${d} dia(s) (janela de ${hit} dias)`, sev: hit <= 30 ? 3 : hit <= 90 ? 2 : 1 } : null; }
function relRows(c) {
  const prods = new Set([...evOk(c.rel).filter(e => e.extra?.tipo === 'producao').map(e => e.extra.produto), ...baseLines(c).filter(x => ['Protheus', 'RM', 'Datasul'].includes(x))]); if (!prods.size) prods.add('Linha não identificada');
  return [...prods].map(produto => {
    const ok = evOk(c.rel).filter(e => e.extra?.tipo === 'producao' && e.extra.produto === produto).sort((a, b) => (b.conf || '').localeCompare(a.conf || ''))[0] || null;
    const cands = evCand(c.rel).filter(e => e.extra?.produto === produto || produto === 'Linha não identificada');
    if (!ok) return { produto, rel: null, ev: null, marco: null, sit: { k: 'nao_confirmada', l: 'Release em produção não confirmada', sev: 1 }, acao: cands.length ? `Revisar ${cands.length} menção(ões) extraída(s) e confirmar a release em produção com evidência (ex.: tela "Sobre", chamado, relatório de ambiente).` : 'Solicitar evidência da release em produção (ex.: tela "Sobre" do sistema ou relatório de ambiente).', cands };
    const mc = marcoFor(produto, ok.v); let sit, acao;
    if (!mc) { sit = { k: 'sem_marco', l: `Sem marco oficial aprovado para ${ok.v}`, sev: 1 }; acao = 'Consultar o Ciclo de Vida de Software (Portal do Cliente/TDN) e registrar o marco com fonte.'; }
    else if (!mc.data) { sit = { k: 'sem_data', l: 'Fonte oficial sem data pública para este marco', sev: 1 }; acao = 'Confirmar a data no portal de Ciclo de Vida (login) e atualizar o marco.'; }
    else { const d = daysTo(mc.data), al = alertLevel(d); sit = al ? { k: al.k, l: `${mc.tipo} em ${fmtD(mc.data)} — ${al.l}`, sev: al.sev } : { k: 'vigente', l: `Vigente — ${mc.tipo.toLowerCase()} em ${fmtD(mc.data)}`, sev: 0 };
      acao = al ? 'Avaliar diagnóstico de atualização de release (escopo preliminar; esforço só após avaliação do ambiente).' : 'Acompanhar; revisar no próximo ciclo.'; }
    if (mc && isStale(mc.consultadoEm)) sit.stale = true;
    return { produto, rel: ok.v, ev: ok, marco: mc, sit, acao, cands };
  });
}
const fmtD = d => d ? d.split('-').reverse().join('/') : '—';
/* ---------- Requisitos de soluções complementares x release ---------- */
const prereqNivel = p => p.nivel || (/obrigat|exige|requer|necess[aá]ri|m[ií]nim|somente|apenas|n[aã]o (est[aá] )?dispon[ií]vel para/i.test(p.t) ? 'obrigatorio' : /recomend|sugerid/i.test(p.t) ? 'recomendado' : 'indefinido');
const NIVEL_L = { obrigatorio: 'Obrigatório', recomendado: 'Recomendação', indefinido: 'Não classificado — validação técnica' };
function prereqCheck(p, c) {
  const m = p.t.match(/12\.1\.(\d+)/); if (!m) return { k: 'manual', l: 'Verificação técnica no ambiente' };
  const prodRel = relRows(c).find(r => r.produto === 'Protheus' && r.rel); if (!prodRel) return { k: 'desconhecido', l: 'Release em produção não confirmada — validação técnica' };
  const need = relKey('12.1.' + m[1]), have = relKey(prodRel.rel); return have >= need ? { k: 'ok', l: `Atendido pela release confirmada ${prodRel.rel}` } : { k: 'nao', l: `Release confirmada ${prodRel.rel} é anterior a 12.1.${m[1]}` };
}
/* ---------- Regulatório ---------- */
const regsOk = () => (S.regs || []).filter(r => r.st === 'aprovado');
function regTiming(r) {
  const v = daysTo(r.vigencia), p = daysTo(r.prazo), out = [];
  if (r.prazo) out.push(p < 0 ? { k: 'vencido', l: `prazo ${fmtD(r.prazo)} (há ${-p} dias)`, d: p } : { k: 'prazo', l: `prazo em ${p} dia(s) (${fmtD(r.prazo)})`, d: p });
  else if (r.vigencia) out.push(v <= 0 ? { k: 'vigor', l: `em vigor desde ${fmtD(r.vigencia)}`, d: v } : { k: 'futuro', l: `vigência em ${v} dia(s) (${fmtD(r.vigencia)})`, d: v });
  if (r.testes?.ini) out.push({ k: 'teste', l: `testes/transição: ${fmtD(r.testes.ini)}${r.testes.fim ? ' a ' + fmtD(r.testes.fim) : ' (sem data final)'}` });
  return out;
}
function applic(r, c) {
  const k = r.criterios || {}, q = [], got = []; let total = 0, known = 0, mis = false;
  let regOnly = false; if (k.regimes?.length) { total++; const v = c.fis?.regime?.v, decl = stOf(c.fis?.regime) !== 'confirmado'; if (!v || v === 'Não informado' || v === 'Outros') q.push(`Qual o regime tributário do cliente? (critério: ${k.regimes.join(', ')})`); else { known++; got.push(`Regime: ${v} (${fonteTxt(c.fis.regime.fonte)}; ${decl ? 'declarado' : 'confirmado'})`); if (!k.regimes.includes(v)) { if (decl) q.push(`Regime declarado (${v}) fora do critério: confirmar antes de descartar o evento.`); else mis = true; } } }
  if (k.ufs?.length) { total++; const v = c.fis?.uf?.v; if (!v) q.push(`Em qual UF o cliente opera? (critério: ${k.ufs.join(', ')})`); else { known++; got.push(`UF: ${v}`); if (!k.ufs.includes(v)) mis = true; } }
  if (k.ops?.length) { total++; const vals = k.ops.map(o => [o, c.fis?.ops?.[o]?.v]); const sim = vals.filter(([, v]) => v === 'sim'), nao = vals.filter(([, v]) => v === 'nao');
    if (sim.length) { known++; got.push(sim.map(([o]) => OPS[o]).join('; ')); } else if (nao.length === vals.length) { known++; mis = true; got.push('Não: ' + nao.map(([o]) => OPS[o]).join('; ')); } else q.push(`O cliente realiza: ${k.ops.map(o => OPS[o]).join(' ou ')}?`); }
  if (k.atividade) { total++; const v = c.fis?.atividade?.v; if (!v) q.push(`A atividade do cliente envolve "${k.atividade}"?`); else { known++; got.push('Atividade: ' + v); if (!norm(v).includes(norm(k.atividade))) mis = true; } }
  regOnly = !!k.regimes?.length && total === 1; if (regOnly && !mis) q.push('O regime é um critério entre outros: confirmar operações, atividade e UF antes de concluir impacto ou urgência.');
  const state = mis ? 'nao_aplicavel' : total === 0 ? 'geral' : known === total && !regOnly && !q.length ? 'aplicavel' : 'potencial';
  const conf = mis ? 'alta' : total === 0 ? 'baixa' : known === total ? 'alta' : known ? 'média' : 'baixa';
  if (total === 0) q.push('Critérios de aplicabilidade não definidos para este evento: avaliação tributária especializada necessária.');
  return { state, conf, q, got, l: { aplicavel: 'Aplicável (critérios confirmados)', potencial: 'Potencialmente afetado — validar', nao_aplicavel: 'Não aplicável segundo os dados confirmados', geral: 'Aplicabilidade não determinada' }[state] };
}
function regForClient(c) { return regsOk().map(r => ({ r, ap: applic(r, c), t: regTiming(r) })); }
const regNear = x => x.t.some(t => (t.k === 'prazo' && t.d <= alertDays()[0]) || (t.k === 'futuro' && t.d <= alertDays()[0]) || (t.k === 'vigor' && t.d >= -180) || (t.k === 'vencido' && t.d >= -180) || t.k === 'teste');

/* Radar regulatório (versão hospedada): fontes oficiais que o servidor relê 1x por dia útil. O aviso diz apenas que a página mudou;
   o evento só existe depois que o executivo abre a fonte e o registra. "Já conferi" fica em S.meta.regVisto (por usuário). */
const RGF = { d: null, t: 0, busy: false };
async function rgfCarregar() { if (!window.__HOSTED__ || RGF.busy || Date.now() - RGF.t < 300000) return; RGF.busy = true; try { const r = await fetch('/api/regfontes', { credentials: 'same-origin', cache: 'no-store', redirect: 'manual' }); if (r.ok) { const j = await r.json(); RGF.d = Array.isArray(j.fontes) ? j.fontes : []; RGF.t = Date.now(); if (UI.view === 'refs') render(); } } catch { /* offline: o registro manual continua */ } finally { RGF.busy = false; } }
const rgfPend = () => (RGF.d || []).filter(f => f.mudou_em && (S.meta.regVisto || {})[f.id] !== f.mudou_em);
function rgfCard() {
  if (!window.__HOSTED__) return ''; rgfCarregar(); const F = RGF.d; if (!F) return '';
  if (!F.length) return '<div class="card" id="rgf"><h3>Radar regulatório</h3><p class="sm muted">Nenhuma fonte oficial está sendo monitorada. O administrador cadastra as fontes no Painel Administrador; até lá, registre os eventos manualmente abaixo, com a fonte oficial.</p></div>';
  const P = rgfPend(), ids = new Set(P.map(f => f.id));
  return `<div class="card" id="rgf"><h3>Radar regulatório <span class="pill ${P.length ? 'p-warn' : 'p-ok'}">${P.length ? P.length + ' fonte(s) com mudança a conferir' : 'sem mudança a conferir'}</span></h3>
  <p class="sm muted">${F.length} fonte(s) oficial(is) relida(s) 1 vez por dia útil. O radar <b>só aponta que a página mudou</b>: não diz o que mudou e não cria evento. Abra a fonte; se houver norma nova, registre o evento com publicação, vigência e prazo comprovados.</p>
  ${[...P, ...F.filter(f => !ids.has(f.id))].map(f => `<div class="row sm" style="gap:8px;padding:6px 0;border-top:1px solid var(--bd2)"><span style="flex:1"><b>${esc(f.nome)}</b>${f.orgao ? ` <span class="muted">— ${esc(f.orgao)}</span>` : ''}<div class="muted">${ids.has(f.id) ? `<b>Página alterada em ${esc(dtBR(f.mudou_em))}</b> — a conferir` : f.estado !== 'ok' ? 'Não foi possível ler na última tentativa' : f.vista_em ? 'Sem mudança a conferir • lida em ' + esc(dtBR(f.vista_em)) : 'Ainda não lida'}</div></span><a class="btn ghost sm" href="${esc(f.url)}" target="_blank" rel="noopener noreferrer">Abrir fonte</a>${ids.has(f.id) ? `<button class="btn sm" data-a="rgfUsar" data-id="${esc(f.id)}">Registrar evento desta fonte</button><button class="btn ghost sm" data-a="rgfVisto" data-id="${esc(f.id)}">Já conferi</button>` : ''}</div>`).join('')}</div>`;
}
const RGF_ACT = {
  rgfVisto: t => { const f = (RGF.d || []).find(x => x.id === t.dataset.id); if (!f) return; S.meta.regVisto = { ...(S.meta.regVisto || {}), [f.id]: f.mudou_em }; touchMeta(); render(); },
  rgfUsar: t => { const f = (RGF.d || []).find(x => x.id === t.dataset.id), dt = $('#rg-novo'); if (!f || !dt) return; dt.open = true; $('#rg_ft').value = f.nome; $('#rg_fu').value = f.url; if (f.orgao) $('#rg_o').value = f.orgao; $('#rg_n').focus(); dt.scrollIntoView({ block: 'center' }); toast('Fonte preenchida. Informe a obrigação e as datas que a fonte comprova.'); }
};
/* ---------- Oportunidades adicionais (release e regulatório) ---------- */
function mkOpp(c, base, crit) { const o = { id: `${c.key}::${base.ruleId}`, key: c.key, cliente: c.name, setorial: [], sols: [], contratacao: (c.productsIdent || []).map(p => p.nome), validar: null, baseOK: true, extraBase: [], jaIdent: [], ...base, crit }; o.score = scoreOpp(o, S.meta.weights); o.conf = confLevel(o); o.prio = prioLabel(o.score); return o; }
function consOpps(c) {
  const out = [], dq = dataQuality(c);
  relRows(c).filter(r => r.rel && r.marco?.data && ['expirado', 'alerta'].includes(r.sit.k)).forEach(r => {
    const d = daysTo(r.marco.data);
    out.push(mkOpp(c, { ruleId: 'release_' + norm(r.produto).replace(/\W/g, ''), tipo: 'Otimização', tipoBase: 'Otimização', nome: `Diagnóstico de atualização de release (${r.produto} ${r.rel})`, modo: 'evidencia',
      problema: `HIPÓTESE DE NECESSIDADE com indício individual: release em produção ${r.rel} com marco oficial "${r.marco.tipo}" em ${fmtD(r.marco.data)}.`, impacto: 'HIPÓTESE: risco de ficar sem manutenção e atualizações legais no release; impacto não quantificado.',
      evInd: [{ cls: 'FATO', text: `Release em produção ${r.rel} (confirmada em ${fmtDate(r.ev.conf)})`, src: fonteTxt(r.ev.fonte) }, { cls: 'FATO', text: `${r.marco.tipo}: ${fmtD(r.marco.data)}`, src: `${r.marco.fonte.t} (consulta ${fmtD(r.marco.consultadoEm)})` }],
      natureza: ['PROCESSO', 'PARAMETRIZAÇÃO'], escopo: ['Inventário de customizações, pontos de entrada e relatórios específicos', 'Mapa de integrações e soluções complementares (requisitos da release de destino)', 'Plano de testes de processos críticos e fiscais', 'Plano de virada, contingência e treinamento'],
      deps: ['Avaliação do ambiente antes de qualquer estimativa de esforço', 'Requisitos de binário/DbAccess/lib da release de destino (TDN)', 'Janela de homologação com usuários-chave', 'Garantia Estendida: disponibilidade comercial a confirmar quando citada na fonte'],
      perg: ['Há customizações ou integrações críticas que precisam ser homologadas?', 'Existe janela de homologação e quem são os usuários-chave?', 'O cliente avaliou Garantia Estendida ou prefere atualizar?'], acao: 'Propor diagnóstico de atualização (escopo preliminar). Não apresentar esforço sem avaliação do ambiente.' },
      { evidencia: 3, aderencia: 2, impacto: 2, urgencia: d < 0 ? 3 : d <= 30 ? 3 : d <= 90 ? 2 : 1, viabilidade: 2, dados: dq }));
  });
  const regs = regForClient(c).filter(x => ['aplicavel', 'potencial'].includes(x.ap.state) && regNear(x));
  if (regs.length) {
    const conf = regs.filter(x => x.ap.state === 'aplicavel'), modo = conf.length ? 'evidencia' : 'investigacao', use = conf.length ? conf : regs;
    const acoes = [...new Set(use.flatMap(x => x.r.acoes || []))].map(a => ACOES_REG[a]).filter(Boolean);
    out.push(mkOpp(c, { ruleId: 'regulatorio', tipo: 'Otimização', tipoBase: 'Otimização', nome: 'Preparação para mudanças fiscais e regulatórias', modo,
      problema: `${modo === 'evidencia' ? 'HIPÓTESE DE NECESSIDADE com critérios confirmados' : 'INVESTIGAÇÃO RECOMENDADA (aplicabilidade a validar)'}: ${use.slice(0, 4).map(x => x.r.nome.split(':')[0]).join('; ')}.`,
      impacto: 'HIPÓTESE: necessidade de adequação de cadastros, parametrizações, testes e atualização; impacto não quantificado. Não é orientação fiscal conclusiva.',
      evInd: conf.flatMap(x => x.ap.got.map(g => ({ cls: 'FATO', text: `${g} → ${x.r.nome.split(':')[0]}`, src: 'Perfil fiscal do cliente' }))).slice(0, 6),
      setorial: use.slice(0, 5).map(x => ({ cls: 'FATO', text: `${x.r.nome} — ${x.t.map(t => t.l).join('; ')}`, fonte: { t: x.r.fonte.t, u: x.r.fonte.u, d: fmtD(x.r.consultadoEm) }, tag: 'REGULATÓRIA' })),
      natureza: ['PARAMETRIZAÇÃO', 'PROCESSO'], escopo: acoes, deps: ['Separar serviço de configuração do sistema de consultoria tributária especializada', 'Disponibilidade comercial de serviços a confirmar', 'Release e pacotes de atualização vigentes no ambiente'],
      perg: [...new Set(use.flatMap(x => x.ap.q))].slice(0, 5).concat(['Quem é o responsável tributário do cliente e qual a assessoria contratada?']), acao: modo === 'evidencia' ? 'Agendar diagnóstico de preparação com fiscal e TI do cliente.' : 'Confirmar regime, UF e operações do cliente antes de qualquer proposta.' },
      { evidencia: modo === 'evidencia' ? 3 : 1, aderencia: 2, impacto: 2, urgencia: use.some(x => x.t.some(t => (t.k === 'prazo' && t.d <= 30) || t.k === 'vencido')) ? 3 : 2, viabilidade: 2, dados: dq }));
  }
  return out;
}

/* ---------- Full x Light ---------- */
const toksL = s => String(s || '').split(/[,;\n|]+/).map(x => norm(x).trim()).filter(x => x.length >= 2);
function flAnalysis(c) {
  const L = c.lic, m = L.matriz; const regras = (L.regras || []).filter(r => r.fonte?.t);
  if (!m?.rows?.length) return { k: 'sem_matriz', msg: 'Anexe a matriz de acesso (usuário, perfil/licença, atividades ou rotinas) para esta análise.' };
  const distinto = m.rows.some(r => /full|light|lgt/i.test(r.perfil)) || evOk(L.itens).some(e => /full|light|lgt/i.test(e.extra?.perfil || ''));
  if (!distinto) return { k: 'sem_distincao', msg: 'A distinção Full/Light não aparece no contrato confirmado nem na matriz deste cliente: análise não se aplica.' };
  if (!regras.length) return { k: 'sem_regra', msg: 'Regra de licenciamento sem fonte suficiente: registre o escopo de cada perfil (rotinas/módulos permitidos e restrições) com fonte contratual ou oficial. Nenhuma adequação foi sugerida.' };
  const lights = regras.filter(r => /light|lgt/i.test(r.perfil)), fulls = m.rows.filter(r => /full/i.test(r.perfil)), cands = [];
  fulls.forEach(u => { const at = toksL(u.ativ); if (!at.length) { cands.push({ u, k: 'sem_atividade' }); return; }
    for (const lr of lights) { const perm = toksL(lr.permitidas), restr = toksL(lr.restricoes); if (perm.length && at.every(a => perm.some(p => a.includes(p))) && !at.some(a => restr.some(p => a.includes(p)))) { cands.push({ u, k: 'possivel', light: lr.perfil, regra: lr }); return; } }
    cands.push({ u, k: 'mantem' }); });
  const P = L.precos || {}, n = cands.filter(x => x.k === 'possivel').length; let orc = null;
  if (n && P.full?.v != null && P.light?.v != null && P.meses) orc = { n, dif: P.full.v - P.light.v, meses: +P.meses, total: n * (P.full.v - P.light.v) * P.meses, viavel: !!P.viavel };
  return { k: 'ok', regras, lights, fulls: fulls.length, cands, orc };
}

/* ---------- TCO Cloud ---------- */
const TCO_A = [['infra', 'Infraestrutura/servidores (mensal equivalente)'], ['licSO', 'Licenças de SO e banco de dados (mensal)'], ['pessoal', 'Equipe ou terceiros de operação (mensal)'], ['link', 'Conectividade (mensal)'], ['backup', 'Backup e DR (mensal)'], ['energia', 'Energia/datacenter (mensal)'], ['outros', 'Outros (mensal)']];
const TCO_P = [['migracao', 'Migração (custo único)', 1], ['servicos', 'Serviços de implantação (custo único)', 1], ['cloud', 'Mensalidade cloud (mensal)'], ['conect', 'Conectividade (mensal)'], ['operacao', 'Operação residual do cliente (mensal)'], ['residual', 'Custos residuais/legados (mensal)'], ['outros', 'Outros (mensal)']];
function tcoCalc(c) {
  const T = c.cloud.tco, H = String(T.horiz || '').split(/[,;\s]+/).map(Number).filter(x => x > 0 && x <= 240).slice(0, 5); const v = (o, k) => o[k]?.v;
  const missA = TCO_A.filter(([k]) => v(T.a, k) == null).map(([, l]) => l), missP = TCO_P.filter(([k]) => v(T.p, k) == null).map(([, l]) => l);
  const mA = TCO_A.reduce((s, [k]) => s + (v(T.a, k) || 0), 0), uP = TCO_P.filter(x => x[2]).reduce((s, [k]) => s + (v(T.p, k) || 0), 0), mP = TCO_P.filter(x => !x[2]).reduce((s, [k]) => s + (v(T.p, k) || 0), 0);
  const rows = H.map(h => { const capex = (T.capex || []).filter(x => x.mes <= h && x.v != null).reduce((s, x) => s + x.v, 0); const a = mA * h + capex, p = uP + mP * h; return { h, a, p, dif: a - p, capex }; });
  const evid = ['servidores', 'incidentes', 'custos'].filter(k => !evOk(c.cloud.f[k]).length && !(c.cloud.f[k] || []).some(e => e.st === 'confirmado'));
  return { H, rows, missA, missP, mA, uP, mP, evid, any: mA > 0 || uP > 0 || mP > 0 };
}

/* ---------- Calculadoras de ROI ---------- */
const ROI_CLS = ['DADO DO CLIENTE', 'BENCHMARK COM FONTE', 'PREMISSA MANUAL'];
const n1 = v => (+v).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const ROI_T = {
  wms: { nome: 'WMS e operação logística', campos: [['vol', 'Volume de pedidos ou linhas', 'un./mês', 1], ['taxa', 'Taxa de erros atual', '%', 1], ['red', 'Redução estimada da taxa de erros', 'p.p.', 1], ['cust', 'Custo médio por ocorrência de erro', 'R$', 1], ['devol', 'Devolução atribuível à operação (por ocorrência)', 'R$', 0, 'add'], ['retrab', 'Retrabalho (por ocorrência)', 'R$', 0, 'add'], ['frete', 'Frete reverso (por ocorrência)', 'R$', 0, 'add']],
    formula: 'Custo evitável mensal = volume × (redução da taxa em p.p. ÷ 100) × custo por erro. Custo por erro = custo médio por ocorrência + adicionais (somente se NÃO estiverem incluídos no custo por ocorrência).',
    calc(x, fl) { const errs = [], warn = []; if (x.red > x.taxa) errs.push('Redução maior que a taxa de erros atual.'); const add = fl.incl ? 0 : (x.devol || 0) + (x.retrab || 0) + (x.frete || 0); if (fl.incl && (x.devol || x.retrab || x.frete)) warn.push('Adicionais ignorados: marcados como já incluídos no custo por ocorrência (evita dupla contagem).');
      const ev = x.vol * x.red / 100, cpe = x.cust + add; return { errs, warn, B: ev * cpe, det: [['Erros evitados/mês', ev, 'un.'], ['Custo por erro considerado', cpe, 'R$'], ['Taxa após melhoria', x.taxa - x.red, '%']] }; } },
  mes: { nome: 'MES e produção', campos: [['horas', 'Horas planejadas de produção', 'h/mês', 1], ['disp', 'Disponibilidade atual', '%', 1], ['desemp', 'Desempenho atual', '%', 1], ['qual', 'Qualidade atual', '%', 1], ['ganho', 'Ganho estimado de OEE', 'conforme tipo', 1], ['taxa', 'Produção teórica por hora (a 100% de OEE)', 'un./h', 1], ['aprov', 'Parcela da produção adicional aproveitável (demanda/gargalo)', '%', 1], ['margem', 'Margem de contribuição por unidade', 'R$', 1]],
    formula: 'OEE = disponibilidade × desempenho × qualidade. Ganho em p.p.: OEE novo = OEE + g. Ganho relativo: OEE novo = OEE × (1 + g/100). Unidades adicionais = horas × produção teórica × ΔOEE. Benefício = unidades adicionais × parcela aproveitável × margem de contribuição (não é faturamento).',
    calc(x, fl) { const errs = [], warn = []; const oee = x.disp * x.desemp * x.qual / 1e4; const novo = fl.ganhoTipo === 'rel' ? oee * (1 + x.ganho / 100) : oee + x.ganho; if (novo > 100) errs.push(`OEE resultante ${n1(novo)}% excede 100%.`);
      if (fl.gargalo === 'nao') warn.push('Equipamento informado como NÃO gargalo: ganho de OEE pode não aumentar a produção vendável.'); if (!fl.gargalo || fl.gargalo === '?') warn.push('Gargalo não confirmado: validar se a capacidade adicional pode ser aproveitada.');
      const alt = fl.ganhoTipo === 'rel' ? oee + x.ganho : oee * (1 + x.ganho / 100); const un = x.horas * x.taxa * (novo - oee) / 100;
      return { errs, warn, B: un * x.aprov / 100 * x.margem, det: [['OEE atual', oee, '%'], [`OEE novo (${fl.ganhoTipo === 'rel' ? 'aumento relativo' : 'pontos percentuais'})`, novo, '%'], [`Comparação: se fosse ${fl.ganhoTipo === 'rel' ? '+' + x.ganho + ' p.p.' : '+' + x.ganho + '% relativo'}`, alt, '%'], ['Unidades adicionais/mês', un, 'un.'], ['Unidades aproveitáveis/mês', un * x.aprov / 100, 'un.']] }; } },
  fluig: { nome: 'Fluig/BPM e processos administrativos', campos: [['proc', 'Volume de processos', 'proc./mês', 1], ['tAtual', 'Tempo por processo hoje', 'min', 1], ['tNovo', 'Tempo por processo após', 'min', 1], ['retTaxa', 'Taxa de retrabalho', '%', 0], ['tRet', 'Tempo por retrabalho', 'min', 0], ['retRed', 'Redução do retrabalho', '%', 0], ['pessoas', 'Pessoas envolvidas (informativo)', 'pessoas', 0], ['custoH', 'Custo por hora (carregado)', 'R$/h', 1], ['despesa', 'Redução efetiva de despesa (mecanismo concreto)', 'R$/mês', 0]],
    formula: 'Horas liberadas = processos × (tempo hoje − tempo após) ÷ 60 + processos × taxa de retrabalho × tempo de retrabalho ÷ 60 × redução do retrabalho. Valor econômico da capacidade = horas × custo/hora (estimativa). Redução efetiva de despesa só com mecanismo concreto informado (horas não viram redução de folha automaticamente).',
    calc(x, fl) { const errs = [], warn = []; if (x.tNovo > x.tAtual) errs.push('Tempo após maior que o tempo atual.'); const h = x.proc * (x.tAtual - x.tNovo) / 60 + x.proc * (x.retTaxa || 0) / 100 * (x.tRet || 0) / 60 * (x.retRed || 0) / 100; const cap = h * x.custoH;
      const efet = fl.mecanismo && x.despesa ? x.despesa : 0; if (x.despesa && !fl.mecanismo) warn.push('Redução de despesa informada sem mecanismo concreto: desconsiderada.');
      const B = fl.base === 'capacidade' ? cap : efet; if (fl.base !== 'capacidade' && !efet) warn.push('Sem redução efetiva de despesa: ROI financeiro calculado com benefício zero. Use "valor econômico da capacidade" apenas como estimativa de capacidade liberada.');
      return { errs, warn, B, det: [['Horas de capacidade liberadas/mês', h, 'h'], ['Valor econômico estimado da capacidade', cap, 'R$/mês'], ['Redução efetiva de despesa', efet, 'R$/mês']] }; } }
};
const ROI_COMMON = [['inv', 'Investimento inicial', 'R$', 1], ['rec', 'Custos recorrentes incrementais', 'R$/mês', 1], ['horiz', 'Horizonte', 'meses', 1], ['rampa', 'Meses até benefício pleno (0 = imediato)', 'meses', 0]];
function roiNew(tipo) { return { id: 'roi_' + uid(), tipo, nome: ROI_T[tipo].nome, at: nowISO(), upd: nowISO(), fl: { incl: false, ganhoTipo: 'pp', gargalo: '', base: 'reducao', mecanismo: '' }, inp: {}, share: false }; }
const roiFields = s => [...ROI_T[s.tipo].campos, ...ROI_COMMON];
function roiVals(s, cen) { const out = {}, miss = [], bench = []; roiFields(s).forEach(([k, l, u, req]) => { const f = s.inp[k] || {}; let v = f[cen]; if (v === '' || v == null || isNaN(v)) v = null; if (v != null && f.cls === 'BENCHMARK COM FONTE' && !String(f.fonte || '').trim()) { bench.push(l); v = null; } if (v == null && req) miss.push(l); out[k] = v == null ? (req ? null : 0) : +v; }); return { x: out, miss, bench }; }
function roiCalc(s, cen, over) {
  const { x, miss, bench } = roiVals(s, cen); if (over) Object.assign(x, over); if (miss.length) return { ok: false, miss, bench };
  const r = ROI_T[s.tipo].calc(x, s.fl); if (r.errs.length) return { ok: false, miss: [], errs: r.errs, bench };
  const H = Math.max(1, Math.round(x.horiz)), ramp = Math.max(0, Math.round(x.rampa || 0)); let cum = -x.inv, ben = 0, pay = null, prev = cum;
  for (let m = 1; m <= H; m++) { const f = ramp ? Math.min(1, m / ramp) : 1, b = r.B * f, net = b - x.rec; ben += b; prev = cum; cum += net; if (pay == null && cum >= 0 && net > 0) pay = m - 1 + (-prev) / net; }
  const custos = x.inv + x.rec * H, liq = ben - custos, roi = custos > 0 ? liq / custos : null, netM = r.B - x.rec;
  let payTxt; if (netM <= 0) payTxt = 'Sem payback neste cenário (benefício líquido mensal ≤ 0)'; else if (!ramp) { const p = x.inv / netM; payTxt = p <= H ? `${n1(p)} meses (simples = investimento ÷ benefício líquido mensal)` : `${n1(p)} meses — fora do horizonte de ${H}`; pay = p; } else payTxt = pay != null ? `${n1(pay)} meses (fluxo acumulado com rampa de ${ramp} meses)` : `Não recupera no horizonte de ${H} meses`;
  return { ok: true, x, r, B: r.B, H, ben, custos, liq, roi, netM, pay, payTxt, warn: r.warn, bench };
}
function roiSens(s) {
  const base = roiCalc(s, 'base'); if (!base.ok) return []; const out = [];
  roiFields(s).forEach(([k, l]) => { if (['horiz', 'rampa'].includes(k) || !base.x[k]) return; const lo = roiCalc(s, 'base', { [k]: base.x[k] * 0.8 }), hi = roiCalc(s, 'base', { [k]: base.x[k] * 1.2 }); if (lo.ok && hi.ok) out.push({ l, lo: lo.liq, hi: hi.liq, amp: Math.abs(hi.liq - lo.liq) }); });
  return out.sort((a, b) => b.amp - a.amp).slice(0, 6);
}

/* ---------- Radar de ecossistema ---------- */
const MODO_L = { nativa: 'Integração nativa documentada', conector: 'Conector/wizard documentado', api: 'API documentada', desenvolvimento: 'Desenvolvimento específico', nao_documentada: 'Integração não documentada' };
const isFin = s => !!s.financeira || /techfin|financ|pagamento|cr[eé]dito|receb/i.test(`${s.categoria} ${s.linha}`);
function ecoChains(c) {
  const lines = baseLines(c), out = []; const corePr = new Set(['protheus', 'rm_linha', 'datasul', 'winthor', 'logix', 'cdu']);
  Object.keys(NEED_LABEL).forEach(n => {
    const hits = needHits(c, n); const rule = RULES.find(r => r.need === n); const seg = KB.segments.find(g => g.id === c.segInfo?.id);
    const sector = !hits.length && seg?.tendencias?.some(t => t.needs.includes(n));
    if (!hits.length && !sector) return;
    const offers = activeSols().filter(s => (s.necessidades || []).includes(n) && !corePr.has(s.id)).map(s => {
      const ints = (s.integracoes || []).filter(i => lines.some(l => norm(i.sistema).includes(norm(l))));
      const best = ints.find(i => i.estado === 'confirmada') || ints.find(i => i.estado === 'nao_integra') || ints[0] || null;
      const ader = !lines.length ? { k: 'base_desconhecida', l: 'Linha de ERP do cliente não identificada: aderência a validar' } : !best ? { k: 'nd', l: `Integração com ${lines.join('/')} não documentada na base` } : best.estado === 'nao_integra' ? { k: 'nao', l: `${best.sistema}: NÃO integra segundo a fonte` } : best.estado === 'confirmada' ? { k: 'ok', l: `${best.sistema}: ${MODO_L[best.modo || 'nao_documentada'].toLowerCase()}` } : { k: 'nv', l: `${best.sistema}: compatibilidade não verificada` };
      const pre = (s.prerequisitos || []).map(p => ({ t: p.t, nivel: prereqNivel(p), chk: prereqCheck(p, c) }));
      const score = (s.oficial ? 2 : 0) + (s.status === 'Validado' ? 2 : s.status === 'Em revisão' ? 1 : 0) + (ader.k === 'ok' ? 2 : ader.k === 'nao' ? -3 : 0);
      return { s, ader, pre, score, fin: isFin(s) };
    }).filter(x => x.ader.k !== 'nao').sort((a, b) => b.score - a.score).slice(0, 3);
    offers.forEach(o => out.push({ need: n, processo: NEED_LABEL[n], modo: hits.length ? 'evidencia' : 'investigacao', indicio: hits.length ? hits.slice(0, 2).map(h => `"${h.term}" em ${h.src}`).join('; ') : `Somente tendência setorial (${seg?.nome || ''}) — sem indício individual`, oferta: o.s, ader: o.ader, pre: o.pre,
      deps: [...(o.fin ? ['Elegibilidade, disponibilidade e condições a confirmar com a Techfin; pode haver análise de crédito. Sem promessa de aprovação, taxa ou ativação.'] : []), ...(o.s.tipo === 'servico' && !o.s.oficial ? [`Serviço de ${o.s.fornecedor || 'fornecedor não informado'}: não é oferta oficial TOTVS confirmada`] : []), ...(o.s.status !== 'Validado' ? [`Registro da base com status ${o.s.status}`] : [])],
      pergunta: rule?.perg?.[0] || 'Como esse processo é executado hoje e quem é o responsável?', acao: hits.length ? (rule?.acao || 'Validar o processo com o cliente.') + (o.fin ? ' Confirmar elegibilidade antes de apresentar condições.' : '') : 'Investigação recomendada: validar se a necessidade existe antes de citar a oferta.' }));
  });
  const inv = out.filter(x => x.modo === 'investigacao').slice(2).map(x => x); return out.filter(x => !inv.includes(x));
}
