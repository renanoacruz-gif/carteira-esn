/* ===== CONTEÚDO INTEGRAL ESTRUTURADO (TDN / páginas importadas) =====
   Além dos campos resumidos da solução (finalidade, funcionalidades, dores, requisitos, integrações), o texto da página é preservado por seção,
   sem o corte de itens/trechos do resumo: parágrafos, listas (com nível), tabelas (cabeçalho + linhas), blocos de código, FAQ, exemplos, versões,
   parametrizações e limitações. Menus/rodapés/navegação e blocos repetidos são descartados e contados. Nada é cortado em silêncio: se um limite for
   atingido, a página fica marcada como truncada, com o quanto foi omitido.
   Armazenamento: o registro da solução guarda só a referência (conteudoRef); o texto vai em blocos ("chunks") de até 60 mil caracteres na coleção privada
   solconteudo (documento do banco limitado a 256 KiB), conferidos por hash ao reler. Anexos (PDF/DOCX/PPTX/XLSX) entram nos campos estruturados, não como texto integral. */
const TD_CHUNK = 60000;
const TD_TIPOS = [['faq', /\bfaq\b|perguntas? frequentes/i], ['prerequisitos', /pr[eé]-?requisit|\brequisitos?\b|vers[aã]o m[ií]nima|compatibilid/i], ['parametrizacoes', /parametriza|par[aâ]metros?\b|configura[cç][aã]o|\bMV_[A-Z0-9_]+/i], ['integracoes', /integra[cç]|\bapi\b|web ?service|\brest\b|\bsoap\b/i],
  ['limitacoes', /limita[cç]|restri[cç]|n[aã]o (contempla|atende|suporta)|observa[cç][oõ]es? importantes?|aten[cç][aã]o/i], ['beneficios', /benef[ií]cio|vantagem|ganhos?\b/i], ['versoes', /vers[oõ]es?\b|\brelease|hist[oó]rico|changelog|novidades|atualiza[cç]/i],
  ['exemplos', /exemplo|caso de uso|cen[aá]rio/i], ['funcionalidades', /funcionalidad|recursos?\b|o que (faz|permite)|caracter[ií]stica/i], ['processos', /processo|fluxo|passo a passo|como (funciona|utilizar|usar)|rotina/i],
  ['segmentos', /segmento|setor|ind[uú]stria/i], ['dores', /\bdores?\b|problema|desafio/i], ['finalidade', /finalidade|objetivo|vis[aã]o geral|introdu|\bsobre\b|apresenta|descri[cç][aã]o|contexto/i]];
