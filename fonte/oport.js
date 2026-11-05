/* ===== Oportunidades TOTVS: descoberta, explicação, leitura do executivo e síntese de abordagem =====
   Posicionamento: painel de análise de carteira e descoberta de oportunidades (não é CRM).
   Reutiliza o motor único (c.opps), a classificação do Raio-X (rxClass) e as decisões existentes (decGet/aval). */
const OP_CL = { identificada: ['Oportunidade identificada', 'ok'], hipotese: ['Hipótese de investigação', 'warn'], nao: ['Não priorizada', 'off'] };
const opClasse = r => r.cl === 'prioridade' ? 'identificada' : r.cl === 'investigar' ? 'hipotese' : 'nao';
const oppNeed = o => (RULES.find(r => r.id === o.ruleId) || {}).need || ((o.sols || []).flatMap(s => s.necessidades || [])[0]) || '';
const oppProc = o => { const n = oppNeed(o), t = n ? NEED_TXT(n) : ''; return t && t !== n ? t : (o.tipoBase || o.tipo || 'Outros'); };
const oppFam = o => ((o.sols || [])[0] || {}).cat || 'Serviço / relacionamento';
const opUso = o => o.tipoBase === 'Otimização' || /^adocao_/.test(o.ruleId) || (o.jaIdent || []).length > 0;
const opMkt = c => (c.fatos || []).length > 0 || (c.insRef || []).length > 0;
const opSeg = c => c.segInfo?.id || 'none';
const opSegL = id => id === 'none' ? 'Sem segmento definido' : (segName(id) || id);
const OPF0 = () => ({ q: '', cl: '', seg: '', fam: '', proc: '', dec: '', ev: '', uso: '', mkt: '', cli: '', lim: 30 });
const OPF = () => UI.op ||= OPF0();
const diasDesde = iso => iso ? (Date.now() - new Date(iso).getTime()) / 864e5 : 1e9;

function opAll() { const out = []; clients().forEach(c => rxRecs(c).forEach(r => out.push({ c, o: r.o, cl: opClasse(r), why: r.why, r }))); return out; }

/* ---------- leitura do executivo: Faz sentido | Investigar | Já atendida | Descartar (+ observação) ----------
   Mapeia nos registros existentes (decisão de validação e avaliação do ESN); não cria pipeline. */
