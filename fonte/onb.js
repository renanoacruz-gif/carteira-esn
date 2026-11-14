/* Primeiros passos (onboarding): lista curta na Visão da Carteira, calculada do estado real (nada é marcado à mão). Começa vazio: sem dados de exemplo. */
function onbPassos() {
  const cl = clients();
  return [
    { ok: cl.length > 0, t: 'Suba a planilha da sua carteira', d: 'A exportação “Clientes_ESN” do Empodera, em Carteira & MRR. Leva menos de um minuto.', v: 'mrr', b: 'Subir planilha' },
    { ok: lsGet('onb.semana') === '1', t: 'Veja o plano da semana', d: 'As contas que pedem atenção agora, por ordem de prioridade.', v: 'mrr', tab: 'semana', b: 'Ver plano', dep: cl.length > 0 },
    { ok: lsGet('onb.cliente') === '1', t: 'Abra um cliente', d: 'Raio-X, diagnóstico e briefing prontos para a próxima conversa.', v: 'clientes', b: 'Ver clientes', dep: cl.length > 0 }
  ];
}
/* ajustes opcionais: só aparecem depois dos 3 passos, em uma linha */
function onbExtras() {
  const cl = clients(), temChave = (() => { try { return Object.values(hkLer()).some(Boolean); } catch { return false; } })();
  return [[temChave, 'Conectar chave de IA', 'ia'], [cl.some(c => c.fstat && c.fstat.k === 'disponivel'), 'Anexar uma ficha de faturamento', 'importar'], [!!(typeof LEM !== 'undefined' && LEM.local), 'Ativar o lembrete neste aparelho', 'conta']].filter(x => !x[0]);
}
function onbCard() {
  if (lsGet('onb.fim') === '1') return '';
  const p = onbPassos(), n = p.filter(x => x.ok).length, ex = onbExtras(); if (n === p.length && !ex.length) return '';
  if (n === p.length) return `<div class="card" id="onb"><div class="row"><h3>Tudo pronto</h3><span class="pill p-ok">3 de 3</span><span class="sp"></span><button class="btn ghost sm" data-a="onbFim">Ocultar</button></div><p class="sm muted" style="margin:6px 0 0">Quando quiser, opcional: ${ex.map(x => `<button class="btn ghost sm" data-a="nav" data-v="${x[2]}">${esc(x[1])}</button>`).join(' ')}</p></div>`;
  const prox = p.findIndex(x => !x.ok);
  return `<div class="card" id="onb"><div class="row"><h3>Comece em 3 passos</h3><span class="pill p-info">${n} de ${p.length}</span><span class="sp"></span><button class="btn ghost sm" data-a="onbFim">Ocultar</button></div>
  <ol class="sm" style="list-style:none;padding:0;margin:8px 0 0">${p.map((x, i) => `<li class="row" style="gap:10px;padding:8px 0;border-top:1px solid var(--bd2)"><span class="onb-n ${x.ok ? 'ok' : i === prox ? 'at' : ''}" aria-hidden="true">${x.ok ? '✔' : i + 1}</span><div style="flex:1"><b>${esc(x.t)}</b>${x.ok ? ' <span class="muted">(feito)</span>' : ''}<div class="muted">${esc(x.d)}</div></div>${x.ok ? '' : `<button class="btn ${i === prox ? 'pri' : 'ghost'} sm" data-a="onbIr" data-i="${i}" ${x.dep === false ? 'disabled title="Depende do passo 1"' : ''}>${esc(x.b)}</button>`}</li>`).join('')}</ol>
  <p class="sm muted" style="margin-top:8px">Sua carteira é privada: só você a vê. Este quadro some quando os passos terminam, ou ao ocultar.</p></div>`;
}
/* marca os passos 2 e 3 pelo uso real da tela (não por clique no quadro) */
function onbVisto() { try { if (!clients().length) return; if (UI.view === 'mrr' && UI.emp && UI.emp.tab === 'semana' && lsGet('onb.semana') !== '1') lsSet('onb.semana', '1'); if (UI.view === 'cliente' && UI.sel && S.clients[UI.sel] && lsGet('onb.cliente') !== '1') lsSet('onb.cliente', '1'); } catch { /* sem efeito */ } }
const ONB_ACT = { onbFim: () => { lsSet('onb.fim', '1'); render(); }, onbIr: t => { const x = onbPassos()[+t.dataset.i]; if (!x) return; if (x.tab) empUI().tab = x.tab; UI.view = x.v; render(); window.scrollTo(0, 0); } };
{
  const g = typeof vGeral === 'function' ? vGeral : null;
  if (g) globalThis.vGeral = function (forExport) { const h = g.apply(this, arguments); return forExport ? h : onbCard() + h; };
}
