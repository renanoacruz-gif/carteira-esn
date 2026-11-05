/* ===== IMPORTAÇÃO EM LOTE: fila com progresso, concorrência controlada, retentativa e resumo persistido =====
   Fluxo por arquivo: ler → hash (dedupe) → extrair → identificar cliente (CNPJ/código; razão social só sugere) → associar ou pendência → gravar.
   Reutiliza ingestOne(): o mesmo caminho do envio individual (sem segundo motor). */
const LT = { items: [], files: new Map(), kind: 'ficha', run: 0, running: false, cancel: false, conc: 3, ep: 0 };
const LT_ST = { fila: 'Na fila', lendo: 'Lendo…', assoc: 'Associado', pend: 'Pendente de revisão', dup: 'Duplicado', erro: 'Com erro', sem_texto: 'Sem texto extraível' };
const ltCount = it => ({
  rec: it.length, proc: it.filter(x => ['assoc', 'pend'].includes(x.st)).length, assoc: it.filter(x => x.st === 'assoc').length, dup: it.filter(x => x.st === 'dup').length,
  pend: it.filter(x => x.st === 'pend').length, erro: it.filter(x => x.st === 'erro' || x.st === 'sem_texto').length, fila: it.filter(x => x.st === 'fila' || x.st === 'lendo').length
});
function ltClassify(out, n) { // estado do arquivo a partir de onde cada ficha/documento foi colocada
  if (!out.length) return { st: 'pend', msg: n ? 'Nada identificável neste arquivo.' : 'Nenhum item reconhecido.' };
  const bad = out.filter(o => o.st !== 'confirmado'), cli = [...new Set(out.filter(o => o.cli).map(o => o.cli))];
  if (!bad.length) return { st: 'assoc', msg: `${out.length} item(ns) → ${cli.join(', ')}`, cli };
  const m = bad.map(o => o.st === 'inbox' ? 'sem cliente' + (o.cands?.length ? ' (candidatos: ' + o.cands.slice(0, 3).join(', ') + ')' : '') : o.st === 'sugerido' ? `vínculo sugerido com ${o.cli} (${o.by})` : `divergência em ${o.cli}: ${o.msg}`);
  return { st: 'pend', msg: `${bad.length} de ${out.length} para revisar: ${[...new Set(m)].slice(0, 3).join('; ')}`, cli };
}
let ltPaintT = null;
const ltPaint = () => { clearTimeout(ltPaintT); ltPaintT = setTimeout(() => { const b = $('#lotebox'); if (b) b.innerHTML = loteInner(); }, 120); };
async function ingestLote(files, kind = 'ficha', only = null) {
  if (LT.running) return toast('Já existe um lote em processamento.');
  const ep = DM.epoch; LT.ep = ep;
  if (!only) { LT.items = files.map(f => ({ id: uid(), nome: f.name, tam: f.size, st: 'fila', msg: '', kind })); files.forEach((f, i) => LT.files.set(LT.items[i].id, f)); LT.kind = kind; LT.at = new Date().toISOString(); }
  const todo = only ? LT.items.filter(x => only.includes(x.id)) : LT.items.slice(); todo.forEach(x => { x.st = 'fila'; x.msg = ''; });
  LT.running = true; LT.cancel = false; render();
  const ctx = { ep, touched: new Set() }, queue = todo.slice();
  const work = async () => {
    while (queue.length && !LT.cancel && ep === DM.epoch) {
      const it = queue.shift(), f = LT.files.get(it.id); if (!f) { it.st = 'erro'; it.msg = 'Arquivo não está mais na memória: selecione-o novamente.'; continue; }
      it.st = 'lendo'; ltPaint();
      try {
        const r = await ingestOne(f, it.kind, null, {}, ctx);
        if (r.st === 'cancel') { it.st = 'fila'; it.msg = 'Interrompido: os dados foram limpos durante a leitura. Nada foi gravado.'; continue; }
        if (r.st === 'dup') { it.st = 'dup'; it.msg = `Arquivo idêntico já importado${r.owner ? ' em ' + r.owner : ''} — ignorado.`; continue; }
        const c = ltClassify(r.out, r.n); it.st = c.st; it.msg = c.msg; it.cli = c.cli || []; it.hash = r.hash; it.n = r.n;
      } catch (e) {
        it.st = /sem camada de texto|sem texto/i.test(e.message) ? 'sem_texto' : 'erro'; it.msg = e.message;
        it.msg = it.st === 'sem_texto' ? 'PDF sem camada de texto extraível (provável escaneado). NÃO foi marcado como lido. Fichas de cliente não são enviadas a OCR externo sem autorização específica; use uma versão com texto.' : e.message;
      } finally { ltPaint(); }
    }
  };
  await Promise.all(Array.from({ length: Math.min(LT.conc, queue.length || 1) }, work));
  LT.running = false;
  if (ep !== DM.epoch) { LT.items = []; LT.files.clear(); render(); return; } /* limpeza durante o lote: descarta tudo */
  todo.filter(x => x.st === 'fila').forEach(x => { x.msg = LT.cancel ? 'Cancelado antes de processar.' : x.msg; });
  const ok = LT.items.filter(x => ['assoc', 'pend'].includes(x.st));
  reanalyze([...ctx.touched], ok.length ? `Lote de ${LT.kind === 'doc' ? 'documentos' : 'fichas'}: ${ok.length} arquivo(s)` : '');
  ltSave(); log(`Lote concluído: ${ltCount(LT.items).rec} recebido(s), ${ltCount(LT.items).assoc} associado(s), ${ltCount(LT.items).pend} pendente(s), ${ltCount(LT.items).dup} duplicado(s), ${ltCount(LT.items).erro} com erro.`, ltCount(LT.items).erro ? 'bad' : 'ok'); render();
}
function ltSave() { // resumo persistido (sem conteúdo dos arquivos): permite ver o resultado do último lote depois de reabrir
  const L = (S.meta.lotes ||= []); const c = ltCount(LT.items);
  const rec = { id: uid(), at: LT.at || new Date().toISOString(), kind: LT.kind, cont: c, itens: LT.items.slice(0, 300).map(x => ({ nome: x.nome, st: x.st, msg: String(x.msg || '').slice(0, 300), cli: x.cli || [] })) };
  const i = L.findIndex(x => x.at === rec.at); if (i >= 0) L[i] = rec; else L.unshift(rec); S.meta.lotes = L.slice(0, 10); touchMeta();
}
function loteInner() {
  const cur = LT.items.length ? LT.items : null, prev = !cur && (S.meta.lotes || [])[0];
  const it = cur || (prev ? prev.itens.map((x, i) => ({ id: 'p' + i, ...x })) : []); if (!it.length) return '<p class="muted sm">Nenhum lote nesta sessão. Selecione vários arquivos acima: cada um aparece aqui com seu resultado.</p>';
  const c = ltCount(it), pct = c.rec ? Math.round((c.rec - c.fila) / c.rec * 100) : 0, errIds = it.filter(x => x.st === 'erro' || x.st === 'sem_texto').map(x => x.id), canRetry = cur && !LT.running && errIds.some(id => LT.files.has(id));
  const kp = (l, v, cls = '') => `<div class="kpi ${cls}"><div class="v">${v}</div><div class="l">${l}</div></div>`;
  return `${!cur ? `<p class="muted sm">Último lote (${fmtDate(prev.at)}) — resumo guardado; os arquivos não ficam armazenados.</p>` : ''}
  <div class="kpis lt-kpis">${kp('Recebidos', c.rec)}${kp('Processados', c.proc)}${kp('Associados', c.assoc, 'ok')}${kp('Duplicados', c.dup)}${kp('Pendentes', c.pend, c.pend ? 'warn' : '')}${kp('Com erro', c.erro, c.erro ? 'bad' : '')}</div>
  ${c.fila || LT.running ? `<div class="lt-bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div><p class="sm muted">${pct}% • ${c.fila} restante(s) • até ${LT.conc} em paralelo ${LT.running ? '<button class="btn ghost sm" data-a="loteCancel">Cancelar fila</button>' : ''}</p>` : ''}
  <table class="tbl sm"><thead><tr><th>Arquivo</th><th>Resultado</th><th>Detalhe</th></tr></thead><tbody>${it.map(x => `<tr><td>${esc(x.nome)}</td><td><span class="pill ${x.st === 'assoc' ? 'p-ok' : x.st === 'pend' ? 'p-warn' : x.st === 'dup' ? '' : x.st === 'fila' || x.st === 'lendo' ? '' : 'p-bad'}">${LT_ST[x.st] || x.st}</span></td><td>${esc(x.msg || '')}</td></tr>`).join('')}</tbody></table>
  <div class="row" style="margin-top:8px">${canRetry ? '<button class="btn pri sm" data-a="loteRetry">Reprocessar somente os com erro</button>' : ''}${cur && !LT.running ? '<button class="btn ghost sm" data-a="loteClear">Limpar lista</button>' : ''}${c.pend && S.inbox.length ? '<span class="muted sm">Pendências sem cliente: confirme abaixo em "Pendências de associação". Vínculos sugeridos ficam na página do cliente.</span>' : ''}${!canRetry && c.erro && !cur ? '<span class="muted sm">Para reprocessar os com erro, selecione novamente esses arquivos.</span>' : ''}</div>`;
}
const loteCard = () => `<div class="card" id="lotecard"><h3>Fila do lote</h3><div id="lotebox">${loteInner()}</div></div>`;
const LOTE_ACT = {
  loteRetry: () => { const ids = LT.items.filter(x => (x.st === 'erro' || x.st === 'sem_texto') && LT.files.has(x.id)).map(x => x.id); if (!ids.length) return toast('Nenhum arquivo com erro disponível em memória.'); ingestLote([], LT.kind, ids); },
  loteClear: () => { LT.items = []; LT.files.clear(); render(); },
  loteCancel: () => { LT.cancel = true; toast('Fila será interrompida após os arquivos em leitura.'); }
};
