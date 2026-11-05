/* ===== CADASTRO DE PRODUTOS: reconhecimento configurável + decisão por cliente ===== */
/* Reconhecimento de produto em texto é por termo com fronteira de palavra (sem casar dentro de outras palavras).
   Por produto: S.meta.prodReg[id] = { semTexto, excl[] }  (semTexto = só vale em Produtos da planilha / itens de ficha;
   excl = se o texto contiver o termo, o produto não é reconhecido naquele texto).
   Por cliente: c.prodDec[id] = { st: 'confirmado' | 'rejeitado' | 'manual', nota, at, hist[] } — a decisão humana prevalece sobre o reconhecimento automático. */
const PROD_DEF = { rm_linha: { semTexto: true } }; /* "RM" é sigla ambígua: não reconhecer em texto livre */
const prodRegOf = id => ({ ...(PROD_DEF[id] || {}), ...(S.meta.prodReg?.[id] || {}) });
const PD_L = { confirmado: 'Confirmado pelo usuário', rejeitado: 'Rejeitado pelo usuário', manual: 'Informado manualmente' };
function prodRegSet(id, patch) {
  const cur = prodRegOf(id), n = { semTexto: !!cur.semTexto, excl: cur.excl || [], ...patch };
  n.excl = [...new Set((n.excl || []).map(x => String(x).trim()).filter(Boolean))].slice(0, 20);
  S.meta.prodReg ||= {}; if (!n.semTexto && !n.excl.length && !PROD_DEF[id]) delete S.meta.prodReg[id]; else S.meta.prodReg[id] = n;
  touchMeta(); const aff = Object.values(S.clients).filter(c => (c.docs || []).length || (c.productsIdent || []).some(p => p.id === id)).map(c => c.key); reanalyze(aff, 'Cadastro de produtos: ' + id); render();
}
function prodDecSet(key, id, st, nota) {
  const c = S.clients[key]; if (!c) return; nota = String(nota || '').trim();
  if (st !== 'confirmado' && st !== 'limpar' && !nota) return toast('Informe a nota: motivo da rejeição ou fonte da informação.', 'bad');
  c.prodDec ||= {}; const cur = c.prodDec[id], h = { at: nowISO(), de: cur?.st || 'automático', para: st === 'limpar' ? 'automático' : st, nota };
  if (st === 'limpar') delete c.prodDec[id]; else c.prodDec[id] = { st, nota, at: nowISO(), hist: [h, ...(cur?.hist || [])].slice(0, 10) };
  runAnalysis(c, 'Decisão de produto: ' + id); touchC(key); render(); toast(st === 'limpar' ? 'Voltou ao reconhecimento automático.' : 'Decisão registrada.', 'ok');
}
function prodTest(txt) { /* teste de texto: mostra quais produtos seriam reconhecidos e por qual termo (não grava nada) */
  const t = String(txt || ''); return prodPatterns().map(p => { const e = prodRegOf(p.id), m = t.match(p.re); return m ? { id: p.id, nome: p.nome, term: m[0], bloq: e.excl?.length && new RegExp(e.excl.map(escRe).join('|'), 'i').test(t) ? 'termo de exclusão presente' : '' } : null; }).filter(Boolean);
}
function prodStats(id) { let est = 0, txt = 0, dec = 0; Object.values(S.clients).forEach(c => { const p = (c.productsIdent || []).find(x => x.id === id); if (p) { p.nivel === 'estruturado' ? est++ : p.nivel === 'texto' ? txt++ : dec++; } if (c.prodDec?.[id]) dec++; }); return { est, txt, dec }; }
function prodRegCard() {
  const q = norm(UI.prodQ || ''), rows = activeSols().filter(s => s.tipo !== 'servico' && (!q || norm(s.nome + ' ' + (s.termos || []).join(' ')).includes(q))).slice(0, 60);
  const t = UI.prodTxt || '', res = t ? prodTest(t) : [];
  return `<div class="card"><h3>Reconhecimento de produtos</h3><p class="sm">Como o sistema decide que um cliente <b>já tem</b> um produto: termo da solução (aba Base de Soluções → “Termos de identificação”) com fronteira de palavra, em <b>Produtos da planilha</b>, <b>itens de ficha</b> e <b>documentos</b>. Aqui você restringe os casos ambíguos. O reconhecimento é uma pista; a decisão por cliente (confirmar / rejeitar / informar) fica na página do cliente e prevalece.</p>
  <div class="row"><input type="search" data-i="prodq" placeholder="Filtrar produto ou termo…" value="${esc(UI.prodQ || '')}" style="flex:1;min-width:200px"><span class="muted sm">${rows.length} produto(s)</span></div>
  <div class="tw" style="max-height:340px"><table><thead><tr><th>Produto</th><th>Termos reconhecidos</th><th>Só planilha/ficha</th><th>Termos de exclusão</th><th>Clientes (planilha/ficha • só texto • decisão)</th></tr></thead><tbody>${rows.map(s => { const e = prodRegOf(s.id), st = prodStats(s.id); return `<tr><td><b>${esc(s.nome)}</b></td><td class="sm">${esc((s.termos || []).join(', ') || s.nome)}${s.termosRe ? ' <span class="muted">+ padrão da base</span>' : ''}</td><td><label class="sm"><input type="checkbox" data-c="prodsem" data-id="${esc(s.id)}" ${e.semTexto ? 'checked' : ''}> não reconhecer em texto livre</label></td><td><input type="text" data-c="prodexcl" data-id="${esc(s.id)}" value="${esc((e.excl || []).join(', '))}" placeholder="ex.: Smart View, módulo X" style="width:180px"></td><td class="sm">${st.est} • ${st.txt} • ${st.dec}</td></tr>`; }).join('') || '<tr><td colspan="5" class="muted">Nenhum produto.</td></tr>'}</tbody></table></div>
  <details style="margin-top:8px" ${t ? 'open' : ''}><summary>Testar um texto</summary><textarea data-c="prodtxt" rows="3" style="width:100%" placeholder="Cole uma observação ou linha de ficha para ver o que seria reconhecido (nada é gravado)">${esc(t)}</textarea>${t ? (res.length ? `<ul class="sm">${res.map(r => `<li><b>${esc(r.nome)}</b> — termo "${esc(r.term)}"${r.bloq ? ` <span class="pill p-bad">${esc(r.bloq)}</span>` : ''}</li>`).join('')}</ul>` : '<p class="sm muted">Nenhum produto reconhecido neste texto.</p>') : ''}</details></div>`;
}
function prodClientBlock(c) {
  const dec = c.prodDec || {}, rej = Object.entries(dec).filter(([, d]) => d.st === 'rejeitado'), list = c.productsIdent || [], cand = activeSols().filter(s => s.tipo !== 'servico' && !list.some(p => p.id === s.id));
  const lvl = p => p.nivel === 'manual' ? pill('informado manualmente', 'info') : p.conf ? pill('confirmado', 'ok') : p.nivel === 'texto' ? pill('só em texto livre — confirmar', 'warn') : pill('planilha/ficha', 'ok');
  return `<div class="prodbox" data-k="${esc(c.key)}"><h3 style="margin-top:12px">Produtos identificados</h3>${list.length ? `<ul style="margin:0;padding-left:18px">${list.map(p => `<li><b>${esc(p.nome)}</b> ${lvl(p)} <span class="muted sm">${p.ev.slice(0, 3).map(e => `"${esc(e.term)}" em ${esc(e.src)} ${esc(e.loc || '')}`).join('; ')}</span> <span class="sm">${p.nivel === 'manual' ? `<button class="btn ghost sm" data-a="prodDec" data-id="${esc(p.id)}" data-st="limpar">Remover</button>` : `${p.conf ? '' : `<button class="btn ghost sm" data-a="prodDec" data-id="${esc(p.id)}" data-st="confirmado">Confirmar</button>`}<button class="btn ghost sm" data-a="prodDec" data-id="${esc(p.id)}" data-st="rejeitado">Rejeitar</button>${p.conf ? `<button class="btn ghost sm" data-a="prodDec" data-id="${esc(p.id)}" data-st="limpar">Desfazer</button>` : ''}`}</span></li>`).join('')}</ul>` : '<span class="muted">Não identificado nos documentos.</span>'}
  ${rej.length ? `<div class="sm" style="margin-top:6px"><b>Rejeitados:</b> ${rej.map(([id, d]) => `${esc(solById(id)?.nome || id)} <span class="muted">(${esc(d.nota)})</span> <button class="btn ghost sm" data-a="prodDec" data-id="${esc(id)}" data-st="limpar">Desfazer</button>`).join(' • ')}</div>` : ''}
  <div class="row sm" style="margin-top:8px"><label>Informar produto contratado <select data-f="pid"><option value="">—</option>${cand.map(s => `<option value="${esc(s.id)}">${esc(s.nome)}</option>`).join('')}</select></label><input type="text" data-f="pnota" placeholder="Nota (obrigatória para rejeitar ou informar: fonte/motivo)" style="flex:1;min-width:220px"><button class="btn sm" data-a="prodDec" data-st="manual">Registrar</button></div>
  <p class="sm muted">Ausência em ficha significa "não identificado nos documentos", nunca "o cliente não possui". Usuários, licenciamento e capacidade não são deduzidos de descrições abreviadas.</p></div>`;
}
const PROD_ACT = { prodDec: (t) => { const b = t.closest('.prodbox'); if (!b) return; const nota = b.querySelector('[data-f=pnota]')?.value || '', st = t.dataset.st; let id = t.dataset.id; if (!id) { id = b.querySelector('[data-f=pid]')?.value; if (!id) return toast('Escolha o produto a informar.', 'bad'); } prodDecSet(b.dataset.k, id, st, nota); } };
