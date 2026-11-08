/* ===== Imagens e prints do cliente =====
   Reaproveita o OCR existente (S.ocr/S.ocrimg, ocrEnviar, ocrClienteResposta). Regras:
   - sem limite fixo de quantidade; limite técnico por imagem (OC_MAX) e cota do banco explícitos; nada é descartado em silêncio;
   - fila com concorrência PR_CONC; arquivo idêntico não é reprocessado (nem cobrado de novo);
   - o texto da imagem é DADO: só vira informação por regras locais (rótulo→campo) e sempre rotulada "Extraído de print por OCR";
   - campo vazio só é preenchido com leitura de alta confiança e cliente identificado na imagem; o resto vai para revisão;
   - tudo tem origem (imagem, trecho, linha, data, método) e pode ser desfeito sem apagar edições posteriores;
   - um print isolado é indício, não prova de contratação, uso ou processo. */
const PR_CONC = 2, PR_PAGE = 8, PR_NOME = 'Extraído de print por OCR', PR_METODO = 'regra local sobre o texto lido por OCR (rótulo → campo)';
const PR_EST = { fila: ['Na fila', 'off'], proc: ['Processando', 'info'], ok: ['Concluída', 'ok'], rev: ['Revisão necessária', 'warn'], erro: ['Com erro', 'bad'] };
const PR_SUG = { aplicada: ['preenchido automaticamente', 'ok'], aceita: ['aceito por você', 'ok'], pendente: ['aguarda revisão', 'warn'], conflito: ['conflita com o cadastro', 'bad'], confirma: ['confirma o cadastro', 'off'], rejeitada: ['rejeitado', 'off'], desfeita: ['desfeito', 'off'] };
const PR_CAMPO = { code: 'Código TOTVS', cnpj: 'CNPJ', seg: 'Segmento', city: 'Cidade', uf: 'UF', size: 'Porte', site: 'Site', release: 'Release', regime: 'Regime tributário' };
const PR_CRIT = ['cnpj', 'code'];
const PR_EVT = { contato: 'Contato', produto: 'Produto/módulo citado', contrato: 'Contratual/operacional', quantidade: 'Quantidade/indicador', data: 'Data exibida', valor: 'Valor exibido', dor: 'Dor/observação/histórico', tabela: 'Tabela', campo: 'Outra informação', outra_empresa: 'Outra empresa citada' };
UI.pr = { pg: 0, f: '', run: 0, auto: {}, inf: new Set(), at: {}, del: null, big: null, msg: '' };
const prRecs = c => S.ocr.filter(o => o.origem === 'print' && o.cli === c.key);
const prTxt = rec => rec.textoCorrigido ?? rec.texto ?? '';
const prNorm = v => norm(String(v ?? '')).replace(/\s+/g, ' ').trim();
const prImp = (c, id) => (c.prImp || []).find(i => i.id === id);

/* ---------- configuração de OCR: sem ela, arquivos ficam guardados e a ação necessária é mostrada ---------- */
function prOcrPronto() {
  if (aiTarefa('ocr').prov === 'pagina') return { ok: true };
  if (window.__HOSTED__) return hkChave('gemini') ? { ok: true } : { ok: false, acao: 'Cadastre a sua chave do Google Gemini em Configurações → IA e provedores → Minhas chaves de IA (o OCR usa o Gemini).', nav: 'integra' };
  if (bkModo() === 'manual') return { ok: false, acao: 'Este ambiente não chama o backend de OCR diretamente. Configure o backend em Integrações ou escolha o provedor “Claude desta página” em Configurar IA.', nav: 'integra' };
  return { ok: true };
}
const prProvTxt = () => aiTarefa('ocr').prov === 'pagina' ? 'Claude (Anthropic), pelo claude.ai, através desta página' : window.__HOSTED__ ? 'Google Gemini, com a sua chave pessoal, por meio do servidor desta aplicação' : `Google Gemini, por meio do backend ${bkUrl() || '(não configurado)'}`;

/* ---------- estado por imagem ---------- */
function prPend(rec) {
  const r = [];
  if (rec.estado !== 'lido') return r;
  if (rec.ident?.estado === 'outra') r.push('Possível outra empresa: confirme se a imagem é deste cliente.');
  else if (rec.ident?.estado === 'sem') r.push('Cliente não identificado na imagem: sugestões aguardam sua revisão.');
  else if (rec.ident?.estado === 'misto') r.push('A imagem cita este cliente e outro: confirme antes de usar os dados.');
  const s = rec.sug || [], np = s.filter(x => x.estado === 'pendente').length, nc = s.filter(x => x.estado === 'conflito').length;
  if (np) r.push(`${np} sugestão(ões) de preenchimento a revisar.`); if (nc) r.push(`${nc} conflito(s) com o cadastro.`);
  return r;
}
function prEstado(rec) {
  if (rec.estado === 'erro' || rec.estado === 'aguardando_resposta') return 'erro';
  if (rec.estado === 'lendo') return 'proc';
  if (rec.estado === 'autorizar' || rec.estado === 'fila') return 'fila';
  if (rec.estado === 'ilegivel') return 'rev';
  return prPend(rec).length ? 'rev' : 'ok';
}

/* ---------- adicionar imagens (seleção, arrastar, colar) ---------- */
const prMime = f => { const m = ocMime(f); return m && m !== 'application/pdf' ? m : ''; };
function prThumb(file) {
  return new Promise(res => {
    const t = setTimeout(() => res(''), 4000);
    try { const u = URL.createObjectURL(file), im = new Image(); im.onload = () => { try { const k = 140 / Math.max(im.width, im.height, 140), cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(im.width * k)); cv.height = Math.max(1, Math.round(im.height * k)); cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height); clearTimeout(t); res(cv.toDataURL('image/jpeg', 0.6)); } catch (e) { clearTimeout(t); res(''); } URL.revokeObjectURL(u); }; im.onerror = () => { clearTimeout(t); res(''); }; im.src = u; } catch (e) { clearTimeout(t); res(''); }
  });
}
async function prAdd(files, key, colado) {
  const c = S.clients[key]; if (!c) return; const ep = DM.epoch, avisos = [], novos = [], reuso = [];
  const imp = { id: 'imp_' + uid(), at: nowISO(), recs: [], ap: [] };
  let seq = 0;
  for (const f0 of files) {
    const mime = prMime(f0); if (!mime) { avisos.push(`${f0.name}: formato não suportado (aceitos: PNG, JPG/JPEG e WebP).`); continue; }
    if (f0.size > OC_MAX) { avisos.push(`${f0.name}: ${(f0.size / 1048576).toFixed(1)} MB — acima do limite técnico de ${OC_MAX / 1048576} MB por imagem (o original precisa ser guardado e enviado ao OCR). Reduza a resolução e envie de novo; nada foi descartado em silêncio.`); continue; }
    const buf = await readBuf(f0); if (ep !== DM.epoch) return; const hash = await sha(buf); if (ep !== DM.epoch) return;
    const dup = prRecs(c).find(o => o.hash === hash); if (dup) { avisos.push(`${f0.name}: idêntica a “${dup.nome}” já anexada a este cliente — não foi processada de novo.`); continue; }
    const outra = S.ocr.find(o => o.hash === hash && o.estado === 'lido' && prTxt(o));
    const ext = mime === 'image/jpeg' ? 'jpg' : mime.split('/')[1], d = new Date(), pad = n => String(n).padStart(2, '0');
    const nome = colado || /^image\.(png|jpe?g|webp)$/i.test(f0.name) ? `print-colado-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}-${++seq}.${ext}` : String(f0.name).slice(0, 120);
    const b64 = ocB64(buf), n = Math.ceil(b64.length / OC_CHUNK), thumb = await prThumb(f0); if (ep !== DM.epoch) return;
    const rec = { id: 'oc_' + uid(), at: nowISO(), nome, mime, tam: f0.size, hash, estado: outra ? 'lido' : 'autorizar', ocr: true, origem: 'print', cli: key, assoc: { key, por: 'upload no cliente', at: nowISO() }, imp: imp.id, n, texto: outra ? prTxt(outra) : '', thumb, avisos: [], reuso: outra ? { de: outra.id, nome: outra.nome } : null, usar: true };
    if (outra) { rec.modelo = outra.modelo; rec.consultadoEm = outra.consultadoEm; reuso.push(rec); }
    for (let i = 0; i < n; i++) { const ch = { id: `${rec.id}_${i}`, ocrId: rec.id, i, n, b64: b64.slice(i * OC_CHUNK, (i + 1) * OC_CHUNK) }; S.ocrimg.push(ch); touchG('ocrimg', ch.id); }
    S.ocr.unshift(rec); touchG('ocr', rec.id); imp.recs.push(rec.id); if (!outra) novos.push(rec.id);
  }
  UI.pr.msg = avisos.join(' • '); if (avisos.length) toast(avisos[0].slice(0, 170));
  if (!imp.recs.length) return render();
  c.prImp = [imp, ...(c.prImp || [])].slice(0, 200); touchC(key);
  reuso.forEach(r => prPos(r)); if (reuso.length) toast(`${reuso.length} imagem(ns) idêntica(s) a outra já lida: texto reaproveitado, sem novo envio ao OCR.`);
  UI.pr.pg = 0;
  if (novos.length) { if (!prOcrPronto().ok) toast('Imagens guardadas. OCR não configurado: veja a ação necessária no painel “Imagens e prints”.'); else prSolicitar(novos, key); }
  render();
}

