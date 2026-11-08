/* Primeiros passos (onboarding): lista curta na Visão da Carteira, calculada do estado real (nada é marcado à mão). Começa vazio: sem dados de exemplo. */
function onbPassos() {
  const cl = clients(), temChave = (() => { try { return Object.values(hkLer()).some(Boolean); } catch { return false; } })();
  return [
    { ok: cl.length > 0, t: 'Importar sua carteira', d: 'Planilha ou Planilha do Google, em Importar e fichas.', v: 'importar' },
    { ok: temChave, t: 'Conectar sua chave de IA', d: 'Opcional para a análise por IA e o OCR. A chave fica só neste navegador.', v: 'ia' },
    { ok: cl.some(c => c.fstat && c.fstat.k === 'disponivel'), t: 'Anexar uma ficha de faturamento', d: 'Sem ficha, o raio-X e o briefing ficam incompletos.', v: 'importar' },
    { ok: !!(typeof LEM !== 'undefined' && LEM.local), t: 'Ativar o lembrete neste aparelho', d: 'Aviso às 9h e às 14h só se você ainda não abriu a ferramenta.', v: 'conta' }
  ];
}
function onbCard() {
  if (lsGet('onb.fim') === '1') return '';
  const p = onbPassos(), n = p.filter(x => x.ok).length; if (n === p.length) return '';
  return `<div class="card" id="onb"><div class="row"><h3>Primeiros passos</h3><span class="pill p-info">${n} de ${p.length}</span><span class="sp"></span><button class="btn ghost sm" data-a="onbFim">Ocultar</button></div>
  <ol class="sm" style="list-style:none;padding:0;margin:8px 0 0">${p.map(x => `<li class="row" style="gap:8px;padding:6px 0;border-top:1px solid var(--bd2)"><span aria-hidden="true">${x.ok ? '✔' : '○'}</span><div style="flex:1"><b>${esc(x.t)}</b>${x.ok ? ' <span class="muted">(feito)</span>' : ''}<div class="muted">${esc(x.d)}</div></div>${x.ok ? '' : `<button class="btn ghost sm" data-a="nav" data-v="${x.v}">Abrir</button>`}</li>`).join('')}</ol>
  <p class="sm muted" style="margin-top:8px">Sua carteira é privada: só você a vê. Este quadro some quando os passos terminam, ou ao ocultar.</p></div>`;
}
const ONB_ACT = { onbFim: () => { lsSet('onb.fim', '1'); render(); } };
{
  const g = typeof vGeral === 'function' ? vGeral : null;
  if (g) globalThis.vGeral = function (forExport) { const h = g.apply(this, arguments); return forExport ? h : onbCard() + h; };
}
