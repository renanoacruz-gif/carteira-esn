/* ===== Onda 2: retornos com data, pós-reunião, follow-up, renovações, carteira em risco, exportação para CRM ===== */

/* ---------- Retornos (tarefas livres do cliente, em c.act['ret:…']) ---------- */
const RT_ABERTO = a => !['Concluído', 'Descartado'].includes(a.status || 'Pendente');
const RT_DATA = /^\d{4}-\d{2}-\d{2}$/;
const rtLista = (c, soAbertos = true) => Object.entries(c.act || {}).filter(([k, a]) => k.startsWith('ret:') && (!soAbertos || RT_ABERTO(a)))
  .map(([id, a]) => ({ id, texto: a.texto || '', prazo: a.prazo || '', resp: a.resp || '', status: a.status || 'Pendente', origem: a.origem || '' }))
  .sort((x, y) => (x.prazo || '9999').localeCompare(y.prazo || '9999'));
function rtAdd(c, { texto, prazo, resp, origem }) {
  texto = String(texto || '').replace(/\s+/g, ' ').trim().slice(0, 300); prazo = RT_DATA.test(prazo || '') ? prazo : '';
  if (texto.length < 3) return false;
  c.act ||= {}; c.act['ret:' + uid()] = { texto, prazo, resp: String(resp || '').trim().slice(0, 80), status: 'Pendente', origem: origem || 'manual', criado: today() };
  touchC(c.key); return true;
}
function rtSet(c, id, patch) { if (!id.startsWith('ret:') || !c.act?.[id]) return; c.act[id] = { ...c.act[id], ...patch }; touchC(c.key); }
function rtDel(c, id) { if (!id.startsWith('ret:') || !c.act?.[id]) return; delete c.act[id]; touchC(c.key); }
const rtVenc = r => !!r.prazo && r.prazo < today(), rtHoje = r => r.prazo === today();