/* ---------- autorização do lote (uma confirmação para todas) e fila ---------- */
function prSolicitar(ids, key) {
  if (UI.pr.auto[key]) return prEnfileirar(ids);
  const recs = ids.map(id => S.ocr.find(o => o.id === id)).filter(Boolean); if (!recs.length) return;
  const kb = recs.reduce((a, r) => a + r.tam, 0) / 1024;
  MODALS.prauth = { t: `Autorizar o envio de ${recs.length} imagem(ns) para OCR?`, b: `O lote (${kb.toFixed(0)} KB no total) será enviado para leitura por <b>${esc(prProvTxt())}</b>. Prints podem conter <b>nomes, CNPJ, valores e dados de contatos</b>. É uma única confirmação para todo o lote; imagens idênticas já lidas não são reenviadas. O texto lido é tratado apenas como dado, nunca como instrução.<br><label class="sm" style="display:block;margin-top:8px"><input type="checkbox" id="pr_sess"> Autorizar também as próximas imagens deste cliente nesta sessão (sem nova pergunta)</label>`, ok: ['prAutOk', 'Autorizar lote e ler', 'pri'], cancel: 'prAutNo' };
  UI.pr.pend = { ids, key }; UI.confirm = 'prauth'; render();
}
function prEnfileirar(ids) {
  ids.map(id => S.ocr.find(o => o.id === id)).filter(Boolean).forEach(r => { if (r.estado === 'ilegivel' || r.estado === 'erro' || r.estado === 'autorizar' || r.estado === 'aguardando_resposta' || r.estado === 'lido') { r.estado = 'fila'; r.erro = null; r.autorizadoEm = nowISO(); touchG('ocr', r.id); } });
  prKick(); render();
}
function prKick() {
  const U = UI.pr; if (!prOcrPronto().ok) return;
  while (U.run < PR_CONC) { const rec = S.ocr.find(o => o.origem === 'print' && o.estado === 'fila' && !U.inf.has(o.id)); if (!rec) break; U.run++; U.inf.add(rec.id); prRodar(rec); }
}
async function prRodar(rec) {
  try { await ocrEnviar(rec); if (rec.estado === 'lido') prPos(rec); else if (rec.estado === 'ilegivel') prAgenda(rec.cli, rec.id); }
  catch (e) { rec.estado = 'erro'; rec.erro = String(e.message || e).slice(0, 300); touchG('ocr', rec.id); }
  finally { UI.pr.run--; UI.pr.inf.delete(rec.id); prKick(); render(); }
}
function prRecuperar() { /* após recarregar, "processando" sem trabalho em andamento volta para a fila (já autorizado) */
  S.ocr.filter(o => o.origem === 'print' && o.estado === 'lendo' && !UI.pr.inf.has(o.id)).forEach(o => { o.estado = 'fila'; touchG('ocr', o.id); });
}