const JD = { faz_sentido: 'Faz sentido', investigar: 'Investigar', atendida: 'Já atendida', descartar: 'Descartar' };
function jdCur(c, o) {
  const d = decGet(c, o.ruleId), a = avGet(c, o.ruleId);
  if (d.valid === 'descartada') return 'descartar'; if (a && a.classe === 'atendida') return 'atendida';
  if (d.valid === 'investigacao') return 'investigar'; if (a && a.classe === 'faz_sentido') return 'faz_sentido'; return '';
}
function jdSet(key, rule, k, nota) {
  const c = S.clients[key]; if (!c || !JD[k]) return; nota = String(nota || '').trim().slice(0, 400);
  c.act ||= {}; c.aval ||= {}; const id = oppRid(key, rule), cur = c.act[id] || {}, d = decGet(c, rule), at = nowISO();
  let valid = d.valid, classe = (c.aval[rule] || {}).classe || '';
  if (k === 'descartar') valid = 'descartada';
  else if (k === 'investigar') { if (valid !== 'validada') valid = 'investigacao'; if (classe === 'atendida' || classe === 'faz_sentido') classe = ''; }
  else { if (valid === 'descartada' || valid === 'investigacao') valid = 'sugerida'; classe = k; }
  if (k === 'descartar' && classe === 'faz_sentido') classe = '';
  const mud = []; if (valid !== d.valid) mud.push(`valid: ${d.valid} → ${valid}`); if ((d.nota || '') !== (nota || d.nota || '')) mud.push('nota');
  c.act[id] = { ...cur, valid, sit: d.sit, nivel: valid === 'validada' ? d.nivel : '', nota: nota || (k === 'descartar' ? (d.nota || 'Descartada pelo executivo (sem observação).') : d.nota), contr: d.contr || undefined, at, hist: [{ at, mudancas: mud.length ? mud : [`leitura: ${JD[k]}`], nota }, ...(cur.hist || [])].slice(0, 30) };
  const prev = c.aval[rule] || {};
  if (classe) c.aval[rule] = { ...prev, classe, obs: nota, at, hist: [{ at, classe, correcao: nota }, ...(prev.hist || [])].slice(0, 8) };
  else if (prev.classe) { const { classe: _c, ...rest } = prev; c.aval[rule] = { ...rest, at }; }
  touchC(key); render(); toast(`Leitura registrada: ${JD[k]}.`);
}
function jdBar(c, o) {
  const cur = jdCur(c, o), d = decGet(c, o.ruleId), a = avGet(c, o.ruleId) || {}, k = esc(c.key), id = esc(o.ruleId), nota = d.nota || a.obs || '';
  return `<div class="jd" data-k="${k}" data-r="${id}"><div class="row sm" style="gap:4px;margin:4px 0"><span class="muted">Sua leitura:</span>${Object.entries(JD).map(([j, l]) => `<button class="btn ${cur === j ? 'pri' : 'ghost'} sm" data-a="jd" data-j="${j}" aria-pressed="${cur === j}">${l}</button>`).join('')}<input type="text" data-f="jdnota" value="${esc(nota)}" placeholder="Observação (opcional)" aria-label="Observação sobre esta oportunidade" style="flex:1;min-width:180px"></div></div>`;
}
const jdPill = (c, o) => { const j = jdCur(c, o); return j ? pill('Leitura: ' + JD[j], j === 'faz_sentido' ? 'ok' : j === 'investigar' ? 'warn' : 'off') : ''; };

/* ---------- síntese de abordagem (nada é enviado) ---------- */
function abOpp(c, o) {
  const ft = (c.fatos || []).filter(f => diasDesde(f.data) <= 180).sort((x, y) => String(y.data).localeCompare(String(x.data)))[0];
  const ev = (o.evInd || []).find(e => e.cls === 'FATO' && !/setorial/i.test(e.src || ''));
  const motivo = ft ? `${ft.titulo} (${ft.fonteNome}, ${fmtD(ft.data)})` : ev ? `${String(ev.text).slice(0, 220)} — ${ev.src}` : (o.setorial || [])[0] ? `Contexto do setor (hipótese, não do cliente): ${o.setorial[0].text}` : 'Sem gancho individual: abrir com perguntas de contexto.';
  const assunto = String(o.problema || o.nome).replace(/^(HIPÓTESE DE NECESSIDADE com indício individual|INVESTIGAÇÃO RECOMENDADA \(sem indício individual\)):\s*/, '');
  const sol = (o.sols || []).map(s => s.nome).join('; ') || 'Conversa de relacionamento (sem solução de produto)';
  const perg = (o.perg || [])[0] || 'Este tema é relevante hoje para a operação? Quem decide?';
  return { motivo, assunto, sol, perg };
}
function abHtml(c, o) {
  const a = abOpp(c, o), k = esc(c.key), id = esc(o.id);
  return `<div class="alert i sm ab"><b>Síntese de abordagem — ${esc(o.nome)}</b><dl class="chain2"><dt>Motivo do contato</dt><dd>${esc(a.motivo)}</dd><dt>Assunto a explorar</dt><dd>${esc(a.assunto)}</dd><dt>Solução possível</dt><dd>${esc(a.sol)} <span class="muted">(a validar: não é proposta)</span></dd><dt>Pergunta de validação</dt><dd>${esc(a.perg)}</dd></dl>
  <div class="row"><button class="btn pri sm" data-a="abCopiar" data-k="${k}" data-id="${id}">Copiar síntese</button><span class="muted">Nada é enviado automaticamente.</span></div></div>`;
}
function abText(c, o) { const a = abOpp(c, o); return `SÍNTESE DE ABORDAGEM — ${c.name}\nOportunidade: ${o.nome}\nMotivo do contato: ${a.motivo}\nAssunto a explorar: ${a.assunto}\nSolução possível (a validar): ${a.sol}\nPergunta de validação: ${a.perg}`; }
const abCli = c => rxRecs(c).filter(r => r.cl !== 'nao').sort((x, y) => y.o.score - x.o.score).slice(0, 3);
function abCliHtml(c) {
  const L = abCli(c); if (!L.length) return '<p class="muted sm">Sem oportunidade para sintetizar ainda.</p>';
  return L.map(r => abHtml(c, r.o)).join('') + `<div class="row"><button class="btn ghost sm" data-a="abCopiarCli" data-k="${esc(c.key)}">Copiar todas</button></div>`;
}

