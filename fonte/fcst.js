/* ===== MEU FORECAST: visão ESN de meta/realizado/oportunidades, sincronizada da planilha "Mesa Forecast" (Google Sheets) =====
   Reaproveita handlePlanilha (worker, parâmetro "aba") e parseCSV/detectHeader (core.js). Sem Kanban, sem dashboards de outro perfil,
   sem painel admin próprio: config inline nesta tela, isolada por conta (cada ESN só vê o próprio META/doc). Vínculo oportunidade↔cliente
   é manual (nunca por nome semelhante), preservando o cadastro de clientes existente. */
const FC_TABS = [['ABRIL', '04'], ['MAIO', '05'], ['JUNHO', '06'], ['JULHO', '07'], ['AGOSTO', '08'], ['SETEMBRO', '09'], ['OUTUBRO', '10'], ['NOVEMBRO', '11'], ['DEZEMBRO', '12']];
const FC_QM = { Q1: ['01', '02', '03'], Q2: ['04', '05', '06'], Q3: ['07', '08', '09'], Q4: ['10', '11', '12'] };
let FC_BUSY = false;
const fcHash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return 'o' + (h >>> 0).toString(36); };
const fcNormStatus = s => { const n = norm(s); return /^ganh/.test(n) ? 'GANHA' : /assinatura/.test(n) ? 'EM ASSINATURA' : /abert/.test(n) ? 'EM ABERTO' : /^perd/.test(n) ? 'PERDIDA' : 'OUTRO'; };
const fcStLabel = { GANHA: 'Ganha', 'EM ABERTO': 'Em aberto', 'EM ASSINATURA': 'Em assinatura', PERDIDA: 'Perdida', OUTRO: 'Outro' };
const fcStPill = { GANHA: 'ok', 'EM ABERTO': 'warn', 'EM ASSINATURA': 'warn', PERDIDA: 'off', OUTRO: 'off' };
const fcNormRev = s => { const n = norm(s); return /^cdu/.test(n) ? 'cdu' : /^serv/.test(n) ? 'serv' : /^rec/.test(n) ? 'rec' : null; };
const FC_TIPOS = [['cdu', 'CDU'], ['rec', 'Recorrente'], ['serv', 'Serviços']];
function fcPNum(v) { if (v == null || v === '') return 0; if (typeof v === 'number') return isNaN(v) ? 0 : v; let s = String(v).trim().replace(/[^\d,.\-]/g, ''); if (!s) return 0; if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.'); return +s || 0; }
function fcPData(v, ano, mes) { const s = String(v ?? '').trim(); let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (m) return `${m[3]}-${String(+m[2]).padStart(2, '0')}-${String(+m[1]).padStart(2, '0')}`; m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return `${m[1]}-${String(+m[2]).padStart(2, '0')}-${String(+m[3]).padStart(2, '0')}`; return `${ano}-${mes}-01`; }
const fcCfg = () => S.meta.fcSheet || null;
async function fcFetchAba(url, aba) {
  const r = await fetch('/api/planilha', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ url, aba }) });
  let j; try { j = await r.json(); } catch { throw new Error(`Resposta inválida do servidor (HTTP ${r.status}).`); }
  if (!j.ok) throw new Error(j.erro?.mensagem || `Falha ao ler a aba "${aba}".`); return j;
}
function fcSave(url, minutes, auto) {
  url = String(url || '').trim(); if (!SH_RE.test(url)) return toast('Link inválido. Use o link da planilha: https://docs.google.com/spreadsheets/d/…');
  const C = S.meta.fcSheet ||= {}; C.url = url; C.minutes = Math.max(5, Math.min(1440, +minutes || 30)); C.auto = auto !== false; touchMeta(); return true;
}
function fcUnlink() { delete S.meta.fcSheet; touchMeta(); render(); toast('Planilha do Forecast desvinculada. O histórico sincronizado foi mantido.'); }
/* Sincroniza as 9 abas de meses (ABRIL…DEZEMBRO, ciclo comercial) + aba META. Substitui o cache local inteiro a cada sincronização
   (sem acumular duplicatas); os dados do Analisador (clientes, oportunidades) não são tocados. */