/* ---------- extração estruturada (regras locais; o texto é dado) ---------- */
const PR_LAB = [
  ['code', /^(cod(igo)?( (do )?(cliente|totvs))?|id (do )?cliente|cod cli(ente)?|conta( totvs)?|cliente)$/], ['name', /^(razao social|nome( do)? cliente|nome fantasia|fantasia|empresa|nome empresarial|cliente)$/],
  ['cnpj', /^(cnpj|cnpj\/cpf|cpf\/cnpj)$/], ['seg', /^(segmento|ramo( de atividade)?|atividade( principal)?|cnae( principal)?|setor( de atuacao)?)$/],
  ['city', /^(cidade|municipio)$/], ['uf', /^(uf|estado)$/], ['size', /^(porte|porte da empresa)$/], ['site', /^(site|website|home ?page|url)$/],
  ['release', /^(release|versao( do)? (protheus|sistema|erp)|versao)$/], ['regime', /^(regime( tributario)?|tributacao)$/],
  ['email', /^(e-?mail|email)$/], ['tel', /^(telefone|fone|celular|whatsapp|tel)$/], ['contato', /^(contato|responsavel|nome( do)? contato|interlocutor|solicitante)$/], ['cargo', /^(cargo|funcao|departamento)$/]
];
const PR_FAM = [['data', /data|vigenc|inicio|fim|vencimento|renov|emiss|atualiz|abertura/], ['quantidade', /usuari|licen|filia|funcion|colabor|qtd|quantidade|ambiente|total de|numero de/], ['contrato', /contrato|plano|sla|mensalidade|valor|nuvem|cloud|licenciamento|suporte|vigencia|modalidade/], ['dor', /obs|histor|ocorr|problem|dificuld|reclam|pendenc|motivo|assunto|descri|chamado|necessid|\bdor\b|solicit|retrabalho/], ['produto', /produto|modulo|sistema|solucao|servico|ferramenta|aplicativo/]];
const PR_V = {
  code: v => { v = v.trim().toUpperCase(); return /^[A-Z]{0,2}\d{3,8}$/.test(v) ? v : null; },
  cnpj: v => { const d = digits(v); return d.length === 14 && validCnpj(d) ? d : null; },
  uf: v => { v = v.trim().toUpperCase(); return UFS.includes(v) ? v : null; },
  site: v => { v = v.trim(); return /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(v) ? (/^https?:/i.test(v) ? v : 'https://' + v).slice(0, 200) : null; },
  release: v => (v.match(/12\.1\.\d{2,4}/) || [])[0] || null,
  regime: v => { const n = prNorm(v); return /simples/.test(n) ? 'Simples Nacional' : /presumido/.test(n) ? 'Lucro Presumido' : /lucro real|^real$/.test(n) ? 'Lucro Real' : null; },
  txt: v => { v = v.replace(/\s+/g, ' ').trim(); return v.length >= 2 && v.length <= 80 && !/^[\d\W]+$/.test(v) && !/ \| /.test(v) ? v : null; }
};
PR_V.seg = PR_V.city = PR_V.size = PR_V.txt;
function prValida(campo, v, c) {
  const x = PR_V[campo]?.(String(v ?? '')); if (x == null) return { ok: false, msg: `Valor inválido para ${PR_CAMPO[campo] || campo}.` };
  if (campo === 'cnpj' && Object.values(S.clients).some(o => o.key !== c.key && o.cnpj === x)) return { ok: false, msg: 'Este CNPJ já pertence a outro cliente da carteira.' };
  if (campo === 'code' && Object.values(S.clients).some(o => o.key !== c.key && o.code && norm(o.code) === norm(x))) return { ok: false, msg: 'Este código já pertence a outro cliente da carteira.' };
  return { ok: true, v: x };
}
const prVazio = (c, f) => !String(f === 'cnpj' ? (c.cnpj || c.cnpjRaw || '') : c[f] ?? '').trim();
const prAtual = (c, f) => f === 'cnpj' ? (c.cnpj || c.cnpjRaw || '') : c[f] ?? '';
function prExtrair(rec, c) {
  const texto = prTxt(rec), L = texto.split(/\r?\n/), ev = [], cand = [], contatos = []; let cur = null;
  const push = (tipo, valor, i, x = {}) => { if (ev.length >= 150 || !String(valor ?? '').trim()) return; ev.push({ tipo, valor: String(valor).replace(/\s+/g, ' ').trim().slice(0, 300), trecho: (L[i] || '').trim().slice(0, 240), linha: i + 1, ...x }); };
  const usadas = new Set(), kv = [];
  for (let i = 0; i < L.length;) {
    if (!/ \| /.test(L[i])) { i++; continue; } let j = i; while (j < L.length && / \| /.test(L[j])) j++;
    const rows = L.slice(i, j).map(l => l.split(/ \| /).map(s => s.trim())), n2 = rows.every(r => r.length === 2);
    if (n2) rows.forEach((r, k) => { if (r[0] && r[1] && r[0].length <= 40) kv.push([i + k, r[0], r[1]]); });
    else if (j - i >= 2) { push('tabela', rows[0].join(' | '), i, { linhas: j - i - 1, amostra: rows.slice(1, 4).map(r => r.join(' | ')).join(' // ').slice(0, 240) }); rows.slice(1).forEach((r, k) => findProducts(r.join(' '), {}).forEach(p => push('produto', p.nome, i + 1 + k, { interp: true, term: p.term }))); }
    for (let k = i; k < j; k++) usadas.add(k); i = j;
  }
  L.forEach((l, i) => { if (usadas.has(i)) return; const m = l.match(/^\s*([A-Za-zÀ-ÿ][^:|]{0,38}?)\s*[:：]\s*(\S.*)$/); if (m) kv.push([i, m[1], m[2].trim()]); });
  kv.sort((a, b) => a[0] - b[0]);
  const addC = (campo, valor, label, i) => cand.push({ campo, valor: String(valor).trim(), label, linha: i + 1, trecho: (L[i] || '').trim().slice(0, 240) });
  for (const [i, k, v] of kv) {
    const lab = prNorm(k).replace(/[^a-z0-9\/ -]/g, '').trim(), rule = PR_LAB.find(([, re]) => re.test(lab));
    if (rule) {
      const f = rule[0];
      if (f === 'code' || f === 'name') { if (f === 'code' && /^[A-Za-z]{0,2}\d{3,8}$/.test(v.trim())) addC('code', v, k, i); else if (f === 'name' || lab === 'cliente') { if (!PR_V.txt(v)) continue; push('campo', `${k}: ${v}`, i, { nomeLido: v }); } }
      else if (f === 'contato') { cur = { nome: v }; contatos.push({ ...cur, i }); cur = contatos[contatos.length - 1]; }
      else if (f === 'cargo') { if (cur && !cur.cargo) cur.cargo = v; else push('campo', `${k}: ${v}`, i); }
      else if (f === 'email') { if (cur && !cur.email) cur.email = v; else { cur = { email: v, i }; contatos.push(cur); } }
      else if (f === 'tel') { if (cur && !cur.tel) cur.tel = v; else { cur = { tel: v, i }; contatos.push(cur); } }
      else addC(f, v, k, i);
      continue;
    }
    const fam = (PR_FAM.find(([, re]) => re.test(lab)) || [])[0];
    if (fam === 'data' && /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(v)) push('data', `${k}: ${v}`, i, { aviso: 'Data exibida na tela: pode ser a da operação, não a de atualização do cadastro.' });
    else if (fam === 'quantidade' && /\d/.test(v)) push('quantidade', `${k}: ${v}`, i);
    else if (fam === 'contrato') push(/\d,\d{2}/.test(v) ? 'valor' : 'contrato', `${k}: ${v}`, i, /\d,\d{2}/.test(v) ? { aviso: 'Valor exibido em tela: não é faturamento confirmado.' } : {});
    else if (fam === 'dor') push('dor', `${k}: ${v}`, i);
    else if (fam === 'produto') { push('produto', `${k}: ${v}`, i, { interp: true }); }
    else if (v.length >= 2 && v.length <= 160 && /[A-Za-zÀ-ÿ0-9]/.test(v)) push('campo', `${k}: ${v}`, i);
  }
  const em = [...texto.matchAll(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g)].map(m => m[0]); em.forEach(e => { if (!contatos.some(x => x.email === e)) contatos.push({ email: e, i: Math.max(0, L.findIndex(l => l.includes(e))) }); });
  contatos.forEach(x => push('contato', [x.nome, x.cargo, x.email, x.tel].filter(Boolean).join(' — '), x.i || 0));
  const seen = new Set(); findProducts(texto, {}).forEach(p => { if (seen.has(p.id)) return; seen.add(p.id); const ix = texto.toLowerCase().indexOf(String(p.term).toLowerCase()); push('produto', p.nome, Math.max(0, texto.slice(0, Math.max(0, ix)).split('\n').length - 1), { interp: true, term: p.term, aviso: 'Menção em tela: não prova contratação nem uso efetivo.' }); });
  const rel = texto.match(/release\s*[:\-]?\s*(12\.1\.\d{2,4})/i); if (rel && !cand.some(x => x.campo === 'release')) addC('release', rel[1], 'Release', Math.max(0, texto.slice(0, rel.index).split('\n').length - 1));
  /* identificação: este cliente × outras empresas */
  const mt = matchDoc(texto, idx()), self = mt.cands.find(x => x.key === c.key), outros = mt.cands.filter(x => x.key !== c.key && x.state === 'confirmado'), roles = cnpjRoles(texto);
  const nomeLido = (ev.find(e => e.nomeLido) || {}).nomeLido, nomeDiverge = nomeLido && !self && !normName(nomeLido).includes(normName(c.name)) && !normName(c.name).includes(normName(nomeLido));
  [...roles].forEach(([d, papel]) => { if (d === c.cnpj || papel === 'emissor' || (idx().byCnpj.get(d) || []).includes(c.key)) return; push('outra_empresa', `CNPJ ${fmtCnpj(d)} (${papel === 'faturado' ? 'cliente/faturado' : 'apenas citado'})${(idx().byCnpj.get(d) || []).length ? ' — outra empresa da carteira' : ' — fora da carteira'}`, Math.max(0, L.findIndex(l => digits(l).includes(d)))); });
  if (nomeDiverge) push('outra_empresa', `Razão social lida na tela difere do cliente: ${nomeLido}`, L.findIndex(l => l.includes(nomeLido)));
  let est = self?.state === 'confirmado' ? 'confirmado' : self ? 'provavel' : (outros.length || nomeDiverge) ? 'outra' : 'sem';
  if (self && outros.length) est = 'misto'; if (rec.identManual) est = 'confirmado';
  rec.ident = { estado: est, por: rec.identManual ? 'confirmado por você' : self ? self.by : outros.length ? 'identificadores de outra empresa: ' + outros.map(o => o.by).join('; ') : nomeDiverge ? 'razão social diferente' : 'nenhum identificador do cliente na imagem' };
  /* sugestões de preenchimento */
  const prior = rec.sug || [], sug = [], porCampo = {};
  cand.forEach(x => { (porCampo[x.campo] ||= []).push(x); });
  Object.entries(porCampo).forEach(([f, xs]) => {
    if (!PR_CAMPO[f]) return; const vals = [...new Set(xs.map(x => prNorm(x.valor)))], amb = vals.length > 1;
    xs.forEach((x, n) => {
      const val = PR_V[f]?.(x.valor); if (val == null) { push('campo', `${x.label}: ${x.valor} (formato não reconhecido para ${PR_CAMPO[f]}; não foi proposto)`, x.linha - 1); return; }
      if (n > 0 && prNorm(val) === prNorm(xs[0].valor)) return;
      const antigo = prior.find(p => p.campo === f && prNorm(p.valor) === prNorm(val));
      if (antigo && ['aplicada', 'aceita', 'rejeitada', 'desfeita'].includes(antigo.estado)) { sug.push(antigo); return; }
      const rotulado = true, ok = est === 'confirmado' || (est === 'provavel' && !PR_CRIT.includes(f)), conf = ok && rotulado && !amb ? 'alta' : 'media';
      const s = { id: antigo?.id || 'sg_' + uid(), campo: f, valor: val, label: x.label, linha: x.linha, trecho: x.trecho, conf, estado: 'pendente', at: nowISO(), metodo: PR_METODO };
      if (est === 'outra') s.estado = 'pendente'; else if (!prVazio(c, f)) s.estado = prNorm(prAtual(c, f)) === prNorm(val) ? 'confirma' : 'conflito'; else if (conf === 'alta' && rec.usar !== false && est !== 'outra') s.estado = 'aplicada';
      sug.push(s);
    });
  });
  prior.filter(p => p.ap && !p.desfeito && !sug.includes(p)).forEach(p => { p.obsoleta = true; sug.push(p); });
  rec.ev = ev; rec.sug = sug; rec.extraidoEm = nowISO(); rec.metodo = PR_METODO;
  sug.filter(s => s.estado === 'aplicada' && !s.ap).forEach(s => prGravaCampo(c, rec, s, 'auto'));
  return rec;
}
function prGravaCampo(c, rec, s, modo) {
  const f = s.campo, de = prAtual(c, f); c.prFill ||= {};
  if (f === 'cnpj') { c.cnpj = s.valor; c.cnpjRaw = ''; } else c[f] = s.valor;
  s.ap = true; s.aplicadoEm = nowISO(); s.de = de;
  c.prFill[f] = { rec: rec.id, imagem: rec.nome, sug: s.id, de, para: s.valor, trecho: s.trecho, linha: s.linha, at: s.aplicadoEm, extraido: s.at, metodo: s.metodo, conf: s.conf, modo, imp: rec.imp };
  const imp = prImp(c, rec.imp); if (imp) imp.ap.push({ f, de, para: s.valor, rec: rec.id, sug: s.id });
}

