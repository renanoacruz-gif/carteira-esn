/* ===== Onda 3: resumo semanal, roteiro de descoberta, ditado, busca global ===== */

/* ---------- R5 Resumo da semana (dentro do app; calculado dos dados atuais) ---------- */
const SEM_DIAS = 7;
function semanaDados() {
  const h = today(), lim = new Date(Date.now() - SEM_DIAS * 864e5).toISOString().slice(0, 10), em7 = new Date(Date.now() + SEM_DIAS * 864e5).toISOString().slice(0, 10);
  const D = { feitos: [], criados: 0, vencidos: [], proximos: [], validadas: 0, ren30: [], clientes: clients().length };
  clients().forEach(c => {
    rtLista(c, false).forEach(r => {
      const a = c.act[r.id];
      if (a.status === 'Concluído' && a.concluido && a.concluido >= lim) D.feitos.push({ c, r });
      if (a.criado && a.criado >= lim) D.criados++;
      if (RT_ABERTO(r) && r.prazo) { if (r.prazo < h) D.vencidos.push({ c, r }); else if (r.prazo <= em7) D.proximos.push({ c, r }); }
    });
    (c.opps || []).forEach(o => { const d = decGet(c, o.ruleId); if (d.valid === 'validada' && d.at && d.at.slice(0, 10) >= lim) D.validadas++; });
  });
  try { D.ren30 = rnvItens().filter(x => x.d >= 0 && x.d <= 30); } catch { /* sem datas */ }
  return D;
}
function semanaTexto(D) {
  const L = [`Resumo da semana (${fmtD(new Date(Date.now() - SEM_DIAS * 864e5).toISOString().slice(0, 10))} a ${fmtD(today())})`, ''];
  L.push(`• Retornos concluídos: ${D.feitos.length}`); L.push(`• Retornos registrados: ${D.criados}`); L.push(`• Oportunidades validadas: ${D.validadas}`);
  L.push(`• Retornos atrasados: ${D.vencidos.length}`); if (D.vencidos.length) D.vencidos.slice(0, 8).forEach(x => L.push(`   – ${x.c.name}: ${x.r.texto} (prazo ${fmtD(x.r.prazo)})`));
  L.push(`• Retornos nos próximos ${SEM_DIAS} dias: ${D.proximos.length}`); D.proximos.slice(0, 8).forEach(x => L.push(`   – ${x.c.name}: ${x.r.texto} (${fmtD(x.r.prazo)})`));
  L.push(`• Renovações confirmadas em até 30 dias: ${D.ren30.length}`); D.ren30.slice(0, 8).forEach(x => L.push(`   – ${x.c.name}: ${x.kind} em ${fmtD(x.iso)}`));
  return L.join('\n');
}
function semanaCard() {
  if (!clients().length) return '';
  const D = semanaDados(), k = (v, l, tom = '') => `<div class="kpi ${tom}"><div class="v">${v}</div><div class="l">${l}</div></div>`;
  return `<details class="card" id="semana" ${UI.semAberto ? 'open' : ''}><summary><b>Resumo da semana</b> <span class="muted sm">últimos ${SEM_DIAS} dias e próximos ${SEM_DIAS}</span></summary>
  <div class="grid g4" style="margin-top:8px">${k(D.feitos.length, 'retornos concluídos')}${k(D.validadas, 'oportunidades validadas')}${k(D.vencidos.length, 'retornos atrasados', D.vencidos.length ? 'a' : '')}${k(D.proximos.length, `retornos nos próximos ${SEM_DIAS} dias`)}</div>
  <p class="muted sm">Calculado dos registros atuais (retornos com data, decisões e datas confirmadas); não guarda histórico próprio. ${D.ren30.length ? `Renovações confirmadas em até 30 dias: <b>${D.ren30.length}</b>.` : ''}</p>
  <div class="row"><button class="btn ghost" data-a="semCopiar">Copiar resumo (texto)</button></div></details>`;
}

