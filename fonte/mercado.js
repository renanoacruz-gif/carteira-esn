/* ===== Inteligência Comercial: insights de mercado por segmento/subsegmento/região/período =====
   Contexto de mercado NÃO é evidência individual do cliente. Fonte só é "verificada" se a URL consta nas citações devolvidas pela busca.
   Sem agendador real: atualização é sempre manual (botão) — nenhum monitoramento automático. */
const MK_TIPOS = { noticia: 'Notícia', indicador: 'Indicador', tendencia: 'Tendência', risco: 'Risco', oportunidade: 'Oportunidade', regulatorio: 'Mudança regulatória', hipotese: 'Hipótese' };
const MK_PER = { 30: 'Últimos 30 dias', 90: 'Últimos 90 dias', 180: 'Últimos 180 dias', 365: 'Últimos 12 meses' };
UI.mk = { visao: 'carteira', cli: '', cq: '', fatoOpen: false, seg: '', sub: '', uf: '', per: '90', busy: false, err: null, rep: null, man: false, fq: '', fseg: '', fuf: '', fcl: '', sav: null };
const mkIso = s => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '').trim()); if (!m) return ''; const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`); return isNaN(d) || d.toISOString().slice(0, 10) !== `${m[1]}-${m[2]}-${m[3]}` ? '' : `${m[1]}-${m[2]}-${m[3]}`; };
const mkUF = c => normUF(c.uf) || normUF(c.fis?.uf?.v) || '';
const mkDK = it => (it.fonte?.url ? 'u:' + normUrl(it.fonte.url) : 't:' + norm(it.titulo).replace(/[^a-z0-9]/g, '').slice(0, 90));
const mkTK = it => 't:' + norm(it.titulo).replace(/[^a-z0-9]/g, '').slice(0, 90);
const mkPeriodo = per => { const fim = new Date(), ini = new Date(Date.now() - (+per || 90) * 864e5); return { de: ini.toISOString().slice(0, 10), ate: fim.toISOString().slice(0, 10) }; };
const mkUlt = () => S.insights.filter(i => i.origem === 'ia').reduce((m, i) => (i.at > m ? i.at : m), '');
/* clientes cujo recorte (segmento e/ou UF) coincide com o do insight; sem recorte algum, nenhum (evita "todos") */
function mkRelated(ins) {
  const e = ins.escopo || {}; if (!e.seg && !e.uf) return [];
  return clients().filter(c => (!e.seg || (c.segInfo?.id === e.seg && c.segInfo.mode !== 'ausente')) && (!e.uf || mkUF(c) === e.uf));
}
function mkPrompt(f) {
  const seg = KB.segments.find(s => s.id === f.seg)?.nome || 'não especificado', p = mkPeriodo(f.per);
  return `Você é analista de inteligência comercial para uma consultoria de software de gestão (ERP). Pesquise na web, em fontes primárias ou confiáveis (órgãos oficiais, associações setoriais, imprensa especializada), acontecimentos RECENTES e verificáveis.