/* ---------- pós-OCR: extrai, preenche, agenda reavaliação do raio-X ---------- */
function prPos(rec) {
  const c = S.clients[rec.cli]; if (!c) return;
  rec.usar = rec.usar !== false; prExtrair(rec, c); if (rec.ident.estado === 'outra' && !rec.usarManual) rec.usar = false;
  touchG('ocr', rec.id); touchC(c.key); prAgenda(c.key, rec.id);
}
function prAgenda(key, id) {
  const A = UI.pr.at[key] ||= { t: null, ids: new Set() }; A.ids.add(id); clearTimeout(A.t);
  const tick = () => {
    const c = S.clients[key]; if (!c) { delete UI.pr.at[key]; return; }
    if (S.ocr.some(o => o.origem === 'print' && o.cli === key && ['lendo', 'fila'].includes(o.estado) && prOcrPronto().ok)) { A.t = setTimeout(tick, 1500); return; }
    const n = A.ids.size; A.ids.clear(); runAnalysis(c, `Prints: ${n} imagem(ns) processada(s)`); touchC(key); render();
  };
  A.t = setTimeout(tick, 700);
}
function prSyncDocs(c) { /* texto dos prints entra na análise sem ser gravado dentro do cliente (evita estourar o limite do registro) */
  c.docs = (c.docs || []).filter(d => !d.prv);
  prRecs(c).filter(o => o.estado === 'lido' && o.usar !== false && prTxt(o).trim()).forEach(o => { const t = prTxt(o); c.docs.push({ id: 'prd_' + o.id, name: `${PR_NOME} — ${o.nome}`, hash: o.hash, at: o.at, text: t.slice(0, 12000), trunc: t.length > 12000, state: 'confirmado', by: 'print anexado a este cliente (OCR)', ocr: true, prPrint: true, prv: true, ocrId: o.id, corrigido: !!o.textoCorrigido }); });
}

/* ---------- revisão de sugestões ---------- */
function prSugAcao(recId, sugId, acao, valor) {
  const rec = S.ocr.find(o => o.id === recId), c = S.clients[rec?.cli], s = rec?.sug?.find(x => x.id === sugId); if (!s || !c) return;
  if (acao === 'rejeitar') { s.estado = 'rejeitada'; s.decididoEm = nowISO(); touchG('ocr', rec.id); return render(); }
  const v = prValida(s.campo, valor ?? s.valor, c); if (!v.ok) return toast(v.msg);
  if (!prVazio(c, s.campo) && c.edits?.[s.campo] && !confirm(`${PR_CAMPO[s.campo]} foi corrigido manualmente por você. Substituir pelo valor lido no print?`)) return;
  s.valor = v.v; s.estado = 'aceita'; s.decididoEm = nowISO(); prGravaCampo(c, rec, s, 'manual'); touchG('ocr', rec.id); touchC(c.key);
  runAnalysis(c, `Prints: ${PR_CAMPO[s.campo]} aceito de “${rec.nome}”`); touchC(c.key); render();
}
function prAceitarTodas(recId) {
  const rec = S.ocr.find(o => o.id === recId), c = S.clients[rec?.cli]; if (!rec || !c) return; let n = 0;
  (rec.sug || []).filter(s => s.estado === 'pendente' && prVazio(c, s.campo)).forEach(s => { const v = prValida(s.campo, s.valor, c); if (!v.ok) return; s.valor = v.v; s.estado = 'aceita'; s.decididoEm = nowISO(); prGravaCampo(c, rec, s, 'manual'); n++; });
  if (rec.ident?.estado !== 'confirmado' && n) { rec.identManual = true; rec.usarManual = true; rec.usar = true; prExtrair(rec, c); }
  touchG('ocr', rec.id); touchC(c.key); runAnalysis(c, `Prints: ${n} sugestão(ões) aceita(s) de “${rec.nome}”`); touchC(c.key); render(); toast(n ? `${n} campo(s) preenchido(s) a partir do print.` : 'Nenhuma sugestão aplicável (conflitos exigem decisão individual).');
}
function prEsteCliente(recId) { const rec = S.ocr.find(o => o.id === recId), c = S.clients[rec?.cli]; if (!rec || !c) return; rec.identManual = true; rec.usarManual = true; rec.usar = true; prExtrair(rec, c); touchG('ocr', rec.id); prAgenda(c.key, rec.id); render(); }
function prUsar(recId, on) { const rec = S.ocr.find(o => o.id === recId), c = S.clients[rec?.cli]; if (!rec || !c) return; rec.usar = on; rec.usarManual = on; touchG('ocr', rec.id); runAnalysis(c, `Prints: “${rec.nome}” ${on ? 'incluída no' : 'retirada do'} raio-X`); touchC(c.key); render(); }
function prMover(recId, key) {
  const rec = S.ocr.find(o => o.id === recId), novo = S.clients[key], velho = S.clients[rec?.cli]; if (!rec || !novo || !velho || velho.key === key) return toast('Escolha o cliente de destino.');
  prReverterDe(velho, rec, true); const imp = prImp(velho, rec.imp); if (imp) imp.recs = imp.recs.filter(x => x !== rec.id);
  rec.cli = key; rec.assoc = { key, por: 'movida manualmente', at: nowISO() }; delete rec.identManual; delete rec.usarManual; rec.usar = true; rec.imp = null; rec.sug = [];
  prExtrair(rec, novo); touchG('ocr', rec.id); touchC(velho.key); touchC(key); runAnalysis(velho, 'Prints: imagem movida para outro cliente'); runAnalysis(novo, 'Prints: imagem recebida de outro cliente'); touchC(velho.key); touchC(key); render(); toast(`Imagem movida para ${novo.name}.`);
}