/* ---------- P4 Roteiro de descoberta (modelo de conversa; copiável) ---------- */
function roteiroTexto(c) {
  const ops = (c.opps || []).filter(o => oppAtiva(c, o)).sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 3);
  let Q = []; try { Q = (cadRules(c).Q || []).slice(0, 4); } catch { /* sem regras */ }
  const L = [`Roteiro de descoberta — ${c.name}`, '', '1. Abertura (5 min)', '   • Objetivo da conversa e o que o cliente espera dela.', '   • Mudanças recentes na empresa (estrutura, sistemas, regulatório).', ''];
  let n = 2;
  ops.forEach(o => { const p = (Array.isArray(o.perg) ? o.perg : o.perg ? [o.perg] : []).slice(0, 3); L.push(`${n++}. ${o.nome || o.titulo || o.tipo} (hipótese a validar, não confirmada)`); (p.length ? p : ['Como isso é feito hoje e quem decide?']).forEach(q => L.push(`   • ${q}`)); L.push(''); });
  if (Q.length) { L.push(`${n++}. Perguntas do cadastro do cliente`); Q.forEach(q => L.push(`   • ${q}`)); L.push(''); }
  L.push(`${n}. Encerramento`, '   • Resumir o que foi entendido e o que ficou combinado.', '   • Definir próximo passo, responsável e data (registrar em Retornos).');
  return L.join('\n');
}
{ const t = typeof tabReuniao === 'function' ? tabReuniao : null; if (t) globalThis.tabReuniao = function (c) {
  const base = t.apply(this, arguments), vz = typeof dictOk === 'function' && dictOk() ? '<div class="row"><button class="btn ghost sm" data-a="ditar" data-alvo="reu-ata">🎙 Ditar na ata (experimental)</button><span class="muted sm">O navegador envia o áudio ao serviço de voz do fabricante; não dite CNPJ nem valores.</span></div>' : '';
  const rot = `<div class="card"><h3>Roteiro de descoberta</h3><p class="muted sm">Monta um roteiro de conversa com as perguntas das oportunidades ativas e do cadastro do cliente. São <b>hipóteses a validar</b>, não fatos; o app não envia nada.</p>
  <div class="row"><button class="btn" data-a="rotGerar" data-k="${kk(c)}">Gerar roteiro</button></div>
  ${UI.rot && UI.rot.k === c.key ? `<textarea id="rot-txt" rows="14" style="width:100%;margin-top:8px">${esc(UI.rot.t)}</textarea><div class="row"><button class="btn ghost" data-a="rotCopiar">Copiar roteiro</button></div>` : ''}</div>`;
  return base.replace('<textarea id="reu-ata"', vz + '<textarea id="reu-ata"') + rot;
}; }

/* ---------- R6 Ditado (Web Speech do navegador; experimental, não verificado em aparelhos reais) ---------- */
const dictApi = () => window.SpeechRecognition || window.webkitSpeechRecognition || null;
const dictOk = () => !!dictApi() && !!window.__HOSTED__;
const DICT = { rec: null, ativo: null };
function dictParar() { try { DICT.rec && DICT.rec.stop(); } catch { /* já parado */ } DICT.rec = null; DICT.ativo = null; }
function dictIniciar(alvoId) {
  const A = dictApi(); const el = document.getElementById(alvoId); if (!A || !el) return;
  if (DICT.ativo) { dictParar(); return toast('Ditado encerrado.'); }
  let ok = false; try { ok = localStorage.getItem('ditado.ok') === '1'; } catch { /* sem storage */ }
  if (!ok) { if (!window.confirm('O ditado usa o serviço de voz do seu navegador (Google no Chrome/Android, Apple no Safari/iPhone), que recebe o áudio para transcrever. Não dite CNPJ, valores nem dados pessoais. Continuar?')) return; try { localStorage.setItem('ditado.ok', '1'); } catch { /* sem storage */ } }
  const r = new A(); r.lang = 'pt-BR'; r.interimResults = false; r.continuous = true; DICT.rec = r; DICT.ativo = alvoId;
  r.onresult = ev => { let t = ''; for (let i = ev.resultIndex; i < ev.results.length; i++) if (ev.results[i].isFinal) t += ev.results[i][0].transcript + ' '; if (t) { el.value = (el.value ? el.value.replace(/\s*$/, ' ') : '') + t.trim(); el.dispatchEvent(new Event('input', { bubbles: true })); } };
  r.onerror = e => { toast(e.error === 'not-allowed' ? 'Permissão do microfone negada.' : 'O ditado não está disponível agora.'); DICT.rec = null; DICT.ativo = null; };
  r.onend = () => { DICT.rec = null; DICT.ativo = null; };
  try { r.start(); toast('Ouvindo… toque de novo para encerrar.'); } catch { toast('Não foi possível iniciar o ditado.'); DICT.rec = null; DICT.ativo = null; }
}

