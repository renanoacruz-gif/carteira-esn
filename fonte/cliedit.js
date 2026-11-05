/* ===== Edição do cliente: dados cadastrais, observações, campos personalizados (rodada 11) ===== */
const CE_F = [['name', 'Razão social', 'txt'], ['code', 'Código TOTVS', 'txt'], ['cnpj', 'CNPJ', 'txt'], ['site', 'Site institucional', 'txt'], ['seg', 'Segmento', 'txt'], ['city', 'Cidade', 'txt'], ['uf', 'UF', 'uf'], ['size', 'Porte', 'txt'], ['mrr', 'MRR (planilha)', 'num'], ['productsRaw', 'Produtos (planilha)', 'area'], ['churn', 'Churn/risco', 'txt'], ['nps', 'NPS', 'txt'], ['notes', 'Observações', 'area']];
const CE_MAX = 40, CE_LEN = 300;
const ceVal = (c, f) => f === 'cnpj' ? (c.cnpj ? fmtCnpj(c.cnpj) : c.cnpjRaw || '') : f === 'mrr' ? (c.mrr == null ? '' : String(c.mrr).replace('.', ',')) : c[f] ?? '';

function ceOpen(key) { const c = S.clients[key]; if (!c) return; UI.ced = { key, custom: (c.custom || []).map(x => ({ ...x })), err: {} }; render(); }
function ceCancel() { UI.ced = null; render(); }
function ceSync() { /* copia o DOM para o estado antes de re-renderizar */
  const e = UI.ced; if (!e) return; e.d = e.d || {};
  CE_F.forEach(([f]) => { const n = document.getElementById('ced_' + f); if (n) e.d[f] = n.value; });
  e.custom.forEach(x => { const a = document.getElementById('cedn_' + x.id), b = document.getElementById('cedv_' + x.id); if (a) x.nome = a.value; if (b) x.valor = b.value; });
}
function ceAddCustom() { ceSync(); if (UI.ced.custom.length >= CE_MAX) return toast('Limite de campos personalizados atingido.'); UI.ced.custom.push({ id: 'cf_' + uid(), nome: '', valor: '' }); render(); }
function ceRmCustom(id) { ceSync(); UI.ced.custom = UI.ced.custom.filter(x => x.id !== id); render(); }

