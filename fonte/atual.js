/* Atualizar ferramenta: compara a versão carregada com a publicada e recarrega sem precisar reinstalar o atalho da tela inicial. */
const BUILD = '__BUILD__';
const ATU = { nova: false, busy: false, em: 0 };
async function atuCheck() {
  if (!window.__HOSTED__) return false;
  try { const r = await fetch('/api/versao', { cache: 'no-store', credentials: 'same-origin', redirect: 'manual' }); if (!r.ok) return false; const j = await r.json(); ATU.em = Date.now(); ATU.nova = !!(j && j.ok && j.v && j.v !== BUILD); } catch { return false; }
  atuAviso(); return ATU.nova;
}
function atuAviso() {
  let el = document.getElementById('atu-bar');
  if (!ATU.nova) { if (el) el.remove(); return; }
  if (el) return; el = document.createElement('div'); el.id = 'atu-bar'; el.setAttribute('role', 'status');
  el.innerHTML = '<span>Nova versão da ferramenta disponível.</span><button type="button" class="btn sm pri" data-a="atuGo">Atualizar agora</button>'; document.body.appendChild(el);
}
async function atuGo() {
  if (ATU.busy) return; ATU.busy = true; toast('Atualizando a ferramenta…');
  try { await Promise.race([flushNow(), new Promise(r => setTimeout(r, 6000))]); } catch { /* segue: o que não gravou continua pendente no aparelho */ }
  try { const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration('/') : null; if (reg) await Promise.race([reg.update(), new Promise(r => setTimeout(r, 3000))]); } catch { /* sem service worker */ }
  try { if (window.caches) for (const k of await caches.keys()) await caches.delete(k); } catch { /* sem cache */ }
  location.replace('/?atualizado=' + Date.now());
}
const ATU_ACT = { atuGo };
const atuBtn = cls => window.__HOSTED__ ? `<button type="button" class="${cls}" data-a="atuGo" data-tip="Carrega a versão mais recente, sem reinstalar o atalho" data-tipc="1">${ico('atualizar', 18)}<span class="sb-lb">Atualizar ferramenta</span></button>` : '';
if (typeof window !== 'undefined') {
  try { const u = new URL(location.href); if (u.searchParams.has('atualizado')) { u.searchParams.delete('atualizado'); history.replaceState(null, '', u.pathname + u.search + u.hash); setTimeout(() => toast('Ferramenta atualizada: você está na versão mais recente.'), 1500); } } catch { /* sem efeito */ }
  setTimeout(atuCheck, 20000); setInterval(() => { if (!document.hidden) atuCheck(); }, 30 * 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - ATU.em > 5 * 60000) atuCheck(); });
}
