/* ===== Rodada 18 §H: gatilhos de data (vigência, fim de desconto, renovação) em fichas e documentos do cliente =====
   Distingue DATA ENCONTRADA no texto (trecho bruto) de DATA INTERPRETADA (ISO) e de DATA CONFIRMADA pelo executivo (c.dtConf[chave]).
   Só data confirmada gera alerta/oportunidade; a competência de faturamento NUNCA é tratada como fim de contrato; vencimento de fatura/boleto é ignorado.
   Os lembretes contratuais estruturados (ctReminders) e os alertas de sustentação/regulatório continuam como estavam. Gatilhos nunca presumem renegociação, troca ou risco. */
const DT_K = {
  vigencia: ['Vigência', /vig[eê]ncia|v[aá]lid[oa]s?\s+at[eé]|validade|t[eé]rmino d[aeo]s?\s+(contrato|prazo|vig)|fim d[aeo]s?\s+(contrato|vig)|encerramento d[oa]\s+contrato|expira/i, 'Confirmar no contrato original a vigência e preparar a conversa de continuidade antes da data.'],
  renovacao: ['Renovação', /renova[cç]|prorroga/i, 'Verificar as condições de renovação/reajuste e quem decide, antes da data (sem presumir a renovação).'],
  desconto: ['Fim de desconto/condição', /desconto|promo[cç]|bonifica|cortesia|car[eê]ncia/i, 'Confirmar a condição após o fim do desconto e preparar a conversa (sem presumir renegociação).']
};
const DT_FATURA = /compet[eê]ncia|emiss[aã]o|\bfatur\w*|boleto|parcela|nota fiscal|\bnf-?e?\b|ref\.?\s*:|referente|pagamento|vencimento d[aeo]/i;
const DT_FORTE = /vig[eê]ncia|renova|prorroga|contrato|desconto|promo[cç]|bonifica|car[eê]ncia|validade|v[aá]lid/i;
const dtH = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
const dtAbrev = (s, n = 70) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);
function dtDatas(texto) {
  const t = String(texto || ''), out = []; FS_DT.lastIndex = 0; let m;
  while ((m = FS_DT.exec(t)) && out.length < 12) {
    let d, mo, y; if (m[1]) { d = +m[1]; mo = +m[2]; y = +m[3]; if (y < 100) y += 2000; } else { d = null; mo = +m[4]; y = +m[5]; }
    if (mo < 1 || mo > 12 || y < 2000 || y > 2100 || (d != null && (d < 1 || d > 31))) continue;
    if (d != null) { const dd = new Date(y, mo - 1, d); if (dd.getMonth() !== mo - 1 || dd.getDate() !== d) continue; }
    const iso = d != null ? `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}` : `${y}-${String(mo).padStart(2, '0')}-${String(new Date(y, mo, 0).getDate()).padStart(2, '0')}`;
    const ctx = t.slice(Math.max(0, m.index - 70), m.index + m[0].length + 25), pre = t.slice(Math.max(0, m.index - 40), m.index);
    if (DT_FATURA.test(pre) && !DT_FORTE.test(pre)) continue; /* competência/fatura/vencimento de cobrança: não é vigência */
    const kind = ['desconto', 'renovacao', 'vigencia'].find(k => DT_K[k][1].test(ctx)); if (!kind) continue;
    out.push({ raw: t.slice(Math.max(0, m.index - 35), m.index + m[0].length).trim(), iso, kind, diaAusente: d == null });
  }
  return out;
}
function dtGatilhos(c) {
  const L = [], seen = new Set(), conf = c.dtConf || {};
  const add = (kind, iso, raw, diaAusente, desc, arq, loc, origem) => {
    const k = 'dt_' + dtH([kind, iso, fsKey(desc).slice(0, 60) || norm(raw).slice(0, 40)].join('|')); if (seen.has(k)) return; seen.add(k);
    const cf = conf[k], isoF = cf?.st === 'confirmada' ? cf.iso : iso;
    L.push({ key: k, kind, iso, isoF, raw, diaAusente, desc: dtAbrev(desc), arq, loc, origem, st: cf?.st || 'encontrada', nota: cf?.nota || '', d: daysTo(isoF) });
  };
  if (fichasOk(c).length) fsLinhas(c).forEach(r => dtDatas(`${r.desc} ${r.statusRaw || ''}`).forEach(x => add(x.kind, x.iso, x.raw, x.diaAusente, r.desc, r.file, r.loc || 'ficha', 'ficha de faturamento')));
  [...(c.cdocs || []), ...(c.docs || [])].forEach(dc => String(dc.text || '').split(/(?<=[.!?;])\s+|\n+/).forEach(s => { if (s.length < 12 || s.length > 600) return; dtDatas(s).forEach(x => add(x.kind, x.iso, x.raw, x.diaAusente, s, dc.name || 'documento', '', 'documento do cliente')); }));
  return L.sort((a, b) => (a.d ?? 9e9) - (b.d ?? 9e9));
}
const dtJanela = () => renovDays()[0];
const dtNivel = g => g.st !== 'confirmada' ? g.st : g.d == null ? 'confirmada' : g.d < 0 ? 'passada' : g.d <= dtJanela() ? 'alerta' : 'futura';
function dtOpps(c, base) {
  c.dtList = dtGatilhos(c); const out = [];
  c.dtList.filter(g => dtNivel(g) === 'alerta').forEach(g => {
    const [lab, , acao] = DT_K[g.kind], ev = [{ cls: 'FATO', text: `Trecho encontrado: “${g.raw}” — data interpretada: ${fmtD(g.iso)}${g.diaAusente ? ' (dia não informado; usado o último dia do mês)' : ''}; data confirmada por você: ${fmtD(g.isoF)}${g.nota ? ` (${g.nota})` : ''}`, src: `${g.arq}${g.loc ? ' • ' + g.loc : ''}` }];
    const fx = renovDays().filter(x => g.d <= x).pop(), exist = g.kind === 'desconto' && (base || []).find(o => o.ruleId === 'fs_desc_' + fsKey(g.desc).replace(/\W/g, '').slice(0, 40));
    if (exist) { exist.evInd = [...(exist.evInd || []), ...ev]; exist.dtConfirmada = g.isoF; return; }
    out.push(mkOpp(c, { ruleId: g.key, tipo: 'Otimização', tipoBase: 'Otimização', nome: `Gatilho de data: ${lab} em ${g.d} dia(s) — ${dtAbrev(g.desc, 50)}`, modo: 'investigacao', sols: [], extraBase: [], natureza: ['CICLO DE VIDA / DATA CONFIRMADA'],
      problema: `INVESTIGAÇÃO RECOMENDADA: ${lab.toLowerCase()} confirmada por você para ${fmtD(g.isoF)} (${g.d} dia(s); aviso de ${fx} dias). A data abre uma janela de conversa; não indica, por si só, renegociação, troca de produto ou risco.`,
      impacto: 'HIPÓTESE: sem estimativa de receita; a data só define o melhor momento para a conversa.', evInd: ev, origemTipo: ['Ciclo de vida'], origens: [g.origem], deps: ['Documento original (contrato, proposta ou aditivo) com a condição vigente'],
      perg: [`O que acontece após ${fmtD(g.isoF)} (valor, condição, renovação automática ou não)?`, 'Quem decide a continuidade e com que antecedência?', 'A data está correta e vigente (não houve aditivo ou renovação)?'], acao },
      { evidencia: 2, aderencia: 2, impacto: 1, urgencia: g.d <= 30 ? 3 : g.d <= 90 ? 2 : 1, viabilidade: 2, dados: dataQuality(c) }));
  });
  return out;
}
function dtPendencia(c) {
  const a = (c.dtList || []).filter(g => g.st === 'encontrada'), p = (c.dtList || []).filter(g => dtNivel(g) === 'passada');
  const L = []; if (a.length) L.push({ falta: `Confirmar ${a.length} data(s) de vigência/renovação/desconto encontrada(s) em fichas ou documentos`, importa: 'Data encontrada no texto é só indício: sem a sua confirmação com o documento original não gera alerta nem oportunidade.', decisao: 'Se há conversa de renovação ou fim de condição próxima.', acao: ['nav', 'geral', 'Ver gatilhos de data'] });
  if (p.length) L.push({ falta: `${p.length} data(s) confirmada(s) já passada(s): confirmar a situação atual`, importa: 'Não presumimos renovação automática nem prorrogação: confirme o que vale hoje.', decisao: 'Se a condição foi renovada, encerrada ou renegociada.', acao: ['nav', 'geral', 'Ver gatilhos de data'] });
  return L;
}
function dtConfirmar(k, key) {
  const c = S.clients[k], g = (c?.dtList || []).find(x => x.key === key); if (!g) return; const v = $('#dtd_' + key)?.value || '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || new Date(v + 'T00:00:00Z').toISOString().slice(0, 10) !== v) return toast('Informe uma data válida.');
  (c.dtConf ||= {})[key] = { st: 'confirmada', iso: v, nota: ($('#dtn_' + key)?.value || '').trim().slice(0, 200), em: nowISO(), por: (typeof ME !== 'undefined' && ME.id) || '' }; touchC(k); runAnalysis(c, ''); render();
}
function dtMarcar(k, key, st) { const c = S.clients[k]; if (!c) return; if (st === 'encontrada') delete (c.dtConf || {})[key]; else (c.dtConf ||= {})[key] = { st: 'ignorada', em: nowISO(), por: (typeof ME !== 'undefined' && ME.id) || '' }; touchC(k); runAnalysis(c, ''); render(); }
const DT_ACT = { dtOk: t => dtConfirmar(t.dataset.k, t.dataset.id), dtIgn: t => dtMarcar(t.dataset.k, t.dataset.id, 'ignorada'), dtUndo: t => dtMarcar(t.dataset.k, t.dataset.id, 'encontrada') };
function dtCard() {
  const todos = clients().flatMap(c => (c.dtList || []).map(g => ({ c, g }))), al = todos.filter(x => ['alerta', 'passada'].includes(dtNivel(x.g))), pend = todos.filter(x => x.g.st === 'encontrada'), igno = todos.filter(x => x.g.st === 'ignorada').length;
  if (!al.length && !pend.length) return '';
  const row = ({ c, g }) => `<li class="sm"><b>${esc(c.name)}</b> • ${esc(DT_K[g.kind][0])} • ${dtNivel(g) === 'passada' ? pill('já passou', 'bad') : pill(g.d + ' dia(s)', g.d <= 30 ? 'bad' : 'warn')} — ${esc(fmtD(g.isoF))}<div class="muted">${esc(g.origem)}: ${esc(g.arq)}${g.loc ? ' • ' + esc(g.loc) : ''}${g.nota ? ' • ' + esc(g.nota) : ''}</div><div>${esc(dtNivel(g) === 'passada' ? 'Confirme a situação atual (renovação, encerramento ou renegociação); nada é presumido.' : DT_K[g.kind][2])}</div> <button class="btn ghost sm" data-a="dtUndo" data-k="${esc(c.key)}" data-id="${g.key}">Desfazer confirmação</button></li>`;
  const prow = ({ c, g }) => `<li class="sm"><b>${esc(c.name)}</b> • ${esc(DT_K[g.kind][0])}<div>Trecho encontrado: “${esc(g.raw)}” <span class="muted">(${esc(g.origem)}: ${esc(g.arq)}${g.loc ? ' • ' + esc(g.loc) : ''})</span></div><div class="muted">Data interpretada: ${esc(fmtD(g.iso))}${g.diaAusente ? ' — dia não informado (usado o último dia do mês)' : ''}</div>
    <div class="row"><input type="date" id="dtd_${g.key}" value="${esc(g.iso)}"><input type="text" id="dtn_${g.key}" placeholder="Nota (onde conferiu)" style="min-width:160px"><button class="btn sm" data-a="dtOk" data-k="${esc(c.key)}" data-id="${g.key}">Confirmar data (conferi no documento)</button><button class="btn ghost sm" data-a="dtIgn" data-k="${esc(c.key)}" data-id="${g.key}">Não é vigência</button></div></li>`;
  return `<div class="card"><h3>Gatilhos de data <span class="pill p-info">${al.length}</span></h3><p class="muted sm">Datas de vigência, renovação e fim de desconto encontradas em fichas e documentos. <b>Só data confirmada por você gera alerta</b> (antecedência: ${renovDays().join(', ')} dias); competência de faturamento e vencimento de fatura não contam. Os lembretes contratuais acima e os alertas de sustentação/regulatório seguem inalterados.</p>
  ${al.length ? `<ul>${al.sort((a, b) => a.g.d - b.g.d).map(row).join('')}</ul>` : '<p class="sm muted">Nenhuma data confirmada dentro da janela de aviso.</p>'}
  ${pend.length ? `<details><summary class="sm">${pend.length} data(s) encontrada(s) aguardando confirmação${igno ? ` • ${igno} marcada(s) como não vigência` : ''}</summary><ul>${pend.slice(0, 30).map(prow).join('')}</ul></details>` : ''}</div>`;
}