/* ---------- reversão (sem apagar modificações posteriores) ---------- */
function prReverterDe(c, rec, soImagem) {
  let rev = 0, mant = 0;
  (rec.sug || []).filter(s => s.ap && !s.desfeito).forEach(s => {
    const f = s.campo, atual = prAtual(c, f);
    if (prNorm(atual) === prNorm(s.valor) && c.prFill?.[f]?.sug === s.id) { if (f === 'cnpj') { c.cnpj = s.de && validCnpj(digits(s.de)) ? digits(s.de) : ''; c.cnpjRaw = s.de && !c.cnpj ? s.de : ''; } else c[f] = s.de || ''; delete c.prFill[f]; s.estado = 'desfeita'; s.desfeito = 'revertido'; rev++; }
    else { s.desfeito = 'mantido: alterado depois'; mant++; }
  });
  return { rev, mant };
}
function prDesfazerImp(key, impId) {
  const c = S.clients[key], imp = c && prImp(c, impId); if (!imp) return; let rev = 0, mant = 0;
  imp.recs.map(id => S.ocr.find(o => o.id === id)).filter(Boolean).forEach(rec => { const r = prReverterDe(c, rec); rev += r.rev; mant += r.mant; rec.usar = false; rec.usarManual = false; touchG('ocr', rec.id); });
  imp.desfeita = nowISO(); imp.ap.forEach(a => { a.desfeito = true; });
  touchC(key); runAnalysis(c, 'Importação de prints desfeita'); touchC(key); render();
  toast(`Importação desfeita: ${rev} campo(s) revertido(s)${mant ? `, ${mant} mantido(s) por terem sido alterados depois` : ''}. As imagens continuam guardadas, fora do raio-X.`);
}

/* ---------- exclusão com dependências ---------- */
function prDeps(c, rec) {
  const nome = `${PR_NOME} — ${rec.nome}`;
  return { campos: (rec.sug || []).filter(s => s.ap && !s.desfeito && c.prFill?.[s.campo]?.sug === s.id), ev: (rec.ev || []).length, noRaioX: rec.usar !== false && rec.estado === 'lido', opps: (c.opps || []).filter(o => (o.evInd || []).some(e => e.src === nome)).map(o => o.nome) };
}
function prExcluirPrep(recId) {
  const rec = S.ocr.find(o => o.id === recId), c = S.clients[rec?.cli]; if (!rec || !c) return; const d = prDeps(c, rec);
  const li = [d.campos.length ? `<li><b>${d.campos.length} campo(s) preenchido(s)</b>: ${d.campos.map(s => `${esc(PR_CAMPO[s.campo])} = ${esc(s.valor)}`).join('; ')}</li>` : '', d.ev ? `<li><b>${d.ev} informação(ões) estruturada(s)</b> no raio-X</li>` : '', d.opps.length ? `<li><b>${d.opps.length} diagnóstico(s)/oportunidade(s)</b> com esta imagem como evidência: ${d.opps.map(esc).join('; ')} (serão reavaliados; decisões suas são preservadas)</li>` : ''].join('');
  UI.pr.del = recId;
  MODALS.prdel = { t: `Excluir “${esc(rec.nome)}”?`, b: li ? `Dependem desta imagem:<ul style="margin:6px 0 0 18px">${li}</ul>Escolha o que fazer com os campos já preenchidos.` : 'Nenhum campo, evidência ou diagnóstico depende desta imagem.', ok: ['prDelRev', d.campos.length ? 'Excluir e reverter os campos' : 'Excluir', 'pri'], alt: d.campos.length ? ['prDelKeep', 'Excluir e manter os campos (origem registrada)', 'ghost'] : null, cancel: 'prDelNo' };
  UI.confirm = 'prdel'; render();
}
function prExcluir(recId, reverter) {
  const rec = S.ocr.find(o => o.id === recId), c = S.clients[rec?.cli]; UI.confirm = null; UI.pr.del = null; if (!rec || !c) return render();
  const d = prDeps(c, rec); let r = { rev: 0, mant: 0 };
  if (reverter) r = prReverterDe(c, rec); else d.campos.forEach(s => { const p = c.prFill?.[s.campo]; if (p && p.sug === s.id) { p.origemExcluida = true; p.excluidaEm = nowISO(); } });
  const imp = prImp(c, rec.imp); if (imp) { imp.recs = imp.recs.filter(x => x !== rec.id); }
  ocrimgDrop(rec); S.ocr = S.ocr.filter(o => o.id !== rec.id); dropG('ocr', rec.id);
  touchC(c.key); runAnalysis(c, `Print excluído: ${rec.nome}`); touchC(c.key); render();
  toast(`Imagem excluída. ${reverter ? `${r.rev} campo(s) revertido(s)${r.mant ? `, ${r.mant} mantido(s) por edição posterior` : ''}.` : d.campos.length ? `${d.campos.length} campo(s) mantido(s) com a origem registrada.` : ''}${d.opps.length ? ' Diagnósticos reavaliados.' : ''}`);
}

/* ---------- texto lido: corrigir e reprocessar ---------- */
function prTexto(recId, v) {
  const rec = S.ocr.find(o => o.id === recId), c = S.clients[rec?.cli]; if (!rec || !c) return; v = String(v).slice(0, OC_TXT);
  if (v === rec.texto) delete rec.textoCorrigido; else { rec.textoCorrigido = v; rec.corrigidoEm = nowISO(); }
  prExtrair(rec, c); touchG('ocr', rec.id); touchC(c.key); prAgenda(c.key, rec.id); render();
}
function prReproc(recId) {
  const rec = S.ocr.find(o => o.id === recId); if (!rec) return;
  if (!prOcrPronto().ok) return toast('OCR não configurado: veja a ação necessária no painel.');
  if (rec.textoCorrigido && !confirm('A correção manual do texto será descartada ao reprocessar. Continuar?')) return;
  delete rec.textoCorrigido; rec.sug = (rec.sug || []).filter(s => s.estado !== 'desfeita'); prSolicitar([recId], rec.cli);
}
function prRepetirFalhas(key) { const ids = prRecs(S.clients[key]).filter(o => ['erro', 'aguardando_resposta'].includes(o.estado)).map(o => o.id); if (!ids.length) return toast('Nenhuma imagem com erro.'); prEnfileirar(ids); }