/* ---------- Pós-reunião: barreira de dados sensíveis + extração com a chave do próprio usuário ---------- */
const REU = { key: null, ata: '', mask: null, res: null, busy: false, err: '', nome: '', fu: '' };
const REU_PAD = [
  [/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, '[CNPJ]', 'CNPJ'],
  [/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, '[CPF]', 'CPF'],
  [/R\$\s*[\d.,]+|\b\d{1,3}(?:\.\d{3})+,\d{2}\b/g, '[valor]', 'valor monetário'],
  [/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '[e-mail]', 'e-mail'],
  [/(?:\+?55\s?)?\(?\b\d{2}\)?\s?9?\d{4}[-\s]?\d{4}\b/g, '[telefone]', 'telefone']
];
function reuMascarar(t) {
  let out = String(t || ''); const n = {};
  REU_PAD.forEach(([re, rep, nome]) => { out = out.replace(re, () => { n[nome] = (n[nome] || 0) + 1; return rep; }); });
  return { texto: out, n, total: Object.values(n).reduce((a, b) => a + b, 0) };
}
const REU_MAX = 9000;
function reuPrompt(txt) {
  return `Você é assistente de um executivo de contas de software de gestão. Abaixo está a ata (ou anotação) de uma reunião com um cliente; CNPJ, valores, e-mails e telefones foram removidos de propósito.
Extraia SOMENTE o que está escrito no texto; não invente prazos, nomes ou compromissos. Se uma data não estiver explícita, deixe o prazo vazio. Hoje é ${today()}.
Devolva apenas JSON: {"compromissos":["o que ficou combinado entre as partes"],"objecoes":["dúvidas, resistências ou riscos levantados pelo cliente"],"proximos_passos":[{"texto":"ação objetiva","prazo":"AAAA-MM-DD ou vazio","responsavel":"nome ou vazio"}]}. Máximo 8 itens por lista.
ATA:
${txt}`;
}
function reuLimpaRes(d) {
  const L = (a, n = 8) => (Array.isArray(a) ? a : []).map(x => String(x?.texto ?? x ?? '').replace(/\s+/g, ' ').trim().slice(0, 300)).filter(x => x.length >= 3).slice(0, n);
  const passos = (Array.isArray(d?.proximos_passos) ? d.proximos_passos : []).slice(0, 8).map(x => ({ texto: String(x?.texto ?? x ?? '').replace(/\s+/g, ' ').trim().slice(0, 300), prazo: RT_DATA.test(x?.prazo || '') ? x.prazo : '', resp: String(x?.responsavel || '').trim().slice(0, 80) })).filter(x => x.texto.length >= 3);
  return { compromissos: L(d?.compromissos), objecoes: L(d?.objecoes), passos };
}
async function reuExtrair(c) {
  const ata = $('#reu-ata')?.value ?? REU.ata; REU.ata = ata;
  if (ata.trim().length < 20) return toast('Cole a ata ou as anotações da reunião (mínimo 20 caracteres).');
  const m = reuMascarar(ata); if (m.texto.length > REU_MAX) return toast(`Texto grande demais (${m.texto.length} caracteres). Envie no máximo ${REU_MAX}: resuma ou divida a ata.`);
  REU.mask = m; REU.busy = true; REU.err = ''; REU.res = null; render();
  try {
    const T = aiTarefa('ata'), pedido = { versao: 2, pedidoId: 'r_' + uid(), provedor: T.prov, modelo: T.modelo, tarefa: 'estruturado', formato: 'json', buscaWeb: false, prompt: reuPrompt(m.texto) };
    const r = await bkChamar('ia', pedido, `pedido-ata-${pedido.pedidoId}.json`);
    if (r.via !== 'direto') throw new Error('A extração por arquivo não está disponível para a ata. Use a chave pessoal em Configurações → IA e provedores, ou registre os retornos manualmente.');
    const j = r.resp; if (!j?.ok) throw new Error(`${j?.erro?.codigo || 'erro'}: ${j?.erro?.mensagem || 'falha na IA'}`);
    if (!j.dados) throw new Error('A IA não devolveu um resultado estruturado. Tente de novo ou registre manualmente.');
    REU.res = reuLimpaRes(j.dados); REU.res.sel = {};
  } catch (e) { REU.err = e.message || 'Falha ao extrair.'; }
  REU.busy = false; render();
}
function reuSalvar(c) {
  const R = REU.res; if (!R) return; let nr = 0; const nota = [];
  const marcados = pref => [...document.querySelectorAll(`input[data-reu^="${pref}"]:checked`)].map(x => +x.dataset.reu.split(':')[1]);
  marcados('p').forEach(i => { const p = R.passos[i]; if (p && rtAdd(c, { ...p, origem: 'pos-reuniao' })) nr++; });
  const cm = marcados('c').map(i => R.compromissos[i]).filter(Boolean), ob = marcados('o').map(i => R.objecoes[i]).filter(Boolean);
  if (cm.length) nota.push('Compromissos: ' + cm.join(' | ')); if (ob.length) nota.push('Objeções: ' + ob.join(' | '));
  if (nota.length) { c.mgmt ||= {}; c.mgmt.notes = [c.mgmt.notes, `[${fmtD(today())} • pós-reunião] ` + nota.join(' • ')].filter(Boolean).join('\n'); touchC(c.key); }
  if (!nr && !nota.length) return toast('Marque ao menos um item para salvar.');
  REU.res = null; REU.mask = null; REU.ata = ''; toast(`Salvo: ${nr} retorno(s)${nota.length ? ' e anotação no cliente' : ''}.`); render();
}

/* ---------- Rascunho de follow-up (sem envio: o texto só é copiado) ---------- */
function fuTexto(c, nome) {
  const ab = rtLista(c).filter(r => r.status !== 'Descartado'), n = String(nome || '').trim().split(/\s+/)[0];
  const itens = ab.slice(0, 6).map(r => `• ${r.texto}${r.prazo ? ` (até ${fmtD(r.prazo)})` : ''}${r.resp ? ` — ${r.resp}` : ''}`);
  return `${n ? 'Olá, ' + n + '!' : 'Olá!'}\n\nObrigado pelo tempo na nossa conversa. Registrando o que combinamos:\n\n${itens.length ? itens.join('\n') : '• (inclua aqui os combinados)'}\n\nSe eu entendi algo diferente, me avise para ajustarmos. Fico à disposição.\n\nAbraço,\n${S.meta.exec?.nome || ''}`.trim();
}

