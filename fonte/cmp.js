/* ===== Rodada 18 §A: comparação de portfólio entre clientes comparáveis (da PRÓPRIA carteira) =====
   Regra central: "não identificado nos documentos" ≠ "cliente não possui". Cliente sem ficha = situação DESCONHECIDA (nunca "não possui").
   Não é benchmark de mercado: descreve a carteira do executivo. Nada de outras carteiras é lido nem exibido (sem identidades, valores ou documentos).
   Comparável = mesmo segmento + ao menos um atributo refinado conhecido nos dois e igual (divisão CNAE ou porte) + nenhuma divergência em atributo conhecido (CNAE, porte, base ERP).
   Só entra como "Investigar — comparação de portfólio". */
const CMP = { minBase: 3, minDoc: 2, minShare: 0.4, repres: 6, max: 3 };
const CMP_ERP = ['protheus', 'rm_linha', 'datasul', 'winthor', 'logix'];
const CMP_BASE = new Set([...CMP_ERP, 'techfin_geral', 'cdu']);
const CMP_BAND = { µ: 'micro (até 19 funcionários)', P: 'pequeno (20–99)', M: 'médio (100–499)', G: 'grande (500+)' };
const _cmpC = new WeakMap();
function cmpProd(p) { /* produtos com contratação DOCUMENTADA em ficha (faturamento) + se há ficha utilizável; cache por assinatura dos dados do cliente */
  const sig = [p.productsRaw || '', (p.fichas || []).map(f => f.id + ':' + f.state + ':' + (f.items || []).length + ':' + (f.items?.[0]?.desc || '') + ':' + (f.items?.[(f.items?.length || 1) - 1]?.desc || '')).join(','), solSigCmp()].join('|'), e = _cmpC.get(p); if (e && e.sig === sig) return e.v;
  const fat = new Set(); const fs = fichasOk(p);
  fs.forEach(f => (f.items || []).forEach(it => { if (it.dup || !['recorrente', 'avulso', 'excedente'].includes(it.kind)) return; findProducts(it.desc, { src: f.file, loc: it.loc }).forEach(x => fat.add(x.id)); }));
  const v = { fat, ficha: fs.length > 0 }; _cmpC.set(p, { sig, v }); return v;
}
const solSigCmp = () => S.solutions.map(s => s.id + ':' + s.rev + (s.arquivado ? 'x' : '')).join(',');
const cmpErp = (c, fat) => CMP_ERP.find(id => fat.has(id) || (c.productsIdent || []).some(p => p.id === id)) || null;
function cmpCnae(c) { const x = String(c.cnpjCad?.cnaePrincipal?.codigo ?? c.cnpjCad?.cnaePrincipal ?? '').replace(/\D/g, ''); return x.length >= 2 ? x.slice(0, 2) : null; }
function cmpPorte(c) {
  const f = c.cad?.func?.v; if (f != null && !isNaN(+f) && +f > 0) { const n = +f; return { band: n < 20 ? 'µ' : n < 100 ? 'P' : n < 500 ? 'M' : 'G', fonte: 'funcionários' }; }
  const t = norm(c.size || ''); if (t) { if (/micro/.test(t)) return { band: 'µ', fonte: 'porte (planilha)' }; if (/pequen/.test(t)) return { band: 'P', fonte: 'porte (planilha)' }; if (/medi/.test(t)) return { band: 'M', fonte: 'porte (planilha)' }; if (/grande/.test(t)) return { band: 'G', fonte: 'porte (planilha)' }; }
  const o = norm(c.cnpjCad?.porte || ''); if (o) { if (/\bme\b|micro|\bepp\b|pequen/.test(o)) return { grupo: 'peq', fonte: 'porte (CNPJ)' }; if (/demais|medi|grande/.test(o)) return { grupo: 'grd', fonte: 'porte (CNPJ)' }; }
  return null;
}
const cmpGrp = p => p ? (p.grupo || (p.band === 'µ' || p.band === 'P' ? 'peq' : 'grd')) : null;
/* comparabilidade entre alvo T e par p: { ok, igual:[...], desc:[...] } */
function cmpComparar(T, p, tErp, pErp, tA, pA) {
  const igual = [], desc = [];
  const segP = classifySeg(p, S.meta.segOv); if (!segP.id || segP.id !== T.segInfo.id) return { ok: false };
  if (tA.cnae && pA.cnae) { if (tA.cnae !== pA.cnae) return { ok: false }; igual.push('cnae'); } else desc.push('cnae');
  if (tA.porte && pA.porte) { const a = tA.porte.band && pA.porte.band ? tA.porte.band === pA.porte.band : cmpGrp(tA.porte) === cmpGrp(pA.porte); if (!a) return { ok: false }; igual.push('porte'); } else desc.push('porte');
  if (tErp && pErp) { if (tErp !== pErp) return { ok: false }; igual.push('erp'); } else desc.push('erp');
  return { ok: igual.includes('cnae') || igual.includes('porte'), igual, desc };
}
function cmpOpps(c) {
  const seg = c.segInfo?.id; if (!seg || !fichasOk(c).length) return [];
  const me = cmpProd(c), tErp = cmpErp(c, me.fat), tA = { cnae: cmpCnae(c), porte: cmpPorte(c) };
  const pares = Object.values(S.clients).filter(p => p.key !== c.key).map(p => { const pf = cmpProd(p), pErp = cmpErp(p, pf.fat), r = cmpComparar(c, p, tErp, pErp, tA, { cnae: cmpCnae(p), porte: cmpPorte(p) }); return r.ok ? { p, pf, r } : null; }).filter(Boolean);
  if (!pares.length) return [];
  const comFicha = pares.filter(x => x.pf.ficha), semFicha = pares.length - comFicha.length;
  if (comFicha.length < CMP.minBase) return [];
  const igual = [...new Set(pares.flatMap(x => x.r.igual))], desc = ['cnae', 'porte', 'erp'].filter(a => !igual.includes(a));
  const segN = KB.segments.find(s => s.id === seg)?.nome || seg;
  const grupo = [`Segmento: ${segN.split('(')[0].trim()}`, igual.includes('cnae') ? `CNAE divisão ${tA.cnae}` : null, igual.includes('porte') ? `porte ${tA.porte.band ? CMP_BAND[tA.porte.band] : (cmpGrp(tA.porte) === 'peq' ? 'ME/EPP' : 'demais')}` : null, igual.includes('erp') ? `base ${tErp === 'protheus' ? 'Protheus' : tErp}` : null].filter(Boolean).join(' • ');
  const naoCons = desc.map(a => ({ cnae: 'CNAE', porte: 'porte', erp: 'base ERP' }[a])).join(', ');
  const covered = new Set((c.opps || []).flatMap(o => (o.sols || []).map(s => s.id)));
  const found = [];
  activeSols().forEach(s => {
    if (CMP_BASE.has(s.id) || me.fat.has(s.id) || (c.productsIdent || []).some(p => p.id === s.id) || covered.has(s.id)) return;
    const nDoc = comFicha.filter(x => x.pf.fat.has(s.id)).length; if (nDoc < CMP.minDoc) return;
    const share = nDoc / comFicha.length; if (share < CMP.minShare) return;
    found.push({ s, nDoc, share });
  });
  found.sort((a, b) => (b.share - a.share) || (b.nDoc - a.nDoc) || String(a.s.id).localeCompare(String(b.s.id)));
  return found.slice(0, CMP.max).map(({ s, nDoc, share }) => {
    const l = solLegacy(s), n = comFicha.length, aus = n - nDoc, baixa = n < CMP.repres, cob = Math.round(100 * n / pares.length);
    const tab = { sol: s.nome, grupo, n: pares.length, nFicha: n, nDoc, nAus: aus, nDesc: semFicha, cob, baixa,
      doc: `${nDoc} de ${n}`, just: `${nDoc} de ${n} clientes comparáveis da sua carteira com ficha têm “${s.nome}” identificado no faturamento; ${aus} com ficha ${aus === 1 ? 'não tem' : 'não têm'} o item identificado; ${semFicha} sem ficha (situação desconhecida, não contam como “não possuem”). Descreve a sua carteira, não o mercado.`,
      validar: [`Se “${c.name}” realmente não tem “${s.nome}” (a ficha pode ser parcial ou o item constar com outro nome)`, `Se o processo atendido por “${s.nome}” existe neste cliente`, 'Se a comparação vale: operação, filiais e nível de uso podem diferir', ...(s.prerequisitos || []).slice(0, 2).map(p => 'Requisito: ' + p.t)], naoConsiderados: naoCons };
    return mkOpp(c, { ruleId: 'cmp_' + s.id, tipo: 'Expansão', tipoBase: 'Expansão', nome: `Investigar — comparação de portfólio: ${s.nome}`, modo: 'investigacao',
      problema: `INVESTIGAÇÃO RECOMENDADA: clientes comparáveis da carteira têm “${s.nome}” documentado e este cliente não tem o item identificado. Isso não prova que ele não possua nem que precise.${baixa ? ' BAIXA REPRESENTATIVIDADE: poucos comparáveis com ficha.' : ''}`,
      impacto: 'HIPÓTESE: sem estimativa de receita; a comparação só orienta a conversa.', evInd: [{ cls: 'INFERÊNCIA', text: tab.just, src: 'Comparação de portfólio (sua carteira)' }],
      sols: [l], extraBase: [s.id], natureza: ['COMPARAÇÃO DE PORTFÓLIO'], deps: (s.prerequisitos || []).map(p => p.t).slice(0, 4), origemTipo: ['Comparação de portfólio'], origens: ['comparação de portfólio'], cmpTab: tab,
      perg: [`Como ${c.name} atende hoje o processo que “${s.nome}” cobre?`, ...tab.validar.slice(0, 1)], acao: 'Confirmar a contratação atual no contrato/ficha e perguntar ao cliente como o processo é atendido antes de propor.' },
      { evidencia: 1, aderencia: l.integraProtheus === true ? 3 : 2, impacto: 1, urgencia: 0, viabilidade: l.integraProtheus === true ? 3 : 2, dados: baixa ? 1 : dataQuality(c) });
  });
}
function cmpPendencia(c) {
  if (!c.segInfo?.id) return [];
  if (!fichasOk(c).length) return [{ falta: 'Ficha de faturamento deste cliente (para a comparação de portfólio)', importa: 'Sem ficha, a contratação é desconhecida: o cliente nunca entra como “não possui” e a comparação com clientes semelhantes não é feita.', decisao: 'Se há soluções que clientes semelhantes têm e este não.', acao: ['ctab', 'fichas', 'Anexar ficha'] }];
  const a = { cnae: cmpCnae(c), porte: cmpPorte(c) };
  if (!a.cnae && !a.porte) return [{ falta: 'CNAE (consulta CNPJ) ou porte/funcionários', importa: 'Sem esses dados só há segmento amplo, que não basta para comparar operações diferentes.', decisao: 'Se a comparação de portfólio pode ser feita com clientes realmente parecidos.', acao: ['open-cnpj', c.key, 'Consultar CNPJ'] }];
  return [];
}
/* HTML da tabela de comparação (no cartão da oportunidade) */
function cmpHtml(o) {
  const t = o.cmpTab; if (!t) return '';
  return `<dt>Comparação de portfólio</dt><dd><div class="tw"><table class="sm"><thead><tr><th>Solução</th><th>Grupo comparado</th><th>Clientes</th><th>Contratação identificada em</th><th>Cobertura documental</th></tr></thead><tbody><tr><td>${esc(t.sol)}</td><td>${esc(t.grupo)}</td><td>${t.n}</td><td>${esc(t.doc)} com ficha${t.baixa ? ` ${chip('BAIXA REPRESENTATIVIDADE')}` : ''}</td><td>${t.nFicha} de ${t.n} (${t.cob}%) com ficha; ${t.nDesc} desconhecido(s)</td></tr></tbody></table></div>
    <div class="sm"><b>Justificativa:</b> ${esc(t.just)}</div>${t.naoConsiderados ? `<div class="sm muted">Atributos não considerados (desconhecidos em algum cliente): ${esc(t.naoConsiderados)}.</div>` : ''}
    <div class="sm"><b>O que validar:</b><ul>${t.validar.map(v => `<li>${esc(v)}</li>`).join('')}</ul></div><div class="sm muted">Comparação restrita à sua carteira; não é benchmark de mercado e não expõe dados de outras carteiras.</div></dd>`;
}
