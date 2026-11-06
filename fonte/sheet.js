/* ===== PLANILHA DO GOOGLE: carteira sincronizada por link compartilhado ("qualquer pessoa com o link → leitor") ===== */
/* Só em modo hospedado (o Worker baixa o CSV de docs.google.com). Clientes que saem da planilha são MANTIDOS e marcados "fora da planilha". */
const SH_RE = /^https:\/\/docs\.google\.com\/spreadsheets\/d\/[A-Za-z0-9_-]{20,100}(?:\/[^?#]*)?(?:[?#].*)?$/;
let SH_BUSY = false;
const shHash = t => { let h = 5381; for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0; return t.length + ':' + (h >>> 0).toString(36); };
const shCfg = () => S.meta.sheet || null;
const shAgo = iso => { if (!iso) return 'nunca'; const m = Math.round((Date.now() - Date.parse(iso)) / 60000); return m < 1 ? 'agora há pouco' : m < 60 ? `há ${m} min` : m < 1440 ? `há ${Math.round(m / 60)} h` : fmtDate(iso); };
const shForaPill = c => c.foraPlanilha ? ` ${pill('fora da planilha desde ' + fmtD(String(c.foraPlanilha.desde).slice(0, 10)), 'warn')}` : '';
async function shFetch(url) {
  const r = await fetch('/api/planilha', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ url }) });
  let j; try { j = await r.json(); } catch { throw new Error(`Resposta inválida do servidor (HTTP ${r.status}).`); }
  if (!j.ok) throw new Error(j.erro?.mensagem || 'Falha ao ler a planilha.'); return j;
}
function shSave(url, minutes, auto) {
  url = String(url || '').trim(); if (!SH_RE.test(url)) return toast('Link inválido. Use o link da planilha: https://docs.google.com/spreadsheets/d/…');
  const C = S.meta.sheet ||= {}; if (C.url !== url) { delete C.mapH; delete C.hash; C.lastErr = null; }
  C.url = url; C.minutes = Math.max(5, Math.min(1440, +minutes || 15)); C.auto = auto !== false; touchMeta(); return true;
}
function shUnlink() { delete S.meta.sheet; touchMeta(); render(); toast('Link removido. Os clientes e o histórico foram mantidos.'); }
/* Sincroniza: manual=true mostra avisos; sem mapeamento salvo (ou se as colunas mudaram), abre o assistente para conferência. */
async function shSync(manual) {
  const C = shCfg(); if (!C?.url || SH_BUSY || !window.__HOSTED__) return; if (UI.wiz && !manual) return;
  SH_BUSY = true; C.lastTry = nowISO(); if (manual) { UI.busy = 'Sincronizando com a planilha do Google…'; render(); }
  let mudou = false;
  try {
    const j = await shFetch(C.url), h = shHash(j.csv), rows = parseCSV(j.csv.replace(/^\uFEFF/, ''), ',');
    if (!rows.some(r => r.some(c => String(c).trim() !== ''))) throw new Error('A planilha está vazia.');
    if (C.hash === h && C.mapH) { C.lastOk = nowISO(); if (manual) toast('Sem alterações desde a última sincronização.'); return; }
    const hd = detectHeader(rows), hdr = (rows[hd] || []).map(x => norm(String(x ?? ''))); let map = null;
    if (C.mapH) { map = {}; for (const [k, nm] of Object.entries(C.mapH)) { const i = hdr.indexOf(nm); if (i < 0) { map = null; break; } map[k] = i; } if (map && map.code == null && map.cnpj == null && map.name == null) map = null; }
    const w = { name: 'Planilha do Google', sheets: [{ name: 'Planilha do Google', rows }], si: 0, h: hd, map: map || autoMap((rows[hd] || []).map(String)), fromSheet: true, hash: h };
    if (!map) { UI.wiz = w; UI.view = 'importar'; mudou = true; if (C.mapH) C.lastErr = { at: nowISO(), msg: 'As colunas da planilha mudaram: confira o mapeamento.' }; toast('Confira o mapeamento de colunas da planilha antes de sincronizar.'); return; }
    UI.wiz = w; const P = impPlan(); P.rows.forEach(r => { if (r.act === 'pendente') w.res[r.i] = 'ignorar'; });
    const o = impApplyPlan({ silent: true }); mudou = true; C.lastErr = null;
    if (manual || o.add || o.upd) toast(`Planilha sincronizada: ${o.add} novo(s), ${o.upd} atualizado(s).`);
  } catch (e) { C.lastErr = { at: nowISO(), msg: e.message }; if (manual) toast(e.message); }
  finally { SH_BUSY = false; UI.busy = ''; if (UI.wiz?.fromSheet && !UI.wiz.step && !mudou) UI.wiz = null; touchMeta(); const ed = document.activeElement?.tagName; if (manual || (mudou && !/INPUT|TEXTAREA|SELECT/.test(ed || ''))) render(); }
}
/* Chamado por impApplyPlan quando a origem é a planilha vinculada */
function shAfterApply(w, plan, matched, o) {
  const C = S.meta.sheet ||= {}, hdr = w.sheets[0].rows[w.h] || [];
  C.mapH = {}; Object.entries(w.map).forEach(([k, i]) => { if (i != null) C.mapH[k] = norm(String(hdr[i] ?? '')); });
  C.hash = w.hash; C.lastOk = nowISO(); C.linhas = plan.rows.length; C.aviso = '';
  const all = Object.values(S.clients), fora = all.filter(c => !matched.has(c.key));
  if (matched.size >= 1 && fora.length <= all.length * 0.5) fora.forEach(c => { if (!c.foraPlanilha) { c.foraPlanilha = { desde: nowISO() }; touchC(c.key); } });
  else if (fora.length) C.aviso = `${fora.length} de ${all.length} clientes não constam na planilha: marcação "fora da planilha" NÃO aplicada (confira o link/aba).`;
  matched.forEach(k => { const c = S.clients[k]; if (c?.foraPlanilha) { delete c.foraPlanilha; touchC(k); } });
  C.fora = Object.values(S.clients).filter(c => c.foraPlanilha).length; C.lastMsg = `${o.add} novo(s), ${o.upd} atualizado(s), ${C.fora} fora da planilha`;
  touchMeta();
}
/* Gatilhos: ao abrir e a cada N minutos com o app aberto/visível */
function shTick() { const C = shCfg(); if (!C?.url || C.auto === false || !window.__HOSTED__ || SH_BUSY || UI.wiz || document.hidden || !META) return; if (C.lastTry && Date.now() - Date.parse(C.lastTry) < (C.minutes || 15) * 60000) return; shSync(false); }
if (typeof window !== 'undefined') { setTimeout(shTick, 9000); setInterval(shTick, 60000); document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(shTick, 500); }); }

