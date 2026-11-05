/* ===== Cobertura da Base de Soluções (R13 §4) =====
   Mede o que a base documenta — não o que a solução faz. Lacuna = base sem material para sustentar recomendação. */
const COV_DIAS_VELHA = 365;
const COV_LAC = {
  funcionalidades: ['Sem funcionalidades documentadas', 'sem funcionalidade registrada a ferramenta não pode citar o que a solução faz'],
  processos: ['Sem processos atendidos', 'sem processo atendido não há como ligar o processo do cliente à solução'],
  prerequisitos: ['Sem requisitos / pré-requisitos', 'sem requisitos a viabilidade técnica fica em aberto'],
  fontes: ['Sem fonte registrada', 'sem fonte a documentação não é rastreável'],
  oficial: ['Nenhuma fonte em domínio oficial', 'apenas fontes não oficiais ou sem link; confirme em fonte TOTVS antes de afirmar capacidade'],
  velha: ['Fonte desatualizada (> ' + COV_DIAS_VELHA + ' dias)', 'a documentação pode não refletir a versão atual'],
  integracao: ['Integração com Protheus não documentada', 'não há registro de integração; trate compatibilidade como a confirmar'],
  validacao: ['Registro marcado como "necessita validação"', 'conteúdo ainda não revisado por um humano']
};
function covSol(r) {
  const n = k => (r[k] || []).length, fo = r.fontes || [], com = fo.filter(f => f.u), ofi = com.filter(f => isOfficialUrl(f.u));
  const datas = fo.map(f => f.d).filter(Boolean).sort(), ult = datas.length ? datas[datas.length - 1] : '';
  const idade = ult && !isNaN(Date.parse(ult)) ? Math.floor((Date.now() - Date.parse(ult)) / 864e5) : null;
  const lac = [];
  if (!n('funcionalidades')) lac.push('funcionalidades');
  if (!n('processos')) lac.push('processos');
  if (!n('prerequisitos')) lac.push('prerequisitos');
  if (!fo.length) lac.push('fontes'); else if (!ofi.length) lac.push('oficial');
  if (idade !== null && idade > COV_DIAS_VELHA) lac.push('velha');
  if (r.tipo !== 'servico' && !n('integracoes') && !n('notasInt')) lac.push('integracao');
  if (/valida/i.test(r.status || '') && !/^validado$/i.test(r.status)) lac.push('validacao');
  return { id: r.id, nome: r.nome, tipo: r.tipo, func: n('funcionalidades'), proc: n('processos'), req: n('prerequisitos'), dores: n('dores'), fontes: fo.length, oficiais: ofi.length, ult, idade, mat: (r.materiais || r.mats || []).length, lac, cheia: lac.length === 0 };
}
const covAtivas = () => S.solutions.filter(r => !r.arquivado);
function covSegmento(segId) {
  const sg = KB.segments.find(s => s.id === segId); if (!sg) return null;
  const ids = new Set(sg.aplicacoes.map(a => a.sol));
  const sols = covAtivas().filter(r => ids.has(r.id) || (r.segmentos || []).includes(segId));
  const l = sols.map(covSol);
  return { seg: sg, sols: l, semRegistro: [...ids].filter(i => !covAtivas().some(r => r.id === i)), lac: l.reduce((n, x) => n + x.lac.length, 0), cheias: l.filter(x => x.cheia).length };
}
function covCliente(c) {
  const segId = c.segInfo?.id || null, sg = segId ? covSegmento(segId) : null;
  const rec = new Set((c.opps || []).flatMap(o => (o.sols || []).map(s => s.id)));
  const extra = covAtivas().filter(r => rec.has(r.id) && !(sg?.sols || []).some(x => x.id === r.id)).map(covSol);
  const sols = [...(sg?.sols || []), ...extra];
  return { segId, seg: sg?.seg || null, sols, semRegistro: sg?.semRegistro || [], recomendadas: sols.filter(x => rec.has(x.id)).map(x => x.id), lac: sols.reduce((n, x) => n + x.lac.length, 0) };
}
const covTabela = (sols, rec = []) => sols.length ? `<div class="tw"><table class="chain"><thead><tr><th>Solução</th><th>Func.</th><th>Proc.</th><th>Req.</th><th>Fontes (ofic.)</th><th>Atualização</th><th>Lacunas</th><th></th></tr></thead><tbody>${sols.map(x => `<tr><td>${esc(x.nome)}${rec.includes(x.id) ? ' ' + chip('RECOMENDADA') : ''}</td><td>${x.func}</td><td>${x.proc}</td><td>${x.req}</td><td>${x.fontes} (${x.oficiais})</td><td>${x.ult ? esc(fmtDate(x.ult)) + (x.idade > COV_DIAS_VELHA ? ' ⚠' : '') : '—'}</td><td>${x.lac.length ? x.lac.map(k => `<span class="pill p-warn" title="${esc(COV_LAC[k][1])}">${esc(COV_LAC[k][0])}</span>`).join(' ') : '<span class="muted">sem lacunas apontadas</span>'}</td><td><button class="btn ghost sm" data-a="covIr" data-id="${esc(x.id)}">${x.cheia ? 'Abrir' : 'Complementar'}</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="sm muted">Nenhum registro de solução ligado a este segmento na base.</p>';
const COV_AVISO = 'Cobertura mede <b>o que está documentado</b>, não a qualidade da solução. Complemente por arquivo, texto, link oficial ou pesquisa revisável no registro (seção "Material livre"); nada é assumido sem fonte.';
function covPanel(c) {
  const v = covCliente(c); if (!v.segId) return `<details class="sm"><summary>Cobertura da Base de Soluções</summary><p class="sm muted">Segmento do cliente não identificado: sem como medir a cobertura do segmento. Defina o segmento no cadastro.</p></details>`;
  const sem = v.semRegistro.length ? `<p class="sm"><b>Aplicações do segmento sem registro na base:</b> ${v.semRegistro.map(esc).join(', ')}.</p>` : '';
  return `<details class="sm"><summary>Cobertura da Base de Soluções — ${esc(v.seg.nome || v.segId)} (${v.sols.length} registro(s); ${v.lac} lacuna(s))</summary><p class="sm">${COV_AVISO}</p>${sem}${covTabela(v.sols, v.recomendadas)}</details>`;
}
function covResumoCarteira() {
  const sg = mkSegCarteira().com; if (!sg.length) return '';
  const linhas = sg.map(({ s, cl }) => { const v = covSegmento(s.id); return `<tr><td>${esc(s.nome || s.id)}</td><td>${cl.length}</td><td>${v.sols.length}</td><td>${v.cheias}</td><td>${v.lac}</td><td>${v.semRegistro.length}</td></tr>`; }).join('');
  const det = sg.map(({ s }) => { const v = covSegmento(s.id); return `<details class="sm"><summary>${esc(s.nome || s.id)} — detalhe</summary>${covTabela(v.sols)}</details>`; }).join('');
  return `<div class="card"><h3>Cobertura da Base de Soluções por segmento da carteira</h3><p class="sm">${COV_AVISO}</p><div class="tw"><table class="chain"><thead><tr><th>Segmento</th><th>Clientes</th><th>Registros</th><th>Sem lacunas</th><th>Lacunas</th><th>Aplicações sem registro</th></tr></thead><tbody>${linhas}</tbody></table></div>${det}</div>`;
}
const COV_ACT = { covIr: t => { UI.view = 'solucoes'; UI.solSel = t.dataset.id; UI.solEdit = null; render(); window.scrollTo(0, 0); } };