/* ---------- Aba "Reunião e retornos" ---------- */
function tabReuniao(c) {
  if (REU.key !== c.key) Object.assign(REU, { key: c.key, ata: '', mask: null, res: null, busy: false, err: '', nome: '', fu: '' });
  const rs = rtLista(c, false), ab = rs.filter(r => RT_ABERTO(r));
  const linha = r => `<tr><td>${esc(r.texto)}${r.origem === 'pos-reuniao' ? ' <span class="muted sm">(da ata)</span>' : ''}</td><td>${r.prazo ? esc(fmtD(r.prazo)) + (RT_ABERTO(r) && rtVenc(r) ? ' ' + pill('vencido', 'bad') : RT_ABERTO(r) && rtHoje(r) ? ' ' + pill('hoje', 'warn') : '') : '<span class="muted">sem data</span>'}</td><td>${esc(r.resp || '—')}</td><td>${esc(r.status)}</td>
    <td class="nw">${RT_ABERTO(r) ? `<button class="btn ghost sm" data-a="rtOk" data-k="${kk(c)}" data-id="${esc(r.id)}">Concluir</button>` : `<button class="btn ghost sm" data-a="rtReabrir" data-k="${kk(c)}" data-id="${esc(r.id)}">Reabrir</button>`} <button class="btn ghost sm" data-a="rtDel" data-k="${kk(c)}" data-id="${esc(r.id)}">Remover</button></td></tr>`;
  let h = `<div class="card"><h3>Retornos <span class="pill p-info">${ab.length} em aberto</span></h3>
  <p class="muted sm">Combinados com este cliente, com a data que você definir. Retornos vencidos ou que vencem hoje entram na Central de Pendências e, se o lembrete diário estiver ativo, no número do aviso (só o número).</p>
  ${rs.length ? `<div class="tw"><table><thead><tr><th>Retorno</th><th>Prazo</th><th>Responsável</th><th>Situação</th><th></th></tr></thead><tbody>${rs.map(linha).join('')}</tbody></table></div>` : '<p class="muted sm">Nenhum retorno registrado.</p>'}
  <div class="row" style="margin-top:8px"><input type="text" id="rt-texto" placeholder="O que ficou combinado (ex.: enviar proposta revisada)" style="min-width:280px;flex:1" maxlength="300"><input type="date" id="rt-prazo"><input type="text" id="rt-resp" placeholder="Responsável" style="min-width:120px" maxlength="80"><button class="btn" data-a="rtAdd" data-k="${kk(c)}">Adicionar retorno</button></div></div>`;
  h += empInterCard(c);
  h += `<div class="card"><h3>Pós-reunião: ata → retornos</h3>
  <p class="muted sm">Cole a ata ou suas anotações. <b>Antes de qualquer envio, CNPJ, CPF, valores em reais, e-mails e telefones são trocados por marcadores</b> e você vê o texto exato que será enviado. A leitura usa a sua chave de IA (Configurações → IA e provedores); nada é salvo sem a sua revisão.</p>
  <textarea id="reu-ata" rows="6" style="width:100%" placeholder="Cole aqui a ata da reunião…">${esc(REU.ata)}</textarea>
  <div class="row"><button class="btn" data-a="reuExtrair" data-k="${kk(c)}" ${REU.busy ? 'disabled' : ''}>${REU.busy ? 'Lendo a ata…' : 'Extrair compromissos, objeções e próximos passos'}</button><button class="btn ghost" data-a="reuPrevia" data-k="${kk(c)}">Ver o que será enviado</button></div>`;
  if (REU.mask) h += `<details ${REU.res ? '' : 'open'}><summary class="sm">Texto que ${REU.res ? 'foi' : 'será'} enviado${REU.mask.total ? ` — ${REU.mask.total} dado(s) sensível(is) trocado(s) por marcador (${Object.entries(REU.mask.n).map(([k, v]) => v + ' ' + k).join(', ')})` : ' — nenhum dado sensível detectado'}</summary><pre class="sm" style="white-space:pre-wrap;max-height:220px;overflow:auto">${esc(REU.mask.texto)}</pre></details>`;
  if (REU.err) h += `<div class="alert w sm">${esc(REU.err)}</div>`;
  if (REU.res) {
    const R = REU.res, bloco = (tit, pref, arr, fmt) => arr.length ? `<h4>${tit}</h4><ul class="sm" style="list-style:none;padding-left:0">${arr.map((x, i) => `<li><label><input type="checkbox" data-reu="${pref}:${i}" checked> ${fmt(x)}</label></li>`).join('')}</ul>` : '';
    h += `<div class="alert i sm"><b>Revise antes de salvar.</b> É a leitura de uma IA sobre o texto que você colou: confira, desmarque o que não vale e só então salve. Próximos passos viram retornos; compromissos e objeções viram uma anotação datada no cliente.</div>
    ${bloco('Próximos passos', 'p', R.passos, x => `${esc(x.texto)}${x.prazo ? ` <span class="muted">— prazo ${esc(fmtD(x.prazo))}</span>` : ' <span class="muted">— sem data</span>'}${x.resp ? ` <span class="muted">— ${esc(x.resp)}</span>` : ''}`)}
    ${bloco('Compromissos', 'c', R.compromissos, esc)}${bloco('Objeções e riscos levantados', 'o', R.objecoes, esc)}
    ${R.passos.length + R.compromissos.length + R.objecoes.length ? `<div class="row"><button class="btn pri" data-a="reuSalvar" data-k="${kk(c)}">Salvar itens marcados</button><button class="btn ghost" data-a="reuDescartar">Descartar</button></div>` : '<p class="muted sm">A IA não encontrou itens no texto.</p>'}`;
  }
  h += `</div><div class="card"><h3>Rascunho de follow-up</h3><p class="muted sm">Monta um texto com os retornos em aberto deste cliente. <b>O aplicativo não envia nada</b>: você copia, ajusta e envia pelo seu e-mail.</p>
  <div class="row"><input type="text" id="fu-nome" placeholder="Nome do contato (opcional)" value="${esc(REU.nome)}" style="min-width:220px"><button class="btn" data-a="fuGerar" data-k="${kk(c)}">Gerar rascunho</button></div>
  ${REU.fu ? `<textarea id="fu-txt" rows="9" style="width:100%;margin-top:8px">${esc(REU.fu)}</textarea><div class="row"><button class="btn ghost" data-a="fuCopiar">Copiar texto</button></div>` : ''}</div>`;
  return h;
}
document.addEventListener('input', e => { const t = e.target; if (t?.id === 'reu-ata') REU.ata = t.value; else if (t?.id === 'fu-nome') REU.nome = t.value; });