/* ---------- interface ---------- */
function prResumo(c) {
  const R = prRecs(c); let ap = 0, ev = 0, cf = 0, pe = 0;
  R.forEach(r => { (r.sug || []).forEach(s => { if (['aplicada', 'aceita'].includes(s.estado) && !s.desfeito) ap++; if (s.estado === 'conflito') cf++; if (s.estado === 'pendente') pe++; }); if (r.estado === 'lido' && r.usar !== false) ev += (r.ev || []).length; if (['ilegivel'].includes(r.estado) || ['outra', 'sem', 'misto'].includes(r.ident?.estado) && r.estado === 'lido') pe++; });
  return { ap, ev, cf, pe, n: R.length };
}
function prCard(c, rec) {
  const e = prEstado(rec), [el, ek] = PR_EST[e], pend = prPend(rec), k = esc(c.key), id = esc(rec.id);
  const dep = (rec.ev || []).length;
  let h = `<div class="card pr-it" data-id="${id}"><div class="row" style="gap:10px;align-items:flex-start">${rec.thumb ? `<img loading="lazy" decoding="async" src="${rec.thumb}" alt="Miniatura de ${esc(rec.nome)}" class="pr-th" data-a="prBig" data-id="${id}" tabindex="0" role="button" aria-label="Ampliar ${esc(rec.nome)}">` : `<button class="btn ghost sm pr-th" data-a="prBig" data-id="${id}">Ver</button>`}
  <div style="flex:1;min-width:200px"><b>${esc(rec.nome)}</b> <span class="muted sm">${(rec.tam / 1024).toFixed(0)} KB • ${esc(dtBR(rec.at))}</span><div>${pill(el, ek)} ${rec.estado === 'autorizar' ? pill('aguardando autorização do envio', 'warn') : ''}${rec.reuso ? pill('texto reaproveitado de imagem idêntica', 'info') : ''}${rec.textoCorrigido ? pill('texto corrigido por você', 'warn') : ''}${rec.usar === false && rec.estado === 'lido' ? pill('fora do raio-X', 'off') : ''}${rec.ident && rec.estado === 'lido' ? pill(rec.ident.estado === 'confirmado' ? 'cliente confirmado na imagem' : rec.ident.estado === 'provavel' ? 'cliente provável (nome)' : rec.ident.estado === 'outra' ? 'possível outra empresa' : rec.ident.estado === 'misto' ? 'cita mais de uma empresa' : 'cliente não identificado', rec.ident.estado === 'confirmado' ? 'ok' : rec.ident.estado === 'provavel' ? 'info' : 'warn') : ''}</div></div>
  <div class="row sm" style="gap:4px"><button class="btn ghost sm" data-a="prBig" data-id="${id}">Ampliar</button><button class="btn ghost sm" data-a="prReproc" data-id="${id}" ${['proc'].includes(e) ? 'disabled' : ''}>Reprocessar</button><button class="btn ghost sm" data-a="prDel" data-id="${id}">Excluir</button></div></div>`;
  if (rec.erro) h += `<div class="alert b sm" role="alert">${esc(rec.erro)}${rec.estado === 'erro' ? ' — use “Repetir os que falharam” ou “Reprocessar”; as demais imagens não foram afetadas.' : ''}</div>`;
  if (pend.length) h += `<div class="alert sm">${pend.map(esc).join('<br>')}${rec.ident?.estado && rec.ident.estado !== 'confirmado' && rec.ident.estado !== 'provavel' ? ` <button class="btn ghost sm" data-a="prEste" data-id="${id}">Esta imagem é deste cliente</button>` : ''}</div>`;
  if (rec.estado === 'lido') {
    const sug = rec.sug || [], ps = sug.filter(s => !['confirma'].includes(s.estado));
    if (rec.ident?.estado === 'outra' || rec.ident?.estado === 'misto') h += prMoverSel(c, rec);
    if (ps.length) h += `<details class="sm" ${ps.some(s => ['pendente', 'conflito'].includes(s.estado)) ? 'open' : ''}><summary><b>Sugestões de preenchimento (${ps.length})</b> <span class="muted">método: ${esc(PR_METODO)}</span> ${ps.some(s => s.estado === 'pendente' && prVazio(c, s.campo)) ? `<button class="btn ghost sm" data-a="prAceitarTodas" data-id="${id}">Aceitar as pendentes</button>` : ''}</summary><div class="tw" style="max-height:none"><table><thead><tr><th>Campo</th><th>Valor lido</th><th>Atual</th><th>Origem</th><th>Situação</th><th></th></tr></thead><tbody>${ps.map(s => `<tr data-sid="${esc(s.id)}"><td>${esc(PR_CAMPO[s.campo])}</td><td>${['pendente', 'conflito'].includes(s.estado) ? `<input type="text" value="${esc(s.valor)}" data-f="prval" aria-label="Valor de ${esc(PR_CAMPO[s.campo])}" style="width:150px">` : esc(s.valor)}</td><td class="sm">${esc(String(prAtual(c, s.campo) || '—'))}</td><td class="sm or">“${esc(s.trecho)}” <div class="muted">linha ${s.linha} • ${esc(rec.nome)} • ${esc(fmtDate(s.at))} • confiança ${s.conf}</div></td><td>${pill(PR_SUG[s.estado][0], PR_SUG[s.estado][1])}${s.desfeito ? ` <span class="muted sm">${esc(s.desfeito)}</span>` : ''}</td><td class="nw">${['pendente', 'conflito'].includes(s.estado) ? `<button class="btn pri sm" data-a="prAceitar" data-id="${id}" data-s="${esc(s.id)}">Aceitar</button> <button class="btn ghost sm" data-a="prRejeitar" data-id="${id}" data-s="${esc(s.id)}">Rejeitar</button>` : ''}</td></tr>`).join('')}</tbody></table></div></details>`;
    if (dep) { const G = {}; rec.ev.forEach(x => (G[x.tipo] ||= []).push(x)); h += `<details class="sm"><summary><b>Informações estruturadas (${dep})</b> <span class="muted">${esc(PR_NOME)} — informação extraída; não é fato confirmado</span></summary>${Object.entries(G).map(([t, a]) => `<h4>${esc(PR_EVT[t] || t)} (${a.length})</h4><ul>${a.slice(0, 25).map(x => `<li>${esc(x.valor)} <span class="muted">— “${esc(x.trecho)}” (linha ${x.linha})${x.interp ? ' • interpretação' : ''}</span>${x.aviso ? `<div class="muted">${esc(x.aviso)}</div>` : ''}${x.amostra ? `<div class="muted">${x.linhas} linha(s): ${esc(x.amostra)}</div>` : ''}</li>`).join('')}${a.length > 25 ? `<li class="muted">+ ${a.length - 25} omitida(s) desta lista (todas guardadas)</li>` : ''}</ul>`).join('')}</details>`; }
    h += `<details class="sm"><summary><b>Texto extraído</b> <span class="muted">${esc(rec.modelo || '')} • ${esc(fmtDate(rec.consultadoEm))}${rec.truncado ? ' • TRUNCADO pelo limite do provedor' : ''}${prTxt(rec).length > 12000 ? ' • a análise usa os primeiros 12.000 caracteres (o texto completo está guardado)' : ''}</span></summary><textarea data-c="prtxt" data-id="${id}" rows="8" style="width:100%;font-family:monospace;font-size:12px" aria-label="Texto extraído de ${esc(rec.nome)}">${esc(prTxt(rec))}</textarea><p class="muted sm">Ao sair do campo, a identificação, as sugestões e o raio-X são recalculados. O OCR pode errar dígitos e nomes.</p></details>`;
    h += `<div class="row sm">${rec.usar === false ? `<button class="btn ghost sm" data-a="prUsar" data-id="${id}" data-on="1">Incluir no raio-X</button>` : `<button class="btn ghost sm" data-a="prUsar" data-id="${id}" data-on="0">Retirar do raio-X</button>`}</div>`;
  }
  return h + '</div>';
}
function prMoverSel(c, rec) {
  const opts = clients().filter(x => x.key !== c.key).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 2000);
  return `<div class="row sm"><label>Mover para outro cliente <select data-id="prmv_${esc(rec.id)}"><option value="">Escolher…</option>${opts.map(x => `<option value="${esc(x.key)}">${esc(x.name)}${x.code ? ' • ' + esc(x.code) : ''}</option>`).join('')}</select></label><button class="btn ghost sm" data-a="prMover" data-id="${esc(rec.id)}">Mover</button></div>`;
}
function prPanel(c) {
  prRecuperar(); const R = prRecs(c), pr = prOcrPronto(), sm = prResumo(c), k = esc(c.key), U = UI.pr, cnt = { fila: 0, proc: 0, ok: 0, rev: 0, erro: 0 }; R.forEach(r => cnt[prEstado(r)]++);
  const lst = R.filter(r => !U.f || prEstado(r) === U.f), np = Math.max(1, Math.ceil(lst.length / PR_PAGE)); U.pg = Math.min(U.pg, np - 1);
  if (pr.ok && R.some(r => r.estado === 'fila') && U.run === 0) setTimeout(prKick, 0);
  const tam = R.reduce((a, r) => a + r.tam, 0), tot = S.ocr.filter(o => o.origem === 'print').length;
  const imps = (c.prImp || []).filter(i => i.recs.length || i.desfeita).slice(0, 5);
  return `<div class="card" id="prints"><div class="row"><h3>Imagens e prints</h3><span class="pill p-info">${R.length}</span><span class="sp"></span><button class="btn ghost sm" data-a="prColar" data-k="${k}">Colar da área de transferência</button></div>
  <label class="drop" data-drop="f-prints"><b>Selecione várias imagens, arraste-as aqui ou cole (Ctrl+V)</b><br><span class="muted sm">PNG, JPG/JPEG ou WebP. Sem limite fixo de quantidade; limite técnico de ${OC_MAX / 1048576} MB por imagem. Imagens podem ser adicionadas a qualquer momento.</span><input type="file" id="f-prints" data-c="prfiles" data-k="${k}" multiple accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" hidden></label>
  <p class="muted sm">Prints de sistemas sem integração alimentam o perfil e o raio-X deste cliente. A leitura é por OCR (${esc(prProvTxt())}) e só ocorre após <b>uma</b> autorização por lote. O que for lido fica rotulado como “${PR_NOME}”: <b>informação extraída</b> (o que está na tela), <b>interpretação</b> (rótulo→campo, menção a produto) e <b>hipótese comercial</b> (oportunidade do motor) são separadas; uma menção na tela não prova contratação, uso efetivo ou o processo inteiro. Armazenamento: ${R.length} imagem(ns) deste cliente (${(tam / 1048576).toFixed(1)} MB) e ${tot} na sua conta — sem limite de quantidade, mas sujeito à cota do banco do seu plano; falhas de gravação aparecem em “ERRO ao salvar”. O backup JSON não inclui as imagens.</p>
  ${pr.ok ? '' : `<div class="alert b sm" role="alert"><b>OCR não configurado.</b> ${esc(pr.acao)} Os arquivos estão guardados e serão lidos depois. ${pr.nav ? `<button class="btn ghost sm" data-a="nav" data-v="${pr.nav}">Abrir configuração</button>` : ''}</div>`}
  ${U.msg ? `<div class="alert i sm">${esc(U.msg)}</div>` : ''}
  ${R.length ? `<div class="row sm" style="gap:6px;margin:6px 0">${Object.entries(PR_EST).map(([e, [l, kk]]) => `<button class="btn ${U.f === e ? 'pri' : 'ghost'} sm" data-a="prFiltro" data-e="${e}" aria-pressed="${U.f === e}">${l} ${cnt[e]}</button>`).join('')}${U.f ? '<button class="btn ghost sm" data-a="prFiltro" data-e="">Todas</button>' : ''}<span class="sp"></span>${cnt.erro ? `<button class="btn sm" data-a="prFalhas" data-k="${k}">Repetir os que falharam (${cnt.erro})</button>` : ''}${R.some(r => r.estado === 'autorizar') && pr.ok ? `<button class="btn pri sm" data-a="prAutPend" data-k="${k}">Autorizar e ler as ${R.filter(r => r.estado === 'autorizar').length} pendente(s)</button>` : ''}${R.some(r => r.estado === 'fila') && pr.ok ? '<button class="btn ghost sm" data-a="prProc">Processar fila</button>' : ''}</div>
  <div class="grid g4" style="margin:8px 0"><div class="kpi m"><div class="v">${sm.ap}</div><div class="l">Campos preenchidos</div></div><div class="kpi"><div class="v">${sm.ev}</div><div class="l">Informações adicionadas ao raio-X</div></div><div class="kpi r"><div class="v">${sm.cf}</div><div class="l">Conflitos</div></div><div class="kpi w"><div class="v">${sm.pe}</div><div class="l">Pendências de revisão</div></div></div>
  ${imps.length ? `<details class="sm"><summary><b>Importações (${imps.length})</b> — desfazer reverte só o que não foi alterado depois</summary><ul>${imps.map(i => { const a = i.ap.filter(x => !x.desfeito).length; return `<li>${esc(fmtDate(i.at))}: ${i.recs.length} imagem(ns), ${i.ap.length} campo(s) preenchido(s)${i.desfeita ? ` ${pill('desfeita em ' + dtBR(i.desfeita), 'off')}` : ` <button class="btn ghost sm" data-a="prDesfazer" data-k="${k}" data-id="${esc(i.id)}">Desfazer importação</button>`}</li>`; }).join('')}</ul></details>` : ''}
  ${Object.keys(c.prFill || {}).length ? `<details class="sm"><summary><b>Campos preenchidos por prints (${Object.keys(c.prFill).length})</b></summary><div class="tw" style="max-height:none"><table><thead><tr><th>Campo</th><th>Valor</th><th>Imagem</th><th>Trecho</th><th>Quando / método</th></tr></thead><tbody>${Object.entries(c.prFill).map(([f, p]) => `<tr><td>${esc(PR_CAMPO[f] || f)}</td><td>${esc(p.para)}</td><td class="sm">${esc(p.imagem)}${p.origemExcluida ? ' <span class="muted">(imagem excluída; origem preservada)</span>' : ''}</td><td class="sm">“${esc(p.trecho)}” (linha ${p.linha})</td><td class="sm">${esc(fmtDate(p.at))} • ${p.modo === 'auto' ? 'automático' : 'aceito por você'} • ${esc(p.metodo)}</td></tr>`).join('')}</tbody></table></div></details>` : ''}
  ${lst.slice(U.pg * PR_PAGE, (U.pg + 1) * PR_PAGE).map(r => prCard(c, r)).join('') || '<p class="muted sm">Nenhuma imagem neste filtro.</p>'}
  ${np > 1 ? `<div class="row sm"><button class="btn ghost sm" data-a="prPag" data-d="-1" ${U.pg === 0 ? 'disabled' : ''}>← Anterior</button><span>Página ${U.pg + 1} de ${np} (${lst.length} imagens)</span><button class="btn ghost sm" data-a="prPag" data-d="1" ${U.pg >= np - 1 ? 'disabled' : ''}>Próxima →</button></div>` : ''}` : '<p class="muted sm">Nenhuma imagem anexada a este cliente ainda.</p>'}</div>`;
}
/* raio-X: o que veio de prints e o que mudou por causa deles */
function prRaioX(c) {
  const R = prRecs(c).filter(r => r.estado === 'lido' && r.usar !== false); if (!prRecs(c).length) return '';
  const G = {}; R.forEach(r => (r.ev || []).forEach(x => (G[x.tipo] ||= []).push({ ...x, img: r.nome }))); const nome = r => `${PR_NOME} — ${r}`;
  const sust = (c.opps || []).map(o => ({ o, im: [...new Set((o.evInd || []).filter(e => String(e.src).startsWith(PR_NOME)).map(e => String(e.src).slice(PR_NOME.length + 3)))] })).filter(x => x.im.length);
  const ch = c.lastChange && /^Prints|^Print |Importação de prints/.test(c.lastChange.reason || '') ? c.lastChange : null;
  return `<div class="card"><h3>Extraído de print por OCR</h3><p class="sm muted">${R.length} imagem(ns) em uso. Rótulos: <b>informação extraída</b> (o que a tela mostra), <b>interpretação</b> (mapeamento de rótulo/produto) e <b>hipótese comercial</b> (oportunidades abaixo). Um print isolado não comprova contratação, uso efetivo nem o processo completo.</p>
  ${ch ? `<div class="alert i sm"><b>O que mudou</b> (${esc(ch.reason)}, ${esc(dtBR(ch.at))}): ${ch.items.map(i => esc(i.t)).slice(0, 6).join('; ') || 'sem alteração nos diagnósticos'}</div>` : ''}
  ${sust.length ? `<h4>Diagnósticos e oportunidades sustentados por prints</h4><ul class="sm">${sust.map(x => `<li><b>${esc(x.o.nome)}</b> ${chip('HIPÓTESE')} ← ${x.im.map(esc).join(', ')}</li>`).join('')}</ul>` : '<p class="muted sm">Nenhum diagnóstico depende de prints neste momento.</p>'}
  ${Object.keys(G).length ? Object.entries(G).filter(([t]) => t !== 'outra_empresa').map(([t, a]) => `<details class="sm"><summary><b>${esc(PR_EVT[t] || t)}</b> (${a.length})</summary><ul>${a.slice(0, 15).map(x => `<li>${esc(x.valor)} <span class="muted">— ${esc(x.img)}, linha ${x.linha}</span> ${chip('NECESSITA VALIDAÇÃO')}</li>`).join('')}${a.length > 15 ? `<li class="muted">+ ${a.length - 15} na aba Fichas → Imagens e prints</li>` : ''}</ul></details>`).join('') : ''}
  <div class="row sm"><button class="btn ghost sm" data-a="ctab" data-v="fichas">Abrir Imagens e prints</button></div></div>`;
}