async function fcSync(manual) {
  const C = fcCfg(); if (!C?.url || FC_BUSY || !window.__HOSTED__) return;
  FC_BUSY = true; C.lastTry = nowISO(); if (manual) { UI.busy = 'Sincronizando com a Mesa Forecast…'; render(); }
  try {
    const opps = [], seen = new Set(), anoRef = new Date().getFullYear(); let lidas = 0;
    for (const [nome, mes] of FC_TABS) {
      let csv; try { csv = (await fcFetchAba(C.url, nome)).csv; } catch { continue; } /* aba pode não existir para este usuário/planilha: segue para as demais */
      lidas++; const rows = parseCSV(String(csv).replace(/^﻿/, ''), ','); if (!rows.length) continue;
      const hd = detectHeader(rows);
      for (let i = hd + 1; i < rows.length; i++) {
        const r = rows[i], cliente = String(r[2] ?? '').trim(); if (!cliente) continue;
        const produto = String(r[3] ?? '').trim(), status = fcNormStatus(r[4]), cdu = fcPNum(r[5]), rec = fcPNum(r[6]), serv = fcPNum(r[7]);
        const total = String(r[8] ?? '').trim() !== '' ? fcPNum(r[8]) : cdu + rec + serv, data = fcPData(r[1], anoRef, mes), vendedor = String(r[9] ?? '').trim();
        const key = [nome, norm(cliente), norm(produto), data, cdu, rec, serv, total].join('|'); if (seen.has(key)) continue; seen.add(key);
        opps.push({ id: fcHash(key), tab: nome, mes, cliente, produto, status, cdu, rec, serv, total, data, vendedor });
      }
    }
    let metas = []; try { const mc = (await fcFetchAba(C.url, 'META')).csv, rows = parseCSV(String(mc).replace(/^﻿/, ''), ','); if (rows.length) { lidas++; const hd = detectHeader(rows);
      for (let i = hd + 1; i < rows.length; i++) { const r = rows[i], nome = String(r[0] ?? '').trim(), tipo = fcNormRev(r[1]); if (!nome || !tipo) continue; /* linha sem tipo de venda válido (ex.: total) não é meta */
        metas.push({ nome, tipo, ano: fcPNum(r[2]), mes: [6, 7, 8, 9, 10, 11, 12, 13, 14].map(ci => fcPNum(r[ci])), tri: [15, 16, 17, 18].map(ci => fcPNum(r[ci])) }); } } } catch { /* aba META ausente: metas ficam vazias */ }
    if (!lidas) throw new Error('Nenhuma aba de meses (ABRIL…DEZEMBRO) ou META foi encontrada na planilha.');
    S.meta.fcData = { opps, metas, syncedAt: nowISO() }; C.lastOk = nowISO(); C.linhas = opps.length; C.lastErr = null;
    if (manual) toast(`Forecast sincronizado: ${opps.length} oportunidade(s), ${metas.length} meta(s).`);
  } catch (e) { C.lastErr = { at: nowISO(), msg: e.message }; if (manual) toast(e.message); }
  finally { FC_BUSY = false; UI.busy = ''; touchMeta(); render(); }
}
function fcTick() { const C = fcCfg(); if (!C?.url || C.auto === false || !window.__HOSTED__ || FC_BUSY || UI.wiz || document.hidden || !META) return; if (C.lastTry && Date.now() - Date.parse(C.lastTry) < (C.minutes || 30) * 60000) return; fcSync(false); }
if (typeof window !== 'undefined') { setTimeout(fcTick, 11000); setInterval(fcTick, 60000); document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(fcTick, 700); }); }
/* Vínculo oportunidade→cliente: manual e explícito (nunca por nome semelhante); identifica por código TOTVS, CNPJ ou razão social exata. */
function fcFindCliente(q) { q = String(q || '').trim(); if (!q) return null; const qn = norm(q).replace(/[^a-z0-9]/g, ''); return Object.values(S.clients).find(x => (x.code && norm(x.code).replace(/[^a-z0-9]/g, '') === qn) || (x.cnpj && x.cnpj === digits(q)) || normName(x.name) === normName(q)) || null; }
function fcLink(oppId, clientKey) { S.meta.fcLink ||= {}; if (clientKey) S.meta.fcLink[oppId] = clientKey; else delete S.meta.fcLink[oppId]; touchMeta(); render(); }
function fcLinkConfirm(oppId, q) { const c = fcFindCliente(q); if (!c) return toast('Cliente não encontrado por código, CNPJ ou razão social exata.'); fcLink(oppId, c.key); }
const fcClienteOf = o => { const k = S.meta.fcLink?.[o.id]; return k ? S.clients[k] : null; };
/* Metas: casa pelo primeiro nome do usuário logado na aba META; sem correspondência, usa todas as linhas (igual à ferramenta original). */
function fcMetaRows(tipo) { const metas = (S.meta.fcData?.metas || []).filter(m => { const t = fcNormRev(m.tipo); return t && (!tipo || t === tipo); }); if (!metas.length) return []; const first = norm((ME.nome || '').trim().split(/\s+/)[0] || ''); if (!first) return metas; const hit = metas.filter(m => norm(m.nome).includes(first)); return hit.length ? hit : metas; }
function fcMesesSel(per, sel) { if (per === 'anual') return FC_TABS.map(t => t[1]); if (per === 'trimestral') return FC_QM[sel] || FC_QM.Q1; return [sel || FC_TABS[0][1]]; }
function fcMetaTotal(per, sel, tipo) { const rows = fcMetaRows(tipo); if (!rows.length) return 0; if (per === 'anual') return rows.reduce((s, m) => s + (m.ano || 0), 0); if (per === 'trimestral') { const qi = ['Q1', 'Q2', 'Q3', 'Q4'].indexOf(sel); return rows.reduce((s, m) => s + (m.tri[qi] || 0), 0); } const mi = FC_TABS.findIndex(t => t[1] === sel); return rows.reduce((s, m) => s + (m.mes[mi] || 0), 0); }
function fcOppsPeriodo(per, sel) { const meses = new Set(fcMesesSel(per, sel)); return (S.meta.fcData?.opps || []).filter(o => meses.has(o.mes)); }
/* tipo ('cdu'|'rec'|'serv'|''): filtra meta e valores pelo tipo de venda; vazio = total */
function fcKPI(per, sel, tipo) {
  const todas = fcOppsPeriodo(per, sel), val = o => tipo ? o[tipo] : o.total, opps = tipo ? todas.filter(o => o[tipo] > 0) : todas, soma = a => a.reduce((s, o) => s + val(o), 0);
  const ganhas = opps.filter(o => o.status === 'GANHA'), aberto = opps.filter(o => o.status === 'EM ABERTO'), assin = opps.filter(o => o.status === 'EM ASSINATURA'), perdida = opps.filter(o => o.status === 'PERDIDA');
  const realizado = soma(ganhas), meta = fcMetaTotal(per, sel, tipo), atingimento = meta > 0 ? realizado / meta * 100 : null;
  const porTipo = FC_TIPOS.map(([t, l]) => { const m = fcMetaTotal(per, sel, t), g = todas.filter(o => o.status === 'GANHA').reduce((s, o) => s + o[t], 0); return { t, l, meta: m, ganho: g, pct: m > 0 ? g / m * 100 : null }; });
  return { meta, realizado, atingimento, falta: Math.max(meta - realizado, 0), excedente: realizado > meta ? realizado - meta : 0,
    aberto: { n: aberto.length, v: soma(aberto) }, assinatura: { n: assin.length, v: soma(assin) }, perdida: { n: perdida.length, v: soma(perdida) }, porTipo, opps };
}
/* ---------- UI ---------- */
function fcSheetCard() {
  if (!window.__HOSTED__) return '<div class="alert sm">A sincronização com o Google Sheets só está disponível na versão hospedada.</div>';
  const C = fcCfg() || {}, linked = !!C.url, D = S.meta.fcData;
  return `<div class="card" id="fccard"><div class="row"><h3>Planilha da Mesa Forecast</h3><span class="sp"></span>${linked ? pill(C.auto === false ? 'automático desligado' : `automático: a cada ${C.minutes || 30} min`, C.auto === false ? 'off' : 'ok') : ''}</div>
  <p class="sm muted">Cole o link da planilha da Mesa Forecast (compartilhada como <b>"Qualquer pessoa com o link → Leitor"</b>). O app lê as abas de meses (ABRIL…DEZEMBRO) e a aba META pelo nome, dispensando o gid de cada uma.</p>
  <div class="row addr"><input id="fc_url" type="url" placeholder="https://docs.google.com/spreadsheets/d/…" value="${esc(C.url || '')}" style="min-width:340px;flex:1" aria-label="Link da planilha da Mesa Forecast"><label class="sm">a cada <input id="fc_min" type="number" min="5" max="1440" value="${C.minutes || 30}" style="width:64px"> min</label><label class="sm"><input type="checkbox" id="fc_auto" ${C.auto === false ? '' : 'checked'}> automático</label>
  <button class="btn pri" data-a="fcGo">${linked ? 'Salvar e sincronizar' : 'Vincular e sincronizar'}</button>${linked ? '<button class="btn ghost" data-a="fcNow">Sincronizar agora</button><button class="btn ghost" data-a="fcOff">Desvincular</button>' : ''}</div>
  ${linked ? `<div class="sm" style="margin-top:6px">Última sincronização: <b>${esc(shAgo(C.lastOk))}</b>${D ? ` • ${D.opps.length} oportunidade(s), ${D.metas.length} meta(s)` : ''}</div>` : ''}
  ${C.lastErr ? `<div class="alert b sm"><b>Falha em ${esc(shAgo(C.lastErr.at))}:</b> ${esc(C.lastErr.msg)}</div>` : ''}</div>`;
}
function fcKpiCard(l, v, sub = '') { return `<div class="kpi"><div class="sm muted">${esc(l)}</div><b>${v}</b>${sub ? `<div class="sm muted">${sub}</div>` : ''}</div>`; }
function vForecast() {
  UI.fc ||= {}; const per = UI.fc.per || 'mensal';
  const sel = UI.fc.sel || (per === 'trimestral' ? 'Q1' : per === 'mensal' ? FC_TABS[0][1] : null);
  const D = S.meta.fcData;
  if (!D) return `<p class="sm muted">Vincule a planilha da Mesa Forecast para ver meta, realizado e oportunidades em aberto.</p>${fcSheetCard()}`;
  const tipo = UI.fc.tipo || '', k = fcKPI(per, sel, tipo), barPct = k.meta > 0 ? Math.min(100, Math.round(k.realizado / k.meta * 100)) : 0;
  const perSel = `<div class="row" style="gap:6px;margin:10px 0">${[['mensal', 'Mensal'], ['trimestral', 'Trimestral'], ['anual', 'Anual']].map(([pv, pl]) => `<button class="btn ${pv === per ? 'pri' : 'ghost'} sm" data-a="fcPer" data-v="${pv}">${pl}</button>`).join('')}
  ${per === 'mensal' ? `<select data-c="fcmes">${FC_TABS.map(([nm, mv]) => `<option value="${mv}" ${mv === sel ? 'selected' : ''}>${nm}</option>`).join('')}</select>` : ''}
  ${per === 'trimestral' ? `<select data-c="fctri">${Object.keys(FC_QM).map(q => `<option value="${q}" ${q === sel ? 'selected' : ''}>${q}</option>`).join('')}</select>` : ''}
  <label class="sm">Tipo de venda <select data-c="fcftipo"><option value="">Todos</option>${FC_TIPOS.map(([t, l]) => `<option value="${t}" ${t === tipo ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>`;
  const atingTxt = k.meta > 0 ? `${Math.round(k.atingimento)}%` : '—', atingSub = k.meta > 0 ? '' : 'meta não configurada para o período';
  const faltaSub = k.excedente > 0 ? `excedente: ${fmtBRL(k.excedente)}` : '';
  const kpis = `<div class="grid g4">${fcKpiCard('Meta comercial', fmtBRL(k.meta))}${fcKpiCard('Realizado (ganhas)', fmtBRL(k.realizado))}${fcKpiCard('Atingimento', atingTxt, atingSub)}${fcKpiCard('Falta para a meta', fmtBRL(k.falta), faltaSub)}</div>
  ${k.meta > 0 ? `<div class="bar" style="margin:8px 0 14px"><div class="tr" style="flex:1"><div class="fl" style="width:${barPct}%"></div></div><div class="nv">${barPct}%</div></div>` : ''}`;
  const sec2 = `<div class="grid g3">${fcKpiCard('Oportunidades em aberto', k.aberto.n, fmtBRL(k.aberto.v))}${fcKpiCard('Em assinatura', k.assinatura.n, fmtBRL(k.assinatura.v))}</div>
  <div class="card"><h3>Meta × Ganho por tipo de venda</h3>${k.porTipo.map(x => `<div class="bar"${tipo && tipo !== x.t ? ' style="opacity:.45"' : ''}><div class="lb"><b>${x.l}</b> — ${fmtBRL(x.ganho)} de ${x.meta > 0 ? fmtBRL(x.meta) : 'meta não configurada'}</div><div class="tr"><div class="fl" style="width:${x.pct == null ? 0 : Math.min(100, Math.round(x.pct))}%"></div></div><div class="nv">${x.pct == null ? '—' : Math.round(x.pct) + '%'}</div></div>`).join('')}</div>`;
  return `${fcSheetCard()}${perSel}${kpis}${sec2}${fcTable(k.opps, tipo)}`;
}
function fcTable(opps, tipo) {
  const f = UI.fc, q = norm(f.q || ''), st = f.st || '', val = o => tipo ? o[tipo] : o.total, sort = f.sort || 'data_desc', lim = f.lim || 150;
  let rows = opps.filter(o => (!st || o.status === st) && (!q || norm(o.cliente).includes(q) || norm(o.produto).includes(q)));
  rows = rows.sort((a, b) => sort === 'valor_asc' ? val(a) - val(b) : sort === 'valor_desc' ? val(b) - val(a) : sort === 'data_asc' ? a.data.localeCompare(b.data) : b.data.localeCompare(a.data));
  const total = rows.length; rows = rows.slice(0, lim);
  const catChip = o => ['cdu', 'rec', 'serv'].filter(k => o[k] > 0).map(k => pill({ cdu: 'CDU', rec: 'Recorrente', serv: 'Serviços' }[k], 'ok')).join(' ') || '—';
  const clienteCel = o => { const c = fcClienteOf(o); return c ? `<a href="#" data-a="open" data-k="${esc(c.key)}">${esc(c.name)}</a> <button class="btn ghost sm" data-a="fcLinkOff" data-id="${o.id}" data-tip="Desvincular">${ico('x', 14)}</button>`
    : `<span class="muted">${esc(o.cliente)}</span> <input id="fcl_${o.id}" type="text" placeholder="código, CNPJ ou razão social exata" style="width:180px" class="sm"> <button class="btn ghost sm" data-a="fcLinkGo" data-id="${o.id}">Vincular</button>`; };
  return `<div class="card"><div class="row"><h3>Oportunidades (${total})</h3><span class="sp"></span></div>
  <div class="row" style="gap:6px;flex-wrap:wrap"><input data-i="fcq" type="search" placeholder="Buscar cliente ou produto…" value="${esc(f.q || '')}" style="min-width:220px">
  <select data-c="fcfst"><option value="">Todos os status</option>${['EM ABERTO', 'EM ASSINATURA', 'GANHA', 'PERDIDA'].map(s => `<option value="${s}" ${s === st ? 'selected' : ''}>${fcStLabel[s]}</option>`).join('')}</select>
  <select data-c="fcsort"><option value="data_desc" ${sort === 'data_desc' ? 'selected' : ''}>Data (mais recente)</option><option value="data_asc" ${sort === 'data_asc' ? 'selected' : ''}>Data (mais antiga)</option><option value="valor_desc" ${sort === 'valor_desc' ? 'selected' : ''}>Valor (maior)</option><option value="valor_asc" ${sort === 'valor_asc' ? 'selected' : ''}>Valor (menor)</option></select></div>
  <div class="tbl-wrap"><table class="sm"><thead><tr><th>Cliente</th><th>Produto</th><th>Categoria</th><th>Valor</th><th>Status</th><th>Data de previsão</th><th>Origem</th></tr></thead>
  <tbody>${rows.length ? rows.map(o => `<tr><td>${clienteCel(o)}</td><td>${esc(o.produto)}</td><td>${catChip(o)}</td><td>${fmtBRL(val(o))}</td><td>${pill(fcStLabel[o.status], fcStPill[o.status])}</td><td>${fmtD(o.data)}</td><td class="sm muted">Mesa Forecast (${esc(o.tab)})</td></tr>`).join('') : `<tr><td colspan="7" class="sm muted">Nenhuma oportunidade no período/filtro selecionado.</td></tr>`}</tbody></table></div>
  ${total > lim ? `<div class="row" style="margin-top:8px"><button class="btn ghost sm" data-a="fcMore">Carregar mais (${total - lim} restante(s))</button></div>` : ''}</div>`;
}