function sheetCard() {
  if (!window.__HOSTED__) return '';
  const C = shCfg() || {}, linked = !!C.url, nf = Object.values(S.clients).filter(c => c.foraPlanilha).length;
  return `<div class="card" id="shcard"><div class="row"><h3>Planilha do Google (carteira)</h3><span class="sp"></span>${linked ? pill(C.auto === false ? 'automático desligado' : `automático: a cada ${C.minutes || 15} min`, C.auto === false ? 'off' : 'ok') : ''}</div>
  <p class="sm muted">Cole o link da planilha da carteira (compartilhada como <b>"Qualquer pessoa com o link → Leitor"</b>). Ao editar a planilha, o app atualiza a carteira ao abrir, a cada intervalo e pelo botão. Se a planilha tiver várias abas, use o link da aba desejada (com <code>gid=</code>). Clientes que saem da planilha <b>são mantidos</b> (histórico) e marcados "fora da planilha".</p>
  <div class="alert sm">Quem tiver o link lê a planilha inteira (MRR, CNPJ). Não compartilhe o link fora da equipe.</div>
  <div class="row addr"><input id="sh_url" type="url" placeholder="https://docs.google.com/spreadsheets/d/…" value="${esc(C.url || '')}" style="min-width:340px;flex:1" aria-label="Link da planilha do Google"><label class="sm">a cada <input id="sh_min" type="number" min="5" max="1440" value="${C.minutes || 15}" style="width:64px"> min</label><label class="sm"><input type="checkbox" id="sh_auto" ${C.auto === false ? '' : 'checked'}> automático</label>
  <button class="btn pri" data-a="shGo">${linked ? 'Salvar e sincronizar' : 'Vincular e sincronizar'}</button>${linked ? '<button class="btn ghost" data-a="shNow">Sincronizar agora</button><button class="btn ghost" data-a="shOff">Desvincular</button>' : ''}</div>
  ${linked ? `<div class="sm" style="margin-top:6px">Última sincronização: <b>${esc(shAgo(C.lastOk))}</b>${C.lastMsg ? ' • ' + esc(C.lastMsg) : ''}${nf ? ` • ${pill(nf + ' fora da planilha', 'warn')}` : ''}</div>` : ''}
  ${C.aviso ? `<div class="alert sm">${esc(C.aviso)}</div>` : ''}${C.lastErr ? `<div class="alert b sm"><b>Falha em ${esc(shAgo(C.lastErr.at))}:</b> ${esc(C.lastErr.msg)}</div>` : ''}</div>`;
}