Segmento: ${seg}. Subsegmento: ${f.sub || 'não especificado'}. Região: ${f.uf ? 'UF ' + f.uf : 'Brasil'}. Período: ${p.de} a ${p.ate}.
Cubra: notícias, indicadores, tendências, riscos, oportunidades e mudanças regulatórias que afetem empresas desse recorte.
Regras: inclua SOMENTE itens com fonte consultada e data conhecida; cada item deve trazer a URL exata da fonte; não invente números, datas ou fontes; o que for inferência deve ter tipo "hipotese". Não cite empresas específicas como clientes. Máximo 8 itens.
Devolva apenas JSON: {"itens":[{"acontecimento":"","tipo":"noticia|indicador|tendencia|risco|oportunidade|regulatorio|hipotese","fonteNome":"","fonteUrl":"","dataEvento":"AAAA-MM-DD","dataPublicacao":"AAAA-MM-DD","impacto":"possível impacto para empresas do recorte","justificativa":"por que isso importa, com base na fonte","acao":"ação comercial sugerida (abordagem/pergunta)"}]}`;
}
async function mkBuscar() {
  const m = UI.mk; if (m.busy) return; if (!m.seg && !m.uf) return toast('Defina ao menos segmento ou região.');
  const T = aiTarefa('mercado'), f = { seg: m.seg, sub: m.sub.trim(), uf: m.uf, per: m.per };
  const pedido = { versao: 2, pedidoId: 'm_' + uid(), provedor: T.prov, modelo: T.modelo, tarefa: 'pesquisa', formato: 'json', buscaWeb: T.busca !== false, prompt: mkPrompt(f) };
  S.meta.mkPend = { ...(S.meta.mkPend || {}), [pedido.pedidoId]: { ...f, at: nowISO() } };
  const ks = Object.keys(S.meta.mkPend); if (ks.length > 8) delete S.meta.mkPend[ks.sort((a, b) => S.meta.mkPend[a].at.localeCompare(S.meta.mkPend[b].at))[0]]; touchMeta();
  m.busy = true; m.err = null; render();
  try {
    const r = await bkChamar('ia', pedido, `pedido-mercado-${pedido.pedidoId}.json`);
    if (r.via === 'direto') await mercadoResposta(r.resp);
    else toast(`Pedido gerado. ${r.motivo ? r.motivo + ' ' : ''}Envie-o na página do backend e importe a resposta em "Importar resposta".`);
  } catch (e) { m.err = e.message; intLog({ sistema: 'ia', op: 'mercado', estado: 'erro', msg: e.message }); }
  m.busy = false; render();
}
/* resposta do /api/ia para tarefa de mercado: valida, classifica, deduplica e grava */
async function mercadoResposta(j) {
  const m = UI.mk, f = (S.meta.mkPend || {})[j.pedidoId];
  if (!f) throw new Error('Resposta de mercado sem pedido correspondente neste navegador (pedido de outra sessão ou já importado).');
  if (!j.ok) { m.err = `${j.erro?.codigo || 'erro'}: ${j.erro?.mensagem || 'falha'}`; intLog({ sistema: 'ia', op: 'mercado', estado: 'erro', msg: m.err }); return true; }
  const itens = Array.isArray(j.dados?.itens) ? j.dados.itens.slice(0, 12) : [];
  const fontes = cap(j.fontes, 40).map(x => ({ u: s4(x.u, 500), t: s4(x.t, 200), oficial: !!x.oficial })), fkeys = new Map(fontes.map(x => [normUrl(x.u), x]));
  const per = mkPeriodo(f.per), rep = { total: itens.length, novos: 0, dup: 0, semFonte: 0, hip: 0, foraPeriodo: 0, avisos: cap(j.avisos, 6).map(x => s4(x, 300)), usouBusca: !!j.usouBusca, prov: j.provedorNome || j.provedor };
  const base = { escopo: { seg: f.seg, sub: f.sub, uf: f.uf, per: f.per }, origem: 'ia', provedor: s4(j.provedor, 20), modelo: s4(j.modelo, 60), consultadoEm: s4(j.consultadoEm, 40), usouBusca: !!j.usouBusca };
  for (const x of itens) {
    const url = /^https?:\/\//i.test(String(x.fonteUrl || '')) ? s4(x.fonteUrl, 500) : '', cit = url ? fkeys.get(normUrl(url)) : null;
    const dataEvento = mkIso(x.dataEvento), dataPub = mkIso(x.dataPublicacao), d0 = dataEvento || dataPub;
    const verificada = !!(j.usouBusca && cit); let classe = verificada && x.tipo !== 'hipotese' ? 'contexto' : 'hipotese';
    const obs = []; if (!url) obs.push('sem URL de fonte'); else if (!verificada) obs.push(j.usouBusca ? 'fonte não consta nas citações da busca' : 'busca web não utilizada: conteúdo do conhecimento do modelo');
    if (!d0) obs.push('sem data válida'); else if (d0 < per.de) { obs.push('fora do período'); rep.foraPeriodo++; }
    if (!d0 && classe === 'contexto') classe = 'hipotese';
    const it = { id: 'ins_' + uid(), at: nowISO(), upd: nowISO(), titulo: s4(x.acontecimento, 300).trim(), tipo: MK_TIPOS[x.tipo] ? x.tipo : 'hipotese', classe, fonte: { nome: s4(x.fonteNome || cit?.t, 150), url, verificada, oficial: !!cit?.oficial }, datas: { evento: dataEvento, publicacao: dataPub }, impacto: s4(x.impacto, 600), justificativa: s4(x.justificativa, 600), acao: s4(x.acao, 400), obs, salvoEm: [], ...base };
    if (it.titulo.length < 5) continue;
    if (!verificada || it.tipo === 'hipotese') rep.hip++; if (!url) rep.semFonte++;
    const dup = S.insights.find(y => mkDK(y) === mkDK(it) || mkTK(y) === mkTK(it));
    if (dup) { rep.dup++; dup.upd = nowISO(); touchG('insights', dup.id); continue; }
    S.insights.unshift(it); touchG('insights', it.id); rep.novos++;
  }
  delete S.meta.mkPend[j.pedidoId]; touchMeta();
  if (!itens.length) rep.avisos.push(j.dados ? 'A resposta não trouxe itens.' : 'O modelo não devolveu JSON válido; nada foi gravado.');
  m.rep = rep; m.err = null;
  intLog({ sistema: 'ia', op: 'mercado', estado: rep.novos ? 'ok' : 'aviso', msg: `${rep.novos} novo(s), ${rep.dup} duplicado(s), ${rep.hip} hipótese(s)`, n: rep.novos });
  render(); return true;
}
function mkManual() {
  const g = f => ($(`#mkman [data-f=${f}]`)?.value || '').trim(), titulo = g('titulo'); if (titulo.length < 5) return toast('Informe o acontecimento (mín. 5 caracteres).');
  const url = g('url'); if (url && !/^https?:\/\//i.test(url)) return toast('URL da fonte deve começar com http(s)://');
  const ev = g('dataEvento'), pub = g('dataPub'); if ((ev && !mkIso(ev)) || (pub && !mkIso(pub))) return toast('Data inválida.');
  const m = UI.mk, it = { id: 'ins_' + uid(), at: nowISO(), upd: nowISO(), titulo, tipo: MK_TIPOS[g('tipo')] ? g('tipo') : 'noticia', classe: url && (ev || pub) && g('tipo') !== 'hipotese' ? 'contexto' : 'hipotese', fonte: { nome: g('fonteNome'), url, verificada: false, oficial: false, informadaPeloUsuario: true }, datas: { evento: ev, publicacao: pub }, impacto: g('impacto'), justificativa: g('just'), acao: g('acao'), obs: ['cadastro manual: fonte informada pelo usuário, não verificada pela busca'], salvoEm: [], escopo: { seg: m.seg, sub: m.sub, uf: m.uf, per: m.per }, origem: 'manual' };
  const dup = S.insights.find(y => mkDK(y) === mkDK(it) || mkTK(y) === mkTK(it)); if (dup) return toast('Já existe insight com a mesma fonte/título.');
  S.insights.unshift(it); touchG('insights', it.id); m.man = false; toast('Insight cadastrado.'); render();
}
function mkSalvar(id, key) {
  const it = S.insights.find(x => x.id === id), c = S.clients[key]; if (!it || !c) return;
  c.insRef ||= []; if (c.insRef.some(r => r.id === id)) return toast('Já salvo neste cliente.');
  c.insRef.push({ id, at: nowISO(), titulo: it.titulo, fonte: it.fonte?.url || '', classe: it.classe }); (it.salvoEm ||= []).push({ key, at: nowISO() }); touchC(key); touchG('insights', id); toast('Insight salvo no cliente (contexto de mercado, não evidência individual).'); render();
}
function mkAcao(id, key) {
  const it = S.insights.find(x => x.id === id), c = S.clients[key]; if (!it || !c) return;
  if (!(c.insRef || []).some(r => r.id === id)) mkSalvar(id, key);
  const rid = `ins:${id}:${key}`; if (c.act?.[rid]) return toast('Ação já criada para este cliente.');
  setAct(rid, key, { status: 'Pendente', criadaEm: nowISO() }); const r = c.insRef.find(x => x.id === id); if (r) r.acao = true; touchC(key); toast('Ação criada no Plano de ação.'); render();
}
function mkDel(id) {
  S.insights = S.insights.filter(x => x.id !== id); dropG('insights', id);
  Object.values(S.clients).forEach(c => { if ((c.insRef || []).some(r => r.id === id)) { c.insRef = c.insRef.filter(r => r.id !== id); Object.keys(c.act || {}).filter(k => k.startsWith(`ins:${id}:`)).forEach(k => delete c.act[k]); touchC(c.key); } });
  render();
}
const MK_ACT = {
  mkBuscar, mkManualAbrir: () => { UI.mk.man = !UI.mk.man; render(); }, mkManual,
  mkSalvar: t => { const k = $(`select[data-id="${t.dataset.id}"]`)?.value; if (!k) return toast('Escolha o cliente.'); mkSalvar(t.dataset.id, k); },
  mkAcao: t => { const k = $(`select[data-id="${t.dataset.id}"]`)?.value; if (!k) return toast('Escolha o cliente.'); mkAcao(t.dataset.id, k); },
  mkDel: t => mkDel(t.dataset.id), mkAtualizarSeg: t => mkAtualizarSeg(t.dataset.seg), mkKbSalvar: t => { const k = $(`select[data-id="kb_${t.dataset.seg}_${t.dataset.i}"]`)?.value; if (!k) return toast('Escolha o cliente.'); mkFromKB(t.dataset.seg, t.dataset.i, k); }, mkRep: () => { UI.mk.rep = null; render(); }
};
function mkChange(t, c, v) {
  if (c !== 'mk') return false; const f = t.dataset.f; if (!(f in UI.mk)) return true; UI.mk[f] = v; if (f === 'seg' && !v) UI.mk.sub = ''; render(); return true;
}
function mkCard(it) {
  const rel = mkRelated(it), cl = rel.slice().sort((a, b) => a.name.localeCompare(b.name)), e = it.escopo || {}, f = it.fonte || {};
  const escopo = [e.seg ? segName(e.seg) : '', e.sub, e.uf, MK_PER[e.per] || ''].filter(Boolean).join(' • ');
  const fonte = f.url ? `<a href="${esc(f.url)}" target="_blank" rel="noopener noreferrer">${esc(f.nome || hostOf(f.url))}</a> ${f.verificada ? pill('citada na busca', 'ok') : f.informadaPeloUsuario ? pill('informada pelo usuário', 'warn') : pill('não verificada', 'bad')} ${f.oficial ? pill('oficial', 'info') : ''}` : '<span class="muted">sem fonte</span>';
  return `<div class="card mk" data-id="${esc(it.id)}"><div class="row" style="justify-content:space-between;gap:8px"><div><b>${esc(it.titulo)}</b></div><div>${pill(MK_TIPOS[it.tipo], 'info')} ${pill(it.classe === 'contexto' ? 'Contexto de mercado' : 'Hipótese', it.classe === 'contexto' ? 'ok' : 'warn')}</div></div>
  <dl class="sm"><dt>Fonte</dt><dd>${fonte}</dd><dt>Datas</dt><dd>evento ${esc(fmtD(it.datas?.evento))} • publicação ${esc(fmtD(it.datas?.publicacao))} • registrado ${esc(dtBR(it.at))}${it.origem === 'ia' ? ' • ' + esc(AI_PROV[it.provedor]?.nome || it.provedor) : it.origem === 'base' ? ' • estudo da base interna' : ' • cadastro manual'}</dd>
  <dt>Impacto possível</dt><dd>${esc(it.impacto || '—')}</dd><dt>Justificativa</dt><dd>${esc(it.justificativa || '—')}</dd><dt>Ação sugerida</dt><dd>${esc(it.acao || '—')}</dd>
  <dt>Clientes relacionados</dt><dd>${cl.length ? `${cl.length} por recorte (${esc(escopo)}): ${cl.slice(0, 6).map(c => esc(c.name)).join('; ')}${cl.length > 6 ? '…' : ''}. <span class="muted">Relação por segmento/UF — não indica necessidade do cliente.</span>` : `<span class="muted">nenhum no recorte${e.seg || e.uf ? '' : ' (insight sem segmento/UF)'}</span>`}</dd></dl>
  ${(it.obs || []).length ? `<div class="sm muted">${it.obs.map(esc).join(' • ')}</div>` : ''}
  ${(it.salvoEm || []).length ? `<div class="sm">Salvo em: ${it.salvoEm.map(x => esc(S.clients[x.key]?.name || '(removido)')).join('; ')}</div>` : ''}
  <div class="row sm">${cl.length ? `<select data-id="${esc(it.id)}" aria-label="Cliente">${cl.map(c => `<option value="${esc(c.key)}">${esc(c.name)}</option>`).join('')}</select><button class="btn sm" data-a="mkSalvar" data-id="${esc(it.id)}">Salvar no cliente</button><button class="btn sm" data-a="mkAcao" data-id="${esc(it.id)}">Salvar + criar ação</button>` : ''}<button class="btn ghost sm" data-a="mkDel" data-id="${esc(it.id)}">Remover</button></div></div>`;
}