/* validação pura (testável): devolve {err, patch} */
function ceValidate(c, d, custom) {
  const err = {}, patch = {}; const v = f => String(d[f] ?? '').trim();
  if (!v('name')) err.name = 'Informe a razão social.'; else patch.name = v('name').slice(0, 200);
  const code = v('code'); if (code && Object.values(S.clients).some(o => o.key !== c.key && o.code && norm(o.code) === norm(code))) err.code = 'Já existe outro cliente com este código TOTVS.'; else patch.code = code;
  const raw = v('cnpj');
  if (raw) { const dg = digits(raw); if (dg.length !== 14 || !validCnpj(dg)) err.cnpj = 'CNPJ inválido (14 dígitos e dígitos verificadores corretos).'; else if (Object.values(S.clients).some(o => o.key !== c.key && o.cnpj === dg)) err.cnpj = 'Já existe outro cliente com este CNPJ.'; else { patch.cnpj = dg; patch.cnpjRaw = ''; } }
  else { patch.cnpj = ''; patch.cnpjRaw = ''; }
  const site = v('site'); if (site && !/^https?:\/\/[^\s.]+\.\S+$/i.test(site)) err.site = 'Informe o endereço completo (https://…).'; else patch.site = site.slice(0, 300);
  const uf = v('uf').toUpperCase(); if (uf && !UFS.includes(uf)) err.uf = 'UF inválida.'; else patch.uf = uf;
  const mr = v('mrr'); if (mr) { const n = parseNum(mr); if (n == null || n < 0) err.mrr = 'Valor numérico não negativo (ex.: 12.500,00).'; else patch.mrr = n; } else patch.mrr = null;
  ['seg', 'city', 'size', 'churn', 'nps'].forEach(f => { patch[f] = v(f).slice(0, CE_LEN); });
  ['productsRaw', 'notes'].forEach(f => { patch[f] = String(d[f] ?? '').trim().slice(0, 4000); });
  const names = new Set(); const cf = [];
  custom.forEach((x, i) => { const n = String(x.nome || '').trim().slice(0, 80), val = String(x.valor || '').trim().slice(0, 1000); if (!n && !val) return; if (!n) { err['cf' + i] = 'Campo personalizado sem nome.'; return; } const k = norm(n); if (names.has(k)) { err['cf' + i] = `Nome repetido: ${n}.`; return; } names.add(k); cf.push({ id: x.id, nome: n, valor: val }); });
  patch.custom = cf; return { err, patch };
}
function ceSave() {
  ceSync(); const e = UI.ced; if (!e) return; const c = S.clients[e.key]; if (!c) return;
  const d = {}; CE_F.forEach(([f]) => { d[f] = e.d?.[f] ?? ceVal(c, f); });
  const { err, patch } = ceValidate(c, d, e.custom); e.err = err;
  if (Object.keys(err).length) { render(); return toast('Corrija os campos destacados.'); }
  c.edits ||= {}; const ch = [];
  Object.entries(patch).forEach(([f, nv]) => {
    if (f === 'custom') { const a = JSON.stringify((c.custom || []).map(x => [x.nome, x.valor])), b = JSON.stringify(nv.map(x => [x.nome, x.valor])); if (a !== b) { c.custom = nv; ch.push('campos personalizados'); } return; }
    if (f === 'cnpjRaw') { c.cnpjRaw = nv; return; }
    const cur = c[f] ?? (f === 'mrr' ? null : ''); if (String(cur ?? '') === String(nv ?? '')) return;
    c.edits[f] = { de: cur, para: nv, at: nowISO() }; c[f] = nv; ch.push(CE_F.find(x => x[0] === f)?.[1] || f);
  });
  UI.ced = null;
  if (!ch.length) { render(); return toast('Nenhuma alteração.'); }
  reanalyze([c.key], 'Dados do cliente editados: ' + ch.join(', ')); log(`Cliente ${c.name}: ${ch.join(', ')} editado(s) manualmente.`, 'ok'); render(); toast('Alterações salvas.');
}