/* ---------- Oportunidades TOTVS (tela) ---------- */
function opFilter(rows, f) {
  const q = norm(f.q);
  return rows.filter(x => (f.cl ? x.cl === f.cl : (x.cl !== 'nao' || (f.dec && f.dec !== 'sem'))) && (!f.cli || x.c.key === f.cli) && (!f.seg || opSeg(x.c) === f.seg) && (!f.fam || oppFam(x.o) === f.fam) && (!f.proc || oppProc(x.o) === f.proc)
    && (!f.dec || (f.dec === 'sem' ? !jdCur(x.c, x.o) : jdCur(x.c, x.o) === f.dec)) && (!f.ev || fundOf(x.o).documental) && (!f.uso || opUso(x.o)) && (!f.mkt || opMkt(x.c)) && (!q || norm(`${x.c.name} ${x.o.nome} ${oppProc(x.o)} ${oppFam(x.o)}`).includes(q)))
    .sort((a, b) => (a.cl === 'identificada' ? 0 : 1) - (b.cl === 'identificada' ? 0 : 1) || b.o.score - a.o.score || a.c.name.localeCompare(b.c.name));
}
function opChips(f) {
  const L = []; if (f.cl) L.push(['cl', 'Classificação: ' + (OP_CL[f.cl] || [f.cl])[0]]); if (f.dec && f.dec !== 'sem') L.push(['dec', 'Leitura: ' + JD[f.dec]]); if (f.ev) L.push(['ev', 'Com evidência em documentos']); if (f.uso) L.push(['uso', 'Melhor aproveitamento do que já contratou']); if (f.mkt) L.push(['mkt', 'Cliente com acontecimento de mercado']);
  if (f.cli) L.push(['cli', 'Cliente: ' + (S.clients[f.cli]?.name || f.cli)]); if (f.seg) L.push(['seg', 'Segmento: ' + opSegL(f.seg)]); if (f.proc) L.push(['proc', 'Processo: ' + f.proc]); if (f.fam) L.push(['fam', 'Família: ' + f.fam]);
  return L.length ? `<div class="fchips" role="group" aria-label="Filtros ativos"><span class="sm muted">Filtros:</span> ${L.map(([k, l]) => `<span class="fchip">${esc(l)} <button class="x" data-a="opClr" data-k="${k}" aria-label="Remover filtro ${esc(l)}">×</button></span>`).join(' ')} <button class="btn ghost sm" data-a="opClr" data-k="*">Limpar filtros</button></div>` : '';
}
function opCard(x) {
  const { c, o, cl, r } = x, K = OP_CL[cl];
  return `<div class="card opc"><div class="row"><b><a href="#" data-a="open" data-k="${esc(c.key)}">${esc(c.name)}</a></b><span class="muted sm">${esc(opSegL(opSeg(c)))}${c.city ? ' • ' + esc(c.city) : ''}</span><span class="sp"></span>${pill(K[0], K[1])}${jdPill(c, o)}</div>${rxRecHtml(c, r)}</div>`;
}
function vOport() {
  if (!clients().length) return needData();
  const f = OPF(), all = opAll(), rows = opFilter(all, f), act = all.filter(x => x.cl !== 'nao');
  const uniq = fn => [...new Set(act.map(fn))].sort((a, b) => String(a).localeCompare(String(b))), sel = (v, l, cur) => `<option value="${esc(v)}" ${cur === v ? 'selected' : ''}>${esc(l)}</option>`;
  const nI = rows.filter(x => x.cl === 'identificada').length, nH = rows.filter(x => x.cl === 'hipotese').length;
  return `<div class="alert i sm"><b>Como ler.</b> ${pill('Oportunidade identificada', 'ok')} tem dado objetivo do cliente ou o mesmo indício em 2+ fontes; ${pill('Hipótese de investigação', 'warn')} é plausível, mas ainda sem confirmação — <b>não é oportunidade comercial confirmada</b>. Ausência na ficha não prova ausência de contratação. Sua leitura (Faz sentido, Investigar, Já atendida, Descartar) ajusta as próximas análises e evita repetir recomendações.</div>
  <div class="filters"><input type="text" data-c="opf" data-f="q" value="${esc(f.q)}" placeholder="Buscar cliente, oportunidade, processo…" aria-label="Buscar oportunidades" style="min-width:220px">
  <select data-c="opf" data-f="cl" aria-label="Classificação">${sel('', 'Identificadas e hipóteses', f.cl)}${sel('identificada', 'Só identificadas', f.cl)}${sel('hipotese', 'Só hipóteses', f.cl)}${sel('nao', 'Não priorizadas', f.cl)}</select>
  <select data-c="opf" data-f="seg" aria-label="Segmento">${sel('', 'Todos os segmentos', f.seg)}${uniq(x => opSeg(x.c)).map(s => sel(s, opSegL(s), f.seg)).join('')}</select>
  <select data-c="opf" data-f="proc" aria-label="Processo ou necessidade">${sel('', 'Todos os processos', f.proc)}${uniq(x => oppProc(x.o)).map(s => sel(s, s, f.proc)).join('')}</select>
  <select data-c="opf" data-f="fam" aria-label="Família de solução">${sel('', 'Todas as famílias', f.fam)}${uniq(x => oppFam(x.o)).map(s => sel(s, s, f.fam)).join('')}</select>
  <select data-c="opf" data-f="dec" aria-label="Sua leitura">${sel('', 'Qualquer leitura', f.dec)}${sel('sem', 'Ainda sem leitura', f.dec)}${Object.entries(JD).map(([k, l]) => sel(k, l, f.dec)).join('')}</select></div>${opChips(f)}
  <div class="muted sm" style="margin:6px 0">${rows.length} oportunidade(s) • ${nI} identificada(s) • ${nH} hipótese(s) de investigação${rows.length > f.lim ? ` • exibindo ${f.lim}` : ''}</div>
  ${rows.length ? rows.slice(0, f.lim).map(opCard).join('') : `<div class="card"><p class="muted">Nenhuma oportunidade neste recorte. ${act.length ? 'Ajuste os filtros.' : 'Carregue fichas e materiais dos clientes ou enriqueça a Base de Soluções: sem evidência, a ferramenta não inventa oportunidades.'}</p></div>`}
  ${rows.length > f.lim ? '<button class="btn ghost" data-a="opMore">Mostrar mais</button>' : ''}`;
}

