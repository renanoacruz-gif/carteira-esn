/* ===== IMPORTAÇÃO POR LINK (TDN / enxoval de vendas), pesquisa no conteúdo e cruzamento com a carteira =====
   Limite verificado: o artefato não acessa outros hosts (CSP). A leitura da página é feita pelo backend (Worker /api/importar,
   com a credencial TDN guardada nos segredos dele); o aplicativo gera o pedido, recebe o conteúdo bruto e extrai por seções.
   Nada é inventado: o que não for encontrado fica vazio; o ambíguo fica pendente de revisão. */
const LK_HOST = /(^|\.)(totvs\.com|totvs\.com\.br)$/i;
const LK_MAX_URLS = 3;
const LK_OPT = () => (UI.lkOpt ||= { paginas: 6, anexos: 4, maxChars: 300000 });
function lkValidate(raw) {
  const urls = [...new Set(String(raw || '').split(/[\s,;]+/).map(x => x.trim()).filter(Boolean))], bad = [], ok = [];
  urls.forEach(u => { let x; try { x = new URL(u); } catch { return bad.push({ u, m: 'não é uma URL válida' }); }
    if (x.protocol !== 'https:') return bad.push({ u, m: 'use https' });
    if (!LK_HOST.test(x.hostname)) return bad.push({ u, m: 'domínio fora da lista permitida (totvs.com, totvs.com.br e subdomínios, incl. tdn.totvs.com). Anexe o material em “Importar materiais”' });
    ok.push(x.href); });
  if (ok.length > LK_MAX_URLS) { bad.push({ u: '', m: `máximo de ${LK_MAX_URLS} links por importação` }); ok.length = LK_MAX_URLS; }
  return { ok, bad };
}
async function lkImport() {
  const { ok, bad } = lkValidate(UI.lkUrls);
  if (!ok.length && !bad.length) return toast('Cole ao menos um link do TDN ou do enxoval de vendas.');
  if (bad.length) { UI.lkErr = bad; if (!ok.length) return render(); } else UI.lkErr = null;
  const O = LK_OPT(), opcoes = { paginasVinculadas: Math.max(0, Math.min(6, +O.paginas || 0)), anexos: Math.max(0, Math.min(4, +O.anexos || 0)) }; const sig = JSON.stringify(['importar_link', [...ok].sort(), opcoes]), dup = S.pesq.find(p => p.tipo === 'importar_link' && p.status === 'aguardando' && p.sig === sig);
  const req = { versao: 1, pedidoId: dup ? dup.id : 'l_' + uid(), tipo: 'importar_link', urls: ok, opcoes };
  if (!dup) { const h = hostOf(ok[0]); S.pesq.unshift({ sig, id: req.pedidoId, tipo: 'importar_link', alvo: `Importação por link: ${h}${new URL(ok[0]).pathname.slice(0, 40)}${ok.length > 1 ? ` (+${ok.length - 1})` : ''}`, at: new Date().toISOString(), status: 'aguardando', modelo: '', enviado: { urls: ok, opcoes }, resposta: null }); touchPes(req.pedidoId); }
  UI.pesqSel = req.pedidoId;
  const known = ok.map(u => S.solutions.find(r => (r.fontes || []).some(f => normUrl(f.u) === normUrl(u)))).filter(Boolean);
  log(`Pedido de importação por link gerado (${ok.length} link(s)).${known.length ? ' Já há fonte igual em: ' + known.map(r => r.nome).join('; ') + ' — a importação complementará o registro.' : ''} `, 'ok');
  UI.busy = window.__HOSTED__ ? `Importando ${ok.length} link(s)… isso pode levar alguns segundos.` : 'Lendo os links pelo backend…'; render();
  try { const r = await bkChamar('importar', req, `pedido-importar-link-${req.pedidoId}.json`); UI.busy = ''; if (r.via === 'direto') { await lkResponse(r.resp); return; } log('Pedido de importação gerado como arquivo (este ambiente não chama o backend). Execute-o no backend e importe a resposta.', 'ok'); }
  catch (e) { UI.busy = ''; log('✖ Backend: ' + e.message, 'bad'); toast(e.message); }
  render();
}
const LK_ACT = { lkImport, lkReq: t => { const rec = S.pesq.find(x => x.id === t.dataset.id); if (rec) offer(`pedido-importar-link-${rec.id}.json`, JSON.stringify({ versao: 1, pedidoId: rec.id, tipo: 'importar_link', urls: rec.enviado?.urls || [], ...(rec.enviado?.opcoes ? { opcoes: rec.enviado.opcoes } : {}) }, null, 1)); }, solCross: t => solCrossRun(t.dataset.id), lkDismiss: () => { UI.lkErr = null; render(); } };
const LK_EDIT = {
  nome: (t, v) => { const x = UI.solImp.items[+t.dataset.fi].cands[+t.dataset.ci]; v = v.trim().slice(0, 90); if (!v) return render(); x.c.nome = v; x.c.termos = [v.replace(/^TOTVS\s+/i, '')]; const d = findDups(x.c); x.dups = d.slice(0, 4).map(y => ({ id: y.rec.id, nome: y.rec.nome, score: y.score, why: y.why.join(', ') })); if (x.act === 'mesclar' && !x.dups.some(y => y.id === x.target)) { x.target = x.dups[0]?.id || ''; if (!x.target) x.act = 'criar'; } render(); },
  fin: (t, v) => { UI.solImp.items[+t.dataset.fi].cands[+t.dataset.ci].c.finalidade = v.trim().slice(0, 700); render(); }
};
const b64bytes = b => { const s = atob(b), a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; };
const LK_ERR_HINT = { autenticacao_necessaria: ' Para páginas restritas, configure o segredo TDN_COOKIE ou TDN_AUTH_HEADER no backend (veja o LEIAME) ou anexe o material em “Importar materiais” (HTML salvo da página, PDF, DOCX, PPTX).' };