/* ---------- Q8 Busca global de conteúdo (no navegador; nada vai ao servidor) ---------- */
const BUSCA_MIN = 3, BUSCA_MAX = 40;
function buscaTrecho(txt, q) {
  const t = String(txt || '').replace(/\s+/g, ' '), i = norm(t).indexOf(q); if (i < 0) return null;
  const a = Math.max(0, i - 50), b = Math.min(t.length, i + q.length + 80);
  return (a ? '…' : '') + t.slice(a, b) + (b < t.length ? '…' : '');
}
function buscaGlobal(termo) {
  const q = norm(String(termo || '').trim()); if (q.length < BUSCA_MIN) return { q, hits: [], erro: `Digite ao menos ${BUSCA_MIN} letras.` };
  const hits = [], add = h => { if (hits.length < BUSCA_MAX) hits.push(h); };
  clients().forEach(c => {
    if (norm(c.name + ' ' + (c.code || '')).includes(q)) add({ g: 'Clientes', t: c.name, s: c.code ? 'Código ' + c.code : '', k: c.key });
    rtLista(c, false).forEach(r => { const s = buscaTrecho(r.texto, q); if (s) add({ g: 'Retornos', t: c.name, s, k: c.key, tab: 'reuniao' }); });
    const sn = buscaTrecho(c.mgmt?.notes, q); if (sn) add({ g: 'Anotações do cliente', t: c.name, s: sn, k: c.key, tab: 'reuniao' });
    const so = buscaTrecho(c.notes, q); if (so) add({ g: 'Observações da planilha', t: c.name, s: so, k: c.key });
    [...(c.cdocs || []), ...(c.docs || [])].forEach(d => { const s = buscaTrecho(d.text, q); if (s) add({ g: 'Documentos do cliente', t: `${c.name} • ${d.name || 'documento'}`, s, k: c.key }); });
  });
  (S.solutions || []).filter(r => !r.arquivado).forEach(r => { const s = buscaTrecho([r.nome, r.finalidade, ...(r.funcionalidades || []).map(x => x.t || x)].join(' • '), q); if (s) add({ g: 'Base de Soluções', t: r.nome, s, nav: 'solucoes' }); });
  (S.insights || []).forEach(i => { const s = buscaTrecho([i.acontecimento, i.titulo, i.impacto].filter(Boolean).join(' — '), q); if (s) add({ g: 'Inteligência de Mercado', t: i.acontecimento || i.titulo || 'Insight', s, nav: 'mercado' }); });
  return { q, hits };
}
function buscaCard() {
  if (!clients().length) return '';
  const B = UI.busca || {}, R = B.res;
  const grupos = R ? [...new Set(R.hits.map(h => h.g))] : [];
  return `<div class="card" id="busca"><h3>Buscar em tudo</h3><p class="muted sm">Procura em clientes, retornos, anotações, documentos dos clientes, Base de Soluções e Inteligência de Mercado. A busca roda no seu navegador.</p>
  <div class="row"><input type="text" id="busca-q" value="${esc(B.q || '')}" placeholder="Ex.: reforma tributária, retenção, integração…" style="min-width:280px;flex:1" maxlength="80"><button class="btn" data-a="buscaIr">Buscar</button>${R ? '<button class="btn ghost" data-a="buscaLimpa">Limpar</button>' : ''}</div>
  ${R ? (R.erro ? `<p class="muted sm">${esc(R.erro)}</p>` : R.hits.length ? `<p class="muted sm">${R.hits.length}${R.hits.length >= BUSCA_MAX ? '+' : ''} resultado(s)</p>${grupos.map(g => `<h4>${esc(g)}</h4><ul>${R.hits.filter(h => h.g === g).map(h => `<li class="sm">${h.k ? `<a href="#" data-a="buscaAbrir" data-k="${esc(h.k)}" data-tab="${esc(h.tab || '')}"><b>${esc(h.t)}</b></a>` : h.nav ? `<a href="#" data-a="nav" data-v="${esc(h.nav)}"><b>${esc(h.t)}</b></a>` : `<b>${esc(h.t)}</b>`}${h.s ? `<div class="muted">${esc(h.s)}</div>` : ''}</li>`).join('')}</ul>`).join('')}` : '<p class="muted sm">Nada encontrado.</p>') : ''}</div>`;
}

/* ---------- Ações ---------- */
const ONDA3_ACT = {
  semCopiar: async () => { const v = semanaTexto(semanaDados()); try { await navigator.clipboard.writeText(v); toast('Resumo copiado.'); } catch { toast('Não foi possível copiar automaticamente.'); } },
  rotGerar: t => { const c = S.clients[t.dataset.k]; if (!c) return; UI.rot = { k: c.key, t: roteiroTexto(c) }; render(); },
  rotCopiar: async () => { const v = $('#rot-txt')?.value || UI.rot?.t || ''; try { await navigator.clipboard.writeText(v); toast('Roteiro copiado.'); } catch { toast('Selecione e copie o texto (Ctrl+C).'); } },
  ditar: t => dictIniciar(t.dataset.alvo),
  buscaIr: () => { const q = $('#busca-q')?.value || ''; UI.busca = { q, res: buscaGlobal(q) }; render(); },
  buscaLimpa: () => { UI.busca = null; render(); },
  buscaAbrir: (t, e) => { e.preventDefault(); UI.sel = t.dataset.k; UI.view = 'cliente'; if (t.dataset.tab) UI.ctab = t.dataset.tab; render(); window.scrollTo(0, 0); }
};
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target?.id === 'busca-q') { e.preventDefault(); ONDA3_ACT.buscaIr(); } });
document.addEventListener('toggle', e => { if (e.target?.id === 'semana') UI.semAberto = e.target.open; }, true);