/* ---------- Visão da Carteira: radar de oportunidades ---------- */
function opBreak(act, title, fn, key, lab) {
  const m = new Map(); act.forEach(x => { const k = fn(x), e = m.get(k) || { id: 0, hip: 0, cs: new Set() }; x.cl === 'identificada' ? e.id++ : e.hip++; e.cs.add(x.c.key); m.set(k, e); });
  const L = [...m].sort((a, b) => (b[1].id - a[1].id) || (b[1].hip - a[1].hip) || String(a[0]).localeCompare(String(b[0]))).slice(0, 6);
  if (!L.length) return `<div class="card" style="margin:0"><h4>${title}</h4><p class="muted sm">Sem dados suficientes.</p></div>`;
  return `<div class="card" style="margin:0"><h4>${title}</h4><div class="tw" style="max-height:none"><table class="sm"><thead><tr><th>${lab}</th><th class="r">Identif.</th><th class="r">Hipót.</th><th class="r">Clientes</th></tr></thead><tbody>${L.map(([k, e]) => `<tr class="clk" tabindex="0" role="button" data-a="opBreak" data-f="${key}" data-v="${esc(k)}"><td>${esc(key === 'seg' ? opSegL(k) : k)}</td><td class="r">${e.id}</td><td class="r">${e.hip}</td><td class="r">${e.cs.size}</td></tr>`).join('')}</tbody></table></div></div>`;
}
function radarData() {
  const all = opAll(), act = all.filter(x => x.cl !== 'nao'), ident = act.filter(x => x.cl === 'identificada'), hip = act.filter(x => x.cl === 'hipotese');
  const nc = a => new Set(a.map(x => x.c.key)).size, doc = act.filter(x => fundOf(x.o).documental), uso = act.filter(x => opUso(x.o)), mkt = act.filter(x => opMkt(x.c));
  const lim = clients().filter(c => c.fstat?.k === 'nao_carregada');
  return { all, act, ident, hip, doc, uso, mkt, lim, nc };
}
function radarCard() {
  const R = radarData(), t = (a, v, l, d, cls = '') => `<button type="button" class="kpi rt ${cls}" data-a="radar" data-k="${a}" aria-label="${esc(l)}: ${v}. Abrir"><div class="v">${v}</div><div class="l">${l}</div><div class="n">${d}</div></button>`;
  const rank = new Map(); R.act.forEach(x => { const e = rank.get(x.c.key) || { c: x.c, id: 0, hip: 0, top: x, src: new Set() }; x.cl === 'identificada' ? e.id++ : e.hip++; if (x.o.score > e.top.o.score) e.top = x; if (x.cl === 'identificada') (x.o.evInd || []).filter(ev => ev.cls === 'FATO' && !/setorial/i.test(ev.src || '')).forEach(ev => e.src.add(String(ev.src).replace(/\s*\(.*$/, ''))); rank.set(x.c.key, e); });
  const top = [...rank.values()].sort((a, b) => (b.id - a.id) || (b.top.o.score - a.top.o.score)).slice(0, 5);
  return `<div class="card" id="radar"><h3>Onde estão as oportunidades da carteira</h3><p class="sm muted">Cada indicador abre os clientes e as evidências correspondentes. Identificada ≠ confirmada comercialmente; hipótese ≠ oportunidade.</p>
  <div class="grid g3">${t('ident', R.ident.length, 'Oportunidades identificadas', `em ${R.nc(R.ident)} cliente(s), com evidência do cliente`, 'm')}${t('hip', R.hip.length, 'Hipóteses de investigação', `em ${R.nc(R.hip)} cliente(s): validar antes de priorizar`, 'w')}${t('doc', R.doc.length, 'Necessidades citadas em documentos', `${R.nc(R.doc)} cliente(s) com texto de ficha, ata ou OCR`)}
  ${t('mkt', R.nc(R.mkt), 'Clientes com contexto de mercado', 'acontecimentos ou notícias que justificam uma conversa')}${t('uso', R.uso.length, 'Melhor aproveitamento do contratado', 'adoção, treinamento e otimização do que já usa')}${t('lim', R.lim.length, 'Análise limitada por falta de ficha', 'pendência de dados — anexar fichas melhora o diagnóstico', 'r')}</div>
  <div class="grid g3" style="margin-top:14px">${opBreak(R.act, 'Por segmento', x => opSeg(x.c), 'seg', 'Segmento')}${opBreak(R.act, 'Por processo / necessidade', x => oppProc(x.o), 'proc', 'Processo')}${opBreak(R.act, 'Por família de solução', x => oppFam(x.o), 'fam', 'Família')}</div>
  <h4 style="margin-top:14px">Clientes com oportunidades mais bem fundamentadas</h4>${top.length ? `<div class="tw" style="max-height:none"><table><thead><tr><th>Cliente</th><th class="r">Identificadas</th><th class="r">Hipóteses</th><th>Principal oportunidade</th><th>Base da fundamentação</th><th></th></tr></thead><tbody>${top.map(e => `<tr><td><a href="#" data-a="open" data-k="${esc(e.c.key)}">${esc(e.c.name)}</a></td><td class="r">${e.id}</td><td class="r">${e.hip}</td><td class="sm">${esc(e.top.o.nome)} ${pill(OP_CL[e.top.cl][0], OP_CL[e.top.cl][1])}</td><td class="sm">${e.src.size ? esc([...e.src].slice(0, 3).join('; ')) : '<span class="muted">hipótese setorial / sem documento do cliente</span>'}</td><td class="nw"><button class="btn ghost sm" data-a="openTab" data-k="${esc(e.c.key)}" data-v="raiox">Abrir raio-X</button> <button class="btn ghost sm" data-a="radar" data-k="cli" data-c="${esc(e.c.key)}">Oportunidades</button></td></tr>`).join('')}</tbody></table></div><p class="muted sm">Ordem: nº de oportunidades identificadas e, no empate, maior score. A coluna “Base” mostra as fontes do cliente que sustentam a indicação.</p>` : '<p class="muted sm">Nenhuma oportunidade identificada ou hipótese ainda: anexe fichas e materiais dos clientes para a análise ganhar evidência.</p>'}</div>`;
}

/* ---------- Onde vale aprofundar hoje (motivos objetivos; não é agenda de tarefas) ---------- */
function hojeItens() {
  const out = [];
  clients().forEach(c => {
    const recs = rxRecs(c).filter(r => r.cl !== 'nao').sort((a, b) => b.o.score - a.o.score), top = recs[0]; if (!top) return;
    const why = []; let bonus = 0;
    const ch = c.lastChange && diasDesde(c.lastChange.at) <= 14 ? (c.lastChange.items || []).filter(i => (i.k === 'hipotese' && i.reav && (/^Nova hipótese/.test(i.t) || /modo |confiança|solução já identificada/.test(i.t))) || i.k === 'contratacao') : [];
    if (ch.length) { why.push(`Análise atualizada em ${dtBR(c.lastChange.at)}: ${ch[0].t}`); bonus += 12; }
    const ft = (c.fatos || []).filter(f => diasDesde(f.data) <= 90).sort((x, y) => String(y.data).localeCompare(String(x.data)))[0];
    if (ft) { why.push(`Acontecimento de mercado: ${ft.titulo} (${ft.fonteNome}, ${fmtD(ft.data)})`); bonus += 8; }
    const prior = top.cl === 'prioridade' && !jdCur(c, top.o); if (prior && !why.length) { why.push(`Oportunidade identificada ainda sem sua leitura: ${top.why}`); bonus += 4; }
    const semFicha = c.fstat?.k !== 'disponivel'; if (why.length && semFicha) { why.push(`Falta a ficha de faturamento para concluir a análise de “${top.o.nome}”.`); bonus += 2; }
    if (why.length && (top.o.perg || [])[0]) why.push(`Pergunta decisiva pendente: ${top.o.perg[0]}`);
    if (!why.length) return;
    out.push({ c, top, why, semFicha, score: top.o.score + bonus + (top.cl === 'prioridade' ? 10 : 0) });
  });
  return out.sort((a, b) => b.score - a.score || a.c.name.localeCompare(b.c.name));
}
function hojeCard() {
  const all = hojeItens(), top = all.slice(0, 5);
  const h = `<div class="row"><h3>Onde vale aprofundar hoje</h3>${top.length ? `<span class="pill p-info">${top.length} de ${all.length}</span>` : ''}</div><p class="sm muted">Seleção por motivo objetivo nos dados atuais (nova evidência, mercado, pergunta decisiva, documento que falta). Não é uma agenda de tarefas.</p>`;
  if (!top.length) return `<div class="card" id="hoje">${h}<p class="muted sm">Nenhum gatilho novo agora. Para gerar motivos de abordagem: anexe fichas e materiais, registre fatos de mercado em <a href="#" data-a="nav" data-v="mercado">Inteligência de Mercado</a> ou abra <a href="#" data-a="nav" data-v="oport">Oportunidades TOTVS</a>.</p></div>`;
  return `<div class="card" id="hoje">${h}${top.map(x => `<div class="hj"><div class="row"><b><a href="#" data-a="open" data-k="${esc(x.c.key)}">${esc(x.c.name)}</a></b><span class="muted sm">${esc(x.top.o.nome)}</span>${pill(OP_CL[opClasse(x.top)][0], OP_CL[opClasse(x.top)][1])}<span class="sp"></span><button class="btn ghost sm" data-a="radar" data-k="cli" data-c="${esc(x.c.key)}">Ver oportunidades</button><button class="btn pri sm" data-a="openTab" data-k="${esc(x.c.key)}" data-v="raiox">Abrir raio-X</button>${x.semFicha ? upBtn(x.c) : ''}</div><ul class="sm hjw">${x.why.map(w => `<li>${esc(w)}</li>`).join('')}</ul></div>`).join('')}</div>`;
}

const OP_ACT = {
  jd: t => { const b = t.closest('.jd'); if (!b) return; const n = b.querySelector('[data-f=jdnota]'); jdSet(b.dataset.k, b.dataset.r, t.dataset.j, n ? n.value : ''); },
  radar: t => {
    const f = UI.op = OPF0(), k = t.dataset.k;
    if (k === 'lim') { UI.f = { ...UI.f, fs: 'nao_carregada' }; UI.view = 'clientes'; render(); window.scrollTo(0, 0); return; }
    if (k === 'ident') f.cl = 'identificada'; else if (k === 'hip') f.cl = 'hipotese'; else if (k === 'doc') f.ev = '1'; else if (k === 'mkt') f.mkt = '1'; else if (k === 'uso') f.uso = '1'; else if (k === 'cli') f.cli = t.dataset.c;
    UI.view = 'oport'; render(); window.scrollTo(0, 0);
  },
  opBreak: t => { const f = UI.op = OPF0(); f[t.dataset.f] = t.dataset.v; UI.view = 'oport'; render(); window.scrollTo(0, 0); },
  opClr: t => { const f = OPF(); if (t.dataset.k === '*') UI.op = OPF0(); else f[t.dataset.k] = ''; render(); },
  opMore: () => { OPF().lim += 30; render(); },
  abToggle: t => { UI.ab ||= {}; UI.ab[t.dataset.id] = !UI.ab[t.dataset.id]; render(); },
  abCopiar: async t => { const c = S.clients[t.dataset.k], o = c && (c.opps || []).find(x => x.id === t.dataset.id); if (!o) return; try { await navigator.clipboard.writeText(abText(c, o)); toast('Síntese copiada.'); } catch (e) { offer('sintese-abordagem.txt', abText(c, o)); } },
  abCopiarCli: async t => { const c = S.clients[t.dataset.k]; if (!c) return; const txt = abCli(c).map(r => abText(c, r.o)).join('\n\n'); try { await navigator.clipboard.writeText(txt); toast('Sínteses copiadas.'); } catch (e) { offer('sinteses-abordagem.txt', txt); } }
};
