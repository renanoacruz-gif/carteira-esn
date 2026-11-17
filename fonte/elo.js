/* ---------- Elo entre módulos (rodada 45, etapa 2) ----------
   Liga o que antes vivia isolado, sem criar dado novo:
   - negociações do Forecast (só as que VOCÊ vinculou ao cliente em Meu Forecast) aparecem na ficha, no briefing e ao lado das recomendações;
   - soluções vinculadas ao cliente (Catálogo Enxoval) aparecem em Gestão da conta e em Oportunidades;
   - o desfecho (ganhou / perdeu / não aderiu) é um só por produto e cliente, lido pelos dois motores de recomendação;
   - MRR do cadastro × MRR pagante do Empodera: divergência sinalizada, nunca somada.
   Regras: valores do Forecast vêm da sua planilha e não são somados a potenciais; correspondência de produto é por nome (indício, não confirmação). */
const ELO_ABERTA = ['EM ASSINATURA', 'EM ABERTO'];
const eloLimpa = t => norm(t || '').replace(/[^a-z0-9]+/g, ' ').replace(/\b(totvs|linha|protheus|rm|datasul|modulo|modulos|sistema|solucao|de|da|do|e|para)\b/g, ' ').replace(/\s+/g, ' ').trim();
function eloCasa(nomeSol, prodFc) { /* nome da solução × texto "produto" da planilha de Forecast */
  const a = eloLimpa(nomeSol), b = eloLimpa(prodFc); if (a && a === b) return true; /* siglas curtas (RH, WMS) só casam como palavra inteira */
  if (a.length < 3 || b.length < 3) return norm(nomeSol || '').trim() !== '' && norm(nomeSol).trim() === norm(prodFc || '').trim();
  return (' ' + b + ' ').includes(' ' + a + ' ') || (' ' + a + ' ').includes(' ' + b + ' ');
}
function fcDoCliente(c) { const L = S.meta.fcLink || {}; return (S.meta.fcData?.opps || []).filter(o => L[o.id] === c.key).sort((a, b) => ELO_ABERTA.includes(b.status) - ELO_ABERTA.includes(a.status) || String(b.data || '').localeCompare(String(a.data || ''))); }
const eloNeg = (c, nome) => fcDoCliente(c).filter(o => eloCasa(nome, o.produto));
function eloDesfecho(c, nome) { /* um desfecho por produto e cliente: vale o registro mais recente, venha da Base ou do catálogo */
  const k = normName(nome); let best = null; const cand = (st, em, origem) => { if (PT_RES[st] && (!best || String(em || '') > String(best.em || ''))) best = { st, em, origem }; };
  for (const v of Object.values(c.enxVinc || {})) if (v.res && normName(v.nome || '') === k) cand(v.res.st, v.res.em, 'catálogo');
  for (const [id, x] of Object.entries(c.ptRes || {})) { const r = S.solutions.find(s => s.id === id); if (r && normName(r.nome) === k) cand(x.st, x.em, 'Base'); }
  return best;
}
function eloPills(c, nome) {
  const ng = eloNeg(c, nome), d = eloDesfecho(c, nome), out = [], dt = o => o.data ? ' · ' + fmtD(o.data) : '';
  const ab = ng.find(o => ELO_ABERTA.includes(o.status)), gh = ng.find(o => o.status === 'GANHA'), pd = ng.find(o => o.status === 'PERDIDA');
  if (ab) out.push(`<span class="pill p-warn" title="Oportunidade vinculada por você no Forecast: ${esc(ab.produto)}${dt(ab)}. Correspondência pelo nome do produto.">em negociação no Forecast (${esc(fcStLabel[ab.status].toLowerCase())})</span>`);
  else if (gh) out.push(`<span class="pill p-ok" title="Consta como ganha no Forecast: ${esc(gh.produto)}${dt(gh)}. Confirme na ficha de faturamento.">ganha no Forecast</span>`);
  else if (pd) out.push(`<span class="pill p-off" title="Consta como perdida no Forecast: ${esc(pd.produto)}${dt(pd)}.">perdida no Forecast</span>`);
  if (d) out.push(`<span class="pill p-${d.st === 'ganhou' ? 'ok' : 'off'}" title="Desfecho registrado por você em ${fmtD(String(d.em || '').slice(0, 10))} (${esc(d.origem)}).">desfecho: ${esc(PT_RES[d.st].toLowerCase())}</span>`);
  return out.length ? ' ' + out.join(' ') : '';
}
/* ---- Forecast na ficha do cliente ---- */
function fcCard(c, compacto) {
  const D = S.meta.fcData; if (!D) return ''; const os = fcDoCliente(c);
  if (!os.length) return compacto ? '' : `<div class="card" id="elo-fc"><h3>Negociações no Forecast</h3><p class="sm muted">Nenhuma oportunidade do seu Forecast está vinculada a este cliente. O vínculo é feito por você em <a href="#" data-a="nav" data-v="forecast">Meu Forecast</a> (nunca automático).</p></div>`;
  const ab = os.filter(o => ELO_ABERTA.includes(o.status)), lista = compacto ? os.slice(0, 3) : os;
  return `<div class="card" id="elo-fc"><div class="row"><h3>Negociações no Forecast <span class="muted sm">(${os.length})</span></h3><span class="sp"></span><button class="btn sm ghost" data-a="nav" data-v="forecast">Abrir Meu Forecast</button></div>
  <div class="tw"><table><thead><tr><th>Produto (planilha)</th><th>Status</th><th>Previsão</th><th class="r">Total</th></tr></thead><tbody>${lista.map(o => `<tr><td>${esc(o.produto || '—')}</td><td>${pill(fcStLabel[o.status], fcStPill[o.status])}</td><td class="sm">${o.data ? fmtD(o.data) : '—'}</td><td class="r">${fmtBRL(o.total)}</td></tr>`).join('')}</tbody></table></div>
  <p class="sm muted" style="margin-top:6px">${ab.length ? `${ab.length} em andamento. ` : ''}Fonte: sua planilha de Forecast, sincronizada em ${fmtD(String(D.syncedAt || '').slice(0, 10))}. Valores da planilha: não entram em potenciais nem em estimativas desta ferramenta.${compacto && os.length > 3 ? ` Mostrando 3 de ${os.length}.` : ''}</p></div>`;
}
/* ---- soluções vinculadas: Gestão da conta e Oportunidades ---- */
const eloVincs = c => Object.entries(c.enxVinc || {}).filter(([, v]) => v.st === 'vinculada' || v.st === 'validada').map(([id, v]) => ({ id, ...v })).sort((a, b) => String(b.em || '').localeCompare(String(a.em || '')));
const eloResSel = (c, v) => `<label class="sm pt-res">Desfecho <select data-c="adres" data-k="${esc(c.key)}" data-id="${esc(v.id)}" aria-label="Desfecho da solução vinculada"><option value="">sem registro</option>${Object.entries(PT_RES).map(([k, l]) => `<option value="${k}" ${v.res?.st === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`;
function vincCard(c) {
  const vs = eloVincs(c); if (!vs.length) return '';
  return `<div class="card" id="elo-vinc"><div class="row"><h3>Soluções vinculadas a este cliente <span class="muted sm">(${vs.length})</span></h3><span class="sp"></span><button class="btn sm ghost" data-a="ctab" data-v="portfolio">Ver recomendações</button></div>
  ${vs.map(v => `<div class="ad-row" data-vinc="${esc(v.id)}"><div class="ad-m"><div><b>${esc(v.nome || v.id)}</b> ${pill(v.st === 'validada' ? 'aderência confirmada por você' : 'vinculada', v.st === 'validada' ? 'ok' : 'info')}${eloPills(c, v.nome || '')}</div><div class="sm muted">Desde ${fmtD(String(v.em || '').slice(0, 10))}${v.ad != null ? ` · aderência ${v.ad}/100 e cobertura ${v.cob}% no momento do vínculo` : ''}</div>${eloRevLinha(c, v)}</div><div class="ad-acts">${eloResSel(c, v)}<button class="btn sm ghost" data-a="adSemana" data-k="${esc(c.key)}" data-id="${esc(v.id)}">Levar para a semana</button><button class="btn sm ghost" data-a="adFicha" data-k="${esc(c.key)}" data-id="${esc(v.id)}">Ver ficha</button></div></div>`).join('')}
  <p class="sm muted" style="margin-top:6px">Vínculo é uma marcação sua, não uma venda: o desfecho registra o que aconteceu e vale para as duas listas de recomendação.</p></div>`;
}
function eloVincOport() { /* painel Oportunidades: o que você já vinculou, em toda a carteira */
  const rows = clients().flatMap(c => eloVincs(c).map(v => ({ c, v }))); if (!rows.length) return '';
  return `<details class="card" id="elo-op" ${UI.eloOp ? 'open' : ''}><summary><b>Soluções vinculadas por você</b> <span class="muted sm">(${rows.length} em ${new Set(rows.map(r => r.c.key)).size} cliente(s))</span></summary>
  <div class="tw" style="margin-top:8px"><table><thead><tr><th style="min-width:200px">Cliente</th><th style="min-width:220px">Solução</th><th>Situação</th><th>Desde</th></tr></thead><tbody>${rows.slice(0, 200).map(({ c, v }) => `<tr><td><a href="#" data-a="open" data-k="${esc(c.key)}"><b>${esc(c.name)}</b></a></td><td>${esc(v.nome || v.id)}</td><td>${pill(v.st === 'validada' ? 'aderência confirmada' : 'vinculada', v.st === 'validada' ? 'ok' : 'info')}${eloPills(c, v.nome || '')}${eloRev(c, v) ? ' ' + pill('revisar: catálogo mudou', 'warn') : ''}</td><td class="sm">${fmtD(String(v.em || '').slice(0, 10))}</td></tr>`).join('')}</tbody></table></div>
  <p class="sm muted" style="margin-top:6px">Marcações suas a partir do Catálogo Enxoval. Não são oportunidades do motor nem entram no Forecast.</p></details>`;
}
function eloResSet(key, id, st) { const c = S.clients[key], v = c?.enxVinc?.[id]; if (!v) return; if (PT_RES[st]) v.res = { st, em: nowISO() }; else delete v.res; touchC(key); }
function eloChange(t, c, v) { if (c !== 'adres') return false; eloResSet(t.dataset.k, t.dataset.id, v); render(); toast(v ? 'Desfecho registrado.' : 'Desfecho removido.'); return true; }
/* ---- MRR do cadastro × Empodera ---- */
function mrrEmpDiv(c) {
  const e = c.emp; if (!e || e.ausente || c.mrr == null || e.mrrP == null) return null;
  const a = +c.mrr, b = +e.mrrP; if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1) * 100 > mrrTol() ? { cad: a, emp: b, data: (e.hist || []).slice(-1)[0]?.[0] || '' } : null;
}
function mrrEmpAlerta(c) { const d = mrrEmpDiv(c); return d ? `<div class="alert b" id="elo-mrr"><b>MRR divergente entre fontes.</b> <span class="sm">Cadastro (planilha): <b>${fmtBRL(d.cad)}</b> · Empodera (MRR pagante${d.data ? ', ' + fmtD(d.data) : ''}): <b>${fmtBRL(d.emp)}</b>. Os dois valores nunca são somados: Visão geral e Clientes usam o do cadastro; Forecast e Carteira & MRR usam o do Empodera. Reimporte a fonte desatualizada para alinhar.</span></div>` : ''; }
/* ---- briefing ---- */
function eloBrief(c) {
  const os = fcDoCliente(c), vs = eloVincs(c), L = [];
  if (os.length) L.push('Forecast (sua planilha): ' + os.slice(0, 6).map(o => `${o.produto || 'produto não informado'} — ${fcStLabel[o.status]}${o.data ? ', ' + fmtD(o.data) : ''}, ${fmtBRL(o.total)}`).join('; ') + (os.length > 6 ? `; mais ${os.length - 6}` : '') + '.');
  if (vs.length) L.push('Soluções vinculadas por você: ' + vs.slice(0, 8).map(v => `${v.nome || v.id} (${v.st === 'validada' ? 'aderência confirmada' : 'vinculada'}${v.res ? ', desfecho: ' + PT_RES[v.res.st].toLowerCase() : ''})`).join('; ') + '.');
  return L;
}

/* ---- etapa 3: catálogo reimportado → vínculos pedem revisão; nomes alternativos para reconhecer "já possui" ---- */
function eloRev(c, v) { /* só aponta mudança material; nada é alterado sozinho */
  if (!ENX.idx || !ENX.meta) return null; const p = ENX.idx.find(x => x.id === v.id);
  if (!p) return { fora: true, motivos: ['o produto não está mais no catálogo importado'] };
  if (p.nivel === 'inativo') return { fora: true, motivos: ['o produto passou a constar como inativo no catálogo'] };
  if (!v.cat || v.cat === ENX.meta.importadoEm) return null;
  const m = [], x = adCalc(adCtx(c), p);
  if (v.nome && normName(v.nome) !== normName(p.nome)) m.push(`o nome mudou para “${p.nome}”`);
  if (x.bloqueio) m.push('agora há bloqueio técnico: ' + x.bloqueio);
  if (v.ad != null && x.ad != null && Math.abs(x.ad - v.ad) >= 10) m.push(`a aderência passou de ${v.ad} para ${x.ad}`);
  if (v.cob != null && Math.abs((x.cob || 0) - v.cob) >= 10) m.push(`a cobertura passou de ${v.cob}% para ${x.cob}%`);
  return m.length ? { motivos: m, ad: x.ad, cob: x.cob, nome: p.nome } : null;
}
function eloRevLinha(c, v) { const r = eloRev(c, v); return r ? `<div class="alert sm" style="margin-top:6px" data-rev="${esc(v.id)}"><b>Revise este vínculo:</b> catálogo ${r.fora ? 'atual' : 'reimportado em ' + fmtD(String(ENX.meta.importadoEm || '').slice(0, 10))} — ${r.motivos.map(esc).join('; ')}. ${r.fora ? `<button class="btn sm ghost" data-a="adSoltar" data-k="${esc(c.key)}" data-id="${esc(v.id)}">Desvincular</button>` : `<button class="btn sm" data-a="eloRevOk" data-k="${esc(c.key)}" data-id="${esc(v.id)}">Marcar como revisado</button>`}</div>` : ''; }
const eloRevN = c => eloVincs(c).filter(v => eloRev(c, v)).length;
function eloRevAlerta(c) { const n = ENX.idx && ENX.meta ? eloRevN(c) : 0; return n ? `<div class="alert i" id="elo-rev"><b>Catálogo Enxoval atualizado:</b> ${n} solução(ões) vinculada(s) a este cliente mudaram desde o vínculo. <a href="#" data-a="ctab" data-v="gestao">Revisar em Gestão da conta</a>.</div>` : ''; }
function eloAliasCard(p) {
  const al = (S.meta.enxAlias || {})[p.id] || [];
  return `<div class="card" id="elo-alias"><h3>Como este produto aparece nas suas fichas</h3><p class="sm muted">Se as fichas de faturamento usam outro nome para este produto, cadastre aqui (separe por vírgula). Cliente com esse item passa a constar como “Já possui”, em vez de receber a recomendação como produto novo. Vale só para a sua carteira.</p>
  <div class="row" style="gap:6px;flex-wrap:wrap"><input type="text" id="elo_al" value="${esc(al.join(', '))}" placeholder="ex.: SIGAWMS, Gestão de Armazém" style="min-width:320px;flex:1" maxlength="400" aria-label="Nomes alternativos"><button class="btn sm pri" data-a="eloAliasSalvar" data-id="${esc(p.id)}">Salvar nomes</button></div>
  ${al.length ? `<p class="sm" style="margin-top:6px">${al.map(a => pill(a, 'info')).join(' ')}</p>` : ''}</div>`;
}
function eloAliasSet(id, txt) {
  const vistos = new Set(), al = String(txt || '').split(/[,;\n]+/).map(a => a.replace(/[<>]/g, '').trim().slice(0, 60)).filter(a => { const k = normName(a); if (k.length < 4 || vistos.has(k)) return false; vistos.add(k); return true; }).slice(0, 8);
  S.meta.enxAlias ||= {}; if (al.length) S.meta.enxAlias[id] = al; else delete S.meta.enxAlias[id]; touchMeta(); return al;
}
const ELO_ACT = {
  eloRevOk: t => { const c = S.clients[t.dataset.k], v = c?.enxVinc?.[t.dataset.id]; if (!v) return; const r = eloRev(c, { id: t.dataset.id, ...v }); v.cat = ENX.meta?.importadoEm || ''; if (r && !r.fora) { v.ad = r.ad; v.cob = r.cob; v.nome = String(r.nome).slice(0, 160); } v.revEm = nowISO(); touchC(c.key); render(); toast('Vínculo revisado com o catálogo atual.'); },
  eloAliasSalvar: t => { const al = eloAliasSet(t.dataset.id, $('#elo_al')?.value); render(); toast(al.length ? `${al.length} nome(s) alternativo(s) salvo(s). As recomendações já consideram.` : 'Nomes alternativos removidos.'); },
};