/* ---------- Estudos por segmento da carteira (base interna com fonte e data; não é consulta em tempo real) ---------- */
function mkSegCarteira() {
  const cnt = new Map(); clients().forEach(c => { const id = c.segInfo?.id; if (id && c.segInfo.mode !== 'ausente' && c.segInfo.mode !== 'nao_mapeado') (cnt.get(id) || cnt.set(id, []).get(id)).push(c); });
  const com = KB.segments.filter(s => cnt.has(s.id)).sort((a, b) => cnt.get(b.id).length - cnt.get(a.id).length).map(s => ({ s, cl: cnt.get(s.id) }));
  const sem = KB.segments.filter(s => !cnt.has(s.id) && (s.tendencias || []).length);
  return { com, sem, total: clients().length, semSeg: clients().length - [...cnt.values()].reduce((n, l) => n + l.length, 0) };
}
function mkFromKB(segId, idx, key) {
  const sg = KB.segments.find(s => s.id === segId), t = sg?.tendencias?.[+idx]; if (!t) return;
  let it = S.insights.find(y => (t.fonte?.u && mkDK(y) === 'u:' + normUrl(t.fonte.u)) || mkTK(y) === mkTK({ titulo: t.t }));
  if (!it) {
    it = { id: 'ins_' + uid(), at: nowISO(), upd: nowISO(), titulo: String(t.t).slice(0, 300), tipo: 'tendencia', classe: 'contexto', fonte: { nome: t.fonte?.t || '', url: t.fonte?.u || '', verificada: false, oficial: false }, datas: { evento: '', publicacao: mkIso(t.fonte?.d) },
      impacto: t.impacto || '', justificativa: `Estudo da base interna do segmento "${sg.nome}" (pesquisa registrada em ${KB.dataPesquisa || '04/11/2026'}; data da fonte: ${t.fonte?.d || 'não informada'}).`, acao: 'Usar como gancho de abordagem e validar a necessidade com o cliente.',
      obs: ['estudo da base interna — não é consulta em tempo real'], salvoEm: [], escopo: { seg: segId, sub: '', uf: '', per: '' }, origem: 'base', provedor: '', modelo: '', consultadoEm: '', usouBusca: false };
    S.insights.unshift(it); touchG('insights', it.id);
  }
  if (key) mkSalvar(it.id, key); else render();
}
function mkAtualizarSeg(segId) { UI.mk.seg = segId; UI.mk.uf = ''; UI.mk.sub = ''; mkBuscar(); }
function mkDiag() {
  const T = aiTarefa('mercado'), modo = bkModo(), ia = iaInit(), st = iaStatusOf(T.prov), n = clients().length, sg = mkSegCarteira();
  const row = (ok, t, d, a) => `<li>${pill(ok ? 'ok' : 'pendente', ok ? 'ok' : 'warn')} <b>${t}</b> — ${d}${!ok && a ? ` <span class="muted">Ação: ${a}</span>` : ''}</li>`;
  return `<div class="card"><h3>Situação da pesquisa de mercado</h3><ul class="sm">
  ${row(n > 0, 'Carteira', n ? `${n} cliente(s); ${sg.com.length} segmento(s) com estudo; ${sg.semSeg} sem segmento definido` : 'carteira vazia', 'importe a planilha em Carteira → Importar. Sem carteira, os estudos abaixo ficam como referência por segmento.')}
  ${row(st.k === 'verificado', 'Provedor de IA para pesquisa', `${esc(AI_PROV[T.prov].nome)} / ${esc(T.modelo)} — ${esc(st.l)}`, 'cadastre a chave no backend e execute o teste em Configurações → Provedores de IA.')}
  ${row(modo === 'direto', 'Transporte para atualização', esc(BK_TXT[modo]), 'configure a URL e o token do backend em Integrações; sem isso a atualização gera um pedido para envio manual.')}
  </ul><p class="sm muted">Estudos por segmento vêm da base interna (fontes e datas indicadas, pesquisa registrada na base — não é consulta em tempo real). Notícias recentes só entram por "Atualizar" com busca web real ou cadastro manual com fonte. Nada é inventado.</p></div>`;
}
function mkEstudos() {
  const { com, sem } = mkSegCarteira();
  const trend = (sg, t, i, cl) => `<li><div>${esc(t.t)}</div><div class="sm muted">Fonte: ${t.fonte?.u ? `<a href="${esc(t.fonte.u)}" target="_blank" rel="noopener noreferrer">${esc(t.fonte.t)}</a>` : esc(t.fonte?.t || 'sem fonte')} • data: ${esc(t.fonte?.d || 'não informada')} • ${pill('base interna', 'off')}${t.impacto ? ` • Impacto possível: ${esc(t.impacto)}` : ''}</div>${cl.length ? `<div class="row sm"><select data-id="kb_${esc(sg.id)}_${i}" aria-label="Cliente">${cl.map(c => `<option value="${esc(c.key)}">${esc(c.name)}</option>`).join('')}</select><button class="btn ghost sm" data-a="mkKbSalvar" data-seg="${esc(sg.id)}" data-i="${i}">Salvar no cliente</button></div>` : ''}</li>`;
  const bloco = (sg, cl, open) => `<details class="card" ${open ? 'open' : ''}><summary><b>${esc(sg.nome)}</b> ${cl.length ? pill(cl.length + ' cliente(s) na carteira', 'info') : pill('sem clientes na carteira', 'off')}</summary>
  <p class="sm">${esc(sg.resumo || '')}</p>
  ${cl.length ? `<p class="sm muted">Relação com a carteira: ${cl.length} cliente(s) classificados neste segmento — ${cl.slice(0, 8).map(c => esc(c.name)).join('; ')}${cl.length > 8 ? '…' : ''}. Relação por segmento, não por evidência individual.</p>` : ''}
  <h4>Tendências e indicadores (${(sg.tendencias || []).length})</h4><ul class="sm">${(sg.tendencias || []).map((t, i) => trend(sg, t, i, cl)).join('')}</ul>
  ${(sg.dores || []).length ? `<h4>Possíveis dores (hipóteses setoriais)</h4><ul class="sm">${sg.dores.map(d => `<li>${esc(d)}</li>`).join('')}</ul>` : ''}
  ${(sg.demandas || []).length ? `<h4>Demandas típicas</h4><ul class="sm">${sg.demandas.map(d => `<li>${esc(d)}</li>`).join('')}</ul>` : ''}
  <div class="row"><button class="btn ghost sm" data-a="mkAtualizarSeg" data-seg="${esc(sg.id)}" ${UI.mk.busy ? 'disabled' : ''}>Atualizar este segmento (IA com busca web)</button></div></details>`;
  return `<div class="card"><h3>Estudos por segmento da carteira</h3>${com.length ? `<p class="sm muted">Ordenados pelo nº de clientes da carteira em cada segmento.</p>` : `<p class="sm muted">Nenhum cliente da carteira com segmento definido: ${clients().length ? 'defina o segmento dos clientes em Carteira → Segmentos' : 'importe a carteira em Carteira → Importar'}. Os estudos abaixo são referência por segmento.</p>`}</div>`
    + com.map(x => bloco(x.s, x.cl, true)).join('') + (sem.length ? `<details class="card"><summary><b>Outros segmentos da base (${sem.length}) — sem clientes na carteira</b></summary>${sem.map(sg => bloco(sg, [], false)).join('')}</details>` : '');
}
function vMercadoSeg() {
  const m = UI.mk, T = aiTarefa('mercado'), ult = mkUlt(), modo = bkModo(), q = norm(m.fq);
  const list = S.insights.filter(i => (!m.fseg || i.escopo?.seg === m.fseg) && (!m.fuf || i.escopo?.uf === m.fuf) && (!m.fcl || i.classe === m.fcl) && (!q || norm(`${i.titulo} ${i.impacto} ${i.fonte?.nome}`).includes(q))).sort((a, b) => (b.datas?.evento || b.datas?.publicacao || b.at.slice(0, 10)).localeCompare(a.datas?.evento || a.datas?.publicacao || a.at.slice(0, 10)));
  let h = `<div class="card"><h3>Inteligência Comercial</h3><p class="sm">Notícias, indicadores, tendências, riscos, oportunidades e mudanças regulatórias por recorte de mercado. <b>Contexto de mercado não é evidência individual</b> do cliente: serve para preparar abordagem e perguntas, não para afirmar necessidade, elegibilidade ou contratação.</p>
  <div class="row"><label class="sm">Segmento <select data-c="mk" data-f="seg"><option value="">—</option>${KB.segments.map(s => optS(s.id, s.nome, m.seg)).join('')}</select></label>
  <label class="sm">Subsegmento <input type="text" data-c="mk" data-f="sub" value="${esc(m.sub)}" placeholder="opcional (ex.: autopeças)" ${m.seg ? '' : 'disabled'} style="max-width:200px"></label>
  <label class="sm">Região (UF) <select data-c="mk" data-f="uf"><option value="">Brasil</option>${UFS.map(u => optS(u, u, m.uf)).join('')}</select></label>
  <label class="sm">Período <select data-c="mk" data-f="per">${Object.entries(MK_PER).map(([k, l]) => optS(k, l, m.per)).join('')}</select></label></div>
  <div class="row"><button class="btn pri" data-a="mkBuscar" ${m.busy ? 'disabled' : ''}>${m.busy ? 'Pesquisando…' : 'Atualizar insights (IA com busca web)'}</button><button class="btn ghost" data-a="mkManualAbrir">Cadastrar insight manual</button><label class="btn ghost" style="cursor:pointer">Importar resposta (.json)<input type="file" id="f-ai2" accept=".json" hidden></label></div>
  <p class="sm muted">Provedor da tarefa: <b>${esc(AI_PROV[T.prov].nome)}</b> / ${esc(T.modelo)} • busca web ${T.busca ? 'ligada' : 'desligada'} • transporte: ${esc(BK_TXT[modo])}. Última atualização por IA: <b>${ult ? esc(fmtDate(ult)) : 'nunca'}</b>. A atualização é <b>manual</b>: não há agendador, portanto nenhum monitoramento automático. Subsegmento refina a pesquisa; a carteira não tem campo de subsegmento, então clientes relacionados usam segmento e UF. O prompt não leva CNPJ, valores nem nomes de clientes.</p></div>`;
  if (m.err) h += `<div class="alert b" role="alert"><b>Falha na atualização:</b> ${esc(m.err)}</div>`;
  if (m.rep) { const r = m.rep; h += `<div class="alert i"><b>Atualização concluída${r.prov ? ' (' + esc(r.prov) + ')' : ''}:</b> ${r.total} item(ns) recebido(s) • ${r.novos} novo(s) • ${r.dup} duplicado(s) ignorado(s) • ${r.hip} tratado(s) como hipótese • ${r.foraPeriodo} fora do período${r.usouBusca ? '' : ' • <b>busca web não executada</b>'}${r.avisos.length ? '<ul class="sm">' + r.avisos.map(a => `<li>${esc(a)}</li>`).join('') + '</ul>' : ''}<button class="btn ghost sm" data-a="mkRep">Fechar</button></div>`; }
  if (m.man) h += `<div class="card" id="mkman"><h3>Cadastro manual</h3><p class="sm muted">Recorte atual: ${esc([m.seg ? segName(m.seg) : '', m.sub, m.uf].filter(Boolean).join(' • ') || 'nenhum — o insight não terá clientes relacionados')}. Com URL e data vira "contexto" (fonte informada por você, não verificada); sem fonte, "hipótese".</p>
  <div class="row"><input type="text" data-f="titulo" placeholder="Acontecimento" style="flex:1;min-width:280px"><select data-f="tipo">${Object.entries(MK_TIPOS).map(([k, l]) => optS(k, l, 'noticia')).join('')}</select></div>
  <div class="row"><input type="text" data-f="fonteNome" placeholder="Nome da fonte"><input type="text" data-f="url" placeholder="https://…" style="flex:1;min-width:240px"><label class="sm">Evento <input type="date" data-f="dataEvento"></label><label class="sm">Publicação <input type="date" data-f="dataPub"></label></div>
  <div class="row"><input type="text" data-f="impacto" placeholder="Impacto possível" style="flex:1;min-width:240px"><input type="text" data-f="just" placeholder="Justificativa" style="flex:1;min-width:240px"><input type="text" data-f="acao" placeholder="Ação sugerida" style="flex:1;min-width:240px"></div>
  <div class="row"><button class="btn pri" data-a="mkManual">Salvar insight</button><button class="btn ghost" data-a="mkManualAbrir">Cancelar</button></div></div>`;
  h += mkDiag() + mkEstudos() + `<h3 style="margin:14px 0 4px">Insights registrados</h3>`;
  h += `<div class="filters"><input type="text" data-c="mk" data-f="fq" value="${esc(m.fq)}" placeholder="Buscar nos insights…" style="min-width:220px"><select data-c="mk" data-f="fseg"><option value="">Todos os segmentos</option>${KB.segments.map(s => optS(s.id, s.nome, m.fseg)).join('')}</select><select data-c="mk" data-f="fuf"><option value="">Todas as UFs</option>${UFS.map(u => optS(u, u, m.fuf)).join('')}</select><select data-c="mk" data-f="fcl"><option value="">Contexto e hipótese</option>${optS('contexto', 'Contexto (fonte citada)', m.fcl)}${optS('hipotese', 'Hipótese', m.fcl)}</select></div>
  <div class="muted sm" style="margin-bottom:6px">${list.length} de ${S.insights.length} insight(s)</div>`;
  h += list.length ? list.map(mkCard).join('') : `<div class="card"><p class="sm muted">${S.insights.length ? 'Nenhum insight com estes filtros.' : 'Nenhum insight registrado: notícias recentes aparecem após "Atualizar insights" (IA com busca web, requer provedor testado e backend) ou cadastro manual com fonte. Os estudos por segmento acima não dependem disso.'}</p></div>`;
  return h;
}
/* bloco no cliente: contexto salvo, separado de evidência individual */
function insBlock(c) {
  const r = (c.insRef || []).map(x => ({ ...x, ins: S.insights.find(i => i.id === x.id) })).filter(x => x.ins);
  if (!r.length) return '';
  return `<div class="card"><h3>Contexto de mercado salvo (${r.length})</h3><p class="sm muted">Contexto setorial/regional; <b>não é evidência individual</b> deste cliente.</p><ul class="sm">${r.map(x => `<li>${esc(x.ins.titulo)} — ${x.ins.fonte?.url ? `<a href="${esc(x.ins.fonte.url)}" target="_blank" rel="noopener noreferrer">${esc(x.ins.fonte.nome || hostOf(x.ins.fonte.url))}</a>` : 'sem fonte'} • ${esc(fmtD(x.ins.datas?.evento || x.ins.datas?.publicacao))} ${pill(x.ins.classe === 'contexto' ? 'contexto' : 'hipótese', x.ins.classe === 'contexto' ? 'ok' : 'warn')}${x.ins.acao ? `<br><span class="muted">Sugestão: ${esc(x.ins.acao)}</span>` : ''}${x.acao ? ' ' + pill('ação no plano', 'info') : ''}</li>`).join('')}</ul></div>`;
}
