/* ===== Base de Soluções: material livre (texto colado, descrição, resultado de pesquisa) com título, origem e vínculo (rodada 11) =====
   O material é guardado integralmente no registro da solução (sem truncar em silêncio), separado de campos estruturados e de notas comerciais.
   Material oficial/enxoval/pesquisa entra no motor (cruzamento com o texto do cliente) com o trecho citado; anotação comercial NÃO entra. */
const SM_ORIG = { colado: 'Texto colado / descrição livre', oficial: 'Documentação oficial (TDN, página TOTVS)', enxoval: 'Enxoval de vendas', pesquisa: 'Resultado de pesquisa com IA', nota: 'Anotação comercial / hipótese (não é fonte oficial)' };
const SM_MAX = 100000;
UI.sm = { titulo: '', origem: 'colado', url: '', vinculo: '', texto: '', open: false };
const smUsable = m => m.origem !== 'nota';
function smHash(t) { return tdHash(norm(t)); }
function smCard() {
  const s = UI.sm; if (!s.open) return `<div class="row" style="margin:8px 0"><button class="btn ghost sm" data-a="smAbrir">+ Adicionar texto ou descrição livre</button><span class="muted sm">Cole conteúdo ainda não estruturado: título, origem e vínculo bastam.</span></div>`;
  return `<div class="card"><div class="row"><h3>Adicionar material livre</h3><span class="sp"></span><button class="btn ghost sm" data-a="smAbrir">Fechar</button></div>
  <div class="row"><input type="text" data-c="sm" data-f="titulo" value="${esc(s.titulo)}" placeholder="Título do material *" style="flex:1;min-width:260px"><select data-c="sm" data-f="origem">${Object.entries(SM_ORIG).map(([k, l]) => optS(k, l, s.origem)).join('')}</select></div>
  <div class="row"><input type="text" data-c="sm" data-f="url" value="${esc(s.url)}" placeholder="Link de origem (opcional; obrigatório para tratar como oficial)" style="flex:1;min-width:260px"><select data-c="sm" data-f="vinculo"><option value="">— nova solução (rascunho) —</option>${S.solutions.filter(r => !r.arquivado).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map(r => optS(r.id, 'Vincular a: ' + r.nome, s.vinculo)).join('')}</select></div>
  <textarea data-c="sm" data-f="texto" rows="7" placeholder="Cole aqui o texto (finalidade, funcionalidades, processos, dores, requisitos, limitações, tabelas…)" style="width:100%">${esc(s.texto)}</textarea>
  <p class="sm muted">${s.origem === 'nota' ? 'Anotação comercial: fica separada, não é usada como fonte nas recomendações.' : s.origem === 'oficial' && !(s.url && isOfficialUrl(s.url)) ? 'Sem link de domínio oficial TOTVS, o material será marcado como NÃO oficial.' : 'Será usado no cruzamento com o texto dos clientes, com o trecho citado no diagnóstico.'} Materiais ficam privados na sua conta (não vão ao catálogo compartilhado). Texto: ${s.texto.length.toLocaleString('pt-BR')} caractere(s); limite ${SM_MAX.toLocaleString('pt-BR')} por solução.</p>
  <div class="row"><button class="btn pri" data-a="smSalvar">Salvar material</button></div></div>`;
}
function smSave() {
  const s = UI.sm, titulo = s.titulo.trim(), texto = s.texto.trim(), url = s.url.trim();
  if (titulo.length < 3) return toast('Informe o título do material.'); if (texto.length < 20) return toast('Cole um texto com ao menos 20 caracteres.');
  if (url && !/^https?:\/\/\S+$/i.test(url)) return toast('Link inválido (use http/https).');
  if (SECRET_RE.test(texto)) return toast('O texto parece conter credenciais (chave/token/senha). Remova antes de salvar.');
  const h = smHash(texto), dupe = S.solutions.find(r => (r.materiais || []).some(m => m.h === h)); if (dupe) return toast(`Material idêntico já registrado em "${dupe.nome}".`);
  let r = s.vinculo && S.solutions.find(x => x.id === s.vinculo), nova = false;
  if (!r) { r = newSol({ nome: titulo, tipo: 'complementar', obs: 'Registro criado a partir de material livre — estruture e valide.' }); r.fontes = []; S.solutions.push(r); nova = true; }
  const tot = (r.materiais || []).reduce((a, m) => a + m.texto.length, 0); if (tot + texto.length > SM_MAX) { if (nova) S.solutions.pop(); return toast(`Limite de ${SM_MAX.toLocaleString('pt-BR')} caracteres de material por solução excedido (${tot.toLocaleString('pt-BR')} já usados). Divida o material ou importe como arquivo.`); }
  const oficial = s.origem !== 'nota' && !!url && isOfficialUrl(url);
  (r.materiais ||= []).push({ id: 'mt_' + uid(), titulo, origem: s.origem, url, oficial, texto, h, at: nowISO(), d: today() });
  if (url && !r.fontes.some(f => normUrl(f.u) === normUrl(url))) r.fontes.push({ t: titulo, u: url, d: today(), origem: 'material livre (' + SM_ORIG[s.origem] + ')' });
  r.rev++; r.atualizadoEm = today(); hist(r, 'material', `Material livre adicionado: ${titulo} (${SM_ORIG[s.origem]}${oficial ? ', fonte oficial' : s.origem === 'oficial' ? ', NÃO oficial' : ''})`);
  const n = solChanged(r, 'material adicionado'); touchSol(r.id);
  UI.sm = { titulo: '', origem: 'colado', url: '', vinculo: '', texto: '', open: false }; UI.solSel = r.id;
  reanalyzeAll(true, `Base de soluções: material livre "${titulo}"`); log(`Material "${titulo}" salvo em "${r.nome}"${nova ? ' (nova solução em rascunho)' : ''}; ${n} diagnóstico(s) sinalizado(s).`, 'ok'); render();
}
function smRm(rid, mid) { const r = S.solutions.find(x => x.id === rid); if (!r) return; const m = (r.materiais || []).find(x => x.id === mid); if (!m) return; r.materiais = r.materiais.filter(x => x.id !== mid); r.rev++; r.atualizadoEm = today(); hist(r, 'material', 'Material removido: ' + m.titulo); solChanged(r, 'material removido'); touchSol(r.id); reanalyzeAll(true, 'Base de soluções: material removido'); render(); }
async function smEstruturar(rid, mid) { /* reutiliza a extração e a prévia da importação, já vinculada ao registro */
  const r = S.solutions.find(x => x.id === rid), m = r && (r.materiais || []).find(x => x.id === mid); if (!m) return;
  const before = (UI.solImp?.items || []).length; await solImportFiles([new File([m.titulo + '\n\n' + m.texto], m.titulo.replace(/[^\w\- ]+/g, '').slice(0, 60) + '.txt', { type: 'text/plain' })]);
  (UI.solImp?.items || []).slice(before).forEach(it => { it.aviso = `Material livre “${m.titulo}” (${SM_ORIG[m.origem]}). Os campos extraídos entram no registro vinculado após sua revisão.`; it.cands.forEach(x => { x.act = 'mesclar'; x.target = rid; }); });
  render();
}
/* trechos do material que sustentam a ligação com o texto do cliente (usado no diagnóstico) */
function smHits(s, all, og) {
  const set = new Set(all); const out = [];
  (s.materiais || []).filter(smUsable).forEach(m => { const hit = []; let first = -1; for (const x of String(m.texto).matchAll(/[A-Za-zÀ-ÿ0-9]+/g)) { const w = wTok(x[0])[0]; if (w && set.has(w) && !hit.includes(w)) { hit.push(w); if (first < 0) first = x.index; } } if (hit.length >= 2) out.push({ titulo: m.titulo, origem: m.origem, oficial: m.oficial, url: m.url, d: m.d, termos: hit.slice(0, 6).map(w => og[w] || w), snip: snippet(m.texto, Math.max(0, first)) }); });
  return out.slice(0, 3);
}
function smPanel(r) {
  const M = r.materiais || []; if (!M.length) return '';
  return `<div class="card"><h4>Materiais livres (${M.length})</h4>${M.map(m => `<div class="opp"><div class="row"><b>${esc(m.titulo)}</b>${pill(SM_ORIG[m.origem], m.origem === 'nota' ? 'warn' : m.oficial ? 'ok' : 'off')}${m.origem === 'oficial' && !m.oficial ? pill('NÃO oficial', 'bad') : ''}<span class="sp"></span>${m.origem !== 'nota' ? `<button class="btn ghost sm" data-a="smEstr" data-id="${esc(r.id)}" data-m="${m.id}">Extrair campos estruturados</button>` : ''}<button class="btn ghost sm" data-a="smRm" data-id="${esc(r.id)}" data-m="${m.id}">Remover</button></div>
  <div class="sm muted">${m.url ? link({ t: m.url, u: m.url }) + ' • ' : ''}registrado em ${esc(fmtD(m.d))} • ${m.texto.length.toLocaleString('pt-BR')} caractere(s), integral</div><details><summary class="sm">Ver texto</summary><pre class="sm" style="white-space:pre-wrap;max-height:260px;overflow:auto">${esc(m.texto)}</pre></details></div>`).join('')}</div>`;
}
function smChange(t, c, v) { if (c !== 'sm') return false; const f = t.dataset.f; if (f in UI.sm) { UI.sm[f] = v; if (f === 'origem' || f === 'vinculo') render(); } return true; }
const SM_ACT = { smAbrir: () => { UI.sm.open = !UI.sm.open; render(); }, smSalvar: smSave, smRm: t => smRm(t.dataset.id, t.dataset.m), smEstr: t => smEstruturar(t.dataset.id, t.dataset.m) };
