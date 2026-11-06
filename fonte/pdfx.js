/* ===== DIAGNÓSTICO EXECUTIVO: modelo, prévia HTML e PDF real (jsPDF) ===== */
const cut = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s; };
const unPrefix = s => String(s || '').replace(/^(HIPÓTESE DE NECESSIDADE[^:]*|INVESTIGAÇÃO RECOMENDADA[^:]*):\s*/, '');
function autoSintese(c) {
  const seg = segName(c.segInfo.id), rel = relRows(c).filter(r => r.rel), prods = (c.productsIdent || []).map(p => p.nome);
  return `${c.name}${seg ? `, segmento ${seg}` : ''}. ${partial(c) ? 'Ficha de faturamento não conferida: contratação e faturamento ainda não confirmados por documento.' : `Ficha de faturamento disponível${c.fstat.last ? ' (última competência ' + c.fstat.last + ')' : ''}.`} ${prods.length ? 'Soluções identificadas nos documentos: ' + prods.slice(0, 5).join(', ') + '.' : 'Soluções contratadas não identificadas nos documentos.'} ${rel.length ? 'Release em produção confirmada: ' + rel.map(r => `${r.produto} ${r.rel}`).join(', ') + '.' : 'Release em produção não confirmada.'}`;
}
function execCandidates(c) {
  const riscos = [];
  relRows(c).filter(r => r.rel && r.marco?.data && ['expirado', 'alerta'].includes(r.sit.k)).forEach(r => riscos.push({ id: 'rel:' + r.produto, t: `${r.produto} ${r.rel}: ${r.marco.tipo.toLowerCase()} em ${fmtD(r.marco.data)} (${r.sit.k === 'expirado' ? 'já ocorrido' : r.sit.l.split('—').pop().trim()}).`, ev: `Release confirmada (${fonteTxt(r.ev.fonte)}); marco: ${r.marco.fonte.t}`, link: r.marco.fonte, sev: r.sit.sev }));
  regForClient(c).filter(x => x.ap.state === 'aplicavel' && regNear(x)).forEach(x => riscos.push({ id: 'reg:' + x.r.id, t: `${x.r.nome.split(':')[0]}: ${x.t.map(t => t.l).join('; ')}.`, ev: `Critérios confirmados: ${x.ap.got.join('; ')}`, link: x.r.fonte, sev: x.t.some(t => t.k === 'vencido' || (t.k === 'prazo' && t.d <= 30)) ? 3 : 2 }));
  riscos.sort((a, b) => b.sev - a.sev);
  const recs = c.opps.filter(o => o.modo === 'evidencia' && oppAtiva(c, o)).slice().sort((a, b) => b.score - a.score);
  return { riscos, recs };
}
function execModel(c, mode) {
  consInit(c); const cli = mode === 'cliente', ok = id => !cli || !!c.exec.ok[id], E = S.meta.exec || {}, cand = execCandidates(c);
  const riscos = cand.riscos.filter(r => ok('r:' + r.id));
  const recs = cand.recs.filter(o => !(cli && o.ruleId === 'retencao') && ok('o:' + o.ruleId)).map(o => ({ id: o.ruleId, nome: o.nome, por: unPrefix(o.problema), ev: o.evInd.slice(0, 2).map(e => `${e.text} [${e.src}]`).join('; '), sol: o.sols.slice(0, 3).map(s => s.nome + (s.status && s.status !== 'Validado' ? ' (sujeito a validação)' : '')).join(', '), acao: o.acao, meta: cli ? '' : `Prioridade ${o.prio} • score ${o.score} • confiança ${o.conf}`, perg: o.perg || [], links: [...o.sols.map(s => s.fonte), ...(o.setorial || []).map(x => x.fonte)].filter(f => f?.u) }));
  const bens = (c.roi || []).filter(s => !cli || s.share).map(s => ({ s, r: roiCalc(s, 'base') })).filter(x => x.r.ok).map(({ s, r }) => ({ nome: ROI_T[s.tipo].nome, t: `Cenário base: benefício líquido ${fmtBRL(r.liq)} em ${r.H} meses; ROI ${r.roi == null ? 'indefinido' : n1(r.roi * 100) + '%'}; payback: ${r.payTxt}.`, prem: roiFields(s).filter(([k]) => s.inp[k]?.base != null).map(([k, l, u]) => `${l}: ${s.inp[k].base} ${u} (${s.inp[k].cls}${s.inp[k].fonte ? '; ' + s.inp[k].fonte : ''})`) }));
  const contr = [...(c.productsIdent || []).map(p => `${p.nome} (fonte: ${p.ev[0]?.src || '—'})`), ...LIC_F.flatMap(([k, l]) => evOk(c.lic.f[k]).map(e => `${l}: ${e.v} (${fonteTxt(e.fonte)})`)), ...relRows(c).filter(r => r.rel).map(r => `Release em produção ${r.produto} ${r.rel} (${fonteTxt(r.ev.fonte)})`)];
  const rec = recurringByComp(c), comps = Object.keys(rec).sort(); const fat = c.exec.valores[mode] && comps.length ? [`Recorrente identificado em ficha (${comps[comps.length - 1]}): ${fmtBRL(rec[comps[comps.length - 1]])} — valor emitido, não equivale a recebido.`] : comps.length ? [`Fichas de faturamento conferidas: competências ${comps.slice(-3).join(', ')}.`] : [];
  const perg0 = [...new Set([...recs.flatMap(r => r.perg.slice(0, 2)), ...regForClient(c).filter(x => x.ap.state === 'potencial' && regNear(x)).flatMap(x => x.ap.q.slice(0, 1)), ...(relRows(c).some(r => !r.rel) ? ['Qual release está em produção hoje (evidência: tela "Sobre" ou relatório de ambiente)?'] : [])])];
  const perg = [...new Set(perg0.map(q => cli ? q.replace(/\s*\(critério:[^)]*\)/, '') : q))];
  const passos = [...String(c.exec.passos || '').split(/\n+/).map(x => x.trim()).filter(Boolean), ...(String(c.exec.passos || '').trim() ? [] : recs.slice(0, 3).map(r => r.acao))];
  const links = []; const addL = f => { if (f?.u && (!cli || isOfficialUrl(f.u) || /gov\.br|planalto/.test(f.u)) && !links.some(x => x.u === f.u)) links.push({ t: f.t || hostOf(f.u), u: f.u }); };
  riscos.forEach(r => addL(r.link)); recs.forEach(r => r.links.forEach(addL)); if (relRows(c).some(r => r.marco)) addL(REFPKG.politica);
  const pend = cli ? [] : [...(partial(c) ? ['Ficha de faturamento: ' + c.fstat.l] : c.fstat.why), ...c.conflicts.map(x => x.text), ...(licStatus(c).k === 'pendente' ? ['Contrato/licenciamento não confirmado'] : []), ...relRows(c).filter(r => !r.rel).map(r => `${r.produto}: release em produção não confirmada`), ...cand.riscos.filter(r => !ok('r:' + r.id)).map(r => 'Risco ainda não revisado: ' + r.t)].slice(0, 10);
  const ressalvas = ['Diagnóstico preliminar com base nos documentos disponíveis; não constitui proposta comercial e não contém preços, condições ou compromissos de entrega.', 'Recomendações dependem de validação técnica e comercial; estimativas dependem das premissas indicadas.', ...(partial(c) ? ['Análise parcial: contratação e faturamento ainda não conferidos.'] : []), ...(riscos.some(r => r.id.startsWith('reg:')) ? ['Pontos regulatórios não constituem orientação fiscal; consultoria tributária especializada é recomendada.'] : [])];
  const seg = segName(c.segInfo.id) || 'segmento não definido';
  return { mode, cliente: c.name, codigo: cli ? '' : c.code, segmento: seg, data: new Date().toLocaleDateString('pt-BR'), exec: { nome: E.nome || '', contato: E.contato || '' }, logo: E.logo !== false,
    sintese: String(c.exec.sintese || '').trim() || autoSintese(c), contratacao: contr, faturamento: fat, riscos: riscos.slice(0, cli ? 3 : 5), recs: recs.slice(0, cli ? 3 : 5), beneficios: bens, perguntas: perg, passos, links, ressalvas, pend, notas: cli ? '' : String(c.exec.notas || '').trim(), anexo: false };
}
/* Seções: [título, itens {s: curto (pág. 1), f: completo (anexo)}] */
function execSections(M) {
  const S1 = [], it = (s, f) => ({ s, f: f || s });
  S1.push(['Síntese do contexto', [it(cut(M.sintese, 430), M.sintese)]]);
  if (M.contratacao.length || M.faturamento.length) S1.push(['Contratação e faturamento confirmados', [...M.faturamento.map(x => it(cut(x, 160), x)), ...M.contratacao.slice(0, 4).map(x => it(cut(x, 150), x)), ...M.contratacao.slice(4).map(x => it(null, x))]]);
  S1.push(['Riscos e pontos de atenção', M.riscos.length ? M.riscos.map((r, i) => it(i < 3 ? cut(r.t, 200) : null, `${r.t} Evidência: ${r.ev}`)) : [it('Nenhum risco sustentado por evidência neste momento.')]]);
  S1.push(['Recomendações', M.recs.length ? M.recs.map((r, i) => it(i < 3 ? cut(`${r.nome}: ${r.por}${M.mode === 'interno' ? ' [' + r.meta + ']' : ''}`, 260) : null, `${r.nome}. ${r.por} Evidência: ${r.ev}. Solução(ões) a avaliar: ${r.sol || '—'}. Próxima ação: ${r.acao}${r.meta ? ' (' + r.meta + ')' : ''}`)) : [it('Nenhuma recomendação sustentada por evidência individual até o momento.')]]);
  if (M.beneficios.length) S1.push(['Benefícios esperados e premissas essenciais', M.beneficios.map((b, i) => it(i < 2 ? cut(`${b.nome} — ${b.t}`, 230) : null, `${b.nome} — ${b.t} Premissas: ${b.prem.join('; ')}`))]);
  if (M.perguntas.length) S1.push(['Perguntas para a próxima reunião', M.perguntas.map((q, i) => it(i < 4 ? cut(q, 160) : null, q))]);
  if (M.passos.length) S1.push(['Próximos passos', M.passos.map((p, i) => it(i < 3 ? cut(p, 160) : null, p))]);
  if (M.pend.length) S1.push(['Pendências internas', M.pend.map((p, i) => it(i < 3 ? cut(p, 140) : null, p))]);
  if (M.notas) S1.push(['Observações do executivo (interno)', [it(cut(M.notas, 200), M.notas)]]);
  S1.push(['Links oficiais e ressalvas', [...M.links.map((l, i) => it(i < 3 ? cut(`${l.t} (${hostOf(l.u)})`, 150) : null, `${l.t}: ${l.u}`)), ...M.ressalvas.map((r, i) => it(i < 2 ? cut(r, 200) : null, r))]]);
  return S1;
}
function execHTML(M) {
  const secs = execSections(M); M.anexo = secs.some(([, its]) => its.some(i => i.s == null || i.s !== i.f));
  const head = `<div class="a4h">${M.logo ? `<img src="${LOGO_W}" alt="TOTVS">` : ''}<div><div class="a4t">Diagnóstico executivo${M.mode === 'interno' ? ' — USO INTERNO' : ''}</div><div class="a4s">${esc(M.cliente)}${M.codigo ? ' • ' + esc(M.codigo) : ''} • ${esc(M.segmento)} • ${esc(M.data)}</div></div></div>`;
  const body = secs.map(([t, its]) => `<div class="a4sec"><h5>${esc(t)}</h5><ul>${its.filter(i => i.s != null).map(i => `<li>${esc(i.s)}</li>`).join('')}</ul></div>`).join('');
  const ex = M.exec.nome ? `<div class="a4x">${esc(M.exec.nome)}${M.exec.contato ? ' • ' + esc(M.exec.contato) : ''}</div>` : '';
  const anexo = M.anexo ? `<div class="a4 a4anexo"><div class="a4h"><div><div class="a4t">Anexo — detalhamento</div><div class="a4s">${esc(M.cliente)} • ${esc(M.data)}</div></div></div>${secs.map(([t, its]) => `<div class="a4sec"><h5>${esc(t)}</h5><ul>${its.map(i => `<li>${esc(i.f)}</li>`).join('')}</ul></div>`).join('')}</div>` : '';
  return `<div class="a4">${head}${body}${ex}<div class="a4f">Diagnóstico — não constitui proposta comercial • modo ${M.mode}</div></div>${anexo}`;
}
const pdfSan = s => String(s ?? '').replace(/[—–]/g, '-').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/…/g, '...').replace(/•/g, '·').replace(/→/g, '->').replace(/≠/g, '<>').replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/[^\x00-\xFF]/g, '');
function execPDF(M) {
  if (!window.jspdf?.jsPDF) throw new Error('Biblioteca de PDF (jsPDF) indisponível neste ambiente.');
  const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' }); const W = 210, MX = 15, CW = W - 2 * MX, BOT = 297 - 16, PT = 0.3528;
  const PET = [0, 34, 51], CIA = [0, 150, 180], TXT = [33, 37, 41], MUT = [100, 110, 120];
  doc.setProperties({ title: `Diagnóstico executivo — ${pdfSan(M.cliente)}`, subject: M.mode === 'cliente' ? 'Versão para o cliente' : 'Uso interno', creator: 'Gestão de Carteira TOTVS ESN' });
  let y = 0;
  const header = (t, sub) => { doc.setFillColor(...PET); doc.rect(0, 0, W, 24, 'F'); let x = MX; if (M.logo) { try { doc.addImage(LOGO_W, 'PNG', MX, 7, 34, 34 * 114 / 396); x = MX + 40; } catch { } } doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.text(pdfSan(t), x, 11); doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.text(doc.splitTextToSize(pdfSan(sub), W - x - MX)[0], x, 17.5); y = 31; };
  const lines = (t, size, w) => { doc.setFontSize(size); return doc.splitTextToSize(pdfSan(t), w); };
  const lh = size => size * PT * 1.32;
  const fits = h => y + h <= BOT;
  const secTitle = t => { doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...CIA); doc.text(pdfSan(t).toUpperCase(), MX, y + 10.5 * PT); y += lh(10.5) + 0.8; doc.setDrawColor(...CIA); doc.setLineWidth(0.3); doc.line(MX, y - 0.6, MX + CW, y - 0.6); y += 1.2; };
  const bullet = (t, size = 9) => { const L = lines(t, size, CW - 5); doc.setFont('helvetica', 'normal'); doc.setFontSize(size); doc.setTextColor(...TXT); doc.text('-', MX + 1, y + size * PT); doc.text(L, MX + 5, y + size * PT); y += L.length * lh(size) + 0.9; };
  const secs = execSections(M), defer = []; let truncated = false;
  header(`Diagnóstico executivo${M.mode === 'interno' ? ' - USO INTERNO' : ''}`, `${M.cliente}${M.codigo ? ' · ' + M.codigo : ''} · ${M.segmento} · ${M.data}`);
  for (const [t, its] of secs) {
    const vis = its.filter(i => i.s != null); if (vis.some(i => i.s !== i.f) || vis.length < its.length) truncated = true;
    const h0 = lh(10.5) + 2 + (vis[0] ? lines(vis[0].s, 9, CW - 5).length * lh(9) + 1 : 0); if (!fits(h0 + 8)) { defer.push(t); truncated = true; continue; }
    secTitle(t); for (const i of vis) { const h = lines(i.s, 9, CW - 5).length * lh(9) + 0.9; if (!fits(h + 6)) { truncated = true; break; } bullet(i.s); } y += 1.5;
  }
  if (defer.length && fits(6)) { doc.setFont('helvetica', 'italic'); doc.setFontSize(8.5); doc.setTextColor(...MUT); doc.text(pdfSan(`Continua no anexo: ${defer.join(', ')}.`), MX, y + 3); y += 5; }
  if (M.exec.nome && fits(6)) { doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...PET); doc.text(pdfSan(`${M.exec.nome}${M.exec.contato ? ' · ' + M.exec.contato : ''}`), MX, BOT - 2); }
  M.anexo = truncated || defer.length > 0;
  if (M.anexo) {
    doc.addPage(); header('Anexo - detalhamento', `${M.cliente} · ${M.data}`);
    for (const [t, its] of secs) { if (!fits(14)) { doc.addPage(); header('Anexo - detalhamento (cont.)', M.cliente); } secTitle(t); for (const i of its) { const h = lines(i.f, 9, CW - 5).length * lh(9) + 0.9; if (!fits(h)) { doc.addPage(); header('Anexo - detalhamento (cont.)', M.cliente); } bullet(i.f); } y += 1.5; }
  }
  const n = doc.getNumberOfPages(); for (let p = 1; p <= n; p++) { doc.setPage(p); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...MUT); doc.text(pdfSan(`Diagnóstico - não constitui proposta comercial · ${M.mode === 'cliente' ? 'versão para o cliente' : 'uso interno'} · página ${p} de ${n}`), MX, 297 - 7); }
  return doc.output('blob');
}
async function execExport(key) {
  const c = S.clients[key]; if (!c) return; const mode = UI.execMode || 'interno';
  try { await vend('jspdf'); const M = execModel(c, mode); const blob = execPDF(M); await offer(`diagnostico-${mode}-${safeKey(c.code || c.name).slice(0, 40)}.pdf`, blob); c.exec.lastPdf = { at: nowISO(), mode, paginas: M.anexo ? '1 + anexo' : '1' }; touchC(key); }
  catch (e) { toast('Falha ao gerar PDF: ' + e.message); }
}
