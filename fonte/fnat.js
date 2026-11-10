/* ===== Rodada 32: natureza do item de ficha pelo PRODUTO (não por palavras soltas) =====
   Ordem: classificação manual do item > código do produto ligado pelo executivo (S.meta.codMap) > produto reconhecido na Base de Soluções pelo nome (coluna de descrição) > regras de texto.
   Só vale para ficha tabular com coluna de código/descrição; ficha em texto corrido segue pelas regras de texto. "Imposto"/"total" nunca se aplicam a linha que tem código de produto. */
const COB = { recorrente: 'Recorrente (licença, manutenção, assinatura)', consumo: 'Pacote de consumo mensal (franquia)', avulso: 'Avulso (projeto ou serviço pontual)' };
const COB_KIND = { recorrente: 'recorrente', consumo: 'recorrente', avulso: 'avulso' };
/* sem campo gravado: produto, módulo, plataforma e solução complementar são cobrados de forma recorrente; serviço não é deduzido */
const solCobranca = s => s ? (s.cobranca || (s.tipo && s.tipo !== 'servico' ? 'recorrente' : '')) : '';
function fnEnrich(f) {
  if (!f.tab || f._fnE === (f.items || []).length) return; const map = new Map();
  f.tab.sheets.forEach(sh => { const hr = sh.rows.find(r => r.n === sh.h + 1); if (!hr) return; const col = brCols(hr.c); if (col.desc == null || col.codp == null) return;
    sh.rows.filter(r => r.n > sh.h + 1).forEach(r => map.set(`aba ${sh.name} • linha ${r.n}`, { cod: String(r.c[col.codp] ?? '').trim(), nome: String(r.c[col.desc] ?? '').trim() })); });
  (f.items || []).forEach(it => { const m = map.get(it.loc); if (m && m.cod && m.nome) { it.cod = m.cod.slice(0, 40); it.nome = m.nome.slice(0, 120); } });
  Object.defineProperty(f, '_fnE', { value: (f.items || []).length, enumerable: false, writable: true });
}
function fnIdent(it) {
  if (it.cod && it.nome) {
    const m = S.meta.codMap?.[it.cod];
    if (m) { const sol = m.sol ? S.solutions.find(s => s.id === m.sol) : null, cob = m.cob || solCobranca(sol); if (cob) return { kind: COB_KIND[cob], via: 'codigo', sol }; }
    const p = prodTest(it.nome).find(x => !x.bloq), sol = p ? S.solutions.find(s => s.id === p.id) : null, cob = solCobranca(sol);
    if (cob) return { kind: COB_KIND[cob], via: 'produto', sol };
    for (const [k, re] of KIND_RULES) if (k !== 'imposto' && k !== 'total' && re.test(it.nome)) return { kind: k, via: 'texto', sol };
    return { kind: 'outro', via: 'texto', sol };
  }
  return { kind: classifyItem(it.desc || ''), via: 'texto', sol: null };
}
function fnApply(c) {
  (c.fichas || []).forEach(f => { fnEnrich(f); (f.items || []).forEach(it => { if (it.kindMode === 'manual') return; if (!it.cod && it.kind !== 'outro') return; /* ficha em texto: mantém o que já estava */
    const r = fnIdent(it); it.kind = r.kind; it.kindMode = r.via === 'texto' ? 'inferido' : r.via; if (r.sol) it.solId = r.sol.id; else delete it.solId; }); });
}
/* códigos de produto ainda sem natureza: o executivo liga uma vez e vale para todas as fichas */
function fnPend() {
  const g = new Map();
  Object.values(S.clients).forEach(c => fichasOk(c).forEach(f => (f.items || []).forEach(it => { if (!it.cod || it.dup || it.kindMode === 'manual' || it.kind !== 'outro') return;
    const e = g.get(it.cod) || { cod: it.cod, nome: it.nome, cli: new Set(), n: 0, v: 0 }; e.cli.add(c.key); e.n++; e.v += it.vals?.[it.vi] || 0; g.set(it.cod, e); })));
  return [...g.values()].sort((a, b) => b.v - a.v);
}
function fnSave(cod) {
  const sol = $(`[data-fn-sol="${CSS.escape(cod)}"]`)?.value || '', cob = $(`[data-fn-cob="${CSS.escape(cod)}"]`)?.value || '';
  if (!cob && !solCobranca(S.solutions.find(s => s.id === sol))) return toast('Escolha o modelo de cobrança (ou um produto que já tenha modelo definido).', 'bad');
  const p = fnPend().find(x => x.cod === cod); S.meta.codMap ||= {}; S.meta.codMap[cod] = { sol: sol || null, cob: cob || null, nome: p?.nome || S.meta.codMap[cod]?.nome || '', at: nowISO() };
  touchMeta(); reanalyzeAll(true, 'Código de produto identificado: ' + cod); render(); toast('Código identificado. Vale para todas as fichas.', 'ok');
}
function fnDel(cod) { if (S.meta.codMap) delete S.meta.codMap[cod]; touchMeta(); reanalyzeAll(true, 'Identificação de código removida: ' + cod); render(); }
function fnCard() {
  const P = fnPend(), M = Object.entries(S.meta.codMap || {}); if (!P.length && !M.length) return '';
  const sols = activeSols().slice().sort((a, b) => a.nome.localeCompare(b.nome)), so = v => optS('', 'Produto da Base (opcional)', v) + sols.map(s => optS(s.id, s.nome, v)).join(''), co = v => optS('', 'Modelo de cobrança…', v) + Object.entries(COB).map(([k, l]) => optS(k, l, v)).join('');
  let h = `<div class="card"><div class="row"><h3>Itens de ficha a identificar</h3>${P.length ? pill(P.length + ' código(s)', 'warn') : pill('tudo identificado', 'ok')}</div>`;
  if (P.length) h += `<p class="muted sm">Códigos de produto que apareceram em fichas e ainda não têm natureza definida — hoje ficam fora do MRR. Ligue cada código uma vez; vale para todas as fichas.</p><div class="tw" style="max-height:none"><table><thead><tr><th>Código</th><th>Nome na ficha</th><th class="r">Clientes</th><th class="r">Valor</th><th>Identificação</th><th></th></tr></thead><tbody>${P.slice(0, 40).map(e => `<tr><td class="nw"><b>${esc(e.cod)}</b></td><td>${esc(e.nome)}</td><td class="r">${e.cli.size}</td><td class="r nw">${fmtBRL(e.v)}</td><td><select style="max-width:210px" data-fn-sol="${esc(e.cod)}">${so('')}</select> <select style="max-width:210px" data-fn-cob="${esc(e.cod)}">${co('')}</select></td><td><button class="btn sm" data-a="fnSave" data-id="${esc(e.cod)}">Salvar</button></td></tr>`).join('')}</tbody></table></div>`;
  if (M.length) h += `<details class="sm"><summary>${M.length} código(s) já identificado(s)</summary><ul>${M.map(([cod, m]) => `<li><b>${esc(cod)}</b> ${esc(m.nome || '')} → ${esc(S.solutions.find(s => s.id === m.sol)?.nome || 'sem produto ligado')} • ${esc(COB[m.cob || solCobranca(S.solutions.find(s => s.id === m.sol))] || '—')} <button class="btn ghost sm" data-a="fnDel" data-id="${esc(cod)}">Remover</button></li>`).join('')}</ul></details>`;
  return h + '</div>';
}
/* modelo de cobrança no detalhe do produto */
function fnSolRow(r) { return `<div class="row sm" style="margin:6px 0"><label>Modelo de cobrança <select data-c="solCob" data-id="${r.id}">${optS('', r.tipo !== 'servico' ? 'Padrão do tipo: recorrente' : 'Não definido', r.cobranca || '')}${Object.entries(COB).map(([k, l]) => optS(k, l, r.cobranca || '')).join('')}</select></label><span class="muted">Define a natureza dos itens de ficha reconhecidos como este produto.</span></div>`; }
function fnSolCob(id, v) { const r = S.solutions.find(s => s.id === id); if (!r) return; r.cobranca = COB[v] ? v : ''; hist(r, 'editado', 'Modelo de cobrança: ' + (COB[r.cobranca] || 'padrão do tipo')); r.atualizadoEm = today(); solChanged(r, 'editado'); reanalyzeAll(true, 'Modelo de cobrança de ' + r.nome); render(); }
const FN_ACT = { fnSave: t => fnSave(t.dataset.id), fnDel: t => fnDel(t.dataset.id) };