/* ---------- Linha do tempo de renovações (I2) ---------- */
function rnvItens() {
  const out = [], vistos = new Set();
  clients().forEach(c => {
    const v = (() => { try { return mrrOf(c).v; } catch { return null; } })();
    const push = (kind, iso, d, fonte, conf) => { if (d == null || d > 180) return; const id = `${c.key}|${iso}|${kind}`; if (vistos.has(id)) return; vistos.add(id); out.push({ c, kind, iso, d, fonte, mrr: v, conf }); };
    (c.dtList || []).filter(g => g.st === 'confirmada').forEach(g => push(DT_K[g.kind]?.[0] || g.kind, g.isoF, g.d, `${g.origem}: ${g.arq}`, true));
    try { ctReminders(c).filter(x => x.nivel === 'alerta' || x.nivel === 'passada').forEach(x => push(x.l, x.data, x.d, 'contrato (data confirmada)', true)); } catch { /* sem contratos */ }
  });
  return out.sort((a, b) => a.d - b.d);
}
const RNV_FX = [['Já passou — confirmar a nova data', x => x.d < 0, 'bad'], ['Em até 30 dias', x => x.d >= 0 && x.d <= 30, 'bad'], ['De 31 a 90 dias', x => x.d > 30 && x.d <= 90, 'warn'], ['De 91 a 180 dias', x => x.d > 90 && x.d <= 180, 'info']];
function rnvCard() {
  const it = rnvItens(); if (!it.length) return '';
  const blocos = RNV_FX.map(([t, f, tom]) => {
    const L = it.filter(f); if (!L.length) return '';
    const soma = L.reduce((a, x) => a + (x.mrr || 0), 0), sem = L.filter(x => x.mrr == null).length;
    return `<h4>${pill(t, tom)} <span class="muted sm">${L.length} data(s)${soma ? ` • MRR identificado ${fmtBRL(soma)}${sem ? ` (${sem} sem MRR)` : ''}` : ''}</span></h4>
    <ul>${L.map(x => `<li class="sm"><b>${esc(x.c.name)}</b> • ${esc(x.kind)} • ${esc(fmtD(x.iso))} (${x.d < 0 ? 'há ' + (-x.d) : x.d} dia(s))${x.mrr != null ? ` • ${fmtBRL(x.mrr)}` : ''}<div class="muted">${esc(x.fonte)}</div></li>`).join('')}</ul>`;
  }).join('');
  return `<div class="card"><h3>Renovações nos próximos 180 dias <span class="pill p-info">${it.length}</span></h3>
  <p class="muted sm">Só entram datas <b>confirmadas por você</b> (gatilhos de data e contratos). Datas apenas encontradas em documentos aguardam confirmação nos Gatilhos de data. MRR é o valor identificado hoje, não previsão de renovação.</p>${blocos}</div>`;
}

