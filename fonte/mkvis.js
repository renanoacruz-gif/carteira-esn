/* ===== Inteligência Comercial: Visão da carteira | por segmento | individual (rodada 11) ===== */
const MK_VIS = { carteira: 'Visão da carteira', segmento: 'Visão por segmento', individual: 'Visão individual' };
const FATO_T = { noticia: 'Notícia', expansao: 'Expansão', investimento: 'Investimento', pressao: 'Pressão operacional', mudanca: 'Mudança relevante', mercado: 'Mercado atendido', outro: 'Outro' };
function vMercado() {
  const v = UI.mk.visao in MK_VIS ? UI.mk.visao : 'carteira';
  const tabs = `<div class="ctabs">${Object.entries(MK_VIS).map(([k, l]) => `<button data-a="mkVis" data-v="${k}" class="${v === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  if (v === 'segmento') return tabs + vMercadoSeg();
  if (v === 'individual') return tabs + mkIndividual();
  return tabs + mkCarteira();
}
function mkCarteira() {
  const sg = mkSegCarteira(), n = clients().length;
  let h = `<div class="card"><h3>Inteligência Comercial — visão da carteira</h3><p class="sm">Panorama dos segmentos presentes na carteira (${n} cliente(s); ${sg.com.length} segmento(s) com estudo). Para uma conta específica use a <a href="#" data-a="mkVis" data-v="individual">Visão individual</a>; para pesquisar um recorte, a <a href="#" data-a="mkVis" data-v="segmento">Visão por segmento</a>. Contexto de mercado não é evidência individual do cliente.</p></div>`;
  h += mkDiag() + covResumoCarteira() + motorSugHtml() + mkEstudos() + `<p class="sm muted">Última atualização por IA: <b>${mkUlt() ? esc(fmtDate(mkUlt())) : 'nunca'}</b>. A atualização é <b>manual</b>: não há agendador, portanto nenhum monitoramento automático.</p>`;
  const l = S.insights.slice().sort((a, b) => (b.at || '').localeCompare(a.at || ''));
  h += `<h3 style="margin:14px 0 4px">Insights registrados (${l.length})</h3>${l.length ? l.slice(0, 60).map(mkCard).join('') : '<div class="card"><p class="sm muted">Nenhum insight registrado: notícias recentes aparecem após “Atualizar” (busca web real) ou cadastro manual com fonte e data. Os estudos acima já cobrem os segmentos da carteira.</p></div>'}`;
  return h;
}
function fatoAdd(key) {
  const c = S.clients[key]; if (!c) return; const g = id => ($('#' + id)?.value || '').trim();
  const f = { id: 'ft_' + uid(), titulo: g('ft_t').slice(0, 200), tipo: g('ft_tp') || 'noticia', fonteNome: g('ft_fn').slice(0, 120), url: g('ft_u'), data: g('ft_d'), identidade: g('ft_i').slice(0, 300), resumo: g('ft_r').slice(0, 800), at: nowISO() };
  if (!f.titulo) return toast('Informe o acontecimento.'); if (!f.fonteNome) return toast('Informe a fonte.');
  if (!/^https?:\/\/\S+$/i.test(f.url)) return toast('Informe o link da fonte (http/https).');
  if (!mkIso(f.data)) return toast('Informe a data do acontecimento (AAAA-MM-DD).');
  if (!f.identidade) return toast('Diga como confirmou que a notícia é sobre ESTA empresa (CNPJ, razão social, site…).');
  c.fatos ||= []; if (c.fatos.some(x => norm(x.titulo) === norm(f.titulo) && x.url === f.url)) return toast('Fato já registrado.');
  c.fatos.unshift(f); UI.mk.fatoOpen = false; reanalyze([key], 'Fato registrado: ' + f.titulo); render(); toast('Fato registrado neste cliente.');
}
function fatoRm(key, id) { const c = S.clients[key]; if (!c) return; c.fatos = (c.fatos || []).filter(x => x.id !== id); touchC(key); render(); }
function mkIndividual() {
  const m = UI.mk, q = norm(m.cq), all = clients().slice().sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  const lst = all.filter(c => !q || norm(`${c.name} ${c.code} ${c.cnpj}`).includes(q) || c.key === m.cli).slice(0, 200), c = m.cli && S.clients[m.cli];
  let h = `<div class="card"><h3>Inteligência Comercial — visão individual</h3><p class="sm">Analise uma conta por vez. Tudo abaixo pertence ao cliente selecionado; ao trocar de cliente nada é misturado.</p>
  <div class="row"><label class="sm">Buscar <input type="text" data-c="mk" data-f="cq" value="${esc(m.cq)}" placeholder="nome, código ou CNPJ (Enter)" style="min-width:240px"></label>
  <label class="sm">Cliente <select data-c="mk" data-f="cli" style="min-width:300px"><option value="">— selecione (${lst.length}${all.length > lst.length ? ' de ' + all.length : ''}) —</option>${lst.map(x => optS(x.key, `${x.name}${x.code ? ' • ' + x.code : ''}`, m.cli)).join('')}</select></label></div></div>`;
  if (!all.length) return h + `<div class="card empty"><p>Carteira vazia. Importe a planilha em Importar dados para analisar clientes.</p><button class="btn pri" data-a="nav" data-v="importar">Importar dados</button></div>`;
  if (!c) return h + `<div class="card empty"><p>Selecione um cliente para ver perfil, contratação identificada, notícias, recomendações e próximas perguntas.</p></div>`;
  const T = aiTarefa('mercado'), st = iaStatusOf(T.prov), ia = (S.pesq || []).filter(p => p.alvoKey === c.key);
  const seg = c.segInfo?.id, insSeg = seg ? S.insights.filter(i => i.escopo?.seg === seg).slice(0, 5) : [];
  h += `<div class="card" style="border-left:4px solid var(--ciano)"><div class="row"><h3>${esc(c.name)}</h3>${c.code ? pill(c.code, 'off') : ''}${fPill(c)}<span class="sp"></span><button class="btn ghost sm" data-a="open" data-k="${esc(c.key)}">Abrir cliente</button><button class="btn pri sm" data-a="pesqCli" data-k="${esc(c.key)}">Pesquisar este cliente (IA)</button></div>
  <p class="sm"><b>Identidade pesquisada:</b> ${esc(c.name)}${c.cnpj ? ' • CNPJ ' + esc(fmtCnpj(c.cnpj)) : ' • <span style="color:var(--bad)">sem CNPJ válido — a identidade da empresa pesquisada não pode ser confirmada</span>'}${c.cnpjCad ? ' • ' + esc(c.cnpjCad.razaoSocial || '') : ''}. Confira estes dados antes de aceitar qualquer notícia.</p>
  <p class="sm muted">Pesquisa por IA: ${esc(AI_PROV[T.prov].nome)} / ${esc(T.modelo)} — ${esc(st.l)} • ${ia.length} pesquisa(s) registrada(s) para este cliente (${ia.filter(p => p.status === 'incorporada').length} incorporada(s)). ${st.k !== 'verificado' ? 'Sem provedor testado, use o cadastro manual de fatos abaixo (com fonte e data); nada é simulado.' : ''}</p></div>`;
  h += rxHtml(c);
  const ft = c.fatos || [];
  h += `<div class="card"><div class="row"><h3>Notícias e fatos deste cliente ${chip('FATO')}</h3><span class="sp"></span><button class="btn ghost sm" data-a="mkFatoAbrir">${m.fatoOpen ? 'Cancelar' : '+ Registrar fato'}</button></div>
  ${m.fatoOpen ? `<div class="alert i sm">Registre apenas o que tem fonte consultada, link e data. Confirme a identidade: a notícia precisa ser sobre este CNPJ/empresa, não sobre homônimo ou grupo.</div><div class="row"><input id="ft_t" type="text" placeholder="Acontecimento" style="flex:1;min-width:260px"><select id="ft_tp">${Object.entries(FATO_T).map(([k, l]) => optS(k, l, 'noticia')).join('')}</select></div>
  <div class="row"><input id="ft_fn" type="text" placeholder="Fonte (veículo/órgão)"><input id="ft_u" type="text" placeholder="https://…" style="flex:1;min-width:240px"><label class="sm">Data <input id="ft_d" type="date"></label></div>
  <div class="row"><input id="ft_i" type="text" placeholder="Como confirmou que é esta empresa? (obrigatório)" style="flex:1;min-width:260px"></div><div class="row"><textarea id="ft_r" rows="2" placeholder="Resumo e implicação possível (opcional)" style="flex:1"></textarea></div>
  <div class="row"><button class="btn pri" data-a="mkFatoSalvar" data-k="${esc(c.key)}">Salvar fato</button></div>` : ''}
  ${ft.length ? ft.map(x => `<div class="opp"><div class="row"><b>${esc(x.titulo)}</b>${pill(FATO_T[x.tipo] || x.tipo, 'info')}<span class="sp"></span><button class="btn ghost sm" data-a="mkFatoRm" data-k="${esc(c.key)}" data-id="${x.id}">Remover</button></div><div class="sm">${esc(x.resumo || '')}</div><div class="sm muted">${link({ t: x.fonteNome, u: x.url })} • evento ${esc(fmtD(x.data))} • registrado ${esc(dtBR(x.at))} • identidade: ${esc(x.identidade)}</div></div>`).join('') : '<p class="muted sm">Nenhum fato registrado para este cliente. Sem pesquisa individual, o raio-X usa apenas cadastro, documentos e contexto setorial (identificado como tal).</p>'}</div>`;
  h += `<div class="card"><h3>Contexto setorial do segmento ${chip('INFERÊNCIA')}</h3><p class="sm muted">Não é evidência deste cliente.</p>${insSeg.length ? insSeg.map(mkCard).join('') : `<p class="sm muted">${seg ? 'Nenhum insight registrado para o segmento. Veja os estudos na Visão da carteira.' : 'Segmento não definido: edite os dados do cliente para habilitar o contexto setorial.'}</p>`}</div>`;
  return h;
}
const MKV_ACT = { mkVis: (t, e) => { e?.preventDefault?.(); UI.mk.visao = t.dataset.v; render(); window.scrollTo(0, 0); }, mkIndiv: (t, e) => { e?.preventDefault?.(); UI.mk.visao = 'individual'; UI.mk.cli = t.dataset.k; UI.view = 'mercado'; render(); window.scrollTo(0, 0); }, mkFatoAbrir: () => { UI.mk.fatoOpen = !UI.mk.fatoOpen; render(); }, mkFatoSalvar: t => fatoAdd(t.dataset.k), mkFatoRm: t => fatoRm(t.dataset.k, t.dataset.id) };