async function lkBuildCand(res, dt) {
  const pages = cap(res.paginas, 7), main = pages.find(p => p.principal) || pages[0]; if (!main || !main.html) return null;
  const rep = { urlOriginal: s4(res.urlOriginal, 500), urlFinal: s4(main.u, 500), autenticado: !!res.autenticado, paginas: [], anexos: [], naoLidos: cap(res.naoLidos, 30).map(n => ({ u: s4(n.u, 300), motivo: s4(n.motivo, 160) })), omitidosCredencial: 0, inferidos: [] };
  const origem = 'importação por link' + (res.autenticado ? ' (acesso autenticado no backend)' : ''), mk = (p, via) => ({ t: s4(p.titulo, 120) || hostOf(p.u) || p.u, u: s4(p.u, 500), d: dt, origem: `${origem} • ${via}` });
  const mx = LK_OPT().maxChars, c = extractHtmlSections(s4(main.html, 2.5e6), { titulo: s4(main.titulo, 160), origem, url: main.u, maxChars: mx }); c.conteudoNovo.paginas[0].principal = true; c.conteudoNovo.paginas[0].htmlTruncado = !!main.truncado; rep.omitidosCredencial += c.imp.omitidosCredencial;
  c.fontes = [mk(main, 'página principal')]; if (res.urlOriginal && normUrl(res.urlOriginal) !== normUrl(main.u)) c.fontes.push({ t: 'Link informado (redirecionado)', u: s4(res.urlOriginal, 500), d: dt, origem: 'link original informado pelo usuário' });
  rep.paginas.push({ titulo: c.nome, u: main.u, principal: true, bytes: main.html.length, htmlTruncado: !!main.truncado, stats: c.conteudoNovo.paginas[0].stats, conteudoTruncado: c.conteudoNovo.paginas[0].truncado, n: c.funcionalidades.length + c.dores.length + c.prerequisitos.length + c.integracoes.length + c.processos.length });
  const mergeIn = (c2, label) => { const st = { n: 0 }; ['funcionalidades', 'dores', 'prerequisitos', 'processos'].forEach(k => addItems(c[k], c2[k] || [], st)); addItems(c.integracoes, c2.integracoes || [], st); c.segmentos = [...new Set([...c.segmentos, ...(c2.segmentos || [])])]; c.necessidades = [...new Set([...c.necessidades, ...(c2.necessidades || [])])]; (c2.naoClass || []).forEach(g => c.naoClass.push({ h: `${label} › ${g.h}`, itens: g.itens })); if (c2.limites && !c.limites.includes(c2.limites)) c.limites = [c.limites, c2.limites].filter(Boolean).join('; '); Object.entries(c2.extras || {}).forEach(([k, a]) => { c.extras[k] ||= []; addItems(c.extras[k], a, st); }); c.conteudoNovo.paginas.push(...(c2.conteudoNovo?.paginas || [])); return st.n; };
  for (const p of pages.filter(x => x !== main)) { if (!p.html) continue; const c2 = extractHtmlSections(s4(p.html, 2.5e6), { titulo: s4(p.titulo, 160), origem: origem + ' • página vinculada', url: p.u, maxChars: mx }); c2.conteudoNovo.paginas[0].htmlTruncado = !!p.truncado; rep.omitidosCredencial += c2.imp.omitidosCredencial; const n = mergeIn(c2, c2.nome); c.fontes.push(mk(p, 'página vinculada')); rep.paginas.push({ titulo: c2.nome, u: p.u, principal: false, bytes: p.html.length, htmlTruncado: !!p.truncado, stats: c2.conteudoNovo.paginas[0].stats, conteudoTruncado: c2.conteudoNovo.paginas[0].truncado, n }); }
  for (const a of cap(res.anexos, 5)) { const row = { nome: s4(a.nome, 120), u: s4(a.u, 500), tam: +a.tamanho || 0, aviso: '', erro: '' };
    try { if (!a.b64) throw new Error('conteúdo ausente'); const f = new File([b64bytes(a.b64)], row.nome || 'anexo'); const r = await extractSolutionsFile(f); const n = r.cands.reduce((t, c2) => { c2.funcionalidades = c2.funcionalidades.map(i => ({ ...i, o: 'importação por link (anexo)' })); c2.dores = c2.dores.map(i => ({ ...i, o: 'importação por link (anexo)' })); c2.prerequisitos = c2.prerequisitos.map(i => ({ ...i, o: 'importação por link (anexo)' })); c2.integracoes = c2.integracoes.map(i => ({ ...i, o: 'importação por link (anexo)' })); return t + mergeIn(c2, row.nome); }, 0); row.aviso = r.aviso; row.n = n; c.fontes.push({ t: row.nome, u: row.u, d: dt, origem: `${origem} • anexo da página` }); }
    catch (e) { row.erro = e.message; } rep.anexos.push(row); }
  c.nome = c.nome || 'Solução importada'; c.termos = [c.nome.replace(/^TOTVS\s+/i, '')];
  enrichFromText(c, [c.nome, c.finalidade, ...c.funcionalidades.map(x => x.t), ...c.dores.map(x => x.t), ...c.processos.map(x => x.t)].join('\n'), 'página'); c.fontes = c.fontes.filter(f => f.u || f.t);
  c.fontes = c.fontes.filter((f, i, a) => !f.u || a.findIndex(y => normUrl(y.u) === normUrl(f.u)) === i);
  if (c.imp.semNome) rep.inferidos.push('nome tirado da URL (a página não trouxe título)'); if (c.imp.tipoInferido) rep.inferidos.push('tipo atribuído por palavras do nome'); if (c.necessidades.length) rep.inferidos.push('necessidades por palavras-chave: ' + c.necessidades.map(n => NEED_LABEL[n] || n).join(', ')); if (c.segmentos.length) rep.inferidos.push('segmentos: ' + c.segmentos.map(id => segName(id) || id).join(', '));
  c.lkRep = rep; c.imp = undefined; return { c, rep };
}
async function lkResponse(j) {
  let rec = S.pesq.find(x => x.id === j.pedidoId);
  if (!rec) { rec = { id: s4(j.pedidoId, 40) || 'l_' + uid(), tipo: 'importar_link', alvo: 'Importação por link (resposta sem pedido correspondente)', at: new Date().toISOString(), status: 'aguardando', modelo: '', enviado: { urls: [] }, resposta: null }; S.pesq.unshift(rec); }
  const dt = (j.consultadoEm || '').slice(0, 10) || today(), resultados = [], items = [], errs = [];
  for (const res of cap(j.resultados, LK_MAX_URLS)) {
    const sum = { urlOriginal: s4(res.urlOriginal, 500), ok: !!res.ok, erro: res.erro ? { codigo: s4(res.erro.codigo, 40), mensagem: s4(res.erro.mensagem, 300) } : null, autenticado: !!res.autenticado };
    if (res.ok) { const b = await lkBuildCand(res, dt); if (!b) { sum.ok = false; sum.erro = { codigo: 'conteudo_nao_legivel', mensagem: 'A resposta não trouxe o conteúdo da página.' }; } else { Object.assign(sum, { paginas: b.rep.paginas, anexos: b.rep.anexos.map(a => ({ nome: a.nome, tam: a.tam, erro: a.erro })), naoLidos: b.rep.naoLidos });
      { const tr = UI.catHint && (UI.catHint[normUrl(b.rep.urlFinal)] || UI.catHint[normUrl(res.urlOriginal || '')]); /* hierarquia da fonte (fila do catálogo): só sugere, e fica visível na prévia */ if (tr && tr.length) { const nv = tr.slice(1), sug = []; if (!b.c.linha && nv[0]) { b.c.linha = s4(nv[0], 60); sug.push('linha'); } if (!b.c.categoria && nv[1]) { b.c.categoria = s4(nv[1], 60); sug.push('categoria'); } b.rep.inferidos.push('hierarquia na fonte: ' + tr.map(x => s4(x, 60)).join(' › ') + (sug.length ? ` (${sug.join(' e ')} sugerida(s) por ela)` : '')); } }
      const dups = findDups(b.c), best = dups[0]; items.push({ file: 'Link: ' + (hostOf(b.rep.urlFinal) + new URL(b.rep.urlFinal).pathname).slice(0, 70), aviso: `Conteúdo lido pelo backend em ${fmtD(dt)}${b.rep.autenticado ? ' com acesso autenticado' : ''}. Extração por seções; nada foi gravado.`, pid: rec.id, lk: b.rep,
        cands: [{ c: b.c, dups: dups.slice(0, 4).map(x => ({ id: x.rec.id, nome: x.rec.nome, score: x.score, why: x.why.join(', ') })), act: best && best.score >= .85 ? 'mesclar' : 'criar', target: best?.rec.id || '', choices: { tipo: 'depois', categoria: 'depois', linha: 'depois' } }] }); } }
    if (!sum.ok) errs.push({ file: s4(res.urlOriginal, 120) || 'Link', msg: (AI_ERR[sum.erro?.codigo] ? AI_ERR[sum.erro.codigo] + ' ' : '') + (sum.erro?.mensagem || 'Falha ao ler.') + (LK_ERR_HINT[sum.erro?.codigo] || ' Você pode anexar o material em “Importar materiais”.') });
    resultados.push(sum);
  }
  if (!resultados.length && j.erro) errs.push({ file: 'Pedido', msg: (AI_ERR[j.erro.codigo] || '') + ' ' + s4(j.erro.mensagem, 300) });
  rec.resposta = { ok: items.length > 0, erro: items.length ? null : (errs[0] ? { codigo: resultados.find(r => r.erro)?.erro?.codigo || j.erro?.codigo || 'erro', mensagem: errs[0].msg } : null), consultadoEm: s4(j.consultadoEm, 40), modelo: '', usouBuscaWeb: false, fallbackSemBusca: false, daCache: false, consultas: [], fontes: [], sugestoesBuscaHtml: [], resumo: '', semResultados: !items.length, avisos: cap(j.avisos, 6).map(x => s4(x, 300)), itens: [], resultados, importadoEm: new Date().toISOString() };
  intSet('tdn', { ok: items.length > 0, msg: items.length ? `${items.length} página(s) lida(s)` : (errs[0]?.msg || 'sem conteúdo').slice(0, 120) }); intLog({ sistema: 'tdn', op: 'importar_link', estado: items.length ? 'ok' : 'erro', msg: items.length ? '' : (errs[0]?.msg || '').slice(0, 200), n: items.length });
  rec.status = items.length ? 'em revisão' : 'falhou'; touchPes(rec.id); UI.pesqSel = rec.id;
  UI.solImp = { items: [...(UI.solImp?.items || []), ...items], errs: [...(UI.solImp?.errs || []), ...errs] }; UI.view = 'solucoes'; UI.solSel = null;
  log(items.length ? `Importação por link: ${items.length} página(s)/solução(ões) lida(s) — revise a prévia antes de incorporar.` : 'Importação por link falhou: ' + (errs[0]?.msg || 'sem conteúdo'), items.length ? 'ok' : 'bad'); render(); window.scrollTo(0, 0);
}

