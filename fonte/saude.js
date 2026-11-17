/* ---------- Saúde e integração da plataforma (rodada 45, etapa 4) ----------
   Seção do Painel Administrador. O diagnóstico EXECUTA as conexões reais, na sessão de quem clica:
   - servidor: gravação condicional, conflito e isolamento, em um documento próprio de diagnóstico (criado e apagado na hora);
   - propagação: roda as funções reais dos módulos sobre um cliente de teste que existe só na memória (nunca é gravado);
   - dados: lê a carteira de quem executa e conta vínculos órfãos, conflitos e pendências (não altera nada).
   Limite declarado: a carteira é privada; o diagnóstico enxerga a de quem executa, não a dos demais executivos.
   Estados: ok · atenção (funciona, há algo a tratar) · falha · não verificado (faltou pré-requisito; nunca é contado como ok). */
const SAU = { busy: false, rel: null };
const SAU_ST = { ok: ['ok', 'p-ok'], at: ['atenção', 'p-warn'], falha: ['falha', 'p-bad'], nv: ['não verificado', 'p-off'] };
/* integrações entre módulos: [id, origem, destino, mecanismo]. O estado vem da sonda executada, não desta lista. */
const SAU_MAPA = [
  ['cad_analise', 'Cadastro do cliente', 'Análise (produtos identificados, oportunidades)', 'reanálise a cada edição'],
  ['cad_ader', 'Cadastro (segmento)', 'Aderência do Catálogo Enxoval', 'cálculo na abertura da ficha'],
  ['prod_possui', 'Fichas e produtos identificados', 'Aderência: “Já possui”', 'nome do produto, nome alternativo ou marcação manual'],
  ['fc_ficha', 'Meu Forecast (vínculo manual)', 'Ficha do cliente, briefing e recomendações', 'leitura do vínculo oportunidade ↔ cliente'],
  ['vinc_gestao', 'Solução vinculada', 'Gestão da conta e Oportunidades', 'leitura do vínculo no cliente'],
  ['desfecho', 'Desfecho (Base ou catálogo)', 'As duas listas de recomendação', 'um desfecho por produto e cliente'],
  ['mrr', 'MRR do cadastro × Empodera', 'Alerta na ficha e filtro “com conflitos”', 'comparação com a tolerância configurada'],
  ['cat_rev', 'Reimportação do Catálogo Enxoval', 'Vínculos existentes', 'aviso de revisão por mudança material'],
  ['sinc_mescla', 'Outra sessão do mesmo executivo', 'Carteira desta sessão', 'mescla por campo em três vias'],
  ['srv_versao', 'Aplicativo', 'Banco de dados (carteira privada)', 'gravação condicional por versão'],
  ['srv_isol', 'Banco de dados', 'Isolamento entre executivos', 'recusa de leitura de carteira alheia'],
  ['enx_srv', 'Servidor', 'Catálogo Enxoval no aplicativo', 'leitura do catálogo importado'],
];
/* conexões que NÃO existem hoje (declaradas, não simuladas) */
const SAU_AUSENTES = [
  'Diagnóstico executivo e prompts de IA não leem Forecast nem soluções vinculadas.',
  'Visão geral não tem indicador de soluções vinculadas.',
  'Cruzamento Base × Catálogo Enxoval (“já está na sua Base”) não usa os nomes alternativos.',
  'Notas de aderência da Base e do Catálogo Enxoval são calculadas por critérios diferentes (só desfecho e selos são únicos).',
  'Inbox, pesquisas, marcos, OCR e consolidações gravam sem controle de versão entre sessões.',
  'Exclusão de cliente feita em outra sessão só é percebida ao recarregar ou ao editar o mesmo cliente.',
  'Pendências documentais não lista vínculos a revisar.',
  'O painel não enxerga a carteira dos demais executivos: cada um vê o diagnóstico da própria.',
];
const sauTmp = () => ({ key: '__diag__', name: 'Cliente de diagnóstico (só memória)', cnpj: '', city: '', uf: '', productsRaw: 'Protheus', seg: 'Manufatura', segment: 'Manufatura', fichas: [], docs: [], mgmt: {}, act: {}, opps: [], src: { row: 1 } });
async function sauDb(corpo) { const r = await fetch('/api/db', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo), credentials: 'same-origin', redirect: 'manual' }); let j = null; try { j = await r.json(); } catch { /* resposta sem JSON */ } return { s: r.status, j: j || {} }; }
/* cada sonda devolve [estado, detalhe]; exceção vira falha */
const SAU_SONDAS = {
  cad_analise: () => { const c = sauTmp(); runAnalysis(c); const a = (c.productsIdent || []).length; c.productsRaw = ''; runAnalysis(c); const b = (c.productsIdent || []).length; return a > 0 && b === 0 ? ['ok', `produto informado no cadastro foi identificado (${a}) e saiu ao ser removido`] : ['falha', `identificados antes ${a}, depois ${b}`]; },
  cad_ader: () => { if (!ENX.idx || !ENX.meta) return ['nv', 'Catálogo Enxoval não importado ou não carregado']; const p = ENX.idx.find(x => x.nivel !== 'inativo'); if (!p) return ['nv', 'catálogo sem produto ativo']; const c = sauTmp(); runAnalysis(c); const d1 = adCalc(adCtx(c), p).dims.find(d => d.k === 'setorial').nota; c.seg = c.segment = ''; if (c.edits) delete c.edits.seg; runAnalysis(c); const d2 = adCalc(adCtx(c), p).dims.find(d => d.k === 'setorial').nota; return d1 != null && d2 == null ? ['ok', 'com segmento, o critério setorial é calculado; sem segmento, fica “sem informação”'] : ['falha', `setorial com segmento ${d1}, sem segmento ${d2}`]; },
  prod_possui: () => { if (!ENX.idx || !ENX.meta) return ['nv', 'Catálogo Enxoval não importado ou não carregado']; const p = ENX.idx.find(x => x.nivel !== 'inativo' && normName(x.nome).length >= 8); if (!p) return ['nv', 'catálogo sem produto ativo']; const c = sauTmp(); runAnalysis(c); const antes = adCalc(adCtx(c), p).cls; c.enxVinc = { [p.id]: { st: 'possui', nome: p.nome, em: nowISO() } }; const dep = adCalc(adCtx(c), p).cls; return antes !== 'possui' && dep === 'possui' ? ['ok', 'marcar “já possui” tira o produto das recomendações do cliente'] : antes === 'possui' ? ['nv', 'o produto de teste já consta como possuído'] : ['falha', `classe antes ${antes}, depois ${dep}`]; },
  fc_ficha: () => { const c = sauTmp(), fd = S.meta.fcData, fl = S.meta.fcLink; try { S.meta.fcData = { syncedAt: nowISO(), metas: [], opps: [{ id: '__d1', mes: '12', cliente: 'x', produto: 'Produto de Diagnóstico', status: 'EM ABERTO', total: 1, data: '' }, { id: '__d2', mes: '12', cliente: 'x', produto: 'Outro', status: 'EM ABERTO', total: 1, data: '' }] }; S.meta.fcLink = { __d1: '__diag__' }; const os = fcDoCliente(c), selo = eloPills(c, 'TOTVS Produto de Diagnóstico'), br = eloBrief(c); return os.length === 1 && /em negociação/.test(selo) && br.length === 1 && fcCard(c) ? ['ok', 'só a oportunidade vinculada chega à ficha, ao selo da recomendação e ao briefing'] : ['falha', `oportunidades ${os.length}, selo ${selo ? 'sim' : 'não'}, briefing ${br.length}`]; } finally { if (fd === undefined) delete S.meta.fcData; else S.meta.fcData = fd; if (fl === undefined) delete S.meta.fcLink; else S.meta.fcLink = fl; } },
  vinc_gestao: () => { const c = sauTmp(); c.enxVinc = { 'produto-diag': { st: 'vinculada', nome: 'Produto de Diagnóstico', em: nowISO() }, 'outro-diag': { st: 'descartada', nome: 'Outro', em: nowISO() } }; const n = eloVincs(c).length, h = vincCard(c); return n === 1 && /Produto de Diagnóstico/.test(h) && !/Outro</.test(h) ? ['ok', 'vínculo aparece em Gestão da conta; descartado não aparece'] : ['falha', `vínculos lidos ${n}`]; },
  desfecho: () => { const r = S.solutions.find(x => !x.arquivado && normName(x.nome).length >= 4); if (!r) return ['nv', 'Base de Soluções vazia']; const c = sauTmp(); c.ptRes = { [r.id]: { st: 'perdeu', em: '2026-01-01T00:00:00.000Z' } }; c.enxVinc = { x: { st: 'vinculada', nome: r.nome, em: nowISO(), res: { st: 'ganhou', em: '2026-06-01T00:00:00.000Z' } } }; const d = eloDesfecho(c, r.nome); return d && d.st === 'ganhou' ? ['ok', 'registros da Base e do catálogo para o mesmo produto resultam em um desfecho (o mais recente)'] : ['falha', 'desfecho lido: ' + (d ? d.st : 'nenhum')]; },
  mrr: () => { const c = sauTmp(); c.mrr = 1000; c.emp = { mrrP: 2000, hist: [] }; const a = mrrEmpDiv(c); c.emp.mrrP = 1000; const b = mrrEmpDiv(c); return a && !b ? ['ok', `divergência acima de ${mrrTol()}% é sinalizada; valores iguais não`] : ['falha', 'comparação não respondeu como esperado']; },
  cat_rev: () => { if (!ENX.idx || !ENX.meta) return ['nv', 'Catálogo Enxoval não importado ou não carregado']; const c = sauTmp(); const r = eloRev(c, { id: 'produto-que-nao-existe-diag', st: 'vinculada', nome: 'X' }); return r && r.fora ? ['ok', 'vínculo com produto fora do catálogo é sinalizado para revisão'] : ['falha', 'vínculo órfão não foi sinalizado']; },
  sinc_mescla: () => { const B = sincHashes({ a: 1, b: 2, c: 3 }), m = sincMerge({ a: 1, b: 20, c: 30 }, { a: 10, b: 2, c: 31 }, B); return m.tomou.join() === 'a' && m.conf.join() === 'c' && !('b' in m.val) ? [SINC.on ? 'ok' : 'at', SINC.on ? 'mescla por campo ativa: incorpora o que só o outro lado mudou e pede decisão no que os dois mudaram' : 'mescla correta, mas o controle de versão não está ativo nesta sessão'] : ['falha', 'mescla devolveu resultado inesperado']; },
  srv_versao: async () => {
    if (!window.__HOSTED__ || !ME.id) return ['nv', 'fora do ambiente hospedado']; const path = 'data/users/' + ME.id + '/diagnostico/integracao', passos = [];
    try {
      await sauDb({ op: 'delete', path });
      const a = await sauDb({ op: 'set', path, data: { n: 1 }, base: '' }); passos.push(a.s === 200 && a.j.at ? '' : 'criação recusada');
      const b = await sauDb({ op: 'set', path, data: { n: 2 }, base: '' }); passos.push(b.s === 409 ? '' : 'segunda criação aceita');
      const c = await sauDb({ op: 'set', path, data: { n: 3 }, base: a.j.at || 'x' }); passos.push(c.s === 200 ? '' : 'gravação com versão correta recusada');
      const d = await sauDb({ op: 'set', path, data: { n: 4 }, base: a.j.at || 'x' }); passos.push(d.s === 409 && d.j.atual && d.j.atual.n === 3 ? '' : 'gravação com versão antiga aceita');
      const g = await sauDb({ op: 'get', path }); passos.push(g.j.data && g.j.data.n === 3 ? '' : 'conteúdo final diferente do esperado');
    } finally { await sauDb({ op: 'delete', path }); }
    const z = await sauDb({ op: 'get', path }); passos.push(z.j.exists === false ? '' : 'documento de diagnóstico não foi apagado');
    const er = passos.filter(Boolean); return er.length ? ['falha', er.join('; ')] : ['ok', 'criação, recusa de versão antiga (409), conteúdo preservado e limpeza: 6 passos reais no banco'];
  },
  srv_isol: async () => { if (!window.__HOSTED__ || !ME.id) return ['nv', 'fora do ambiente hospedado']; const r = await sauDb({ op: 'get', path: 'data/users/outro.executivo@diagnostico.invalid/carteira' }), w = await sauDb({ op: 'set', path: 'data/users/outro.executivo@diagnostico.invalid/diagnostico/integracao', data: { n: 1 } }); return r.s === 403 && w.s === 403 ? ['ok', 'leitura e gravação em carteira de outro usuário recusadas (403)'] : ['falha', `leitura ${r.s}, gravação ${w.s}`]; },
  enx_srv: async () => { if (!window.__HOSTED__) return ['nv', 'fora do ambiente hospedado']; const r = await fetch('/api/enxoval', { credentials: 'same-origin', cache: 'no-store', redirect: 'manual' }), j = r.ok ? await r.json() : null; if (!j || !j.ok) return ['falha', 'servidor não respondeu (HTTP ' + r.status + ')']; if (!j.meta) return ['at', 'catálogo ainda não importado pelo administrador']; const loc = ENX.meta?.importadoEm; return loc && loc !== j.meta.importadoEm ? ['at', `esta sessão usa o catálogo de ${fmtD(String(loc).slice(0, 10))}; o servidor tem o de ${fmtD(String(j.meta.importadoEm).slice(0, 10))} (atualiza em até 10 min)`] : ['ok', `${j.meta.total} produto(s), importado em ${fmtD(String(j.meta.importadoEm || '').slice(0, 10))}`]; },
};
/* leitura da carteira de quem executa: nada é alterado */
function sauDados() {
  const cs = clients(), L = S.meta.fcLink || {}, ops = S.meta.fcData?.opps || [], opId = new Set(ops.map(o => o.id)), C = fcCfg() || {}, out = [];
  const add = (nome, n, st, det) => out.push({ nome, n, st: n ? st : 'ok', det });
  const linkOrf = Object.entries(L).filter(([, k]) => !S.clients[k]).length, linkVelho = Object.keys(L).filter(id => ops.length && !opId.has(id)).length;
  add('Vínculos do Forecast apontando para cliente inexistente', linkOrf, 'falha', 'vínculo oportunidade ↔ cliente cujo cliente foi removido');
  add('Vínculos do Forecast de oportunidades que saíram da planilha', linkVelho, 'at', 'ficam sem efeito; nada é exibido para eles');
  let ptOrf = 0, vFora = 0, vRev = 0, chave = 0, semAn = 0, mrr1 = 0, mrr2 = 0, cadc = 0, rflag = 0; const sid = new Set(S.solutions.map(r => r.id)), cat = ENX.idx && ENX.meta;
  for (const c of cs) { if (S.clients[c.key] !== c) chave++; if (!Array.isArray(c.opps)) semAn++; for (const id of Object.keys(c.ptRes || {})) if (!sid.has(id)) ptOrf++; if (cat) for (const v of eloVincs(c)) { const r = eloRev(c, v); if (r) r.fora ? vFora++ : vRev++; } if (mrrEmpDiv(c)) mrr1++; try { if (mrrOf(c).div) mrr2++; } catch { /* sem competência */ } cadc += (c.cadConf || []).filter(x => !x.res).length; if ((c.reviewFlags || []).length) rflag++; }
  add('Clientes cuja chave não confere com o índice', chave, 'falha', 'identificador único inconsistente');
  add('Clientes sem análise calculada', semAn, 'falha', 'a análise roda ao carregar; não deveria haver nenhum');
  add('Desfechos de soluções que não existem mais na Base', ptOrf, 'at', 'registro mantido, sem solução correspondente');
  add('Vínculos com produto fora do catálogo ou inativo', vFora, 'at', cat ? 'revisar em Gestão da conta de cada cliente' : 'não verificado: catálogo não carregado');
  add('Vínculos a revisar por mudança no catálogo', vRev, 'at', cat ? 'revisar em Gestão da conta de cada cliente' : 'não verificado: catálogo não carregado');
  add('Clientes com MRR divergente (cadastro × Empodera)', mrr1, 'at', 'os valores nunca são somados');
  add('Clientes com MRR divergente (planilha × ficha)', mrr2, 'at', 'vale a precedência configurada');
  add('Conflitos de cadastro sem decisão', cadc, 'at', 'aguardam a escolha do executivo');
  add('Clientes com diagnóstico a revisar (Base atualizada)', rflag, 'at', 'marcados quando uma solução da Base mudou');
  add('Conflitos entre sessões aguardando decisão', Object.keys(SINC.conf).length, 'at', 'alteração simultânea no mesmo campo');
  const pend = dirtyC.size + delC.size + dirtyI.size + dirtyS.size + dirtyP.size + (dirtyMeta ? 1 : 0) + Object.values(GCOL).reduce((n, g) => n + g.d.size + g.x.size, 0);
  add('Gravações pendentes nesta sessão', pend, 'at', 'aguardando envio ao servidor');
  return { linhas: out, clientes: cs.length, fc: { ligado: !!C.url, ok: C.lastOk || '', erro: C.lastErr ? C.lastErr.msg : '', opps: ops.length, vinc: Object.keys(L).length }, persist: UI.persist };
}
async function sauDiag() {
  if (SAU.busy) return; SAU.busy = true; render(); const t0 = performance.now(), itens = [];
  try { if (window.__HOSTED__ && !ENX.idx) await enxCarregar(true); } catch { /* segue sem catálogo */ }
  for (const [id, de, para, como] of SAU_MAPA) { const t = performance.now(); let st, det; try { [st, det] = await SAU_SONDAS[id](); } catch (e) { st = 'falha'; det = 'erro ao executar: ' + String(e && e.message || e).slice(0, 160); } itens.push({ id, de, para, como, st, det, ms: Math.round(performance.now() - t) }); }
  let dados = null, erroDados = ''; try { dados = sauDados(); } catch (e) { erroDados = String(e && e.message || e).slice(0, 160); }
  /* tempo de processamento medido agora, sem gravar nada */
  const tempo = {}; try { const c = sauTmp(), t = performance.now(); runAnalysis(c); tempo.analise = Math.round(performance.now() - t); const am = clients().slice(0, 25); if (am.length && ENX.idx && ENX.meta) { const t2 = performance.now(); am.forEach(c2 => adCliente(c2)); const ms = performance.now() - t2; tempo.aderN = am.length; tempo.aderMed = Math.round(ms / am.length); tempo.aderCarteira = Math.round(ms / am.length * clients().length); } } catch { /* medição opcional */ }
  const n = k => itens.filter(i => i.st === k).length, erros = (UI.log || []).filter(l => l.k === 'bad').slice(0, 8).map(l => `${l.at} ${l.t}`.slice(0, 200));
  const ext = (ADMV.integ?.itens || []).map(x => ({ nome: x.nome, estado: (ADM_INT_EST[x.estado] || [x.estado])[0], ultima: x.ultima || '', ruim: ['falha_autenticacao', 'indisponivel', 'intervencao'].includes(x.estado) }));
  SAU.rel = { em: nowISO(), ms: Math.round(performance.now() - t0), por: ME.id || '', modulos: NAV.reduce((a, g) => a + Math.max(1, g[3].length), 0), itens, resumo: { mapeadas: itens.length, ok: n('ok'), at: n('at'), falha: n('falha'), nv: n('nv'), ausentes: SAU_AUSENTES.length }, dados, erroDados, tempo, erros, ext };
  SAU.busy = false; render(); toast(`Diagnóstico concluído em ${SAU.rel.ms} ms: ${n('ok')} ok, ${n('at')} atenção, ${n('falha')} falha, ${n('nv')} não verificado.`);
}
function sauTexto(R) {
  const L = [`DIAGNÓSTICO DE INTEGRAÇÃO — ${new Date(R.em).toLocaleString('pt-BR')} — executado por ${R.por} — ${R.ms} ms`, `Módulos (telas): ${R.modulos} · Integrações mapeadas: ${R.resumo.mapeadas} · ok: ${R.resumo.ok} · atenção: ${R.resumo.at} · falha: ${R.resumo.falha} · não verificado: ${R.resumo.nv} · não implementadas: ${R.resumo.ausentes}`, '', 'INTEGRAÇÕES TESTADAS'];
  R.itens.forEach(i => L.push(`[${SAU_ST[i.st][0]}] ${i.de} → ${i.para} (${i.como}): ${i.det} (${i.ms} ms)`));
  L.push('', 'DADOS DA CARTEIRA DE QUEM EXECUTOU'); if (R.dados) { L.push(`Clientes: ${R.dados.clientes} · Forecast: ${R.dados.fc.ligado ? 'planilha vinculada, última sincronização ' + (R.dados.fc.ok || 'nunca') + (R.dados.fc.erro ? ', último erro: ' + R.dados.fc.erro : '') : 'sem planilha vinculada'} · Gravação: ${R.dados.persist}`); R.dados.linhas.forEach(d => L.push(`[${SAU_ST[d.st][0]}] ${d.nome}: ${d.n}`)); } else L.push('não verificado: ' + R.erroDados);
  L.push('', 'INTEGRAÇÕES EXTERNAS (última execução real registrada)'); R.ext.length ? R.ext.forEach(x => L.push(`${x.nome}: ${x.estado}${x.ultima ? ' em ' + x.ultima : ''}`)) : L.push('não verificado');
  L.push('', 'TEMPO DE PROCESSAMENTO', `Análise de um cliente: ${R.tempo.analise ?? '—'} ms` + (R.tempo.aderN ? ` · Aderência: ${R.tempo.aderMed} ms por cliente (amostra de ${R.tempo.aderN}); carteira inteira ≈ ${R.tempo.aderCarteira} ms` : ' · Aderência: não medida (sem clientes ou sem catálogo)'));
  L.push('', 'ERROS RECENTES NESTA SESSÃO'); R.erros.length ? R.erros.forEach(e => L.push(e)) : L.push('nenhum registrado');
  L.push('', 'CONEXÕES NÃO IMPLEMENTADAS'); SAU_AUSENTES.forEach(a => L.push('- ' + a)); return L.join('\n');
}
function admSaudeCard() {
  const R = SAU.rel, st = k => `<span class="pill ${SAU_ST[k][1]}">${SAU_ST[k][0]}</span>`, kp = (l, v, tone = '') => `<div class="kpi"><div class="sm muted">${l}</div><b${tone ? ` style="color:var(--${tone})"` : ''}>${v}</b></div>`;
  let h = `<div class="card" id="adm-saude"><div class="row"><h3>Saúde e integração da plataforma</h3><span class="sp"></span>${R ? '<button class="btn ghost sm" data-a="sauCopiar">Copiar relatório</button>' : ''}<button class="btn pri sm" data-a="sauDiag" ${SAU.busy ? 'disabled' : ''}>${SAU.busy ? 'Executando…' : 'Executar diagnóstico de integração'}</button></div>
  <p class="sm muted">O diagnóstico executa as conexões de verdade: grava e apaga um documento próprio de teste no banco, roda as funções dos módulos sobre um cliente que existe só na memória e lê a sua carteira sem alterá-la. Nenhum indicador é presumido: o que não pôde ser testado aparece como “não verificado”. A carteira é privada: o resultado reflete a de quem executa, não a dos demais executivos.</p>`;
  if (!R) return h + `<p class="sm" style="margin-top:8px" id="sau-vazio">Nenhum diagnóstico executado nesta sessão. ${SAU_MAPA.length} integrações entre módulos mapeadas e ${SAU_AUSENTES.length} conexões declaradas como não implementadas aguardam a execução.</p></div>`;
  const r = R.resumo, D = R.dados, conf = D ? D.linhas.filter(d => /onflito|divergente/.test(d.nome)).reduce((a, d) => a + d.n, 0) : null, desat = D ? D.linhas.filter(d => /revisar|fora do catálogo/.test(d.nome)).reduce((a, d) => a + d.n, 0) : null, pend = D ? D.linhas.find(d => /Gravações pendentes/.test(d.nome)).n : null;
  h += `<div class="grid g4" style="margin-top:10px" id="sau-kpis">${kp('Módulos (telas)', R.modulos)}${kp('Integrações mapeadas', r.mapeadas)}${kp('Operacionais', r.ok, 'ok')}${kp('Com falha', r.falha, r.falha ? 'bad' : '')}${kp('Com atenção', r.at)}${kp('Não verificadas', r.nv)}${kp('Não implementadas', r.ausentes)}${kp('Processamentos pendentes', pend ?? '—')}${kp('Dados desatualizados', desat ?? '—')}${kp('Conflitos', conf ?? '—')}${kp('Erros recentes', R.erros.length)}${kp('Tempo do diagnóstico', R.ms + ' ms')}</div>
  <div class="sm muted" style="margin-top:6px">Executado em ${esc(new Date(R.em).toLocaleString('pt-BR'))} por ${esc(R.por)}. Última sincronização do Forecast: ${D && D.fc.ligado ? esc(D.fc.ok ? new Date(D.fc.ok).toLocaleString('pt-BR') : 'nunca') + (D.fc.erro ? ' (último erro: ' + esc(D.fc.erro) + ')' : '') : 'sem planilha vinculada'}. Gravação da carteira: ${esc(D ? D.persist : '—')}.</div>
  <h4 style="margin-top:14px">Integrações entre módulos (testadas agora)</h4><div class="tw"><table id="sau-itens"><thead><tr><th>De</th><th>Para</th><th>Estado</th><th style="min-width:280px">Resultado</th><th class="num">ms</th></tr></thead><tbody>${R.itens.map(i => `<tr data-s="${i.id}"><td>${esc(i.de)}</td><td>${esc(i.para)}<div class="sm muted">${esc(i.como)}</div></td><td>${st(i.st)}</td><td class="sm">${esc(i.det)}</td><td class="num sm">${i.ms}</td></tr>`).join('')}</tbody></table></div>
  <h4 style="margin-top:14px">Dados da sua carteira <span class="muted sm">(${D ? D.clientes + ' cliente(s), só leitura' : 'não verificado'})</span></h4>${D ? `<div class="tw"><table id="sau-dados"><thead><tr><th>Verificação</th><th class="num">Ocorrências</th><th>Estado</th><th>Observação</th></tr></thead><tbody>${D.linhas.map(d => `<tr><td>${esc(d.nome)}</td><td class="num">${d.n}</td><td>${st(d.st)}</td><td class="sm muted">${esc(d.det)}</td></tr>`).join('')}</tbody></table></div>` : `<p class="sm">Não verificado: ${esc(R.erroDados)}</p>`}
  <h4 style="margin-top:14px">Tempo de processamento <span class="muted sm">(medido agora)</span></h4><p class="sm">Análise de um cliente: <b>${R.tempo.analise ?? '—'} ms</b>${R.tempo.aderN ? ` · Aderência ao Catálogo Enxoval: <b>${R.tempo.aderMed} ms</b> por cliente (amostra de ${R.tempo.aderN}); carteira inteira ≈ <b>${R.tempo.aderCarteira} ms</b>` : ' · Aderência: não medida (sem clientes ou sem catálogo)'}.</p>
  <h4 style="margin-top:14px">Erros recentes nesta sessão</h4>${R.erros.length ? `<ul class="sm">${R.erros.map(e => `<li>${esc(e)}</li>`).join('')}</ul>` : '<p class="sm muted">Nenhum erro registrado nesta sessão. Integrações externas: bloco “Integrações e Inteligência”, abaixo.</p>'}
  <details class="sm" style="margin-top:10px"><summary><b>Conexões não implementadas (${SAU_AUSENTES.length})</b></summary><ul>${SAU_AUSENTES.map(a => `<li>${esc(a)}</li>`).join('')}</ul></details></div>`;
  return h;
}
const SAU_ACT = {
  sauDiag: () => { sauDiag(); },
  sauCopiar: async () => { if (!SAU.rel) return; try { await navigator.clipboard.writeText(sauTexto(SAU.rel)); toast('Relatório copiado.'); } catch { toast('Não foi possível copiar. Selecione o texto da tela.'); } },
};