/* indicadores calculados e de onde corrigir a origem */
function ceDerived(c) {
  const m = mrrOf(c), comp = complet(c), out = [];
  out.push(['MRR da competência de referência', m.v == null ? 'Desconhecido' : fmtBRL(m.v), m.origem === 'ficha' ? 'Calculado a partir da ficha de faturamento (itens recorrentes) — corrija a classificação dos itens na aba Fichas.' : m.origem === 'planilha' ? 'Vem do MRR da planilha — edite o campo “MRR (planilha)”.' : 'Sem origem: carregue uma ficha ou informe o MRR.', m.origem === 'ficha' ? ['ctab', 'fichas'] : null]);
  out.push(['Segmento considerado', c.segInfo?.id ? segName(c.segInfo.id) : 'Não definido', `Modo: ${c.segInfo?.mode || '—'} — corrija o texto de Segmento ou use o mapa de segmentos.`, null]);
  out.push(['Completude do cadastro', `${comp.ok.length}/${comp.n}`, 'Calculada pelos campos preenchidos (aba Cadastro e contratos).', ['ctab', 'cadastro']]);
  out.push(['Oportunidades', String(c.opps.length), 'Geradas pelo motor a partir de evidências; decisões manuais são preservadas.', null]);
  return out;
}
function ceCard(c) {
  const e = UI.ced && UI.ced.key === c.key ? UI.ced : null, ed = c.edits || {}, er = e?.err || {};
  const tag = f => ed[f] ? `<span class="pill p-info" title="Editado em ${esc(dtBR(ed[f].at))}; valor anterior: ${esc(String(ed[f].de ?? '—'))}">manual</span>` : '<span class="pill p-off">planilha/importado</span>';
  let h = `<div class="card"><div class="row"><h3>Dados do cliente ${chip('FATO')}</h3><span class="sp"></span>${e ? `<button class="btn pri sm" data-a="ceSave">Salvar</button><button class="btn ghost sm" data-a="ceCancel">Cancelar</button>` : `<button class="btn ghost sm" data-a="ceOpen" data-k="${esc(c.key)}">Editar dados</button>`}</div>`;
  if (!e) {
    h += `<table><tbody>${CE_F.map(([f, l]) => { const v = f === 'mrr' ? (c.mrr != null ? fmtBRL(c.mrr) : '') : f === 'cnpj' ? (c.cnpj ? fmtCnpj(c.cnpj) + (validCnpj(c.cnpj) ? '' : ' ⚠ dígito verificador inválido') : c.cnpjRaw ? c.cnpjRaw + ' ⚠ formato inválido' : '') : c[f]; return `<tr><td class="muted sm nw">${l}</td><td>${v ? esc(v) : '<span class="muted">—</span>'}</td><td class="sm nw">${v || ed[f] ? tag(f) : ''}</td></tr>`; }).join('')}
    ${(c.custom || []).map(x => `<tr><td class="muted sm nw">${esc(x.nome)}</td><td>${x.valor ? esc(x.valor) : '<span class="muted">—</span>'}</td><td class="sm nw"><span class="pill p-info">personalizado</span></td></tr>`).join('')}
    <tr><td class="muted sm nw">Origem</td><td colspan="2">${c.src ? esc(`${c.src.file}${c.src.sheet ? ' • aba ' + c.src.sheet : ''} • linha ${c.src.row}`) : '<span class="muted">cadastro manual</span>'}</td></tr></tbody></table>`;
  } else {
    const val = f => e.d && f in e.d ? e.d[f] : ceVal(c, f);
    h += `<div class="alert i sm">Alterações só valem ao clicar em <b>Salvar</b>. Valores editados passam a ser <b>manuais</b> e uma nova importação da planilha não os substitui silenciosamente (a divergência vai para “Conflitos de importação”).</div><div class="grid g2">${CE_F.map(([f, l, t]) => `<label class="sm">${l} ${ed[f] ? tag(f) : ''}${t === 'area' ? `<textarea id="ced_${f}" rows="3" style="width:100%">${esc(val(f))}</textarea>` : t === 'uf' ? `<select id="ced_${f}" style="width:100%">${optS('', '—', val(f))}${UFS.map(u => optS(u, u, val(f))).join('')}</select>` : `<input id="ced_${f}" type="text" value="${esc(val(f))}" style="width:100%" ${t === 'num' ? 'inputmode="decimal"' : ''}>`}${er[f] ? `<div class="sm" role="alert" style="color:var(--bad)">${esc(er[f])}</div>` : ''}</label>`).join('')}</div>
    <h4>Campos personalizados</h4>${e.custom.map((x, i) => `<div class="row"><input id="cedn_${x.id}" type="text" value="${esc(x.nome)}" placeholder="Nome do campo" style="max-width:220px"><input id="cedv_${x.id}" type="text" value="${esc(x.valor)}" placeholder="Valor" style="flex:1;min-width:200px"><button class="btn ghost sm" data-a="ceRmCustom" data-id="${x.id}">Remover</button>${er['cf' + i] ? `<span class="sm" role="alert" style="color:var(--bad)">${esc(er['cf' + i])}</span>` : ''}</div>`).join('') || '<p class="muted sm">Nenhum campo personalizado.</p>'}
    <div class="row"><button class="btn ghost sm" data-a="ceAddCustom">+ Campo personalizado</button></div>`;
  }
  const dv = ceDerived(c);
  h += `<details style="margin-top:8px"><summary class="sm"><b>Indicadores calculados</b> (não editáveis diretamente — corrija a origem)</summary><table><tbody>${dv.map(([l, v, how, go]) => `<tr><td class="sm nw">${l}</td><td><b>${esc(v)}</b> <span class="pill p-off">calculado</span></td><td class="sm">${esc(how)} ${go ? `<button class="btn ghost sm" data-a="${go[0]}" data-v="${go[1]}">Ir para a origem</button>` : ''}</td></tr>`).join('')}</tbody></table></details></div>`;
  return h;
}
const CE_ACT = { ceOpen: t => ceOpen(t.dataset.k), ceCancel, ceSave, ceAddCustom, ceRmCustom: t => ceRmCustom(t.dataset.id) };
