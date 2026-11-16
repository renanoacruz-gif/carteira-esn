/* ===== CATÁLOGO ENXOVAL (referência somente leitura) =====
   Origem: pacote importado pelo administrador (Enxoval de Vendas + fichas técnicas públicas de produtos.totvs.com), guardado no servidor.
   Nada aqui entra na Base de Soluções sozinho: o executivo "traz" um produto como RASCUNHO PRIVADO e valida. O que a fonte não documenta
   aparece como NÃO CONFIRMADO — nunca é preenchido por suposição. O nível diz quanto há documentado: ficha | portal | enxoval | inativo. */
const ENX = { idx: null, meta: null, t: 0, busy: false, det: {}, detBusy: '', err: '' };
const ENX_SEG = { manufatura: ['Manufatura', 'manufatura'], varejo: ['Varejo', 'varejo'], construcao: ['Construção', 'construcao'], distribuicao: ['Distribuição', 'distribuicao'], logistica: ['Logística', 'logistica_seg'], agro: ['Agro', 'agro'], saude: ['Saúde', 'saude'], educacional: ['Educacional', 'educacional'], hotelaria: ['Hotelaria', 'hospitalidade'], juridico: ['Jurídico', 'juridico'], 'prestadores-de-servicos': ['Prestadores de Serviços', 'servicos'] };
const ENX_NV = { ficha: ['Ficha técnica', 'ok'], portal: ['Só descrição', 'info'], enxoval: ['Só materiais', 'warn'], inativo: ['Inativo no Enxoval', 'off'] };
const ENX_SELO = { E: ['Externo', 'ok'], I: ['Interno', 'info'], C: ['Interno confidencial', 'bad'], '?': ['Sem selo', 'off'] };
/* o que o motor de aderência precisa e a ficha pode ou não trazer: cada item é procurado nos TÍTULOS das seções */
const ENX_TOPICOS = [['Funcionalidades e processos', /funcionalid|processo|recurso|m[óo]dulo/i], ['Benefícios', /benef|vantag/i], ['Setores atendidos', /setor|segment|para quem|p[úu]blico/i], ['Integrações', /integra/i], ['Modelo de contratação', /contrata|licen|plano/i], ['Requisitos e compatibilidade', /requisit|compatib/i]];
const enxSegs = s => s === '*' ? ['*'] : String(s || '').split(',').filter(Boolean), enxSegNome = k => k === '*' ? 'Todos os segmentos' : (ENX_SEG[k] || [k])[0];
async function enxCarregar(forcar) {
  if (!window.__HOSTED__ || ENX.busy || (!forcar && ENX.idx && Date.now() - ENX.t < 600000)) return; ENX.busy = true; ENX.err = '';
  try { const r = await fetch('/api/enxoval', { credentials: 'same-origin', cache: 'no-store', redirect: 'manual' }); const j = r.ok ? await r.json() : null; if (j && j.ok) { ENX.idx = Array.isArray(j.itens) ? j.itens : []; ENX.meta = j.meta || null; ENX.pesos = j.pesos || null; ENX.hay = null; ENX.t = Date.now(); } else ENX.err = 'Não foi possível carregar o catálogo.'; }
  catch { ENX.err = 'Sem conexão com o servidor. O catálogo volta quando a conexão voltar.'; } finally { ENX.busy = false; if (UI.view === 'portfolio' || UI.view === 'cliente') render(); }
}
async function enxAbrir(id) {
  const U = ptUI(); U.esel = id; adUI().cmais = 0; if (ENX.det[id] || ENX.detBusy === id) return render(); ENX.detBusy = id; render();
  try { const r = await fetch('/api/enxoval?id=' + encodeURIComponent(id), { credentials: 'same-origin', cache: 'no-store', redirect: 'manual' }); const j = r.ok ? await r.json() : null; if (j && j.ok && j.produto) ENX.det[id] = j.produto; else toast('Produto não encontrado no catálogo importado.'); }
  catch { toast('Sem conexão com o servidor.'); } finally { ENX.detBusy = ''; if (UI.view === 'portfolio') render(); }
}
const enxNaBase = nome => { const k = normName(nome); return S.solutions.find(r => !r.arquivado && normName(r.nome) === k) || null; };
function enxAbas() { if (!window.__HOSTED__) return ''; const U = ptUI(), b = (k, t) => `<button class="btn sm ${(U.aba || 'base') === k ? 'pri' : 'ghost'}" data-a="enxAba" data-k="${k}">${esc(t)}</button>`; return `<div class="row" id="pt-abas" style="gap:6px;margin-bottom:10px" role="tablist">${b('base', 'Minha Base de Soluções')}${b('enx', 'Catálogo Enxoval' + (ENX.meta ? ` (${ENX.meta.total})` : ''))}</div>`; }
function enxFiltrar() {
  const U = ptUI(), ws = norm(U.eq || '').split(/\s+/).filter(Boolean);
  const res = (ENX.idx || []).filter(p => (!U.eseg || enxSegs(p.seg).includes(U.eseg)) && (!U.env || p.nivel === U.env) && (!ws.length || (h => ws.every(w => h.includes(w)))(norm(`${p.nome} ${p.grupo || ''} ${p.linha || ''}`))));
  if (!ws.length) return res; const noNome = p => { const n = norm(p.nome); return ws.every(w => n.includes(w)) ? 0 : 1; }; return res.sort((a, b) => noNome(a) - noNome(b) || a.nome.localeCompare(b.nome, 'pt')); /* quem tem as palavras no nome vem antes de quem só casa pela família */
}
function enxView() {
  const U = ptUI(); enxCarregar(); if (U.esel) return enxFicha(U.esel);
  if (!ENX.idx) return `<div class="card"><h3>Catálogo Enxoval</h3><p class="sm muted">${esc(ENX.err || 'Carregando…')}</p></div>`;
  if (!ENX.meta) return '<div class="card" id="enx-vazio"><h3>Catálogo Enxoval</h3><p class="sm">Nenhum catálogo importado ainda. O administrador importa o pacote no Painel Administrador; até lá, use a sua Base de Soluções.</p></div>';
  const res = enxFiltrar(), POR = 50, pags = Math.max(1, Math.ceil(res.length / POR)); if ((U.epag || 0) >= pags) U.epag = 0; const pg = U.epag || 0, cnt = k => ENX.idx.filter(p => p.nivel === k).length, opt = (v, t, cur) => `<option value="${esc(v)}" ${(cur || '') === v ? 'selected' : ''}>${esc(t)}</option>`;
  const segs = ['*', ...Object.keys(ENX_SEG).sort((a, b) => enxSegNome(a).localeCompare(enxSegNome(b), 'pt'))];
  return `<div class="card" id="enx"><h3>Catálogo Enxoval <span class="muted sm">(${ENX.meta.total} produto(s) • coletado em ${esc(fmtD(ENX.meta.coletadoEm))})</span></h3>
  <p class="sm muted">Referência do Enxoval de Vendas e das fichas técnicas públicas. <b>${cnt('ficha')}</b> com ficha técnica, <b>${cnt('portal')}</b> só com descrição, <b>${cnt('enxoval')}</b> só com materiais, <b>${cnt('inativo')}</b> inativos. O que a fonte não documenta aparece como <b>não confirmado</b>. Para usar um produto nas análises, traga-o para a sua Base e valide.</p>
  <div class="row" style="gap:8px;flex-wrap:wrap"><input type="text" data-i="enxq" value="${esc(U.eq || '')}" placeholder="Buscar por nome, família ou linha" style="min-width:260px;flex:1"><select data-c="enxseg" aria-label="Segmento">${opt('', 'Todos os segmentos', U.eseg)}${segs.map(k => opt(k, k === '*' ? 'Atende todos os segmentos' : enxSegNome(k), U.eseg)).join('')}</select><select data-c="enxnv" aria-label="Documentação">${opt('', 'Qualquer documentação', U.env)}${Object.keys(ENX_NV).map(k => opt(k, ENX_NV[k][0], U.env)).join('')}</select></div>
  ${res.length ? `<div class="tw" style="margin-top:10px"><table><thead><tr><th style="min-width:230px">Produto</th><th>Segmentos</th><th>Linha</th><th>Documentação</th><th class="num">Materiais</th><th>Na sua Base</th><th></th></tr></thead><tbody>${res.slice(pg * POR, pg * POR + POR).map(p => { const ss = enxSegs(p.seg); return `<tr><td><b>${esc(p.nome)}</b>${p.grupo ? `<div class="sm muted">${esc(p.grupo)}</div>` : ''}</td><td class="sm">${esc(ss.slice(0, 3).map(enxSegNome).join(', ') + (ss.length > 3 ? ` +${ss.length - 3}` : ''))}</td><td class="sm">${esc(p.linha || '—')}</td><td>${pill(ENX_NV[p.nivel]?.[0] || p.nivel, ENX_NV[p.nivel]?.[1] || 'off')}</td><td class="num">${p.nmat}</td><td>${enxNaBase(p.nome) ? pill('já está', 'ok') : '<span class="muted sm">não</span>'}</td><td><button class="btn sm ghost" data-a="enxAbrir" data-id="${esc(p.id)}">Abrir</button></td></tr>`; }).join('')}</tbody></table></div>
  <div class="row" style="gap:8px;margin-top:8px"><button class="btn sm ghost" data-a="enxPag" data-d="-1" ${pg > 0 ? '' : 'disabled'}>Anterior</button><span class="sm muted">Página ${pg + 1} de ${pags} · ${res.length} resultado(s)</span><button class="btn sm ghost" data-a="enxPag" data-d="1" ${pg + 1 < pags ? '' : 'disabled'}>Próxima</button></div>` : '<p class="sm muted" style="margin-top:10px">Nenhum produto com esses filtros.</p>'}</div>`;
}
function enxTopicos(p) { const hs = (p.sec || []).map(s => s[1]); return ENX_TOPICOS.map(([t, re]) => [t, hs.some(h => re.test(h))]); }
function enxFicha(id) {
  const p = ENX.det[id], volta = '<button class="btn ghost sm" data-a="enxVoltar">‹ Voltar ao catálogo</button>';
  if (!p) return `<div class="card">${volta}<p class="sm muted" style="margin-top:8px">${ENX.detBusy === id ? 'Carregando…' : 'Produto indisponível.'}</p></div>`;
  const nv = ENX_NV[p.nv] || [p.nv, 'off'], na = enxNaBase(p.n), tp = enxTopicos(p), link = (u, t) => u ? `<a class="btn ghost sm" href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(t)}</a>` : '';
  let h = `<div class="card" id="enx-ficha">${volta}<h3 style="margin-top:10px">${esc(p.n)} ${pill(nv[0], nv[1])}${p.lin ? ' ' + pill('Linha ' + p.lin, 'info') : ''}</h3>
  <p class="sm muted">${esc((p.todos ? ['Atende todos os segmentos'] : p.seg.map(enxSegNome)).join(' • ') || 'Segmento não informado')}${p.g ? ' — família ' + esc(p.g) : ''} • coletado em ${esc(fmtD(ENX.meta?.coletadoEm || ''))}</p>
  ${p.d ? `<p>${esc(p.d)}</p>` : '<p class="sm muted">Descrição: <b>não confirmada</b> (a fonte pública não traz).</p>'}
  <div class="row" style="gap:6px;flex-wrap:wrap">${link(p.uf, 'Abrir ficha técnica')}${link(p.up, 'Abrir Portal de Produtos')}${link(p.ue, 'Abrir no Enxoval (exige login)')}<span class="sp"></span>${na ? pill('já está na sua Base', 'ok') : p.nv === 'inativo' ? '' : `<button class="btn pri sm" data-a="enxTrazer" data-id="${esc(p.id)}">Trazer para a minha Base (rascunho)</button>`}</div></div>`;
  h += `<div class="card"><h3>O que a fonte documenta</h3><div class="row" style="gap:6px;flex-wrap:wrap" id="enx-topicos">${tp.map(([t, ok]) => pill(t + (ok ? '' : ': não confirmado'), ok ? 'ok' : 'warn')).join('')}</div>
  ${p.nv === 'ficha' ? `<p class="sm muted" style="margin-top:8px">Trecho inicial de cada seção da ficha técnica pública (limite de 700 caracteres por seção). Para o texto completo, abra a ficha.</p>${p.sec.map(s => `<div style="margin:${s[0] <= 2 ? '14px' : '8px'} 0 0 ${Math.max(0, s[0] - 2) * 14}px">${s[1] ? `<div class="${s[0] <= 2 ? '' : 'sm'}"><b>${esc(s[1])}</b></div>` : ''}${s[2] ? `<div class="sm">${esc(s[2])}</div>` : ''}</div>`).join('')}` : `<p class="sm" style="margin-top:8px">${p.nv === 'inativo' ? 'O produto aparece no Enxoval como inativo: não há página nem materiais.' : 'Não há ficha técnica pública lida para este produto. Funcionalidades, benefícios, integrações e requisitos estão <b>não confirmados</b>; consulte os materiais abaixo.'}</p>`}</div>`;
  h += `<div class="card"><h3>Materiais no Enxoval <span class="muted sm">(${p.mat.length})</span></h3>${p.mat.length ? `<p class="sm muted">Só título, selo e link — o conteúdo dos materiais não foi lido. Materiais internos exigem seu login TOTVS e não devem ser repassados a clientes.</p><div class="tw"><table><thead><tr><th>Material</th><th>Selo no Enxoval</th><th></th></tr></thead><tbody>${p.mat.map(m => `<tr><td>${esc(m[0])}</td><td>${pill((ENX_SELO[m[1]] || ENX_SELO['?'])[0], (ENX_SELO[m[1]] || ENX_SELO['?'])[1])}</td><td>${m[2] ? `<a href="${esc(m[2])}" target="_blank" rel="noopener noreferrer">Abrir</a>` : '<span class="muted sm">sem link</span>'}</td></tr>`).join('')}</tbody></table></div>` : '<p class="sm muted">Nenhum material listado.</p>'}</div>`;
  return h + adClientesCard(id);
}
/* rascunho PRIVADO na Base: só o que a ficha documenta, cada item com a seção de origem; o resto fica declarado como não confirmado */
function enxParaSol(p, coletadoEm) {
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(coletadoEm || '') ? coletadoEm : today(), func = []; let dentro = false;
  for (const s of p.sec || []) { if (s[0] <= 2) dentro = ENX_TOPICOS[0][1].test(s[1]); else if (dentro && s[1] && func.length < 25) func.push({ t: (s[1] + (s[2] ? ': ' + s[2] : '')).slice(0, 320), o: 'Catálogo Enxoval — ficha técnica', f: 'Ficha técnica (produtos.totvs.com)', loc: s[1] }); }
  const falta = enxTopicos(p).filter(x => !x[1]).map(x => x[0].toLowerCase());
  const r = newSol({ nome: p.n, tipo: 'produto', categoria: p.g || '', linha: p.lin || '', segmentos: (p.seg || []).map(k => (ENX_SEG[k] || [])[1]).filter(Boolean), finalidade: p.d || '', funcionalidades: func, origem: 'Catálogo Enxoval', _priv: true, status: 'NECESSITA VALIDAÇÃO', oficial: false,
    obs: `Rascunho trazido do Catálogo Enxoval (coleta de ${fmtD(dia)}). NÃO CONFIRMADO na fonte pública: ${falta.length ? falta.join('; ') : 'nenhum tópico ausente'}. Compatibilidade com a linha do cliente e condições comerciais exigem validação antes de qualquer proposta.` });
  r.fontes = [[p.uf, 'Ficha técnica — ' + p.n], [p.up, 'Portal de Produtos — ' + p.n], [p.ue, 'Enxoval de Vendas — ' + p.n]].filter(x => x[0]).map(([u, t]) => ({ t, u, d: dia, origem: 'Catálogo Enxoval' }));
  return r;
}
const ENX_ACT = {
  enxAba: t => { const U = ptUI(); U.aba = t.dataset.k; U.esel = ''; U.sel = ''; render(); },
  enxAbrir: t => enxAbrir(t.dataset.id), enxVoltar: () => { ptUI().esel = ''; render(); }, enxPag: t => { const U = ptUI(); U.epag = Math.max(0, (U.epag || 0) + (+t.dataset.d || 0)); render(); },
  enxTrazer: t => { const p = ENX.det[t.dataset.id]; if (!p || p.nv === 'inativo') return; if (enxNaBase(p.n)) return toast('Este produto já está na sua Base.'); const r = enxParaSol(p, ENX.meta?.coletadoEm); hist(r, 'criado', 'Rascunho trazido do Catálogo Enxoval (não validado)'); S.solutions.push(r); solChanged(r, 'criado'); render(); toast('Rascunho privado criado na sua Base. Revise e valide antes de usar.'); }
};
function enxChange(t, c, v) { const U = ptUI(); if (c === 'enxseg') { U.eseg = v; U.epag = 0; render(); return true; } if (c === 'enxnv') { U.env = v; U.epag = 0; render(); return true; } return false; }
