/* ===== Rodada 18 §B: sinais da ficha de faturamento no motor de oportunidades =====
   Reutiliza briefRaw/brClassRow (Briefing): mesma leitura de colunas, mesmo critério de Ativo/Cancelado/Excedente — sem extrator paralelo.
   Regras: excedente ≠ necessidade de upgrade; cancelamento ≠ oportunidade de recuperação; desconto ≠ renegociação automática;
   recorrência exige 2+ competências distintas (uma ficha só nunca conclui recorrência). Tudo entra como "Investigar — sinal de faturamento". */
const FS_CFG = { minComp: 2, varPct: 15, max: 3 };
const FS_ORIG = 'Sinal de faturamento';
const fsCompL = cp => /^\d{4}-\d{2}$/.test(cp || '') ? cp.slice(5) + '/' + cp.slice(0, 4) : (cp || 'competência não informada');
const fsKey = d => norm(d).replace(/\b(20\d\d|\d{1,2}[\/\-.]\d{1,2}([\/\-.]\d{2,4})?|\d+)\b/g, ' ').replace(/\s+/g, ' ').trim();
const fsLinhas = c => briefRaw(c).rows.filter(r => r.kind !== 'imposto').map(brClassRow);
const fsAbrev = (d, n = 70) => String(d || '').replace(/\s+/g, ' ').trim().slice(0, n);
/* data ENCONTRADA no documento (texto bruto) × data INTERPRETADA (ISO). Só vale com palavra-chave de vigência/desconto/término/renovação perto da data. */
const FS_DT = /(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4}|\d{2})\b|(?<![\d\/.\-])(\d{1,2})[\/\-](20\d\d)\b/g;
const FS_KW = [['desconto', /desconto|promo[cç]|bonifica|cortesia|car[eê]ncia/i], ['renovacao', /renova/i], ['termino', /t[eé]rmino|fim d[aeo]|encerr|expira|vencimento|at[eé]\b/i], ['vigencia', /vig[eê]ncia|v[aá]lid/i]];
function fsDatas(texto) {
  const t = String(texto || ''), out = []; FS_DT.lastIndex = 0; let m;
  while ((m = FS_DT.exec(t))) {
    let d, mo, y; if (m[1]) { d = +m[1]; mo = +m[2]; y = +m[3]; if (y < 100) y += 2000; } else { d = null; mo = +m[4]; y = +m[5]; }
    if (mo < 1 || mo > 12 || y < 2000 || y > 2100 || (d != null && (d < 1 || d > 31))) continue;
    const iso = d != null ? `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}` : `${y}-${String(mo).padStart(2, '0')}-${String(new Date(y, mo, 0).getDate()).padStart(2, '0')}`;
    if (d != null) { const dd = new Date(y, mo - 1, d); if (dd.getMonth() !== mo - 1 || dd.getDate() !== d) continue; }
    const ctx = t.slice(Math.max(0, m.index - 45), m.index), tipo = FS_KW.filter(([, re]) => re.test(ctx)).map(x => x[0]);
    if (!tipo.length) continue;
    out.push({ raw: t.slice(Math.max(0, m.index - 30), m.index + m[0].length).trim(), iso, tipo, diaAusente: d == null });
  }
  return out;
}
function fsGrupo(rows, st) { const g = new Map(); rows.filter(r => r.st === st || (st === 'desc' && r.nat === 'desconto')).forEach(r => { const k = fsKey(r.desc); (g.get(k) || g.set(k, []).get(k)).push(r); }); return g; }
const fsEv = (r, tx) => ({ cls: 'FATO', text: tx, src: `${r.file} • ${r.loc || 'ficha'}` });
const fsVal = r => r.total != null ? fmtBRL(r.total) : (r.liq != null ? fmtBRL(r.liq) + ' (líquido)' : 'valor não consta');
function fsSols(rows) { const ids = [...new Set(rows.flatMap(r => findProducts(r.desc, { src: r.file, loc: r.loc }).map(p => p.id)))]; return ids.map(solById).filter(Boolean); }
function fsOpp(c, ruleId, nome, tipoBase, rows, ev, o, crit) {
  const sols = fsSols(rows);
  return mkOpp(c, { ruleId, tipo: tipoBase, tipoBase, nome, modo: 'investigacao', sols, extraBase: sols.map(s => s.id), natureza: ['SINAL DE FATURAMENTO'], evInd: ev, origemTipo: [FS_ORIG], origens: ['ficha de faturamento'],
    impacto: 'HIPÓTESE: sem estimativa de receita, economia ou probabilidade; o sinal de faturamento só orienta a conversa.', ...o }, { evidencia: 1, aderencia: sols.some(s => s.integraProtheus === true) ? 3 : 2, impacto: 1, urgencia: 0, viabilidade: 2, dados: dataQuality(c), ...crit });
}
function fsOpps(c) {
  if (!fichasOk(c).length) return [];
  const rows = fsLinhas(c), out = [], comps = [...new Set(rows.map(r => r.comp).filter(Boolean))].sort();
  /* 1) excedente repetido em competências DISTINTAS (uma ocorrência isolada vira só pendência — ver fsPendencias) */
  fsGrupo(rows, 'Excedente').forEach((rs, k) => {
    const cps = [...new Set(rs.map(r => r.comp).filter(Boolean))].sort(); if (cps.length < FS_CFG.minComp) return;
    const nome = fsAbrev(rs[0].desc);
    out.push(fsOpp(c, 'fs_exc_' + k.replace(/\W/g, '').slice(0, 40), `Excedente repetido: ${nome}`, 'Otimização', rs,
      cps.map(cp => { const r = rs.find(x => x.comp === cp); return fsEv(r, `${fsCompL(cp)}: “${fsAbrev(r.desc)}” classificado como excedente — ${fsVal(r)}`); }),
      { problema: `INVESTIGAÇÃO RECOMENDADA: o item aparece como excedente em ${cps.length} competências (${cps.map(fsCompL).join(', ')}). Excedente não comprova necessidade de upgrade nem de nova contratação.`,
        deps: ['Contrato vigente e limite contratado do item', 'Histórico de consumo mais longo que as fichas disponíveis'],
        perg: ['O excedente é sazonal, crescimento de uso ou limite contratado abaixo da necessidade?', 'Houve revisão do limite ou do plano desde a primeira ocorrência?', 'Há previsão de crescimento de uso nos próximos meses?'],
        cenarios: ['A) Consumo cresceu de forma estrutural → revisar dimensionamento/plano.', 'B) Pico sazonal ou evento pontual → nenhuma ação comercial.', 'C) Uso fora do escopo (ex.: usuários ou ambientes não previstos) → regularizar com o cliente.'],
        acao: 'Levantar com o cliente o motivo do excedente e o histórico de consumo antes de qualquer proposta.' }, { evidencia: cps.length >= 3 ? 3 : 2 }));
  });
  /* 2) itens cancelados (qualquer competência): entender o motivo; não presumir recuperação */
  [...fsGrupo(rows, 'Cancelado')].sort((a, b) => Math.max(...b[1].map(r => r.total || 0)) - Math.max(...a[1].map(r => r.total || 0))).slice(0, FS_CFG.max).forEach(([k, rs]) => {
    const r0 = rs.slice().sort((a, b) => String(b.comp).localeCompare(String(a.comp)))[0], ult = comps[comps.length - 1];
    const subst = rows.filter(x => x.st === 'Ativo' && x.comp === ult && x.dept === r0.dept && x.dept !== 'com' && fsKey(x.desc) !== k).slice(0, 2);
    out.push(fsOpp(c, 'fs_canc_' + k.replace(/\W/g, '').slice(0, 40), `Entender cancelamento: ${fsAbrev(r0.desc)}`, 'Retenção', rs,
      rs.map(r => fsEv(r, `${fsCompL(r.comp)}: “${fsAbrev(r.desc)}” consta como cancelado/descontinuado na ficha${r.statusRaw ? ` (status: ${fsAbrev(r.statusRaw, 40)})` : ''} — ${fsVal(r)}`)),
      { problema: 'INVESTIGAÇÃO RECOMENDADA: item marcado como cancelado ou descontinuado na ficha. O cancelamento não comprova oportunidade de recuperação: pode ser substituição, migração, consolidação ou encerramento planejado.',
        deps: ['Motivo do cancelamento (comercial, técnico, financeiro ou organizacional)', 'Confirmar que a marcação é do contrato e não de um item legado já substituído'],
        perg: ['Qual foi o motivo do cancelamento e quem decidiu?', 'O item foi substituído por outra solução (TOTVS ou de terceiro)?', 'O problema que ele resolvia continua existindo?', ...subst.map(x => `Hipótese a confirmar: “${fsAbrev(x.desc, 50)}” (mesmo departamento) substituiu o item cancelado?`)].slice(0, 5),
        cenarios: ['A) Substituído por outro item já contratado → sem oportunidade.', 'B) Necessidade deixou de existir → registrar e encerrar.', 'C) Necessidade permanece sem cobertura → investigar solução aderente.'],
        acao: 'Perguntar ao cliente o motivo do cancelamento antes de qualquer abordagem de recuperação.' }, { evidencia: 1, urgencia: 0 }));
  });
  /* 3) variação de contratação recorrente entre as DUAS competências mais recentes */
  if (comps.length >= 2) {
    const P = comps[comps.length - 2], L = comps[comps.length - 1], tot = cp => { const m = new Map(); rows.filter(r => r.comp === cp && r.nat === 'recorrente' && r.st === 'Ativo' && r.total != null).forEach(r => { const k = fsKey(r.desc), e = m.get(k) || { v: 0, r }; e.v += r.total; m.set(k, e); }); return m; };
    const mp = tot(P), ml = tot(L), var_ = [];
    ml.forEach((e, k) => { const p = mp.get(k); if (!p) var_.push({ t: 'novo', k, e }); else if (p.v > 0 && Math.abs(e.v - p.v) / p.v * 100 >= FS_CFG.varPct) var_.push({ t: e.v > p.v ? 'aumento' : 'reducao', k, e, p }); });
    mp.forEach((p, k) => { if (!ml.has(k) && !rows.some(r => r.comp === L && fsKey(r.desc) === k)) var_.push({ t: 'saiu', k, e: p, p }); });
    if (var_.length) {
      const lab = { novo: 'aparece em ' + fsCompL(L) + ' e não em ' + fsCompL(P), saiu: 'consta em ' + fsCompL(P) + ' e não em ' + fsCompL(L), aumento: 'aumentou', reducao: 'reduziu' };
      out.push(fsOpp(c, 'fs_var', `Variação de contratação entre ${fsCompL(P)} e ${fsCompL(L)}`, 'Otimização', var_.map(v => v.e.r),
        var_.slice(0, 6).map(v => fsEv(v.e.r, `“${fsAbrev(v.e.r.desc, 55)}” ${lab[v.t]}${v.p && v.t.match(/aumento|reducao/) ? `: ${fmtBRL(v.p.v)} → ${fmtBRL(v.e.v)}` : ''}`)),
        { problema: `INVESTIGAÇÃO RECOMENDADA: ${var_.length} item(ns) recorrente(s) variam entre as duas últimas competências. A variação pode refletir reajuste, mudança de escopo, migração ou ficha parcial — não indica por si só oportunidade.`,
          deps: ['Confirmar que as duas fichas cobrem o mesmo contrato e o mesmo escopo', 'Reajustes contratuais do período'],
          perg: ['A variação foi decisão do cliente, reajuste, migração ou diferença de escopo entre fichas?', 'Algum item que saiu foi substituído por outro?'],
          cenarios: ['A) Reajuste ou ajuste de quantidade → sem ação.', 'B) Migração/consolidação de produtos → mapear o destino.', 'C) Redução de uso → entender risco de retenção.'],
          acao: 'Comparar as duas fichas com o cliente e confirmar o que mudou.' }, { evidencia: 2 }));
    }
  }
  /* 4) desconto com validade DOCUMENTADA (data encontrada no texto da linha; interpretação mostrada junto) */
  rows.filter(r => r.nat === 'desconto').forEach(r => {
    const dt = fsDatas(`${r.desc} ${r.statusRaw}`).find(d => d.tipo.some(t => t !== 'renovacao')); if (!dt) return;
    const dias = daysTo(dt.iso), k = fsKey(r.desc);
    out.push(fsOpp(c, 'fs_desc_' + k.replace(/\W/g, '').slice(0, 40), `Desconto com validade documentada: ${fsAbrev(r.desc, 60)}`, 'Otimização', [r],
      [fsEv(r, `Trecho da ficha: “${dt.raw}” — data interpretada: ${fmtD(dt.iso)}${dt.diaAusente ? ' (dia não informado; usado o último dia do mês)' : ''}; valor da linha ${fsVal(r)}`)],
      { problema: `INVESTIGAÇÃO RECOMENDADA: desconto com prazo citado no documento (${dias < 0 ? 'data já passou' : `${dias} dia(s)`}). O fim de um desconto não justifica, por si só, renegociação ou nova oferta.`,
        deps: ['Condições do desconto no contrato/proposta', 'Confirmar a data com o documento original (a ficha pode estar desatualizada)'],
        perg: ['Qual é o valor/condição após o término do desconto?', 'O desconto foi condicionado a volume, prazo ou outro compromisso?', 'O cliente já foi avisado do fim da condição?'],
        cenarios: ['A) Desconto encerra e o cliente aceita o valor cheio → acompanhar.', 'B) Cliente pede extensão → avaliar contrapartida (escopo ou prazo).', 'C) Data errada ou já renovada → atualizar o registro.'],
        acao: 'Confirmar a vigência no documento original e preparar a conversa antes da data (sem presumir renegociação).' }, { evidencia: 2 }));
  });
  return out;
}
/* pendências de informação: o que impede concluir (não são oportunidades) */
function fsPendencias(c) {
  if (!fichasOk(c).length) return [];
  const rows = fsLinhas(c), L = [];
  const exc1 = [...fsGrupo(rows, 'Excedente')].filter(([, rs]) => new Set(rs.map(r => r.comp).filter(Boolean)).size < FS_CFG.minComp);
  if (exc1.length) L.push({ falta: 'Fichas de mais competências (excedente em uma única ficha)', importa: `Há ${exc1.length} item(ns) com excedente em apenas uma competência (${exc1.slice(0, 2).map(([, rs]) => fsAbrev(rs[0].desc, 40)).join('; ')}). Com uma ficha não dá para distinguir excedente pontual de recorrente.`, decisao: 'Se o excedente vira investigação de dimensionamento.', acao: ['ctab', 'fichas', 'Anexar fichas'] });
  const sd = rows.filter(r => r.nat === 'desconto' && !fsDatas(`${r.desc} ${r.statusRaw}`).some(d => d.tipo.some(t => t !== 'renovacao')));
  if (sd.length) L.push({ falta: 'Vigência dos descontos', importa: `${sd.length} desconto(s) na ficha sem prazo documentado. Sem vigência não há como saber se a condição termina.`, decisao: 'Se há conversa de renovação de condições.', acao: ['ctab', 'fichas', 'Ver fichas'] });
  return L;
}
