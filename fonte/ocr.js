/* ===== Outros documentos e imagens (OCR) =====
   Imagens/PDFs escaneados → texto por OCR no backend (Gemini). Regras:
   - NADA sai do navegador sem autorização explícita (diálogo com destino e arquivos);
   - original preservado (em partes, coleção privada "ocrimg") + texto extraído + indicação de OCR;
   - cliente identificado por CNPJ válido / código TOTVS; associação automática SÓ se inequívoca; dúvida = candidatos + escolha manual;
   - texto OCR é INDÍCIO (rótulo "OCR — texto a confirmar"), nunca fato confirmado; pode ser corrigido pelo usuário. */
const OC_MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', pdf: 'application/pdf' };
const OC_MAX = 3 * 1024 * 1024, OC_CHUNK = 120000, OC_TXT = 80000;
UI.oc = { fila: [], ver: null, msg: '' };
const ocMime = f => OC_MIME[(String(f.name).split('.').pop() || '').toLowerCase()] || '';
const ocB64 = buf => { let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
const ocImgB64 = id => S.ocrimg.filter(x => x.ocrId === id).sort((a, b) => a.i - b.i).map(x => x.b64).join('');
const ocEstL = { autorizar: ['Aguardando autorização', 'warn'], lendo: ['Lendo (OCR)…', 'info'], aguardando_resposta: ['Aguardando resposta do backend', 'warn'], lido: ['Texto extraído', 'ok'], ilegivel: ['Ilegível / sem texto', 'bad'], erro: ['Erro no OCR', 'bad'] };
/* 1) seleção de arquivos: valida, deduplica por hash, guarda o original e pede autorização */
async function ocrPrep(files) {
  const ep = DM.epoch, novos = [], avisos = [];
  for (const f of files) {
    const mime = ocMime(f); if (!mime) { avisos.push(`${f.name}: formato não suportado pelo OCR (aceitos: PNG, JPG, WEBP e PDF).`); continue; }
    if (f.size > OC_MAX) { avisos.push(`${f.name}: ${(f.size / 1048576).toFixed(1)} MB — acima de 3 MB. Reduza/comprima e envie de novo (o original precisa ser guardado junto).`); continue; }
    const buf = await readBuf(f); if (ep !== DM.epoch) return; const hash = await sha(buf); if (ep !== DM.epoch) return;
    const ja = S.ocr.find(o => o.hash === hash);
    if (ja) { avisos.push(`${f.name}: arquivo idêntico já enviado em ${fmtDate(ja.at)} (${ocEstL[ja.estado]?.[0] || ja.estado}). ${['erro', 'ilegivel'].includes(ja.estado) ? 'Use "Reenviar" no registro existente.' : 'Reaproveite o texto já extraído.'}`); UI.oc.ver = ja.id; continue; }
    const b64 = ocB64(buf), n = Math.ceil(b64.length / OC_CHUNK), rec = { id: 'oc_' + uid(), at: nowISO(), nome: String(f.name).slice(0, 120), mime, tam: f.size, hash, estado: 'autorizar', ocr: true, n, texto: '', avisos: [] };
    for (let i = 0; i < n; i++) { const ch = { id: `${rec.id}_${i}`, ocrId: rec.id, i, n, b64: b64.slice(i * OC_CHUNK, (i + 1) * OC_CHUNK) }; S.ocrimg.push(ch); touchG('ocrimg', ch.id); }
    S.ocr.unshift(rec); touchG('ocr', rec.id); novos.push(rec.id);
  }
  UI.oc.msg = avisos.join(' • '); if (avisos.length) toast(avisos[0].slice(0, 160));
  if (!novos.length) return render();
  UI.oc.fila = novos; ocrPedirAut(novos);
}
/* 2) autorização explícita — o texto diz o que sai, para onde e o que pode conter */
function ocrPedirAut(ids) {
  const recs = ids.map(id => S.ocr.find(o => o.id === id)).filter(Boolean); if (!recs.length) return;
  const modo = bkModo(), dest = bkPronto() ? bkUrl() : '(backend não configurado)';
  MODALS.ocrauth = { t: 'Autorizar envio para leitura por OCR?', b: `${esc(recs.map(r => `${r.nome} (${(r.tam / 1024).toFixed(0)} KB)`).join('; '))}. ${aiTarefa('ocr').prov === 'pagina' ? 'O conteúdo será enviado ao <b>Claude (Anthropic) pelo claude.ai, através desta página</b>, para transcrição (sem backend e sem chave).' : `O conteúdo será enviado ao backend ${esc(dest)} e, de lá, ao <b>Google Gemini</b> para transcrição.`} Imagens e PDFs podem conter <b>nomes, CNPJ, valores e outros dados de clientes</b>. ${modo === 'manual' && aiTarefa('ocr').prov !== 'pagina' ? 'Neste ambiente não há chamada direta: será gerado um arquivo de pedido (contém a imagem) para você enviar ao backend. ' : ''}Nada é enviado sem esta autorização; o original fica guardado na sua conta e a chave do provedor nunca passa pelo navegador.`, ok: ['ocrAutOk', 'Autorizar envio e ler', 'pri'], cancel: 'ocrAutNo' };
  UI.confirm = 'ocrauth'; render();
}
async function ocrEnviar(rec) {
  const ep = DM.epoch; rec.estado = 'lendo'; rec.erro = null; rec.autorizadoEm = nowISO(); rec.pedidoId = 'ocrc_' + uid(); touchG('ocr', rec.id); render();
  try {
    const pedido = { versao: 1, pedidoId: rec.pedidoId, ...(aiTarefa('ocr').prov === 'pagina' ? { provedor: 'pagina' } : {}), tipo: 'ocr_material', finalidade: 'cliente', autorizacaoUsuario: true, confirmaEnvioProvedor: true, arquivo: { nome: rec.nome, mime: rec.mime, base64: ocImgB64(rec.id) } };
    const r = await bkChamar('ocr', pedido, `pedido-ocr-${rec.id}.json`); if (ep !== DM.epoch) return;
    if (r.via === 'direto') await ocrClienteResposta(r.resp);
    else { rec.estado = 'aguardando_resposta'; touchG('ocr', rec.id); toast(`Pedido de OCR gerado. ${r.motivo ? r.motivo + ' ' : ''}Envie-o ao backend e importe a resposta em "Importar resposta".`); }
  } catch (e) { if (ep !== DM.epoch) return; rec.estado = 'erro'; rec.erro = String(e.message || e).slice(0, 300); touchG('ocr', rec.id); intLog({ sistema: 'ia', op: 'ocr', estado: 'erro', msg: rec.erro }); }
  render();
}
/* 3) resposta do backend (direta ou arquivo importado) */
async function ocrClienteResposta(j) {
  const rec = S.ocr.find(o => o.pedidoId && o.pedidoId === j.pedidoId); if (!rec) throw new Error('Resposta de OCR sem pedido correspondente neste navegador (outra sessão, já importada ou registro excluído).');
  if (!j.ok || typeof j.texto !== 'string') { rec.estado = 'erro'; rec.erro = `${j.erro?.codigo || 'erro'}: ${s4(j.erro?.mensagem, 300) || 'resposta sem texto'}`; if (j.provedor !== 'pagina') intSet('ocr', { ok: false, msg: j.erro?.codigo || 'erro' }); touchG('ocr', rec.id); intLog({ sistema: 'ia', op: 'ocr', estado: 'erro', msg: rec.erro }); render(); return true; }
  let omit = 0; const lines = j.texto.split(/\r?\n/).filter(l => { if (SECRET_RE.test(l)) { omit++; return false; } return true; }), txt = lines.join('\n');
  rec.texto = txt.slice(0, OC_TXT); rec.truncado = !!j.truncado || txt.length > OC_TXT; rec.modelo = s4(j.modelo, 60); rec.consultadoEm = s4(j.consultadoEm, 40); rec.omitidas = omit;
  rec.avisos = [...cap(j.avisos, 4).map(a => s4(a, 240)), ...(omit ? [`${omit} linha(s) omitida(s) por parecerem credenciais.`] : [])];
  const util = rec.texto.replace(/\[ileg[ií]vel\]|\s/gi, '');
  if (util.length < 12) { rec.estado = 'ilegivel'; rec.erro = 'O OCR não encontrou texto legível. Envie uma imagem mais nítida (maior resolução, sem reflexo) ou digite os dados.'; }
  else { rec.estado = 'lido'; rec.erro = null; ocrIdentificar(rec); }
  if (j.provedor !== 'pagina') intSet('ocr', { ok: rec.estado === 'lido', msg: rec.estado === 'lido' ? 'leitura concluída' : 'sem texto legível' }); touchG('ocr', rec.id); intLog({ sistema: 'ia', op: 'ocr', estado: rec.estado === 'lido' ? 'ok' : 'aviso', msg: `${rec.nome}: ${rec.estado}` }); render(); return true;
}
/* 4) identificação do cliente: CNPJ válido (com papel no documento) e código; só associa sozinho se for inequívoco */
function ocrIdentificar(rec) {
  const text = rec.textoCorrigido ?? rec.texto, ix = idx(), m = matchDoc(text, ix), res = resolveMatch(m), roles = cnpjRoles(text);
  rec.ids = { cnpjs: [...roles.entries()].map(([d, papel]) => ({ cnpj: d, papel, naCarteira: (ix.byCnpj.get(d) || []).length > 0 })), };
  rec.cands = (res.cands || m.cands || (res.key ? [{ key: res.key, by: res.by, state: res.state }] : [])).map(c => ({ key: c.key, by: c.by, state: c.state, role: c.role || '' }));
  rec.decisao = res.state;
  if (!rec.assoc && res.state === 'confirmado') rec.assoc = { key: res.key, por: `automática (inequívoca: ${res.by})`, at: nowISO() };
  if (!rec.assoc && res.state === 'sugerido') rec.sugestao = { key: res.key, by: res.by };
  if (res.state === 'ambiguo') rec.nota = res.note;
}
function ocrAssociar(id, key) {
  const rec = S.ocr.find(o => o.id === id), c = S.clients[key]; if (!rec || !c) return toast('Escolha o cliente.');
  if (rec.assoc && rec.assoc.key !== key) ocrRemoverDoCliente(rec);
  rec.assoc = { key, por: 'manual', at: nowISO() }; delete rec.sugestao; touchG('ocr', id); toast('Documento associado a ' + c.name + '. Revise o texto e incorpore ao cliente.'); render();
}
function ocrRemoverDoCliente(rec) {
  const c = S.clients[rec.assoc?.key || rec.incorporado?.key]; if (!c) return;
  const n = (c.docs || []).length; c.docs = (c.docs || []).filter(d => d.ocrId !== rec.id);
  if (c.docs.length !== n) { touchC(c.key); runAnalysis(c, 'Documento OCR removido: ' + rec.nome); touchC(c.key); }
  delete rec.incorporado;
}
function ocrDesassociar(id) { const rec = S.ocr.find(o => o.id === id); if (!rec) return; ocrRemoverDoCliente(rec); rec.assoc = null; delete rec.sugestao; ocrIdentificar(rec); touchG('ocr', id); render(); }
/* 5) incorporar: vira documento do cliente rotulado como OCR — indício a confirmar, não fato */
function ocrIncorporar(id) {
  const rec = S.ocr.find(o => o.id === id), c = S.clients[rec?.assoc?.key]; if (!rec || !c) return toast('Associe a um cliente antes de incorporar.');
  const texto = (rec.textoCorrigido ?? rec.texto).slice(0, 12000), doc = { id: 'ocd_' + rec.id, name: `${rec.nome} (OCR — texto a confirmar)`, hash: rec.hash, at: nowISO(), text: texto, trunc: (rec.textoCorrigido ?? rec.texto).length > 12000, state: 'confirmado', by: `OCR + ${rec.assoc.por}`, ocr: true, ocrId: rec.id, corrigido: !!rec.textoCorrigido };
  c.docs = (c.docs || []).filter(d => d.ocrId !== rec.id); c.docs.push(doc); rec.incorporado = { key: c.key, at: nowISO() };
  touchC(c.key); runAnalysis(c, 'Documento OCR incorporado: ' + rec.nome); touchC(c.key); touchG('ocr', id); toast('Incorporado a ' + c.name + ' como indício (OCR). Não é fato confirmado.'); render();
}
function ocrExcluir(id) {
  const rec = S.ocr.find(o => o.id === id); if (!rec) return; ocrRemoverDoCliente(rec);
  S.ocrimg.filter(x => x.ocrId === id).forEach(x => dropG('ocrimg', x.id)); S.ocrimg = S.ocrimg.filter(x => x.ocrId !== id); S.ocr = S.ocr.filter(o => o.id !== id); dropG('ocr', id); if (UI.oc.ver === id) UI.oc.ver = null; render();
}
function ocrTexto(id, v) {
  const rec = S.ocr.find(o => o.id === id); if (!rec) return; v = String(v).slice(0, OC_TXT);
  if (v === rec.texto) delete rec.textoCorrigido; else { rec.textoCorrigido = v; rec.corrigidoEm = nowISO(); }
  ocrIdentificar(rec); if (rec.incorporado) ocrIncorporar(id); else { touchG('ocr', id); render(); }
}
/* 6) interface (cartão "3 · Outros documentos e imagens") */
function ocrCand(rec) {
  const opts = clients().sort((a, b) => a.name.localeCompare(b.name)).slice(0, 2000), cand = new Set((rec.cands || []).map(c => c.key));
  const lista = [...(rec.cands || []).map(c => ({ ...c, c: S.clients[c.key] })).filter(x => x.c), ...(rec.sugestao && !cand.has(rec.sugestao.key) && S.clients[rec.sugestao.key] ? [{ key: rec.sugestao.key, by: rec.sugestao.by, state: 'sugerido', c: S.clients[rec.sugestao.key] }] : [])];
  return `<div class="row sm"><select data-id="ocs_${esc(rec.id)}" aria-label="Cliente">${lista.length ? `<optgroup label="Candidatos">${lista.map(x => `<option value="${esc(x.key)}">${esc(x.c.name)} — ${esc(x.by)} (${x.state})</option>`).join('')}</optgroup>` : ''}<optgroup label="Toda a carteira"><option value="">Escolher cliente…</option>${opts.map(c => `<option value="${esc(c.key)}">${esc(c.name)}${c.code ? ' • ' + esc(c.code) : ''}</option>`).join('')}</optgroup></select><button class="btn ghost sm" data-a="ocAssoc" data-id="${esc(rec.id)}">Associar</button></div>`;
}
function ocrCard(rec) {
  const [el, ek] = ocEstL[rec.estado] || [rec.estado, 'off'], cl = S.clients[rec.assoc?.key], t = rec.textoCorrigido ?? rec.texto;
  let h = `<div class="card oc" data-id="${esc(rec.id)}"><div class="row" style="justify-content:space-between;gap:8px"><div><b>${esc(rec.nome)}</b> <span class="muted sm">${(rec.tam / 1024).toFixed(0)} KB • enviado em ${esc(dtBR(rec.at))}</span></div><div>${pill('OCR', 'info')} ${pill(el, ek)}${rec.incorporado ? ' ' + pill('incorporado ao cliente', 'ok') : ''}</div></div>`;
  if (rec.erro) h += `<div class="alert b sm" role="alert">${esc(rec.erro)}</div>`;
  if (rec.estado === 'autorizar') h += `<p class="sm muted">O arquivo está guardado, mas <b>nada foi enviado</b>. <button class="btn pri sm" data-a="ocPedir" data-id="${esc(rec.id)}">Revisar e autorizar envio</button></p>`;
  if (rec.estado === 'aguardando_resposta') h += `<p class="sm muted">Pedido gerado como arquivo. Envie-o ao backend e importe a resposta (JSON) abaixo. <label class="btn ghost sm" style="cursor:pointer">Importar resposta<input type="file" id="f-ai2" accept=".json,application/json" hidden></label></p>`;
  if (['erro', 'ilegivel', 'aguardando_resposta'].includes(rec.estado)) h += `<div class="row sm"><button class="btn ghost sm" data-a="ocPedir" data-id="${esc(rec.id)}">Reenviar (nova autorização)</button></div>`;
  if (rec.estado === 'lido') {
    const ids = rec.ids?.cnpjs || [];
    h += `<dl class="sm"><dt>Identificação</dt><dd>${cl ? `Associado a <b>${esc(cl.name)}</b> — ${esc(rec.assoc.por)} <button class="btn ghost sm" data-a="ocDesassoc" data-id="${esc(rec.id)}">Desfazer</button>` : rec.decisao === 'ambiguo' ? `<span class="pill p-warn">ambíguo</span> ${esc(rec.nota || '')} — escolha o cliente abaixo.` : rec.sugestao ? `<span class="pill p-warn">sugerido</span> ${esc(S.clients[rec.sugestao.key]?.name || '')} (${esc(rec.sugestao.by)}) — confirme abaixo.` : '<span class="pill p-warn">sem cliente identificado</span> nenhum CNPJ/código da carteira no texto — escolha manualmente.'}</dd>
    <dt>CNPJ no documento</dt><dd>${ids.length ? ids.map(x => `${esc(fmtCnpj(x.cnpj))} <span class="muted">(${x.papel === 'emissor' ? 'emissor' : x.papel === 'faturado' ? 'cliente/faturado' : 'apenas citado'}${x.naCarteira ? ', na carteira' : ', FORA da carteira'})</span>`).join('; ') : '<span class="muted">nenhum CNPJ válido lido</span>'}</dd></dl>`;
    if (!cl) h += ocrCand(rec);
    h += `<details ${rec.incorporado ? '' : 'open'}><summary class="sm"><b>Texto extraído por OCR</b> ${rec.textoCorrigido ? pill('corrigido por você', 'warn') : pill('não revisado', 'off')} <span class="muted">${esc(rec.modelo || '')} • ${esc(fmtDate(rec.consultadoEm))}${rec.truncado ? ' • TRUNCADO no limite' : ''}</span></summary>
    <textarea data-c="oc" data-id="${esc(rec.id)}" rows="9" style="width:100%;font-family:monospace;font-size:12px" aria-label="Texto extraído">${esc(t)}</textarea>
    <p class="sm muted">${(rec.avisos || []).map(esc).join(' ')} O OCR pode errar dígitos e nomes: corrigir o texto reprocessa a identificação. O que for incorporado entra como <b>indício rotulado "OCR"</b>, não como fato confirmado.</p></details>
    ${(() => { const sg = sgExtrair(t, { src: rec.nome, nat: 'ocr', ocr: true }); return sg.length ? `<details class="sm"><summary><b>Sinais identificados no texto lido (${sg.length})</b> ${pill('print isolado: indício, não processo', 'warn')}</summary><ul>${sg.slice(0, 10).map(x => `<li><b>${esc(SG_T[x.tipo])}</b>: …${esc(x.trecho)}… ${chip(x.cls)}</li>`).join('')}</ul><div class="alert i sm"><b>Confirmação necessária:</b> ${esc(OCR_Q)}</div></details>` : ''; })()}
    <div class="row sm">${cl ? `<button class="btn pri sm" data-a="ocInc" data-id="${esc(rec.id)}">${rec.incorporado ? 'Atualizar no cliente' : 'Incorporar ao cliente (como indício)'}</button><button class="btn ghost sm" data-a="open" data-k="${esc(cl.key)}">Abrir cliente</button>` : ''}</div>`;
  }
  h += `<div class="row sm"><button class="btn ghost sm" data-a="ocVer" data-id="${esc(rec.id)}">${UI.oc.ver === rec.id ? 'Ocultar original' : 'Ver original'}</button><button class="btn ghost sm" data-a="ocDel" data-id="${esc(rec.id)}">Excluir</button></div>`;
  if (UI.oc.ver === rec.id) h += rec.mime === 'application/pdf' ? `<p class="sm muted">Original em PDF guardado (${rec.n} parte(s)); abra pelo seu arquivo de origem.</p>` : `<img alt="Original enviado: ${esc(rec.nome)}" src="data:${rec.mime};base64,${ocImgB64(rec.id)}" style="max-width:100%;max-height:420px;border:1px solid var(--bd);border-radius:6px">`;
  return h + '</div>';
}
function ocrPanel() {
  const list = S.ocr;
  return `<div class="card"><h3>Leitura por OCR <span class="muted sm">(imagens e PDFs escaneados)</span></h3>
  <label class="drop" data-drop="f-ocr"><b>Prints, imagens e documentos escaneados</b><br><span class="muted sm">PNG, JPG, WEBP ou PDF escaneado, até 3 MB cada. O texto é lido por OCR no backend — <b>só depois da sua autorização</b>.</span><input type="file" id="f-ocr" multiple accept=".png,.jpg,.jpeg,.webp,.pdf,image/png,image/jpeg,image/webp,application/pdf" hidden></label>
  <p class="sm muted">O cliente é identificado por CNPJ válido ou código TOTVS no texto; se houver dúvida, você escolhe. Documentos com texto (PDF com texto, DOCX, XLSX, TXT) seguem pelo cartão 3 e não usam OCR. O backup JSON não inclui as imagens nem as leituras de OCR (ficam na base da sua conta).</p>
  ${UI.oc.msg ? `<div class="alert i sm">${esc(UI.oc.msg)}</div>` : ''}${list.length ? list.map(ocrCard).join('') : '<p class="sm muted">Nenhuma imagem enviada ainda.</p>'}</div>`;
}
const OC_ACT = {
  ocAutOk: () => { UI.confirm = null; const ids = UI.oc.fila.slice(); UI.oc.fila = []; render(); ids.map(id => S.ocr.find(o => o.id === id)).filter(Boolean).forEach(r => ocrEnviar(r)); },
  ocrAutOk: () => OC_ACT.ocAutOk(), ocrAutNo: () => { UI.confirm = null; UI.oc.fila = []; toast('Envio cancelado: nada foi enviado. Os arquivos continuam guardados, aguardando autorização.'); render(); },
  ocPedir: t => { UI.oc.fila = [t.dataset.id]; ocrPedirAut([t.dataset.id]); },
  ocAssoc: t => { const k = $(`select[data-id="ocs_${t.dataset.id}"]`)?.value; ocrAssociar(t.dataset.id, k); },
  ocDesassoc: t => ocrDesassociar(t.dataset.id), ocInc: t => ocrIncorporar(t.dataset.id), ocDel: t => ocrExcluir(t.dataset.id),
  ocVer: t => { UI.oc.ver = UI.oc.ver === t.dataset.id ? null : t.dataset.id; render(); }
};
function ocChange(t, c, v) { if (c !== 'oc') return false; ocrTexto(t.dataset.id, v); return true; }