/* ---------- Carteira em risco (I1): somente sinais documentados ---------- */
function riscoItens() {
  const pend = (() => { try { return pendItems(); } catch { return []; } })(), venc = new Map();
  pend.filter(x => x.tipo === 'acao' && x.key).forEach(x => venc.set(x.key, (venc.get(x.key) || 0) + 1));
  const out = [];
  clients().forEach(c => {
    const s = []; let pts = 0; const add = (p, t) => { pts += p; s.push(t); };
    const datas = [];
    (c.dtList || []).filter(g => g.st === 'confirmada' && g.d != null && g.d <= 180).forEach(g => datas.push(g.d));
    try { ctReminders(c).filter(x => x.nivel === 'alerta' || x.nivel === 'passada').forEach(x => datas.push(x.d)); } catch { /* sem contratos */ }
    if (datas.length) { const d = Math.min(...datas); add(d < 0 ? 2 : d <= 30 ? 3 : d <= 90 ? 2 : 1, d < 0 ? 'Data de vigência/renovação confirmada já passou' : `Vigência/renovação confirmada em ${d} dia(s)`); }
    try { if (fichasOk(c).length) { const n = fsLinhas(c).filter(r => r.st === 'Cancelado').length; if (n) add(2, `${n} item(ns) cancelado(s)/legado(s) na ficha`); } } catch { /* sem ficha */ }
    const fk = c.fstat?.k; if (['desatualizada', 'nao_carregada'].includes(fk)) add(1, fk === 'desatualizada' ? 'Ficha desatualizada (pouca visibilidade)' : 'Sem ficha de faturamento (pouca visibilidade)');
    const v = venc.get(c.key) || 0; if (v) add(Math.min(v, 2), `${v} retorno(s)/prazo(s) vencido(s)`);
    if (pts) out.push({ c, pts, s, mrr: (() => { try { return mrrOf(c).v; } catch { return null; } })() });
  });
  return out.sort((a, b) => b.pts - a.pts || (b.mrr || 0) - (a.mrr || 0));
}
function riscoCard() {
  const L = riscoItens(); if (!L.length) return '';
  const top = L.slice(0, 10), soma = L.reduce((a, x) => a + (x.mrr || 0), 0);
  return `<div class="card"><h3>Carteira: onde há sinal de risco <span class="pill p-warn">${L.length}</span></h3>
  <p class="muted sm"><b>Sinais documentados, não previsão de perda.</b> Reúne datas confirmadas, itens cancelados em ficha, ficha ausente/desatualizada e prazos vencidos. Cada linha mostra o motivo; a ordem é por quantidade de sinais e, no empate, por MRR identificado.${soma ? ` MRR identificado nos clientes listados: <b>${fmtBRL(soma)}</b>.` : ''}</p>
  <div class="tw"><table><thead><tr><th>Cliente</th><th>Sinais</th><th>MRR</th></tr></thead><tbody>${top.map(x => `<tr><td><a href="#" data-a="open" data-k="${kk(x.c)}"><b>${esc(x.c.name)}</b></a></td><td class="sm"><ul style="margin:0;padding-left:16px">${x.s.map(t => `<li>${esc(t)}</li>`).join('')}</ul></td><td class="nw">${x.mrr != null ? fmtBRL(x.mrr) : '—'}</td></tr>`).join('')}</tbody></table></div>
  ${L.length > top.length ? `<p class="muted sm">+ ${L.length - top.length} cliente(s) com sinais.</p>` : ''}</div>`;
}

