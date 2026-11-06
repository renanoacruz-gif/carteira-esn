/* ===== Rodada 18 §D: ticket de referência por solução/serviço (PRIVADO, em S.meta.tickets) =====
   S.meta.tickets = { [solId]: [{ id, valor, moeda, natureza, data, origem, tipo: 'confirmado'|'referencia', cli, nota, em }] }
   Regras: valor confirmado ≠ referência interna; nunca registrar preço identificável de OUTRO cliente; sem previsão de receita/ROI/probabilidade;
   serve só como apoio de priorização (desempate de score igual); ausente ⇒ "Não estimado". Não é compartilhado (S.meta é por executivo). */
const TK_NAT = ['Recorrente', 'Implantação', 'Serviço avulso', 'Faixa estimada'];
const TK_ORI = ['Proposta enviada ao cliente', 'Tabela oficial TOTVS', 'Contrato do próprio cliente', 'Referência interna do executivo'];
const TK_MOEDA = ['BRL', 'USD', 'EUR'];
const TK_TIPO = { confirmado: ['Preço confirmado', 'ok'], referencia: ['Referência interna', 'warn'] };
const tkOf = solId => ((S.meta.tickets || {})[solId] || []);
const tkDataOk = v => /^\d{4}-\d{2}-\d{2}$/.test(v || '') && new Date(v + 'T00:00:00Z').toISOString().slice(0, 10) === v;
const tkNum = v => { const s = String(v ?? '').trim().replace(/[R$\s]/g, ''); if (!s) return NaN; const n = /,/.test(s) ? Number(s.replace(/\./g, '').replace(',', '.')) : Number(s); return n; };
const tkFmt = t => { try { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: t.moeda }).format(t.valor); } catch { return t.valor + ' ' + t.moeda; } };
function tkErros(solId, d) {
  const e = [], n = tkNum(d.valor);
  if (!S.solutions.some(s => s.id === solId && !s.arquivado)) e.push('Solução inexistente.');
  if (!(n > 0) || !isFinite(n)) e.push('Valor deve ser um número maior que zero.');
  if (!TK_MOEDA.includes(d.moeda)) e.push('Moeda inválida.');
  if (!TK_NAT.includes(d.natureza)) e.push('Escolha a natureza do valor.');
  if (!TK_ORI.includes(d.origem)) e.push('Escolha a origem do valor.');
  if (!tkDataOk(d.data)) e.push('Informe a data de referência válida (AAAA-MM-DD).');
  else if (d.data > today()) e.push('Data de referência não pode ser futura.');
  if (!TK_TIPO[d.tipo]) e.push('Informe se é preço confirmado ou referência interna.');
  if (d.tipo === 'confirmado' && d.origem === 'Referência interna do executivo') e.push('Preço confirmado não pode ter origem “Referência interna”.');
  return e;
}
function tkAdd(solId, d) {
  const e = tkErros(solId, d); if (e.length) { UI.tkErr = { id: solId, e }; return render(); }
  UI.tkErr = null; const m = (S.meta.tickets ||= {}); (m[solId] ||= []).push({ id: 'tk_' + uid(), valor: tkNum(d.valor), moeda: d.moeda, natureza: d.natureza, data: d.data, origem: d.origem, tipo: d.tipo, cli: d.cli || '', nota: String(d.nota || '').trim().slice(0, 240), em: nowISO() });
  touchMeta(); toast('Referência registrada (privada).'); render();
}
function tkDel(solId, id) { const m = S.meta.tickets || {}; if (!m[solId]) return; m[solId] = m[solId].filter(t => t.id !== id); if (!m[solId].length) delete m[solId]; touchMeta(); render(); }
const TK_ACT = {
  tkAdd: t => tkAdd(t.dataset.id, { valor: $('#tk-v').value, moeda: $('#tk-m').value, natureza: $('#tk-n').value, origem: $('#tk-o').value, data: $('#tk-d').value, tipo: $('#tk-t').value, cli: $('#tk-c').value, nota: $('#tk-x').value }),
  tkDel: t => tkDel(t.dataset.id, t.dataset.tk)
};
/* melhor referência para (solução, cliente): confirmado do próprio cliente > confirmado geral (sem cliente) > referência interna; mais recente em cada nível. Nunca usa preço atrelado a OUTRO cliente. */
function tkPick(solId, c) {
  const L = tkOf(solId).filter(t => !t.cli || (c && t.cli === c.key)), nivel = t => t.tipo === 'confirmado' ? (t.cli ? 3 : 2) : 1;
  return L.sort((a, b) => nivel(b) - nivel(a) || String(b.data).localeCompare(String(a.data)))[0] || null;
}
const tkIdade = t => Math.floor((Date.now() - new Date(t.data + 'T00:00:00Z').getTime()) / 864e5);
/* apoio de priorização: soma BRL RECORRENTE das soluções da oportunidade (naturezas diferentes não são comparáveis); 0 = não estimado */
const tkRank = (c, o) => (o.sols || []).reduce((s, x) => { const t = tkPick(x.id, c); return s + (t && t.moeda === 'BRL' && t.natureza === 'Recorrente' ? t.valor : 0); }, 0);
function tkHtml(c, o) {
  const itens = (o.sols || []).map(s => ({ s, t: tkPick(s.id, c) }));
  const li = itens.map(({ s, t }) => t ? `<li><b>${esc(s.nome)}</b>: ${esc(tkFmt(t))} • ${esc(t.natureza)} • ${pill(TK_TIPO[t.tipo][0], TK_TIPO[t.tipo][1])} • ${esc(t.origem)} • ref. ${esc(dtBR(t.data))}${tkIdade(t) > 365 ? ' ' + pill('desatualizada (>12 meses)', 'warn') : ''}${t.nota ? ` <span class="muted">— ${esc(t.nota)}</span>` : ''}</li>` : `<li><b>${esc(s.nome)}</b>: <span class="muted">Não estimado</span></li>`).join('');
  return `<dt>Referência comercial</dt><dd>${li ? `<ul>${li}</ul>` : '<span class="muted">Não estimado</span>'}<div class="sm muted">Referência privada para priorizar a conversa; não é proposta, previsão de receita, ROI nem probabilidade de fechamento.</div></dd>`;
}
function tkSection(r) {
  const L = tkOf(r.id), er = UI.tkErr?.id === r.id ? UI.tkErr.e : [], opt = (a, cur) => a.map(x => `<option value="${esc(x)}" ${cur === x ? 'selected' : ''}>${esc(x)}</option>`).join('');
  const row = t => `<tr><td>${esc(tkFmt(t))}</td><td>${esc(t.natureza)}</td><td>${pill(TK_TIPO[t.tipo][0], TK_TIPO[t.tipo][1])}</td><td>${esc(t.origem)}${t.cli ? ' • ' + esc(S.clients[t.cli]?.name || t.cli) : ''}</td><td>${esc(dtBR(t.data))}${tkIdade(t) > 365 ? ' ' + pill('desatualizada', 'warn') : ''}</td><td class="sm">${esc(t.nota || '—')}</td><td><button class="btn ghost sm" data-a="tkDel" data-id="${r.id}" data-tk="${t.id}">Remover</button></td></tr>`;
  return `<div class="card" style="margin-top:10px"><h4>Ticket de referência (privado) ${chip('NECESSITA VALIDAÇÃO')}</h4>
    <p class="sm muted">Visível só para você. Distinga preço confirmado (proposta/tabela/contrato) de referência interna. Não registre preço identificável de outro cliente. Não gera previsão de receita, ROI nem probabilidade; apenas desempata prioridade entre oportunidades de mesmo score.</p>
    ${L.length ? `<div class="tw"><table class="sm"><thead><tr><th>Valor</th><th>Natureza</th><th>Tipo</th><th>Origem</th><th>Data</th><th>Nota</th><th></th></tr></thead><tbody>${L.map(row).join('')}</tbody></table></div>` : '<p class="sm muted">Sem referência registrada — as oportunidades mostram “Não estimado”.</p>'}
    <details><summary class="sm">Registrar referência</summary>
    ${er.length ? `<div class="alert b sm"><ul style="margin:0">${er.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
    <div class="grid g2"><label class="sm">Valor *<input id="tk-v" type="text" style="width:100%" placeholder="ex.: 1.250,00"></label>
    <label class="sm">Moeda *<select id="tk-m" style="width:100%">${opt(TK_MOEDA)}</select></label>
    <label class="sm">Natureza *<select id="tk-n" style="width:100%">${opt(TK_NAT)}</select></label>
    <label class="sm">Tipo *<select id="tk-t" style="width:100%"><option value="referencia">Referência interna</option><option value="confirmado">Preço confirmado</option></select></label>
    <label class="sm">Origem *<select id="tk-o" style="width:100%">${opt(TK_ORI)}</select></label>
    <label class="sm">Data de referência *<input id="tk-d" type="date" style="width:100%"></label>
    <label class="sm">Cliente (só se o valor for deste cliente)<select id="tk-c" style="width:100%"><option value="">— valor geral —</option>${clients().slice().sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).map(c => `<option value="${esc(c.key)}">${esc(c.name)}</option>`).join('')}</select></label>
    <label class="sm">Nota<input id="tk-x" type="text" style="width:100%" maxlength="240"></label></div>
    <button class="btn pri sm" data-a="tkAdd" data-id="${r.id}">Registrar referência</button></details></div>`;
}
