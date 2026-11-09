/* Oportunidade por solução: o nome do produto TOTVS é o destaque do card e cada solução tem aprofundamento próprio.
   Só apresenta o que a Base de Soluções documenta; o que não está documentado aparece como "não documentado" (nunca inventado). */
const SOLX_ACT = { solAprof: t => { UI.view = 'solucoes'; UI.solSel = t.dataset.id; UI.solEdit = null; render(); window.scrollTo(0, 0); } };
const solRec = s => { try { return activeSols().find(r => r.id === s.id) || s; } catch { return s; } };
const solTag = o => { const n = (o.sols || []).map(s => s.nome); return n.length ? ` — <b>${esc(n[0])}</b>${n.length > 1 ? ` <span class="muted">+${n.length - 1}</span>` : ''}` : ''; };
function solLi(a, h, fn) { return (a || []).length ? `<h6>${h}</h6><ul class="sm">${a.slice(0, 6).map(fn).join('')}</ul>` : ''; }
function solCard(c, o, s) {
  const r = solRec(s), est = contratEstado(c, s.id), cat = r.categoria || r.cat || s.cat || '';
  const prot = s.integraProtheus === true ? pill('Integra com Protheus (documentado)', 'ok') : s.integraProtheus === false ? pill('Não integra com Protheus (segundo a fonte)', 'bad') : pill('Compatibilidade com Protheus não verificada', 'off');
  const dores = solLi(r.dores, 'Dores que resolve', x => `<li>${esc(typeof x === 'string' ? x : x.t || '')}</li>`), fun = solLi(r.funcionalidades, 'Funcionalidades documentadas', x => `<li>${esc(typeof x === 'string' ? x : x.t || '')}</li>`);
  const pre = solLi(r.prerequisitos, 'Pré-requisitos', p => `<li>${esc(p.t || '')}</li>`), ing = solLi(r.integracoes, 'Integrações declaradas', i => `<li><b>${esc(i.sistema || '')}</b>: ${i.estado === 'confirmada' ? 'integra (fonte)' : i.estado === 'nao_integra' ? 'NÃO integra (fonte)' : 'não verificada'}</li>`);
  const vazio = !(dores || fun || pre || ing) ? '<p class="muted sm">A Base de Soluções ainda não detalha dores, funcionalidades, pré-requisitos ou integrações desta solução. Enriqueça o registro para aprofundar aqui.</p>' : '';
  const perg = (o.perg || []).slice(0, 2).map(p => `<li>${esc(p)}</li>`).join('');
  return `<div class="sol-card"><div class="sol-h">${cat ? `<span class="sol-cat">${esc(cat)}</span>` : ''}${pill(CT_EST[est], CT_EST_K[est])}${r.oficial ? pill('Oferta oficial TOTVS', 'ok') : ''}</div>
  <h5 class="sol-n">${esc(s.nome)}</h5>${s.finalidade ? `<p class="sol-f">${esc(s.finalidade)}</p>` : ''}<div class="sol-chips">${prot}</div>
  <details class="sol-more"><summary>Aprofundar esta solução</summary><div class="sol-body">
    <h6>Por que aparece para este cliente</h6><p class="sm">${esc(rxMotivo(c, o).replace(/\.{2,}$/, '.'))}</p>
    ${dores}${fun}${pre}${ing}${vazio}
    ${s.limites ? `<h6>Limitações</h6><p class="sm">${esc(s.limites)}</p>` : ''}
    <h6>O que validar com o cliente</h6><p class="sm">${esc(rxValidar(c, o))}</p>${perg ? `<ul class="sm">${perg}</ul>` : ''}
    <div class="row"><button type="button" class="btn ghost sm" data-a="solAprof" data-id="${esc(s.id)}">Abrir na Base de Soluções</button><span class="muted sm">Hipótese a validar; não é proposta nem promessa de aderência.</span></div></div></details></div>`;
}
function solStrip(c, o) {
  const L = o.sols || [];
  return `<div class="solstrip" aria-label="Soluções TOTVS desta oportunidade"><div class="sol-eb">${L.length ? (L.length === 1 ? 'Solução TOTVS' : `${L.length} soluções TOTVS possíveis`) : 'Solução TOTVS'}</div>${L.length ? L.map(s => solCard(c, o, s)).join('') : '<div class="sol-card sol-none"><h5 class="sol-n">Sem solução de produto associada</h5><p class="sol-f">Ação de relacionamento ou serviço: não há produto a apresentar nesta oportunidade.</p></div>'}</div>`;
}