/* ---------- Exportação para CRM / Mesa de Forecast (D2): layout genérico ---------- */
const CRM_HEAD = ['Cliente', 'Código', 'CNPJ', 'Segmento', 'MRR identificado', 'Origem do MRR', 'Competência', 'Oportunidade', 'Tipo', 'Prioridade', 'Confiança', 'Validação', 'Situação comercial', 'Responsável', 'Prazo', 'Próxima ação', 'Próxima renovação confirmada', 'Retornos em aberto'];
function crmLinhas() {
  const rn = new Map(); rnvItens().forEach(x => { if (x.d >= 0 && !rn.has(x.c.key)) rn.set(x.c.key, x.iso); });
  const rows = [];
  clients().forEach(c => {
    let m = { v: null, origem: '', comp: '' }; try { m = mrrOf(c); } catch { /* sem MRR */ }
    const seg = c.segInfo?.id ? segName(c.segInfo.id) : '', nret = rtLista(c).length;
    const base = [c.name, c.code || '', c.cnpj || '', seg || '', m.v ?? '', m.v != null ? (m.origem || '') : '', m.v != null ? (m.comp || '') : ''];
    const fim = [rn.get(c.key) ? fmtD(rn.get(c.key)) : '', nret];
    const ativas = c.opps.filter(o => oppAtiva(c, o));
    if (!ativas.length) rows.push([...base, '', '', '', '', '', '', '', '', '', ...fim]);
    ativas.forEach(o => { const d = decGet(c, o.ruleId); rows.push([...base, o.titulo || o.nome || o.ruleId, o.tipo, o.prio, o.conf, VALID_L[d.valid] || d.valid, SIT_L[d.sit] || d.sit, d.resp || '', d.prazo ? fmtD(d.prazo) : '', o.acao || '', ...fim]); });
  });
  return rows;
}
const crmExportar = () => offer('carteira-para-crm-forecast.csv', toCSV(CRM_HEAD, crmLinhas()));

/* ---------- Sugerir melhoria (G5): vai para o painel do administrador ---------- */
function sugCard() {
  const op = Object.entries(typeof SUG_L === 'object' ? SUG_L : { geral: 'Geral' }).map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join('');
  return `<div class="card" id="sug"><h3>Sugerir melhoria</h3><p class="muted sm">O que falta, atrapalha ou poderia ser mais simples? O texto vai para o administrador desta ferramenta. <b>Não inclua CNPJ, valores nem dados de clientes.</b></p>
  <div class="row"><select id="sug-area">${op}</select><input type="text" id="sug-txt" maxlength="1000" placeholder="Descreva a sugestão (10 a 1000 caracteres)" style="min-width:320px;flex:1"><button class="btn" data-a="sugEnviar">Enviar</button></div></div>`;
}
async function sugEnviar() {
  const area = $('#sug-area')?.value, texto = $('#sug-txt')?.value || '';
  try {
    const r = await fetch('/api/sug', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ area, texto }), credentials: 'same-origin', redirect: 'manual' });
    let j = null; try { j = await r.json(); } catch { /* sem corpo */ }
    if (!j || !j.ok) return toast(j?.erro?.mensagem || 'Não foi possível enviar agora.');
    const t = $('#sug-txt'); if (t) t.value = ''; toast('Sugestão enviada. Obrigado!');
  } catch { toast('Não foi possível enviar agora.'); }
}
{ const c = typeof vConta === 'function' ? vConta : null; if (c) globalThis.vConta = function () { return c.apply(this, arguments) + (window.__HOSTED__ ? sugCard() : ''); }; }

/* ---------- Ações ---------- */
const ONDA2_ACT = {
  rtAdd: t => { const c = S.clients[t.dataset.k]; if (!c) return; if (!rtAdd(c, { texto: $('#rt-texto').value, prazo: $('#rt-prazo').value, resp: $('#rt-resp').value })) return toast('Descreva o retorno (mínimo 3 caracteres).'); render(); },
  rtOk: t => { const c = S.clients[t.dataset.k]; if (c) { rtSet(c, t.dataset.id, { status: 'Concluído', concluido: today() }); render(); } },
  rtReabrir: t => { const c = S.clients[t.dataset.k]; if (c) { rtSet(c, t.dataset.id, { status: 'Pendente' }); render(); } },
  rtDel: t => { const c = S.clients[t.dataset.k]; if (c) { rtDel(c, t.dataset.id); render(); } },
  reuPrevia: t => { REU.ata = $('#reu-ata')?.value ?? REU.ata; REU.mask = reuMascarar(REU.ata); render(); },
  reuExtrair: t => { const c = S.clients[t.dataset.k]; if (c) reuExtrair(c); },
  reuSalvar: t => { const c = S.clients[t.dataset.k]; if (c) reuSalvar(c); },
  reuDescartar: () => { REU.res = null; REU.mask = null; REU.err = ''; render(); },
  fuGerar: t => { const c = S.clients[t.dataset.k]; if (!c) return; REU.nome = $('#fu-nome')?.value ?? REU.nome; REU.fu = fuTexto(c, REU.nome); render(); },
  fuCopiar: async () => { const v = $('#fu-txt')?.value || REU.fu; try { await navigator.clipboard.writeText(v); toast('Texto copiado.'); } catch { $('#fu-txt')?.select(); toast('Selecione e copie o texto (Ctrl+C).'); } },
  sugEnviar,
  crmExp: crmExportar
};