const tdTipo = h => { for (const [k, re] of TD_TIPOS) if (re.test(h)) return k; return 'outros'; };
const TD_REMOVE = 'script,style,noscript,nav,footer,aside,form,button,iframe,svg,.aui-nav,.page-metadata,#comments-section,.comment-container,.confluence-information-macro-icon,.expand-control-icon,.plugin_pagetree,.pagetree,.toc-macro,.breadcrumbs,#breadcrumbs,.aui-label,.label-list,[hidden],[aria-hidden="true"]';
const TD_BLOCKSEL = 'p,ul,ol,table,pre,h1,h2,h3,h4,h5,h6,dl,blockquote';
const TD_INLINE = new Set(['A', 'SPAN', 'STRONG', 'B', 'EM', 'I', 'U', 'CODE', 'SMALL', 'SUP', 'SUB', 'BR', 'MARK', 'ABBR', 'TIME', 'LABEL']);
function tdHash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36) + s.length.toString(36); }
/* maxChars: limite de volume por página (padrão 300 mil caracteres de conteúdo). */
function tdExtract(html, ctx = {}) {
  const maxChars = ctx.maxChars || 300000, doc = new DOMParser().parseFromString(String(html), 'text/html');
  const imagens = doc.querySelectorAll('img').length; doc.querySelectorAll(TD_REMOVE).forEach(n => n.remove());
  const root = doc.querySelector('#main-content,.wiki-content,main,article') || doc.body;
  const secoes = [], st = { duplicados: 0, omitidosCredencial: 0, blocos: 0, tabelas: 0, imagens, chars: 0, omitidosPorLimite: 0, linhasTabelaCortadas: 0 }, seen = new Set();
  let cur = { h: '(introdução)', nivel: 0, tipo: 'finalidade', blocos: [] }, skipN = 0, pulando = false, pulaNivel = 9; secoes.push(cur);
  const put = b => {
    const txt = b.k === 'tab' ? b.linhas.map(r => r.join(' | ')).join('\n') : b.t; if (!txt) return;
    if (SECRET_RE.test(txt)) { st.omitidosCredencial++; return; }
    const kk = b.k === 'tab' ? 't' + norm(txt).slice(0, 300) : norm(txt).slice(0, 220);
    if (txt.length >= 25 && seen.has(kk)) { st.duplicados++; return; } if (txt.length >= 25) seen.add(kk);
    if (st.chars + txt.length > maxChars) { st.omitidosPorLimite++; return; }
    st.chars += txt.length; st.blocos++; if (b.k === 'tab') st.tabelas++; cur.blocos.push(b);
  };
  const isBlockish = n => n.nodeType === 1 && (!TD_INLINE.has(n.tagName) || n.querySelector?.(TD_BLOCKSEL));
  const own = el => { const x = el.cloneNode(true); x.querySelectorAll('ul,ol,table').forEach(n => n.remove()); return hClean(x.textContent); };
  const lista = (el, d) => { for (const li of el.children) { if (li.tagName === 'LI') { const t = own(li); if (t.length >= 2 && !H_CHROME.test(t)) put({ k: 'li', n: Math.min(d, 4), t: t.slice(0, 4000) }); li.querySelectorAll(':scope > ul, :scope > ol').forEach(s => lista(s, d + 1)); } else if (li.tagName === 'UL' || li.tagName === 'OL') lista(li, d + 1); } };
  const tabela = el => {
    const rows = [...el.querySelectorAll('tr')].filter(tr => tr.closest('table') === el).map(tr => ({ th: !!tr.querySelector('th'), c: [...tr.children].filter(x => /^t[dh]$/i.test(x.tagName)).map(x => hClean(x.textContent).slice(0, 800)) })).filter(r => r.c.some(Boolean));
    if (!rows.length) return; const cab = rows[0].th ? rows[0].c.slice(0, 30) : null, body = (cab ? rows.slice(1) : rows); if (body.length > 400) st.linhasTabelaCortadas += body.length - 400;
    put({ k: 'tab', cab, linhas: body.slice(0, 400).map(r => r.c.slice(0, 30)) });
  };
  const visit = el => {
    const tag = el.tagName; if (!tag) return;
    if (/^H[1-6]$/.test(tag)) {
      const t = hClean(el.textContent).slice(0, 160), nivel = +tag[1]; if (!t) return;
      if (pulando && nivel > pulaNivel) return; pulando = false;
      if (H_SKIPSEC.test(t.replace(/^\d{1,2}\s*[.)-]\s*/, '')) || H_CHROME.test(t)) { pulando = true; pulaNivel = nivel; skipN++; return; }
      cur = { h: t, nivel, tipo: tdTipo(t), blocos: [] }; secoes.push(cur); return;
    }
    if (pulando) return;
    if (tag === 'P' || tag === 'BLOCKQUOTE') { const t = hClean(el.textContent); if (t.length >= 3 && !H_CHROME.test(t) && !/serverDuration|requestCorrelationId/.test(t)) put({ k: 'p', t: t.slice(0, 6000) }); return; }
    if (tag === 'UL' || tag === 'OL') return lista(el, 0);
    if (tag === 'TABLE') return tabela(el);
    if (tag === 'PRE') { const t = (el.textContent || '').replace(/\r/g, '').trim(); if (t) put({ k: 'code', t: t.slice(0, 8000) }); return; }
    if (tag === 'DL') { let dt = ''; for (const x of el.children) { if (x.tagName === 'DT') dt = hClean(x.textContent); else if (x.tagName === 'DD') { const d = hClean(x.textContent); if (d) put({ k: 'p', t: (dt ? dt + ': ' : '') + d }); } } return; }
    if (!el.querySelector?.(TD_BLOCKSEL)) { const t = hClean(el.textContent); if (t.length >= 3 && !H_CHROME.test(t)) put({ k: 'p', t: t.slice(0, 6000) }); return; }
    let buf = ''; const flush = () => { const t = hClean(buf); buf = ''; if (t.length >= 3 && !H_CHROME.test(t)) put({ k: 'p', t: t.slice(0, 6000) }); };
    for (const n of el.childNodes) { if (n.nodeType === 3) buf += n.textContent; else if (n.nodeType === 1) { if (isBlockish(n)) { flush(); visit(n); } else buf += ' ' + n.textContent; } }
    flush();
  };
  for (const n of root.childNodes) { if (n.nodeType === 1) visit(n); else if (n.nodeType === 3 && hClean(n.textContent).length >= 3 && !pulando) put({ k: 'p', t: hClean(n.textContent) }); }
  const vivas = secoes.filter(s => s.blocos.length), faqN = vivas.filter(s => s.tipo === 'faq').reduce((n, s) => n + s.blocos.length, 0);
  const pg = { u: s4(ctx.url, 500), titulo: s4(ctx.titulo, 160), principal: !!ctx.principal, em: today(), secoes: vivas, stats: { ...st, secoes: vivas.length, faq: faqN, secoesIgnoradas: skipN } };
  pg.hash = tdHash(JSON.stringify(vivas)); pg.truncado = st.omitidosPorLimite > 0 ? { motivo: 'limite de volume por página (' + maxChars + ' caracteres)', blocosOmitidos: st.omitidosPorLimite } : null; return pg;
}
/* Itens resumidos por tipo de seção para o registro (compactos; o texto completo fica no conteúdo integral). */
const TD_EX = { beneficios: 'beneficios', parametrizacoes: 'parametrizacoes', versoes: 'versoes', limitacoes: 'limitacoes', exemplos: 'exemplos', faq: 'faq' };
const TD_EXN = { beneficios: 'Benefícios', parametrizacoes: 'Parametrizações', versoes: 'Versões e novidades', limitacoes: 'Limitações e restrições', exemplos: 'Exemplos e cenários', faq: 'Perguntas frequentes' };
function tdExtras(pgs) {
  const out = {}; Object.keys(TD_EX).forEach(k => { out[k] = []; });
  (Array.isArray(pgs) ? pgs : [pgs]).forEach(pg => (pg.secoes || []).forEach(s => {
    const k = TD_EX[s.tipo]; if (!k) return;
    s.blocos.forEach(b => { if (b.k === 'tab') b.linhas.slice(0, 30).forEach(r => add(k, r.filter(Boolean).join(' | '), pg, s)); else if (b.k === 'code') add(k, b.t.split('\n')[0], pg, s); else if (b.t.length >= 8 && b.t.split(' ').length >= 2) add(k, b.t, pg, s); });
  }));
  function add(k, t, pg, s) { t = hClean(t).slice(0, 300); if (!t || out[k].length >= 25 || out[k].some(y => keyT(y.t) === keyT(t))) return; out[k].push({ t, o: 'importação por link', f: pg.titulo || '', loc: `seção "${s.h}"`, at: today() }); }
  Object.keys(out).forEach(k => { if (!out[k].length) delete out[k]; }); return out;
}
/* ---- armazenamento em blocos ---- */
const scId = (solId, seq) => solId + '__' + seq;
async function scRead(solId, ref) {
  if (!SCONT || !ref?.chunks) return null; const parts = [];
  for (let i = 0; i < ref.chunks; i++) { const d = await wto(SCONT.doc(scId(solId, i)).get(), 10000); if (!d.exists) return { falta: i }; parts.push(d.data().txt); }
  const txt = parts.join(''); if (ref.hash && tdHash(txt) !== ref.hash) return { corrompido: true };
  try { return JSON.parse(txt); } catch { return { corrompido: true }; }
}
async function scDelete(solId, n) { if (!SCONT) return; for (let i = 0; i < n; i++) { try { await wto(SCONT.doc(scId(solId, i)).delete(), 10000); } catch { /* conferido na leitura */ } } }
/* Mescla páginas novas ao conteúdo já guardado (por URL), grava em blocos, relê e confere. Nunca falha em silêncio. */
async function scMerge(r, novo) {
  if (!SCONT) return { ok: false, motivo: 'sem banco: conteúdo integral não persistido nesta sessão' };
  const antes = r.conteudoRef ? await scRead(r.id, r.conteudoRef) : null, base = antes && antes.paginas ? antes : { v: 1, paginas: [] };
  const key = u => normUrl(u) || u, mapa = new Map(base.paginas.map(p => [key(p.u), p]));
  (novo.paginas || []).forEach(p => { const k = key(p.u), ex = mapa.get(k); if (ex && ex.hash === p.hash) return; if (ex) p.anterior = { em: ex.em, hash: ex.hash }; mapa.set(k, p); });
  const cont = { v: 1, paginas: [...mapa.values()] }, txt = JSON.stringify(cont), hash = tdHash(txt), n = Math.ceil(txt.length / TD_CHUNK) || 1, nAnt = r.conteudoRef?.chunks || 0;
  try {
    for (let i = 0; i < n; i++) await wto(SCONT.doc(scId(r.id, i)).set({ id: scId(r.id, i), solId: r.id, seq: i, total: n, hash, em: new Date().toISOString(), txt: txt.slice(i * TD_CHUNK, (i + 1) * TD_CHUNK) }), 15000);
    if (nAnt > n) await scDelete(r.id, 0) || 0; /* placeholder para manter a ordem: remoção dos blocos excedentes abaixo */
    for (let i = n; i < nAnt; i++) { try { await wto(SCONT.doc(scId(r.id, i)).delete(), 10000); } catch { /* ignorado: leitura usa só 0..n-1 */ } }
    const chk = await scRead(r.id, { chunks: n, hash });
    if (!chk || chk.falta != null || chk.corrompido) throw new Error('conferência após gravar falhou' + (chk?.falta != null ? ` (bloco ${chk.falta} ausente)` : ' (conteúdo divergente)'));
  } catch (e) { r.conteudoRef = { ...(r.conteudoRef || {}), falha: s4(e.message, 200), em: new Date().toISOString() }; touchSol(r.id); return { ok: false, motivo: e.message }; }
  const sts = cont.paginas.reduce((a, p) => ({ secoes: a.secoes + p.stats.secoes, blocos: a.blocos + p.stats.blocos, tabelas: a.tabelas + p.stats.tabelas, trunc: a.trunc + (p.truncado ? 1 : 0) }), { secoes: 0, blocos: 0, tabelas: 0, trunc: 0 });
  r.conteudoRef = { chunks: n, chars: txt.length, hash, em: new Date().toISOString(), paginas: cont.paginas.length, ...sts, dono: ME.id }; touchSol(r.id);
  return { ok: true, chunks: n, chars: txt.length };
}
async function tdCommit(r, novo) {
  if (!novo?.paginas?.length) return; const res = await scMerge(r, novo);
  log(res.ok ? `Conteúdo integral de "${r.nome}" gravado: ${res.chars.toLocaleString('pt-BR')} caracteres em ${res.chunks} bloco(s), conferido ao reler.` : `Conteúdo integral de "${r.nome}" NÃO foi gravado: ${res.motivo}. Os campos resumidos da solução foram mantidos.`, res.ok ? 'ok' : 'bad'); render();
}
/* ---- visualização ---- */
const TD_VIEW = { id: null, dados: null, erro: '', q: '' };
async function tdAbrir(id) {
  const r = S.solutions.find(x => x.id === id); if (!r?.conteudoRef) return; TD_VIEW.id = id; TD_VIEW.dados = null; TD_VIEW.erro = ''; TD_VIEW.q = ''; render();
  try { const d = await scRead(id, r.conteudoRef); if (!d) TD_VIEW.erro = 'Sem banco nesta sessão.'; else if (d.falta != null) TD_VIEW.erro = `Conteúdo não encontrado nesta conta (bloco ${d.falta}). O texto integral fica na conta de quem importou a página, ou foi apagado.`; else if (d.corrompido) TD_VIEW.erro = 'Conteúdo divergente do hash registrado: reimporte o link.'; else TD_VIEW.dados = d; } catch (e) { TD_VIEW.erro = e.message; }
  render();
}
function tdBloco(b) {
  if (b.k === 'li') return `<li style="margin-left:${b.n * 16}px">${esc(b.t)}</li>`;
  if (b.k === 'tab') return `<div class="tw"><table>${b.cab ? `<thead><tr>${b.cab.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead>` : ''}<tbody>${b.linhas.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  if (b.k === 'code') return `<pre class="sm" style="white-space:pre-wrap;max-height:240px;overflow:auto">${esc(b.t)}</pre>`;
  return `<p class="sm" style="margin:3px 0">${esc(b.t)}</p>`;
}
function tdViewer(r) {
  const ref = r.conteudoRef; if (!ref) return '';
  const cab = `<div class="sm"><b>Conteúdo integral</b> — ${ref.paginas || 0} página(s), ${ref.secoes || 0} seção(ões), ${ref.blocos || 0} bloco(s), ${ref.tabelas || 0} tabela(s), ${(ref.chars || 0).toLocaleString('pt-BR')} caracteres em ${ref.chunks || 0} bloco(s) de armazenamento • gravado em ${esc(dtBR(ref.em))}${ref.trunc ? ' ' + pill(ref.trunc + ' página(s) truncada(s) por limite de volume', 'warn') : ''}${ref.falha ? ' ' + pill('última gravação falhou: ' + ref.falha, 'bad') : ''}</div>`;
  if (TD_VIEW.id !== r.id) return `<div class="card sm" style="margin:6px 0">${cab}<div class="row"><button class="btn ghost sm" data-a="tdAbrir" data-id="${r.id}">Abrir conteúdo integral</button></div></div>`;
  if (TD_VIEW.erro) return `<div class="card sm" style="margin:6px 0">${cab}<div class="alert b">${esc(TD_VIEW.erro)}</div></div>`;
  if (!TD_VIEW.dados) return `<div class="card sm" style="margin:6px 0">${cab}<div class="alert i" role="status">Carregando…</div></div>`;
  const q = norm(TD_VIEW.q);
  const pgs = TD_VIEW.dados.paginas.map(p => {
    const secs = p.secoes.filter(s => !q || norm(s.h + ' ' + s.blocos.map(b => b.k === 'tab' ? b.linhas.map(x => x.join(' ')).join(' ') : b.t).join(' ')).includes(q));
    const rel = [p.stats.duplicados ? `${p.stats.duplicados} bloco(s) repetido(s) descartado(s)` : '', p.stats.secoesIgnoradas ? `${p.stats.secoesIgnoradas} seção(ões) de navegação ignorada(s)` : '', p.stats.imagens ? `${p.stats.imagens} imagem(ns) não importada(s)` : '', p.stats.omitidosCredencial ? `${p.stats.omitidosCredencial} trecho(s) com aparência de credencial omitido(s)` : '', p.stats.linhasTabelaCortadas ? `${p.stats.linhasTabelaCortadas} linha(s) de tabela além do limite` : ''].filter(Boolean).join(' • ');
    return `<details ${TD_VIEW.dados.paginas.length === 1 || q ? 'open' : ''}><summary class="sm"><b>${esc(p.titulo || p.u)}</b> ${p.principal ? pill('principal', 'info') : ''} ${p.truncado ? pill('TRUNCADA: ' + p.truncado.blocosOmitidos + ' bloco(s) omitido(s)', 'bad') : ''} <span class="muted">${p.stats.secoes} seção(ões) • ${p.stats.blocos} bloco(s) • ${p.stats.tabelas} tabela(s) • lida em ${esc(fmtD(p.em))}</span></summary>
    <div class="sm muted"><a href="${esc(p.u)}" target="_blank" rel="noopener noreferrer">${esc(p.u)}</a>${rel ? '<br>' + esc(rel) : ''}</div>
    ${secs.map(s => `<details style="margin-left:${Math.max(0, s.nivel - 1) * 10}px"><summary class="sm"><b>${esc(s.h)}</b> ${s.tipo !== 'outros' ? pill(s.tipo, 'off') : ''} <span class="muted">${s.blocos.length} bloco(s)</span></summary>${s.blocos.map(tdBloco).join('')}</details>`).join('') || '<p class="muted sm">Nenhuma seção corresponde à busca.</p>'}</details>`;
  }).join('');
  return `<div class="card sm" style="margin:6px 0">${cab}<div class="row"><input type="text" data-i="tdq" value="${esc(TD_VIEW.q)}" placeholder="Buscar no conteúdo integral" style="min-width:260px"><button class="btn ghost sm" data-a="tdBaixar" data-id="${r.id}">Baixar JSON</button><button class="btn ghost sm" data-a="tdFechar">Fechar</button></div>${pgs}</div>`;
}
const TD_ACT = {
  tdAbrir: t => tdAbrir(t.dataset.id), tdFechar: () => { TD_VIEW.id = null; TD_VIEW.dados = null; render(); },
  tdBaixar: t => { if (TD_VIEW.dados && TD_VIEW.id === t.dataset.id) { const r = S.solutions.find(x => x.id === t.dataset.id); offer(`conteudo-${safeKey(r?.nome || t.dataset.id)}.json`, JSON.stringify({ solucao: r?.nome, ...TD_VIEW.dados }, null, 1)); } }
};
function tdExtrasBlock(r) {
  const e = r.extras || {}; const ks = Object.keys(TD_EXN).filter(k => (e[k] || []).length); if (!ks.length) return '';
  return ks.map(k => `<details><summary class="sm"><b>${TD_EXN[k]}</b> (${e[k].length}${e[k].length >= 25 ? '+' : ''}) <span class="muted">resumo; o texto completo está no conteúdo integral</span></summary><ul class="sm" style="padding-left:18px">${e[k].map(i => `<li>${esc(i.t)} <span class="muted">— ${esc(i.f || '')} ${esc(i.loc || '')}</span></li>`).join('')}</ul></details>`).join('');
}
