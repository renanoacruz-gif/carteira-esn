/* ===== Rodada 18 §F: radar de portfólio oficial (privado, em S.meta.radar) =====
   S.meta.radar = { auto: true, fontes: [{ id, nome, url, fin, ativo, base:{em,hash,n,h[],t{}}, hist:[{em,res,add,rem,dup}], erro }], fila: [{ id, fonteId, fonteNome, url, fin, tipo, titulo, trecho[], add, rem, key, em, status, nota }] }
   Regras: (1) mudança de página NUNCA publica produto: só gera item na fila de revisão; (2) finalidade decide a leitura — documentação ⇒ “documentação atualizada”, jamais lançamento;
   (3) TDN é documentação técnica, não lista comercial completa; (4) 1ª leitura = linha de base (não gera fila); (5) queda abrupta/página vazia não é aplicada (evita falsas remoções);
   (6) deduplicação por chave, por nome já existente na Base e por histórico da fila; (7) rascunho só por clique do executivo, sempre “NECESSITA VALIDAÇÃO”.
   Agendamento: verificação semanal ao ABRIR o app (sem processo em segundo plano com o app fechado). */
const RD_FIN = { catalogo: ['Lista de produtos / catálogo', 'novos itens viram indício de possível produto/módulo'], lancamentos: ['Página de lançamentos / novidades', 'novas entradas viram indício de possível lançamento'], documentacao: ['Documentação / release notes', 'mudanças viram “documentação atualizada” — nunca lançamento'] };
const RD_DIAS = 7, RD_MAXF = 8, RD_MAXQ = 200, RD_MAXI = 600, RD_MAXT = 300, RD_MAXNOVOS = 20, RD_ESTRUT = 40;
const RD_GEN = /^(saiba mais|leia mais|ver mais|clique aqui|voltar|home|inicio|contato|fale conosco|login|entrar|cadastre-se|pesquisar|buscar|menu|compartilhar|imprimir|anterior|proximo|topo|ir para o topo|politica de privacidade|termos de uso|cookies?)$/;
const rdState = () => (S.meta.radar ||= { auto: true, fontes: [], fila: [] });
const rdH = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
const rdFonte = id => rdState().fontes.find(f => f.id === id);
const rdUrlOk = u => { try { const x = new URL(u); return x.protocol === 'https:' && LK_HOST.test(x.hostname); } catch { return false; } };
const rdDias = f => { const l = f.hist?.[0]?.em; return l ? (Date.now() - Date.parse(l)) / 864e5 : Infinity; };
function rdExtrair(html, fin) {
  const doc = new DOMParser().parseFromString(String(html), 'text/html'), itens = [], seen = new Set();
  doc.querySelectorAll('script,style,noscript,nav,header,footer,aside,form,svg,iframe,[class*="cookie"],[id*="cookie"],#footer,#header,.breadcrumbs,.aui-nav').forEach(n => n.remove());
  const root = doc.querySelector('#main-content,.wiki-content,main,article') || doc.body, max = fin === 'documentacao' ? 220 : 90;
  root.querySelectorAll(fin === 'documentacao' ? 'h1,h2,h3,h4,p,li,td,th' : 'h2,h3,h4,a,li>strong').forEach(n => {
    const t = (n.textContent || '').replace(/\s+/g, ' ').trim(), k = norm(t).replace(/[^\p{L}\p{N} ]/gu, '').trim();
    if (t.length < 3 || t.length > max || !k || RD_GEN.test(k) || seen.has(k) || SECRET_RE.test(t)) return; seen.add(k); itens.push({ t: t.slice(0, 140), k: k.slice(0, 140) });
  });
  return itens.slice(0, RD_MAXI);
}
const rdExiste = it => S.solutions.some(s => !s.arquivado && (norm(s.nome) === it.k || nameSim(s.nome, it.t) >= .85 || (s.termos || []).some(x => norm(x) === it.k)));
function rdEnfileirar(f, q) {
  const R = rdState(); if (R.fila.some(x => x.key === q.key)) return false;
  R.fila.unshift({ id: 'rq_' + uid(), fonteId: f.id, fonteNome: f.nome, url: f.url, fin: f.fin, em: nowISO(), status: 'pendente', nota: '', add: 0, rem: 0, trecho: [], ...q });
  if (R.fila.length > RD_MAXQ) { const i = [...R.fila].reverse().findIndex(x => x.status !== 'pendente'); if (i >= 0) R.fila.splice(R.fila.length - 1 - i, 1); }
  return true;
}
/* aplica uma leitura (HTML) a uma fonte: linha de base na 1ª vez; depois diff. Retorna {res, add, rem, dup, novos} ou {erro} */
function rdAplicar(f, html) {
  const itens = rdExtrair(html, f.fin), em = nowISO();
  if (itens.length < 3) { f.erro = { em, msg: 'Conteúdo insuficiente (página vazia, bloqueada ou de login). Nada foi aplicado.' }; touchMeta(); return { erro: f.erro.msg }; }
  const hs = itens.map(i => rdH(i.k)), hash = rdH([...hs].sort().join('|')), b = f.base;
  if (b && b.n >= 10 && itens.length < b.n * .3) { f.erro = { em, msg: `Queda abrupta no conteúdo (${b.n} → ${itens.length} itens): possível bloqueio ou mudança de layout. Nada foi aplicado.` }; touchMeta(); return { erro: f.erro.msg }; }
  const nova = { em, hash, n: itens.length, h: hs, t: f.fin === 'documentacao' ? undefined : Object.fromEntries(itens.slice(0, RD_MAXT).map((i, j) => [hs[j], i.t.slice(0, 80)])) };
  const reg = r => { f.hist = [{ em, ...r }, ...(f.hist || [])].slice(0, 12); f.erro = null; f.base = nova; touchMeta(); return r; };
  if (!b) return reg({ res: 'baseline', add: 0, rem: 0, dup: 0, n: itens.length });
  if (b.hash === hash) return reg({ res: 'sem_mudanca', add: 0, rem: 0, dup: 0, n: itens.length });
  const prev = new Set(b.h), cur = new Set(hs), add = itens.filter((_, j) => !prev.has(hs[j])), rem = b.h.filter(h => !cur.has(h));
  let novos = 0, dup = 0;
  if (f.fin === 'documentacao') {
    if (rdEnfileirar(f, { key: `doc|${f.id}|${hash}`, tipo: 'doc', titulo: 'Documentação atualizada (não é lançamento de produto)', trecho: add.slice(0, 8).map(i => i.t), add: add.length, rem: rem.length })) novos++; else dup++;
  } else if (add.length > RD_ESTRUT) {
    if (rdEnfileirar(f, { key: `est|${f.id}|${hash}`, tipo: 'estrutura', titulo: `Estrutura da página mudou (${add.length} itens novos) — revisar manualmente`, trecho: add.slice(0, 8).map(i => i.t), add: add.length, rem: rem.length })) novos++; else dup++;
  } else add.slice(0, RD_MAXNOVOS).forEach(it => {
    if (rdExiste(it)) { dup++; return; }
    if (rdEnfileirar(f, { key: `it|${f.fin}|${it.k}`, tipo: 'novo_item', titulo: it.t, trecho: [], add: 1, rem: 0 })) novos++; else dup++;
  });
  return Object.assign(reg({ res: 'mudou', add: add.length, rem: rem.length, dup, n: itens.length, novos }), { novos });
}
async function rdVerificar(id, silencioso) {
  const f = rdFonte(id); if (!f) return null;
  if (typeof bkModo === 'function' && bkModo() === 'manual') { f.erro = { em: nowISO(), msg: 'Este ambiente não chama o backend. Use o app hospedado para verificar.' }; touchMeta(); if (!silencioso) { toast(f.erro.msg); render(); } return { erro: f.erro.msg }; }
  const req = { versao: 1, pedidoId: 'rd_' + uid(), tipo: 'importar_link', urls: [f.url], opcoes: { paginasVinculadas: 0, anexos: 0 } };
  let out;
  try {
    const r = await bkChamar('importar', req, `pedido-radar-${req.pedidoId}.json`), res = r?.resp?.resultados?.[0], html = res?.paginas?.[0]?.html;
    if (r?.via !== 'direto') out = { erro: 'Backend não respondeu diretamente.' };
    else if (!res?.ok || !html) out = { erro: res?.erro?.mensagem || r?.resp?.erro?.mensagem || 'Página não retornou conteúdo.' };
    else out = rdAplicar(f, html);
  } catch (e) { out = { erro: e.message || 'falha' }; }
  if (out.erro) { f.erro = { em: nowISO(), msg: String(out.erro).slice(0, 200) }; touchMeta(); }
  if (!silencioso) { toast(out.erro ? 'Radar: ' + out.erro : out.res === 'baseline' ? `Linha de base registrada (${out.n} itens).` : out.res === 'sem_mudanca' ? 'Sem mudança desde a última leitura.' : `Mudança detectada: ${out.novos} item(ns) na fila de revisão.`); render(); }
  return out;
}
async function rdVerificarTodas(soDevidas) {
  const R = rdState(), L = R.fontes.filter(f => f.ativo && (!soDevidas || rdDias(f) >= RD_DIAS)); if (!L.length) return 0;
  UI.busy = `Radar: verificando ${L.length} fonte(s)…`; render(); let n = 0;
  for (const f of L) { const o = await rdVerificar(f.id, true); n++; if (o?.erro && /limite|aguarde|rate/i.test(o.erro)) break; await new Promise(r => setTimeout(r, 1500)); }
  UI.busy = ''; R.ultimaAuto = nowISO(); touchMeta(); render(); return n;
}
async function radarAuto() {
  if (!window.__HOSTED__) return; const R = S.meta.radar; if (!R || R.auto === false || !R.fontes?.some(f => f.ativo && rdDias(f) >= RD_DIAS)) return;
  const n = await rdVerificarTodas(true); const p = R.fila.filter(x => x.status === 'pendente').length; if (n && p) toast(`Radar de portfólio: ${p} item(ns) aguardando sua revisão (Base de Soluções).`);
}
function rdAdd(d) {
  const R = rdState(), nome = String(d.nome || '').trim().slice(0, 80), url = String(d.url || '').trim(), e = [];
  if (!nome) e.push('Informe o nome da fonte.'); if (!rdUrlOk(url)) e.push('URL inválida: use https em totvs.com ou totvs.com.br (e subdomínios).'); if (!RD_FIN[d.fin]) e.push('Escolha a finalidade.');
  if (R.fontes.some(f => normUrl(f.url) === normUrl(url))) e.push('Esta URL já está no radar.'); if (R.fontes.length >= RD_MAXF) e.push(`Máximo de ${RD_MAXF} fontes.`);
  if (e.length) { UI.rdErr = e; return render(); } UI.rdErr = null;
  R.fontes.push({ id: 'rf_' + uid(), nome, url, fin: d.fin, ativo: true, base: null, hist: [], erro: null }); touchMeta(); toast('Fonte adicionada. A 1ª verificação registra a linha de base (sem gerar itens).'); render();
}
function rdFila(id, st, nota) {
  const R = rdState(), q = R.fila.find(x => x.id === id); if (!q || q.status !== 'pendente') return; nota = String(nota || '').trim().slice(0, 300);
  if (st === 'descartada' && !nota) return toast('Descartar exige o motivo.');
  if (st === 'rascunho') {
    if (q.tipo !== 'novo_item') return toast('Só itens de lista podem virar rascunho.');
    const dup = S.solutions.find(s => !s.arquivado && (nameSim(s.nome, q.titulo) >= .6 || norm(s.nome) === norm(q.titulo))); if (dup) return toast(`Possível duplicidade com “${dup.nome}” na Base. Revise antes de criar.`);
    const r = newSol({ nome: q.titulo, tipo: 'produto', origem: 'radar de portfólio', _priv: true, obs: `Rascunho criado a partir de INDÍCIO no radar (${q.fonteNome}, ${dtBR(q.em)}). Não confirmado como produto comercial: validar em fonte oficial antes de usar.` });
    r.fontes = [{ t: q.fonteNome, u: q.url, d: today(), origem: 'radar de portfólio' }]; hist(r, 'criado', 'Rascunho a partir do radar de portfólio (indício, não validado)'); S.solutions.push(r); solChanged(r, 'criado'); q.solId = r.id;
  }
  q.status = st; q.nota = nota; q.revisadoEm = nowISO(); touchMeta(); toast(st === 'rascunho' ? 'Rascunho criado na Base (NECESSITA VALIDAÇÃO).' : 'Registrado.'); render();
}
const RD_ACT = {
  rdAdd: () => rdAdd({ nome: $('#rd-n').value, url: $('#rd-u').value, fin: $('#rd-f').value }), rdVer: t => rdVerificar(t.dataset.id), rdTodas: () => rdVerificarTodas(false),
  rdTog: t => { const f = rdFonte(t.dataset.id); if (f) { f.ativo = !f.ativo; touchMeta(); render(); } }, rdDel: t => { const R = rdState(); R.fontes = R.fontes.filter(f => f.id !== t.dataset.id); touchMeta(); render(); },
  rdAuto: () => { const R = rdState(); R.auto = R.auto === false; touchMeta(); render(); }, rdQ: t => rdFila(t.dataset.id, t.dataset.v, $('#rq_' + t.dataset.id)?.value)
};
const RD_RES = { baseline: 'Linha de base', sem_mudanca: 'Sem mudança', mudou: 'Mudou' };
function rdHtml() {
  const R = S.meta.radar || { auto: true, fontes: [], fila: [] }, pend = R.fila.filter(x => x.status === 'pendente'), er = UI.rdErr || [];
  const frow = f => { const h = f.hist?.[0]; return `<tr><td><b>${esc(f.nome)}</b><div class="sm"><a href="${esc(safeUrl(f.url))}" target="_blank" rel="noopener noreferrer">${esc(f.url.replace(/^https:\/\//, '').slice(0, 60))}</a></div></td><td class="sm">${esc(RD_FIN[f.fin][0])}</td>
    <td class="sm">${h ? `${esc(dtBR(h.em))} • ${esc(RD_RES[h.res] || h.res)}${h.res === 'mudou' ? ` (+${h.add} / −${h.rem})` : ''}` : '<span class="muted">nunca verificada</span>'}${f.erro ? `<div>${pill('Erro: ' + f.erro.msg.slice(0, 90), 'bad')}</div>` : ''}${rdDias(f) >= RD_DIAS && f.ativo ? ' ' + pill('verificação devida', 'warn') : ''}</td>
    <td><button class="btn sm" data-a="rdVer" data-id="${f.id}">Verificar agora</button> <button class="btn ghost sm" data-a="rdTog" data-id="${f.id}">${f.ativo ? 'Pausar' : 'Ativar'}</button> <button class="btn ghost sm" data-a="rdDel" data-id="${f.id}">Remover</button></td></tr>`; };
  const qcard = q => `<div class="opp"><div class="row"><h4>${esc(q.titulo)}</h4><span class="sp"></span>${pill(q.tipo === 'novo_item' ? (q.fin === 'lancamentos' ? 'Possível lançamento (indício)' : 'Possível produto/módulo (indício)') : q.tipo === 'doc' ? 'Documentação atualizada' : 'Estrutura alterada', q.tipo === 'novo_item' ? 'warn' : 'info')}</div>
    <p class="sm muted">${esc(q.fonteNome)} • <a href="${esc(safeUrl(q.url))}" target="_blank" rel="noopener noreferrer">fonte</a> • detectado em ${esc(dtBR(q.em))}${q.tipo !== 'novo_item' ? ` • +${q.add} / −${q.rem} itens` : ''}</p>
    ${q.trecho?.length ? `<ul class="sm">${q.trecho.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
    <div class="row"><input id="rq_${q.id}" placeholder="Nota / motivo" style="flex:1;min-width:180px">${q.tipo === 'novo_item' ? `<button class="btn sm" data-a="rdQ" data-id="${q.id}" data-v="rascunho">Criar rascunho na Base</button>` : ''}<button class="btn ghost sm" data-a="rdQ" data-id="${q.id}" data-v="analisada">Marcar como analisada</button><button class="btn ghost sm" data-a="rdQ" data-id="${q.id}" data-v="descartada">Descartar</button></div></div>`;
  const hist = R.fontes.flatMap(f => (f.hist || []).map(h => ({ f, h }))).sort((a, b) => b.h.em.localeCompare(a.h.em)).slice(0, 15);
  return `<details class="card" style="margin-bottom:10px" ${UI.rdOpen || pend.length ? 'open' : ''}><summary><b>Radar de portfólio oficial</b> <span class="muted sm">— ${R.fontes.length} fonte(s) • ${pend.length} item(ns) para revisar</span></summary>
  <p class="sm muted">Monitora páginas oficiais que você escolher. <b>Mudança de página não é lançamento</b>: nada vira produto sem sua revisão. Documentação (ex.: TDN) é material técnico, <b>não uma lista comercial completa</b>; sua mudança entra como “documentação atualizada”. A 1ª leitura só registra a linha de base. Verificação semanal ocorre ao abrir o app (não há execução em segundo plano com o app fechado). Domínios permitidos: totvs.com e totvs.com.br.</p>
  <div class="row sm"><button class="btn sm" data-a="rdTodas">Verificar todas agora</button><label class="sm"><input type="checkbox" data-a="rdAuto" ${R.auto === false ? '' : 'checked'}> Verificar semanalmente ao abrir o app</label></div>
  ${R.fontes.length ? `<div class="tw"><table class="sm"><thead><tr><th>Fonte</th><th>Finalidade</th><th>Última verificação</th><th></th></tr></thead><tbody>${R.fontes.map(frow).join('')}</tbody></table></div>` : '<p class="sm muted">Nenhuma fonte cadastrada.</p>'}
  <details><summary class="sm">Adicionar fonte</summary>${er.length ? `<div class="alert b sm"><ul style="margin:0">${er.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
  <div class="grid g2"><label class="sm">Nome *<input id="rd-n" type="text" style="width:100%" maxlength="80"></label><label class="sm">URL (https) *<input id="rd-u" type="text" style="width:100%" placeholder="https://"></label>
  <label class="sm">Finalidade *<select id="rd-f" style="width:100%">${Object.entries(RD_FIN).map(([k, [l, d]]) => `<option value="${k}">${esc(l)} — ${esc(d)}</option>`).join('')}</select></label></div><button class="btn pri sm" data-a="rdAdd">Adicionar</button></details>
  <h4>Fila de revisão (${pend.length})</h4>${pend.length ? pend.map(qcard).join('') : '<p class="sm muted">Nada pendente.</p>'}
  ${hist.length ? `<details><summary class="sm">Histórico de verificações (${hist.length})</summary><ul class="sm">${hist.map(({ f, h }) => `<li>${esc(dtBR(h.em))} • ${esc(f.nome)} • ${esc(RD_RES[h.res] || h.res)}${h.res === 'mudou' ? ` (+${h.add} / −${h.rem}; ${h.novos || 0} na fila; ${h.dup} já conhecido(s)/duplicado(s))` : ''}</li>`).join('')}</ul></details>` : ''}
  ${R.fila.filter(x => x.status !== 'pendente').length ? `<details><summary class="sm">Itens já revisados (${R.fila.filter(x => x.status !== 'pendente').length})</summary><ul class="sm">${R.fila.filter(x => x.status !== 'pendente').slice(0, 30).map(x => `<li>${esc(x.titulo)} — ${esc(x.status)} ${x.nota ? '(' + esc(x.nota) + ')' : ''}</li>`).join('')}</ul></details>` : ''}
  </details>`;
}