/* ---------- Interface ---------- */
function lkCard() {
  const pend = S.pesq.filter(p => p.tipo === 'importar_link' && p.status !== 'incorporada' && p.status !== 'descartada').slice(0, 4), be = aiCfg().backendUrl;
  return `<div class="card" style="border-left:4px solid var(--ciano)"><h3>Importar por link (TDN ou enxoval de vendas)</h3>
  <p class="sm">${window.__HOSTED__ ? `<b>Cole o link para importar o conteúdo para a Base de Soluções.</b> Aceita 1 a ${LK_MAX_URLS} links (um por linha) do TDN ou do portal/enxoval TOTVS. O servidor lê a página e os materiais vinculados; você revisa a prévia antes de gravar.` : `Cole 1 a ${LK_MAX_URLS} links (um por linha) de páginas do TDN ou do portal/enxoval TOTVS. O backend lê a página e os materiais diretamente vinculados (páginas TOTVS e anexos PDF/DOCX/PPTX/XLSX); o aplicativo extrai nome, finalidade, funcionalidades, dores, segmentos, requisitos e integrações, mostra a prévia e só grava depois da sua revisão.`}</p>
  <textarea data-i="lkurls" rows="2" style="width:100%" placeholder="https://tdn.totvs.com/x/…  (um link por linha)">${esc(UI.lkUrls || '')}</textarea>
  ${(UI.lkErr || []).map(b => `<div class="alert b sm"><b>${esc(b.u || 'Links')}</b>: ${esc(b.m)}</div>`).join('')}
  <div class="row sm" style="margin-top:6px"><b>Escopo da leitura</b><label>páginas vinculadas (0–6) <input type="number" min="0" max="6" data-c="lkopt" data-f="paginas" value="${LK_OPT().paginas}" style="width:64px"></label><label>anexos (0–4) <input type="number" min="0" max="4" data-c="lkopt" data-f="anexos" value="${LK_OPT().anexos}" style="width:64px"></label><label>volume máx. por página <select data-c="lkopt" data-f="maxChars">${[[100000, '100 mil caracteres'], [300000, '300 mil caracteres'], [800000, '800 mil caracteres']].map(([v, l]) => `<option value="${v}" ${LK_OPT().maxChars === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label><span class="muted">Só links diretos da página principal; nunca percorre o TDN inteiro.</span></div>
  <div class="row" style="margin-top:6px"><button class="btn pri" data-a="lkImport">Importar para a Base de Soluções</button>${window.__HOSTED__ ? '' : '<label class="btn ghost" style="cursor:pointer">Importar resposta do backend<input type="file" id="f-lk" accept=".json" hidden></label>'}</div>
  ${window.__HOSTED__ ? '<div class="alert i sm">Páginas que exigem login do TDN não podem ser lidas: nesse caso o aplicativo informa o motivo e você pode anexar o material (PDF, DOCX, PPTX, HTML salvo) em “Importar materiais”.</div>' : `<div class="alert i sm"><b>Como funciona neste ambiente.</b> O artefato não consegue abrir outros sites (CSP) nem guardar credenciais. O botão gera o arquivo de pedido; envie-o ao seu backend${be ? ` (<a href="${esc(be)}" target="_blank" rel="noopener noreferrer">${esc(be)}</a>)` : ' (configure em Configurações de IA)'} — a página do backend também aceita colar os links direto —, baixe a resposta e importe-a aqui. Páginas que exigem login só são lidas se o backend tiver a credencial TDN configurada (segredo <code>TDN_COOKIE</code> ou <code>TDN_AUTH_HEADER</code>); caso contrário o aplicativo informa a limitação e você pode anexar o material em “Importar materiais” (HTML salvo, PDF, DOCX, PPTX).</div>`}
  ${pend.map(p => `<div class="row sm"><b>${esc(p.alvo)}</b>${pill(p.status, p.status === 'aguardando' ? 'info' : p.status === 'falhou' ? 'bad' : 'warn')}<span class="muted">${esc(dtBR(p.at))}</span><span class="sp"></span>${p.status === 'aguardando' ? `<button class="btn ghost sm" data-a="lkReq" data-id="${p.id}">Baixar pedido de novo</button>` : ''}<button class="btn ghost sm" data-a="pesqRm" data-id="${p.id}">Remover</button></div>`).join('')}</div>`;
}
function lkRecBody(rec) {
  const r = rec.resposta; if (!r) return `<div class="alert i sm">Aguardando resposta do backend. Links enviados: ${(rec.enviado?.urls || []).map(u => `<code>${esc(u)}</code>`).join(' ')}</div>`;
  return (r.resultados || []).map(x => `<div class="sm" style="margin:4px 0"><b>${esc(x.urlOriginal)}</b> ${x.ok ? pill('lido', 'ok') : pill('não lido', 'bad')} ${x.autenticado ? pill('acesso autenticado', 'info') : ''}${x.erro ? `<div class="muted">${esc(x.erro.mensagem)}</div>` : ''}${(x.paginas || []).map(p => `<div class="muted">página: ${esc(p.titulo)} — ${esc(p.u)}</div>`).join('')}${(x.anexos || []).map(a => `<div class="muted">anexo: ${esc(a.nome)} ${a.erro ? '— erro: ' + esc(a.erro) : ''}</div>`).join('')}${(x.naoLidos || []).map(n => `<div class="muted">não lido: ${esc(n.u)} — ${esc(n.motivo)}</div>`).join('')}</div>`).join('') || '<p class="muted sm">Sem detalhes.</p>';
}
function lkPreviewBlock(x, fi, ci) {
  const c = x.c, it = UI.solImp.items[fi], rep = it.lk;
  let h = `<div class="grid g2" style="margin:6px 0"><label class="sm">Nome do cadastro (corrija se necessário)<input type="text" data-c="impNome" data-fi="${fi}" data-ci="${ci}" value="${esc(c.nome)}" maxlength="90"></label><label class="sm">Finalidade ${c.finalidade ? '' : pill('não encontrada na página', 'warn')}<textarea rows="2" data-c="impFin" data-fi="${fi}" data-ci="${ci}" placeholder="Em branco: não foi possível identificar. Preencha somente com fonte.">${esc(c.finalidade || '')}</textarea></label></div>`;
  if (!rep) return h;
  h += `<div class="sm"><b>O que foi lido</b> — ${rep.autenticado ? 'acesso autenticado (credencial do backend)' : 'acesso público'}; link informado: <code>${esc(rep.urlOriginal)}</code>${rep.urlFinal && normUrl(rep.urlFinal) !== normUrl(rep.urlOriginal) ? ` → <code>${esc(rep.urlFinal)}</code>` : ''}
  <ul style="margin:2px 0;padding-left:18px">${rep.paginas.map(p => `<li>${p.principal ? 'Página principal' : 'Página vinculada'}: ${esc(p.titulo)} <span class="muted">(${p.n} item(ns) nos campos resumidos${p.stats ? `; conteúdo integral: ${p.stats.secoes} seção(ões), ${p.stats.blocos} bloco(s), ${p.stats.tabelas} tabela(s), ${p.stats.duplicados} repetido(s) descartado(s)` : ''})</span>${p.htmlTruncado ? ' ' + pill('HTML cortado pelo limite do backend (1,5 MB)', 'bad') : ''}${p.conteudoTruncado ? ' ' + pill('conteúdo truncado: ' + p.conteudoTruncado.blocosOmitidos + ' bloco(s) omitido(s)', 'bad') : ''}</li>`).join('')}${rep.anexos.map(a => `<li>Anexo: ${esc(a.nome)} ${a.erro ? pill('erro: ' + a.erro, 'bad') : `<span class="muted">(${a.n || 0} item(ns); ${esc(a.aviso || '')})</span>`}</li>`).join('')}</ul>
  ${rep.naoLidos.length ? `<div class="alert sm"><b>Não lido (${rep.naoLidos.length})</b>: ${rep.naoLidos.slice(0, 8).map(n => `${esc(n.u)} — ${esc(n.motivo)}`).join(' • ')}${rep.naoLidos.length > 8 ? '…' : ''}. Importe esses materiais à parte ou anexe-os.</div>` : ''}
  ${rep.inferidos.length ? `<div class="alert i sm"><b>Inferido por regra simples — revise</b> (afeta as sugestões nas oportunidades): ${rep.inferidos.map(esc).join(' • ')}</div>` : ''}
  ${(c.naoClass || []).length ? `<div class="alert sm"><b>Pendente de revisão</b>: ${c.naoClass.length} seção(ões) sem classificação segura serão gravadas como pendência, sem entrar nos dados confirmados: ${c.naoClass.slice(0, 5).map(g => esc(g.h)).join(' • ')}</div>` : ''}
  ${rep.omitidosCredencial ? `<div class="alert sm">${rep.omitidosCredencial} trecho(s) com aparência de credencial foram omitidos.</div>` : ''}
  <div class="muted sm">O nome também passa a identificar produtos contratados nos textos dos clientes: prefira um nome específico do produto.</div></div>`;
  return h;
}
function lkDetailBlock(r) {
  const imps = r.importacoes || [], cr = UI.solCross?.id === r.id ? UI.solCross : null;
  let h = '';
  if (imps.length) h += `<details><summary class="sm">Importações por link (${imps.length})</summary><ul class="sm">${imps.map(i => `<li>${esc(dtBR(i.at))} • <code>${esc(i.url)}</code>${i.final && normUrl(i.final) !== normUrl(i.url) ? ' → <code>' + esc(i.final) + '</code>' : ''} • ${i.paginas.length} página(s), ${i.anexos.length} anexo(s)${i.autenticado ? ' • autenticado' : ''}${i.naoLidos.length ? ` • ${i.naoLidos.length} não lido(s)` : ''}</li>`).join('')}</ul></details>`;
  h += tdExtrasBlock(r) + tdViewer(r);
  h += `<div class="row"><button class="btn ghost sm" data-a="solCross" data-id="${r.id}">Cruzar conteúdo com a carteira</button><span class="muted sm">Procura nos textos dos clientes (observações, produtos, fichas) termos distintivos desta solução. Indício textual — não cria oportunidade sozinho.</span></div>`;
  if (cr) h += `<div class="card sm" style="margin:6px 0">${cr.erro ? `<div class="alert sm">${esc(cr.erro)}</div>` : `<b>${cr.rows.length} cliente(s) com indício textual</b> <span class="muted">(termos usados: ${cr.termos.map(esc).join(', ')}${cr.mais ? '; exibindo os 40 primeiros' : ''}; ${cr.total} cliente(s) verificados)</span><div class="tw"><table><thead><tr><th>Cliente</th><th>Termos encontrados</th><th>Trecho e origem</th><th>Situação</th></tr></thead><tbody>${cr.rows.map(x => `<tr><td><a href="#" data-a="open" data-k="${esc(x.key)}">${esc(x.name)}</a></td><td>${x.terms.map(esc).join(', ')}</td><td class="muted">${esc(x.snip)} <i>(${esc(x.src)})</i></td><td>${x.opp ? pill('já sugerida em oportunidade', 'ok') : pill('novo indício — avaliar', 'warn')}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">Nenhum cliente com 2+ termos distintivos no mesmo texto.</td></tr>'}</tbody></table></div>`}</div>`;
  return h;
}
/* ---------- Pesquisa no conteúdo e cruzamento ---------- */
const _hay = new Map();
function solContentHay(r) { const k = r.id + ':' + r.rev + ':' + (r.fontes || []).length; let v = _hay.get(k); if (v == null) { v = norm([r.finalidade, ...(r.funcionalidades || []).map(x => x.t), ...(r.dores || []).map(x => x.t), ...(r.processos || []).map(x => x.t), ...(r.prerequisitos || []).map(x => x.t), ...(r.integracoes || []).map(x => x.sistema), ...(r.materiais || []).filter(m => m.origem !== 'nota').map(m => m.texto)].join(' ')); if (_hay.size > 400) _hay.clear(); _hay.set(k, v); } return v; }
const GEN_W = new Set('sistema processo processos gestao dados informacoes informacao usuario usuarios cliente clientes funcao funcoes cadastro cadastros empresa empresas relatorio relatorios modulo modulos rotina permite possibilita totvs produto produtos solucao solucoes configuracao configuracoes parametro parametros campo campos tabela tabelas opcao opcoes versao release ambiente integracao utilizacao disponivel acesso entre sobre desta deste forma geral controle gerenciar controlar realizar utilizar documento documentos operacao operacoes funcionalidade funcionalidades protheus micro microsiga'.split(' '));
const wTok = t => norm(t).split(/[^a-z0-9]+/).filter(w => w.length >= 5 && !/^\d+$/.test(w) && !GEN_W.has(w)).map(w => w.length > 5 ? w.replace(/s$/, '') : w);
function solKeyTerms(r) {
  const own = new Set(wTok([r.nome, ...(r.termos || []), r.finalidade, ...(r.funcionalidades || []).map(x => x.t), ...(r.dores || []).map(x => x.t), ...(r.processos || []).map(x => x.t)].join(' ')));
  const df = {}; activeSols().forEach(s => { if (s.id === r.id) return; new Set(wTok([s.nome, s.finalidade, ...(s.funcionalidades || []).map(x => x.t), ...(s.dores || []).map(x => x.t)].join(' '))).forEach(w => df[w] = (df[w] || 0) + 1); });
  return [...own].filter(w => (df[w] || 0) <= 2);
}
function solCrossRun(id) {
  const r = S.solutions.find(x => x.id === id); if (!r) return; const terms = solKeyTerms(r), cs = Object.values(S.clients);
  if (terms.length < 4) { UI.solCross = { id, erro: `Conteúdo insuficiente para cruzar com segurança (${terms.length} termo(s) distintivo(s)). Importe ou cadastre mais funcionalidades/dores com fonte.` }; return render(); }
  const set = new Set(terms), rows = [];
  cs.forEach(c => { let best = null; corpus(c).forEach(p => { const hit = new Map(); for (const m of String(p.t).matchAll(/[A-Za-zÀ-ÿ0-9]+/g)) { const ws = wTok(m[0]); const w = ws[0]; if (w && set.has(w) && !hit.has(w)) hit.set(w, m.index); } if (hit.size >= 2 && (!best || hit.size > best.terms.length)) best = { terms: [...hit.keys()], snip: snippet(p.t, Math.min(...hit.values())), src: p.src }; });
    if (best) rows.push({ key: c.key, name: c.name, ...best, opp: (c.opps || []).some(o => o.sols.some(s => s.id === id)) }); });
  rows.sort((a, b) => b.terms.length - a.terms.length || Number(a.opp) - Number(b.opp)); UI.solCross = { id, termos: terms.slice(0, 20), total: cs.length, mais: rows.length > 40, rows: rows.slice(0, 40) }; render();
}

/* ---------- Motor: oportunidades por conteúdo da Base de Soluções ---------- */
/* Índice de termos distintivos do CORPO da solução (finalidade, funcionalidades, dores, processos), sem os termos do nome
   (citar o nome é identificação de produto, não necessidade). Termo presente em mais de 2 outras soluções não é distintivo. */
let _stc = null, _stsig = '';
function solTermIdx() {
  const sig = S.solutions.map(s => s.id + ':' + s.rev + (s.arquivado ? 'x' : '')).join(',');
  if (_stc && _stsig === sig) return _stc;
  const act = activeSols(), T = new Map(act.map(s => [s.id, { name: new Set(wTok([s.nome, ...(s.termos || [])].join(' '))), body: new Set(wTok(solBodyTxt(s))) }])), df = {};
  T.forEach(t => new Set([...t.name, ...t.body]).forEach(w => df[w] = (df[w] || 0) + 1));
  _stc = new Map(act.map(s => { const t = T.get(s.id); return [s.id, { s, terms: new Set([...t.body].filter(w => !t.name.has(w) && (df[w] || 0) <= 3)) }]; })); _stsig = sig; return _stc;
}
const solBodyTxt = s => [s.finalidade, ...(s.funcionalidades || []).map(x => x.t), ...(s.dores || []).map(x => x.t), ...(s.processos || []).map(x => x.t), ...(s.materiais || []).filter(m => m.origem !== 'nota').map(m => m.texto)].join(' ');
const solNameKey = s => String(s.nome || s.id || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/^totvs\s+/, '').replace(/[^a-z0-9]/g, '') || String(s.id);
function solContentOpps(c) {
  const cfg = CFG.solOpp, idx = solTermIdx(), parts = corpus(c), have = new Set((c.productsIdent || []).map(p => p.id)), covered = new Set((c.opps || []).flatMap(o => (o.sols || []).map(s => s.id))), found = [];
  if (!parts.length) return [];
  const og = {}, toks = parts.map(p => { const m = new Map(); for (const x of String(p.t).matchAll(/[A-Za-zÀ-ÿ0-9]+/g)) { const w = wTok(x[0])[0]; if (w && !m.has(w)) { m.set(w, x.index); og[w] ||= x[0].toLowerCase(); } } return m; });
  idx.forEach(({ s, terms }) => {
    if (terms.size < cfg.minTermsSol || have.has(s.id) || covered.has(s.id)) return;
    let best = null; const srcs = new Set(), all = new Set();
    toks.forEach((m, i) => { const hit = [...m.keys()].filter(w => terms.has(w)); if (hit.length >= cfg.minTerms) { srcs.add(parts[i].src); hit.forEach(w => all.add(w)); if (!best || hit.length > best.terms.length) best = { terms: hit.map(w => og[w]), snip: snippet(parts[i].t, Math.min(...hit.map(w => m.get(w)))), src: parts[i].src }; } });
    if (best) found.push({ s, best, srcs: [...srcs], all: [...all], og });
  });
  found.sort((a, b) => (b.all.length - a.all.length) || String(a.s.id).localeCompare(String(b.s.id)));
  const grp = new Map(); found.forEach(f => { const k = solNameKey(f.s); (grp.get(k) || grp.set(k, []).get(k)).push(f); }); /* registros repetidos da mesma solução ocupam UMA vaga; unifyOpps os une preservando decisões */
  return [...grp.values()].slice(0, cfg.max).flat().map(({ s, best, srcs, all, og }) => {
    const itens = [...(s.dores || []).map(x => ({ k: 'dor', t: x.t })), ...(s.funcionalidades || []).map(x => ({ k: 'funcionalidade', t: x.t })), ...(s.processos || []).map(x => ({ k: 'processo', t: x.t }))].filter(it => wTok(it.t).some(w => all.includes(w))).slice(0, 2);
    const fonte = (s.fontes || [])[0], l = solLegacy(s), dq = dataQuality(c);
    const o = mkOpp(c, { ruleId: 'sol_' + s.id, tipo: 'Expansão', tipoBase: 'Expansão', nome: `Aderência a "${s.nome}" (conteúdo da Base de Soluções)`, modo: 'evidencia',
      problema: `HIPÓTESE DE NECESSIDADE com indício textual: o texto do cliente usa ${all.length} termo(s) que a Base de Soluções documenta para "${s.nome}" — correspondência por palavras, não confirma necessidade.`,
      impacto: 'HIPÓTESE: impacto não quantificado (sem estimativa de receita; preços não inventados).',
      evInd: [{ cls: 'FATO', text: `Termos "${best.terms.slice(0, 5).join('", "')}" em: …${best.snip}…`, src: best.src }],
      sols: [l], extraBase: [s.id], natureza: ['INDÍCIO TEXTUAL'], deps: (s.prerequisitos || []).map(p => p.t).slice(0, 4), perg: itens.length ? itens.map(it => `O cliente enfrenta hoje: "${it.t}"? (${it.k} documentada na solução)`) : ['O cliente reconhece o cenário descrito na solução?'],
      acao: 'Confirmar com o cliente se o cenário documentado na solução existe e validar aderência com especialista antes de propor.', origens: ['conteúdo da base'],
      solEvid: { mat: smHits(s, [...all], og), id: s.id, nome: s.nome, termos: all.slice(0, 8).map(w => og[w]), itens, fonte: fonte ? { t: fonte.t, u: fonte.u, d: fonte.d } : null, status: s.status || '' } },
      { evidencia: srcs.length >= 2 ? 3 : all.length >= 4 ? 2 : 1, aderencia: l.integraProtheus === true ? 3 : l.integraProtheus === false ? 1 : 2, impacto: 1, urgencia: 0, viabilidade: Math.min(3, (l.integraProtheus === true ? 1 : 0) + (dq >= 1 ? 1 : 0)), dados: dq });
    return o;
  });
}

/* ---------- OCR opcional (material de produto escaneado; texto vem do backend/IA) ---------- */
async function ocrResponse(j) {
  if (!j.ok || typeof j.texto !== 'string') { const m = (AI_ERR[j.erro?.codigo] ? AI_ERR[j.erro.codigo] + ' ' : '') + s4(j.erro?.mensagem, 300); log('✖ OCR: ' + (m || 'resposta sem texto'), 'bad'); toast('OCR falhou: ' + (m || 'sem texto')); return render(); }
  let omit = 0; const lines = j.texto.slice(0, 200000).split(/\r?\n/).filter(l => { if (SECRET_RE.test(l)) { omit++; return false; } return true; });
  const nome = (s4(j.nome, 100) || 'material').replace(/\.[^.]+$/, '') + ' (OCR).txt', file = new File([lines.join('\n')], nome, { type: 'text/plain' });
  const antes = (UI.solImp?.items || []).length; await solImportFiles([file]);
  const novos = (UI.solImp?.items || []).slice(antes), dt = (j.consultadoEm || '').slice(0, 10) || today();
  novos.forEach(it => { it.aviso = `Texto obtido por OCR com IA no backend (${s4(j.modelo, 40)}, ${fmtD(dt)}) — pode ter erros de leitura; confira. ${(j.avisos || []).map(a => s4(a, 200)).join(' ')}${omit ? ` ${omit} linha(s) omitida(s) por parecerem credenciais.` : ''}`; it.cands.forEach(x => (x.c.fontes || []).forEach(f => { f.origem = (f.origem || 'upload') + ' • OCR por IA (conferir)'; })); });
  log(`OCR importado: ${lines.length} linha(s). Revise a prévia na Base de Soluções.`, 'ok'); UI.view = 'solucoes'; UI.solSel = null; render(); window.scrollTo(0, 0);
}