const PR_ACT = {
  prAutOk: () => { const p = UI.pr.pend; if (!p) return; if ($('#pr_sess')?.checked) UI.pr.auto[p.key] = true; UI.confirm = null; UI.pr.pend = null; prEnfileirar(p.ids); },
  prAutNo: () => { UI.confirm = null; UI.pr.pend = null; toast('Envio cancelado: nada foi enviado. As imagens continuam guardadas, aguardando autorização.'); render(); },
  prAutPend: t => { const c = S.clients[t.dataset.k]; if (c) prSolicitar(prRecs(c).filter(r => r.estado === 'autorizar').map(r => r.id), c.key); },
  prProc: () => { prKick(); render(); }, prFalhas: t => prRepetirFalhas(t.dataset.k),
  prFiltro: t => { UI.pr.f = t.dataset.e; UI.pr.pg = 0; render(); }, prPag: t => { UI.pr.pg = Math.max(0, UI.pr.pg + +t.dataset.d); render(); },
  prBig: t => { const rec = S.ocr.find(o => o.id === t.dataset.id); if (!rec) return; if (!ocrimgOk(rec)) { toast('Carregando imagem…'); ocrimgEnsure(rec).then(ok => { if (ok) PR_ACT.prBig(t); else toast('Não foi possível carregar a imagem original.'); }, () => toast('Não foi possível carregar a imagem original.')); return; } MODALS.prbig = { t: esc(rec.nome), b: `<div style="max-height:68vh;overflow:auto;border:1px solid var(--bd);border-radius:6px"><img id="prbigimg" alt="Imagem ampliada: ${esc(rec.nome)}" src="data:${rec.mime};base64,${ocImgB64(rec.id)}" style="max-width:100%"></div><p class="sm muted">${(rec.tam / 1024).toFixed(0)} KB • ${esc(dtBR(rec.at))}</p><button class="btn ghost sm" data-a="prZoom">Tamanho real / ajustar à janela</button>`, ok: ['prBigX', 'Fechar', 'pri'], cancel: 'prBigX', wide: true }; UI.confirm = 'prbig'; render(); },
  prBigX: () => { UI.confirm = null; render(); }, prZoom: () => { const i = $('#prbigimg'); if (i) i.style.maxWidth = i.style.maxWidth === 'none' ? '100%' : 'none'; },
  prReproc: t => prReproc(t.dataset.id), prDel: t => prExcluirPrep(t.dataset.id), prDelRev: () => prExcluir(UI.pr.del, true), prDelKeep: () => prExcluir(UI.pr.del, false), prDelNo: () => { UI.confirm = null; UI.pr.del = null; render(); },
  prAceitar: t => { const tr = t.closest('tr'); prSugAcao(t.dataset.id, t.dataset.s, 'aceitar', tr?.querySelector('[data-f=prval]')?.value); }, prRejeitar: t => prSugAcao(t.dataset.id, t.dataset.s, 'rejeitar'),
  prAceitarTodas: (t, e) => { e?.preventDefault(); prAceitarTodas(t.dataset.id); }, prEste: t => prEsteCliente(t.dataset.id), prUsar: t => prUsar(t.dataset.id, t.dataset.on === '1'),
  prMover: t => prMover(t.dataset.id, $(`select[data-id="prmv_${t.dataset.id}"]`)?.value), prDesfazer: t => prDesfazerImp(t.dataset.k, t.dataset.id),
  prColar: async t => { try { const its = await navigator.clipboard.read(), fs = []; for (const it of its) for (const ty of it.types) if (/^image\/(png|jpeg|webp)$/.test(ty)) fs.push(new File([await it.getType(ty)], 'image.' + ty.split('/')[1].replace('jpeg', 'jpg'), { type: ty })); if (!fs.length) return toast('Não há imagem na área de transferência. Copie um print e use Ctrl+V nesta página.'); prAdd(fs, t.dataset.k, true); } catch (e) { toast('O navegador não liberou a leitura da área de transferência: clique na página e use Ctrl+V.'); } }
};
document.addEventListener('paste', e => {
  if (UI.view !== 'cliente' || !UI.sel || !S.clients[UI.sel]) return; const tg = e.target; if (tg && /^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName) && !(tg.type === 'file')) return;
  const fs = [...(e.clipboardData?.items || [])].filter(i => i.kind === 'file' && /^image\/(png|jpeg|webp)$/.test(i.type)).map(i => i.getAsFile()).filter(Boolean); if (!fs.length) return;
  e.preventDefault(); prAdd(fs, UI.sel, true);
});
