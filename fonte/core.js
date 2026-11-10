/* ===== NÚCLEO: parsing, associação, análise ===== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const digits = s => String(s ?? '').replace(/\D/g, '');
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const fmtBRL = n => n == null || isNaN(n) ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = iso => iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

function safeUrl(u) { const t = String(u == null ? '' : u).trim(); return /^https?:\/\/[^\s<>"']+$/i.test(t) ? t : 'about:blank'; }
function parseNum(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  let s = String(v).replace(/R\$|\s/g, '').replace(/[^\d.,\-()]/g, '');
  if (!s) return null;
  let neg = /^\(.*\)$/.test(s) || s.startsWith('-'); s = s.replace(/[()\-]/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = parseFloat(s); return isNaN(n) ? null : neg ? -n : n;
}
const CNPJ_RE = /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g;
function validCnpj(c) {
  c = digits(c); if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  const calc = n => { let s = 0, p = n - 7; for (let i = 0; i < n; i++) { s += +c[i] * p--; if (p < 2) p = 9; } const r = s % 11; return r < 2 ? 0 : 11 - r; };
  return calc(12) === +c[12] && calc(13) === +c[13];
}
const fmtCnpj = c => { c = digits(c); return c.length === 14 ? c.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5') : c; };
const normName = s => norm(s).replace(/\b(ltda|s\/?a|sa|eireli|me|epp|cia|companhia|comercio|industria|e|de|do|da|dos|das)\b/g, ' ').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const safeKey = s => String(s).replace(/[^A-Za-z0-9_\-.~:@+]/g, '_').slice(0, 120) || 'x';

/* ---------- Leitura de arquivos ---------- */
/* Leitura com validação: limite de tamanho, bloqueio de executáveis e conferência da assinatura real (não só a extensão). Erro por arquivo; o lote continua. */
const ARQ_MAX = 80 * 1024 * 1024, ARQ_EXEC = /\.(exe|dll|bat|cmd|com|scr|msi|ps1|vbs|jar|sh|lnk|apk|app|js|jse|wsf|hta|iso)$/i;
function arqAssinatura(name, buf) {
  const u = new Uint8Array(buf, 0, Math.min(buf.byteLength, 1024)), ext = String(name).split('.').pop().toLowerCase(), at = (i, t) => t.every((x, k) => u[i + k] === x), asc = s => [...s].map(c => c.charCodeAt(0));
  if (ARQ_EXEC.test(name) || at(0, [0x4d, 0x5a]) || at(0, [0x7f, 0x45, 0x4c, 0x46]) || at(0, [0xcf, 0xfa, 0xed, 0xfe]) || at(0, [0xce, 0xfa, 0xed, 0xfe]) || at(0, [0xfe, 0xed, 0xfa, 0xce]) || at(0, [0xfe, 0xed, 0xfa, 0xcf]) || at(0, [0xca, 0xfe, 0xba, 0xbe])) return 'Arquivo executável/programa não é aceito. Anexe PDF, DOCX, PPTX, XLSX, CSV, TXT, HTML, JSON ou imagem.';
  if (ext === 'pdf' && !String.fromCharCode(...u).includes('%PDF')) return 'O arquivo não é um PDF válido (assinatura ausente). Reexporte o PDF.';
  if (['xlsx', 'docx', 'pptx'].includes(ext) && !at(0, [0x50, 0x4b])) return 'O arquivo não é um .' + ext + ' válido (assinatura ausente).';
  if (ext === 'png' && !at(0, [0x89, 0x50, 0x4e, 0x47])) return 'O arquivo não é um PNG válido.';
  if ((ext === 'jpg' || ext === 'jpeg') && !at(0, [0xff, 0xd8, 0xff])) return 'O arquivo não é um JPEG válido.';
  if (ext === 'webp' && !(at(0, asc('RIFF')) && at(8, asc('WEBP')))) return 'O arquivo não é um WEBP válido.';
  return '';
}
async function readBuf(file) {
  if (file.size > ARQ_MAX) throw new Error('"' + file.name + '" tem mais de 80 MB: divida ou reduza o arquivo e tente de novo.');
  const buf = await file.arrayBuffer(), m = arqAssinatura(file.name, buf); if (m) throw new Error('"' + file.name + '": ' + m);
  return buf;
}
async function sha(buf) { try { const h = await crypto.subtle.digest('SHA-256', buf); return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 24); } catch { let h = 0; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 7) h = (h * 31 + u[i]) | 0; return 'w' + (h >>> 0).toString(16) + u.length; } }
function decodeText(buf) { let t = new TextDecoder('utf-8').decode(buf); if (t.includes(String.fromCharCode(0xFFFD))) t = new TextDecoder('windows-1252').decode(buf); return t.replace(/^﻿/, ''); }
function parseCSV(text, forceSep) {
  const first = text.split(/\r?\n/, 1)[0] || ''; const sep = forceSep || [';', '\t', ',', '|'].map(c => [c, first.split(c).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === sep) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
/* Retorna {sheets:[{name, rows:[[...]]}]} para XLSX/CSV */
const OP0 = new Set(Object.getOwnPropertyNames(Object.prototype));
async function readTable(file, buf) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext === 'csv' || ext === 'txt' && /[;,\t]/.test(decodeText(buf).slice(0, 500))) return { sheets: [{ name: 'CSV', rows: parseCSV(decodeText(buf)) }] };
  if (!(await vend('xlsx'))) throw new Error('Biblioteca XLSX indisponível neste ambiente (CDN bloqueado?).');
  const p0 = Object.getOwnPropertyNames(Object.prototype).length; /* defesa em profundidade: CVE-2023-30533 (poluição de protótipo no SheetJS < 0.19.3) */
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  if (Object.getOwnPropertyNames(Object.prototype).length !== p0) { for (const k of Object.getOwnPropertyNames(Object.prototype)) if (!OP0.has(k)) delete Object.prototype[k]; throw new Error('Planilha rejeitada: tentativa de alterar objetos internos do navegador.'); }
  return { sheets: wb.SheetNames.map(n => ({ name: n, rows: XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '', blankrows: true }) })) };
}
/* PDF: devolve linhas {p, text} reconstruídas por coordenadas. PDFs escaneados (sem camada de texto) NÃO são lidos (sem OCR). */
async function readPdf(buf) {
  if (!(await vend('pdfjs'))) throw new Error('Biblioteca PDF indisponível neste ambiente (CDN bloqueado?).');
  let pdf, last;
  for (const src of [PDF_WORKER, PDF_WORKER_DIRECT]) { try { pdfjsLib.GlobalWorkerOptions.workerSrc = src; pdf = await pdfjsLib.getDocument({ data: buf.slice(0), isEvalSupported: false }).promise; break; } catch (e) { last = e; } }
  if (!pdf) throw last || new Error('Falha ao abrir o PDF.');
  const lines = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const tc = await (await pdf.getPage(p)).getTextContent(); const rows = [];
    for (const it of tc.items) { if (!it.str || !it.str.trim()) continue; const y = Math.round(it.transform[5]); let r = rows.find(r => Math.abs(r.y - y) <= 2); if (!r) rows.push(r = { y, it: [] }); r.it.push({ x: it.transform[4], s: it.str, w: it.width }); }
    rows.sort((a, b) => b.y - a.y).forEach(r => {
      r.it.sort((a, b) => a.x - b.x); let t = '', end = null;
      for (const i of r.it) { t += (end != null && i.x - end > 12 ? '  ' : end != null && i.x - end > 1 ? ' ' : '') + i.s; end = i.x + (i.w || 0); }
      lines.push({ p, text: t.trim() });
    });
  }
  return { lines, pages: pdf.numPages };
}

/* ---------- Carteira: mapeamento de colunas ---------- */
const FIELDS = [
  { k: 'code', l: 'Código TOTVS', re: [/^c[oó]d(igo)?\.?\s*(totvs|cliente)?$/, /c[oó]digo.*(cliente|totvs)/, /^cod\b/, /^id\b/, /^codigo/] },
  { k: 'name', l: 'Razão social / cliente', re: [/raz[aã]o\s*social/, /^cliente$/, /nome\s*(do\s*)?(cliente|empresa)/, /^nome/, /^empresa/, /fantasia/] },
  { k: 'cnpj', l: 'CNPJ', re: [/cnpj/, /cpf\/?cnpj/] },
  { k: 'seg', l: 'Segmento', re: [/segmento/, /setor/, /vertical/, /ramo/, /atividade/, /cnae/] },
  { k: 'city', l: 'Cidade', re: [/cidade/, /munic[ií]pio/] },
  { k: 'uf', l: 'UF', re: [/^uf$/, /^estado$/, /unidade federativa/] },
  { k: 'regime', l: 'Regime tributário', re: [/regime/, /enquadramento/, /tributa[cç][aã]o/] },
  { k: 'release', l: 'Release Protheus em produção', re: [/release/, /vers[aã]o (do )?(erp|protheus|sistema)/] },
  { k: 'fat', l: 'Faturamento anual do cliente', re: [/faturamento anual/, /receita (bruta )?anual/, /faixa de faturamento/, /faturamento do cliente/] },
  { k: 'moeda', l: 'Moeda (faturamento anual)', re: [/^moeda/, /currency/] },
  { k: 'exerc', l: 'Exercício (faturamento anual)', re: [/exerc[ií]cio/, /ano (fiscal|base)/] },
  { k: 'size', l: 'Porte', re: [/porte/, /^faixa/, /tamanho/] },
  { k: 'mrr', l: 'MRR (recorrente TOTVS)', re: [/\bmrr\b/, /recorr/, /mensalidade/, /fatura.*mens/] },
  { k: 'hosp', l: 'Hospedagem', re: [/hospedagem/, /infraestrutura/, /^ambiente/, /^(cloud|nuvem)$/] },
  { k: 'func', l: 'Funcionários CLT', re: [/funcion[aá]rios/, /colaboradores/, /\bclt\b/, /headcount/] },
  { k: 'cds', l: 'Centros de distribuição', re: [/centros? de distribui/, /^cds?$/, /armaz[eé]ns/] },
  { k: 'filiais', l: 'Filiais', re: [/filia(l|is)/, /estabelecimentos/] },
  { k: 'dref', l: 'Data de referência (dados estratégicos)', re: [/data (de )?refer/, /^refer[eê]ncia$/] },
  { k: 'contrato', l: 'Contrato (identificação)', re: [/^contrato$/, /n[uº°o]?\.? ?(do )?contrato/, /identifica.*contrato/, /contrato (id|n)/] },
  { k: 'ultRenov', l: 'Última renovação', re: [/[uú]ltima renova/, /renovad[oa] em/] },
  { k: 'proxRenov', l: 'Próxima renovação', re: [/pr[oó]xima renova/, /renova[cç][aã]o prevista/, /fim (da )?vig[eê]ncia/] },
  { k: 'dataBase', l: 'Data-base do reajuste', re: [/data.?base/, /anivers[aá]rio do reajuste/] },
  { k: 'indice', l: 'Índice de reajuste', re: [/[ií]ndice/, /reajuste/] },
  { k: 'products', l: 'Produtos', re: [/produto/, /solu[cç][aã]o/, /m[oó]dulo/, /linha/, /sistema/] },
  { k: 'churn', l: 'Churn / risco', re: [/churn/, /cancel/, /risco/] },
  { k: 'nps', l: 'NPS', re: [/\bnps\b/, /satisfa/] },
  { k: 'notes', l: 'Observações', re: [/observa/, /\bobs\b/, /coment/, /anota/, /hist[oó]rico/, /notas?/] }
];
function detectHeader(rows) {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const r = rows[i] || []; const filled = r.filter(c => String(c).trim() !== '');
    if (filled.length >= 3 && filled.filter(c => typeof c === 'string' && parseNum(c) == null).length >= Math.ceil(filled.length * 0.6)) return i;
  } return 0;
}
function autoMap(headers) {
  const m = {}, used = new Set();
  for (const f of FIELDS) {
    let best = -1, bs = 0;
    headers.forEach((h, i) => { if (used.has(i)) return; const n = norm(h); f.re.forEach((re, ri) => { if (re.test(n)) { const sc = 10 - ri; if (sc > bs) { bs = sc; best = i; } } }); });
    if (best >= 0) { m[f.k] = best; used.add(best); }
  } return m;
}
function sampleCol(rows, h, ci) { return rows.slice(h + 1, h + 40).map(r => r[ci]).filter(v => String(v ?? '').trim() !== '').slice(0, 3).map(v => String(v).slice(0, 28)).join(' | '); }

/* ---------- Produtos / necessidades ---------- */
function findProducts(text, origin) {
  const out = []; text = String(text ?? ''); for (const p of prodPatterns()) { if (p.semTexto && origin?.texto) continue; const m = text.match(p.re); if (!m || (p.excl && p.excl.test(text))) continue; out.push({ id: p.id, nome: p.nome, term: m[0], ...origin }); } return out;
}
function snippet(text, idx, len = 90) { const a = Math.max(0, idx - 30); return text.slice(a, a + len).replace(/\s+/g, ' ').trim(); }

/* ---------- Fichas: extração ---------- */
const MONEY = /(?:R\$\s*)?-?\d{1,3}(?:\.\d{3})*,\d{2}(?!\d)/g;
const KIND_RULES = [
  ['total', /^(sub)?\s*total\b|valor total|total geral|total da (nota|fatura|ficha)|total a pagar|valor l[ií]quido|^l[ií]quido/i],
  ['imposto', /\b(iss|issqn|pis|cofins|icms|csll|irrf|inss|ipi)\b|reten[cç][aã]o|imposto|tribut/i],
  ['desconto', /desconto|abatimento|bonifica/i],
  ['excedente', /excedente|excesso|hora extra|adicional|ultrapass/i],
  ['recorrente', /\bsms (?:full|lgt|totvs)\b|mensalidade|licen[cç]a|assinatura|subscription|suporte|manuten[cç][aã]o|\bscc\b|cloud|\bcdu\b|\bsmse\b|plataforma|saas|hospedagem|recorr|cess[aã]o de uso|servi[cç]o continuado/i],
  ['avulso', /projeto|implanta|consultoria|treinamento|hora t[eé]cnica|horas?\b|migra[cç]|atualiza[cç]|desenvolvimento|visita|diagn[oó]stico|servi[cç]o avulso/i]
];
const KIND_LABEL = { recorrente: 'Recorrente', avulso: 'Avulso', excedente: 'Excedente', desconto: 'Desconto', imposto: 'Imposto', total: 'Total do documento (excluído)', outro: 'Não classificado' };
function classifyItem(desc) { for (const [k, re] of KIND_RULES) if (re.test(desc)) return k; return 'outro'; }
const MESES = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
function findComp(text) {
  const n = norm(text);
  let m = n.match(/compet[eê]ncia[^0-9a-z]{0,6}(0?[1-9]|1[0-2])\s*[\/\-.]\s*(20\d{2})/); if (m) return { v: `${m[2]}-${m[1].padStart(2, '0')}`, mode: 'explícita' };
  m = n.match(/compet[eê]ncia[^0-9a-z]{0,6}(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s*(?:de|\/|-)?\s*(20\d{2})/); if (m) return { v: `${m[2]}-${String(MESES.indexOf(m[1]) + 1).padStart(2, '0')}`, mode: 'explícita' };
  m = n.match(/(?:emiss[aã]o|data)[^0-9]{0,12}(\d{1,2})\/(0?[1-9]|1[0-2])\/(20\d{2})/); if (m) return { v: `${m[3]}-${m[2].padStart(2, '0')}`, mode: 'inferida da data de emissão' };
  m = n.match(/(?<![\d\/])(0?[1-9]|1[0-2])\/(20\d{2})\b/); if (m) return { v: `${m[2]}-${m[1].padStart(2, '0')}`, mode: 'inferida (primeiro mês/ano no documento)' };
  return null;
}
function extractFicha(lines, ctx) { // lines: [{text, loc}]
  const text = lines.map(l => l.text).join('\n'); const comp = findComp(text); const items = [];
  lines.forEach(l => {
    const vals = (l.text.match(MONEY) || []).map(parseNum).filter(v => v != null); if (!vals.length) return;
    const desc = l.text.replace(MONEY, ' ').replace(/\b\d{1,2}\/\d{1,2}\/20\d{2}\b|(?<![\d\/])\d{1,2}\/20\d{2}\b/g, ' ').replace(/\s{2,}/g, ' ').replace(/^[\s\-–|:]+|[\s\-–|:]+$/g, '').trim();
    if (!/[a-zA-ZÀ-ú]{3}/.test(desc)) return;
    const lc = findComp(l.text);
    items.push({ id: uid(), desc: desc.slice(0, 160), vals, vi: vals.length - 1, kind: classifyItem(desc), kindMode: 'inferido', loc: l.loc, comp: lc?.v || comp?.v || null, compMode: lc ? lc.mode : (comp ? comp.mode : null) });
  });
  const mod = text.match(KB.modalidadeRe);
  return { comp: comp?.v || null, compMode: comp?.mode || null, items: items.slice(0, 250), modalidade: mod ? { term: mod[0], snip: snippet(text, mod.index) } : null,
    cnpjs: [...new Set((text.match(CNPJ_RE) || []).map(digits).filter(validCnpj))].filter(c => !c.startsWith('53113791')), products: findProducts(text, { src: ctx.file, loc: 'ficha' }), textLen: text.length };
}

/* ---------- Associação documento → cliente ---------- */
function buildIndex(clients) {
  const byCnpj = new Map(), byCode = new Map(), names = [];
  Object.values(clients).forEach(c => {
    if (c.cnpj) (byCnpj.get(c.cnpj) || byCnpj.set(c.cnpj, []).get(c.cnpj)).push(c.key);
    if (c.code) (byCode.get(norm(c.code)) || byCode.set(norm(c.code), []).get(norm(c.code))).push(c.key);
    const nn = normName(c.name); if (nn.length >= 6) names.push({ key: c.key, nn });
  }); return { byCnpj, byCode, names };
}
/* Retorna {cands:[{key, by, state}]}. state: confirmado | sugerido. Dúvida => sugerido/pendente, nunca vínculo silencioso. */
/* Papel de cada CNPJ citado, pelo rótulo logo antes dele: emissor (TOTVS/prestador), faturado (cliente/tomador) ou apenas citado. */
function cnpjRoles(text) {
  const roles = new Map(), re = new RegExp(CNPJ_RE.source, 'g');
  for (const m of text.matchAll(re)) {
    const d = digits(m[0]); if (!validCnpj(d)) continue; const pre = norm(text.slice(Math.max(0, m.index - 60), m.index)).slice(-38);
    const r = d.startsWith('53113791') || /(emitente|prestador|fornecedor|emissor)/.test(pre) ? 'emissor' : /(cliente|tomador|sacado|destinat|faturad|contratante|pagador)/.test(pre) ? 'faturado' : 'citado';
    if (!roles.has(d) || r === 'faturado') roles.set(d, r);
  } return roles;
}
function matchDoc(text, idx) {
  const ev = new Map(); const add = (k, by, st) => { const e = ev.get(k) || { key: k, by: [], conf: false }; if (!e.by.includes(by)) e.by.push(by); if (st === 'confirmado') e.conf = true; ev.set(k, e); };
  const cn = [...new Set((text.match(CNPJ_RE) || []).map(digits).filter(validCnpj))];
  const roles = cnpjRoles(text);
  cn.forEach(c => { (idx.byCnpj.get(c) || []).forEach(k => { add(k, 'CNPJ ' + fmtCnpj(c), 'confirmado'); const e = ev.get(k); if (roles.get(c) === 'faturado' || !e.role) e.role = roles.get(c) || 'citado'; }); });
  const n = norm(text);
  idx.byCode.forEach((keys, code) => {
    if (code.length < 3) return; const esc = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const labeled = new RegExp(`(c[oó]d(igo)?|cliente|cod\\.?)[^a-z0-9]{0,6}${esc}(?![a-z0-9])`, 'i').test(n);
    const bare = new RegExp(`(^|[^a-z0-9])${esc}(?![a-z0-9])`, 'i').test(n);
    if (labeled || (bare && /[a-z]/.test(code) && code.length >= 5)) keys.forEach(k => add(k, 'código ' + code, 'confirmado'));
    else if (bare && code.length >= 4) keys.forEach(k => add(k, 'código ' + code + ' (sem rótulo)', 'sugerido'));
  });
  const nt = normName(text);
  idx.names.forEach(({ key, nn }) => { if (nt.includes(nn)) add(key, 'razão social', 'sugerido'); });
  const cands = [...ev.values()].map(e => ({ key: e.key, by: e.by.join(' + '), state: e.conf ? 'confirmado' : 'sugerido', role: e.role || '' }));
  return { cands, cnpjs: cn };
}
function resolveMatch(m) { // decide vínculo
  const conf = m.cands.filter(c => c.state === 'confirmado');
  if (conf.length === 1 && m.cands.length === 1) return { state: 'confirmado', key: conf[0].key, by: conf[0].by };
  const fat = conf.filter(c => c.role === 'faturado'), onlyFat = fat.length === 1 && conf.every(c => c === fat[0] || c.role === 'citado');
  if (onlyFat) return { state: 'sugerido', key: fat[0].key, by: fat[0].by + ' (rotulado como cliente/faturado; os demais CNPJs aparecem apenas como citados — confirme)' };
  const roleTxt = m.cands.some(c => c.role) ? ' (' + m.cands.map(c => `${c.by}: ${c.role === 'faturado' ? 'faturado' : c.role === 'emissor' ? 'emissor' : 'citado'}`).join('; ') + ')' : '';
  if (conf.length === 1 && m.cands.length > 1) return { state: 'ambiguo', cands: m.cands, note: 'Mais de um cliente citado no documento' + roleTxt };
  if (conf.length > 1) return { state: 'ambiguo', cands: m.cands, note: 'Múltiplos clientes confirmados por identificador' + roleTxt };
  if (m.cands.length === 1) return { state: 'sugerido', key: m.cands[0].key, by: m.cands[0].by };
  if (m.cands.length > 1) return { state: 'ambiguo', cands: m.cands, note: 'Várias correspondências possíveis' };
  return { state: 'nenhum' };
}

/* ---------- Segmento ---------- */
function classifySeg(c, ov) {
  const parts = String(c.seg || '').split(/[;|\/]+/).map(x => x.trim()).filter(Boolean), mp = S.meta.segMap || {};
  const manSec = (S.meta.segSec || {})[c.key] || [], secOf = id => [...new Set([...parts.slice(1).map(segOfRaw).filter(Boolean), ...manSec])].filter(x => x !== id);
  if (ov && ov[c.key]) { const s = KB.segments.find(x => x.id === ov[c.key]); if (s) return { id: s.id, mode: 'manual', ev: 'Definido manualmente', raw: c.seg || '', sec: secOf(s.id) }; }
  const raw = norm(parts[0] || '');
  if (raw && mp[raw]) { const id = mp[raw] === SEG_NONE ? null : mp[raw]; return { id, mode: id ? 'mapa' : 'nao_mapeado', ev: `Planilha: "${c.seg}" → mapeamento editável${id ? '' : ' (marcado como não informado)'}`, raw: c.seg, sec: secOf(id) }; }
  if (raw && !/^(outros?|geral|n\/?a|nao informado|-|)$/.test(raw)) {
    const hit = KB.segments.find(s => s.re.test(raw)); if (hit) return { id: hit.id, mode: 'planilha', ev: `Planilha: "${c.seg}"${parts.length > 1 ? ' (principal = primeiro valor)' : ''}`, raw: c.seg, sec: secOf(hit.id) };
    return { id: null, mode: 'nao_mapeado', ev: `Planilha: "${c.seg}" (sem correspondência nos segmentos TOTVS)`, raw: c.seg, sec: secOf(null) };
  }
  const cnae = c.cnpjCad?.cnaePrincipal, cnaeId = cnae && KB.cnaeSeg(cnae.codigo);
  if (cnaeId) { const s = KB.segments.find(x => x.id === cnaeId); if (s) return { id: s.id, mode: 'inferido', ev: `Inferido pelo CNAE da consulta de CNPJ (${cnae.formatado} — ${cnae.descricao}) — INFERÊNCIA, confirmar` }; }
  const nm = norm(c.name || ''); const hit = KB.segments.find(s => s.re.test(nm));
  if (hit) return { id: hit.id, mode: 'inferido', ev: `Inferido pela razão social ("${c.name}") — INFERÊNCIA, confirmar` };
  return { id: null, mode: 'ausente', ev: 'Segmento ausente na planilha' };
}

/* ---------- Corpus do cliente (somente dados do próprio cliente) ---------- */
function corpus(c) {
  const parts = [];
  if (c.notes) parts.push({ t: c.notes, src: `Planilha${c.src?.sheet ? ' • aba ' + c.src.sheet : ''}${c.src?.row ? ' • linha ' + c.src.row : ''} (Observações)` });
  if (c.productsRaw) parts.push({ t: c.productsRaw, src: `Planilha${c.src?.row ? ' • linha ' + c.src.row : ''} (Produtos)` });
  (c.docs || []).forEach(d => parts.push({ t: d.text, src: d.name }));
  if (c.mgmt?.notes) parts.push({ t: c.mgmt.notes, src: 'Observações manuais' });
  return parts;
}
function needHits(c, need) { return semHits(c, need).filter(h => h.st === 'atual').map(({ term, src, snip, via }) => ({ term, src, snip, via })); } /* só necessidade ATUAL: negada, histórica e resolvida ficam fora (ver needIgnorados) */
function identifiedProducts(c) {
  const map = new Map(); const add = p => { const e = map.get(p.id) || { id: p.id, nome: p.nome, ev: [] }; e.ev.push(p); map.set(p.id, e); };
  if (c.productsRaw) findProducts(c.productsRaw, { src: 'Planilha', loc: `linha ${c.src?.row || '?'} (Produtos)` }).forEach(add);
  fichasOk(c).forEach(f => { if (f.items?.length) f.items.forEach(it => findProducts(it.desc, { src: f.file, loc: it.loc }).forEach(add)); else (f.products || []).forEach(p => add({ ...p, src: f.file })); });
  (c.docs || []).filter(d => !d.prPrint).forEach(d => findProducts(d.text, { src: d.name, loc: 'documento complementar', texto: true }).forEach(add));
  /* decisão humana por cliente prevalece sobre o reconhecimento automático */
  const dec = c.prodDec || {};
  const out = [...map.values()].filter(e => dec[e.id]?.st !== 'rejeitado').map(e => ({ ...e, nivel: e.ev.some(x => !x.texto) ? 'estruturado' : 'texto', conf: dec[e.id]?.st === 'confirmado' }));
  Object.entries(dec).forEach(([id, d]) => { if (d.st !== 'manual' || out.some(p => p.id === id)) return; const s = activeSols().find(x => x.id === id); if (s) out.push({ id, nome: s.nome.split(' (')[0].split(' —')[0], ev: [{ id, nome: s.nome, term: 'informado', src: 'Informado manualmente', loc: d.nota || '' }], nivel: 'manual', conf: true }); });
  return out;
}

/* ---------- Motor de oportunidades ---------- */
const DEF_WEIGHTS = { evidencia: 30, aderencia: 20, impacto: 15, urgencia: 15, viabilidade: 10, dados: 10 };
const CRIT = {
  evidencia: 'Força da evidência individual (dados do próprio cliente)', aderencia: 'Aderência da solução (fonte oficial + compatibilidade com a base)', impacto: 'Impacto potencial (hipótese de negócio)',
  urgencia: 'Urgência comprovada (prazo regulatório com fonte ou sinal de risco na planilha)', viabilidade: 'Viabilidade de abordagem e implantação', dados: 'Qualidade dos dados disponíveis'
};
const RULES = [
 { id: 'reforma', tipo: 'Otimização', nome: 'Preparação para IBS/CBS (Reforma Tributária)', need: 'fiscal', trans: 'reforma', sols: ['cfgtrib', 'tit', 'transmite'], requiresBase: ['protheus'], natureza: ['PARAMETRIZAÇÃO', 'PADRÃO'], impacto: 3, urgencia: 2,
   problema: 'Adequação fiscal ao ano de teste (2026) e à transição 2027–2033.',
   deps: ['Release/pacotes do Protheus compatíveis com o Configurador de Tributos', 'Cadastros fiscais (NCM, classificação tributária) saneados', 'Time fiscal/contábil do cliente para parametrização'],
   perg: ['Quem responde pela parametrização fiscal e em que release está o ambiente?', 'O Configurador de Tributos já está em uso para os novos tributos?', 'Já simularam o impacto de IBS/CBS no preço e no fluxo de caixa?'],
   acao: 'Agendar diagnóstico fiscal: confirmar release, uso do Configurador de Tributos e necessidade de simulação (Inteligência Tributária).' },
 { id: 'nr1', tipo: 'Serviços', nome: 'Gestão de riscos psicossociais (NR-1) e jornada', need: 'sst', trans: 'nr1', sols: ['sst', 'rh', 'ponto'], requiresBase: ['rh', 'ponto'], natureza: ['PROCESSO', 'PADRÃO'], impacto: 2, urgencia: 2,
   problema: 'Estruturar gerenciamento de riscos ocupacionais incluindo fatores psicossociais.',
   deps: ['Confirmar nome/escopo oficial do módulo de SST (ver Base de Conhecimento)', 'Envolvimento de SST/RH/liderança do cliente', 'Verificar status atual de multas/liminar'],
   perg: ['Quem coordena o PGR e como os riscos psicossociais estão sendo levantados?', 'Como são acompanhados absenteísmo, afastamentos e jornada?', 'O sistema de ponto/folha está integrado ao SST?'],
   acao: 'Validar com RH/SST o estágio do PGR e apresentar opções somente após confirmar o escopo oficial do módulo de SST.' },
 { id: 'financeiro', tipo: 'Cross-sell', nome: 'Techfin: recebíveis, prazo e conciliação', need: 'financeiro', sols: ['antecipa', 'maisprazo', 'contatechfin'], requiresBase: ['protheus'], natureza: ['PADRÃO', 'INTEGRAÇÃO'], impacto: 2, urgencia: 0,
   problema: 'Gestão de caixa, cobrança/conciliação e capital de giro integrados ao ERP.',
   deps: ['Release/binário mínimo do Protheus (TDN)', 'Análise de crédito (Techfin/parceiro) — sem garantia de aprovação', 'Dados de recebíveis/contas a pagar no ERP'],
   perg: ['Qual o prazo médio de recebimento e o volume de títulos em aberto?', 'A conciliação bancária é automática? Quem a executa?', 'Há necessidade de capital de giro ou antecipação hoje?'],
   acao: 'Levantar processo de cobrança/conciliação e confirmar elegibilidade técnica (release) antes de falar de crédito.' },
 { id: 'fluig', tipo: 'Cross-sell', nome: 'Fluig: aprovações e documentos', need: 'processos', sols: ['fluig', 'ipaas', 'assinatura'], requiresBase: [], natureza: ['PROCESSO', 'INTEGRAÇÃO', 'PADRÃO'], impacto: 2, urgencia: 0,
   problema: 'Processos de aprovação/documentos em planilha, e-mail ou papel.',
   deps: ['Mapeamento dos processos prioritários', 'Projeto de integração com o ERP (iPaaS/APIs)'],
   perg: ['Quais aprovações (compras, pagamentos, férias) ainda são manuais?', 'Onde ficam os documentos e como são versionados/assinados?', 'Quanto tempo leva uma aprovação típica?'],
   acao: 'Mapear 2–3 fluxos críticos com o cliente e dimensionar escopo de integração.' },
 { id: 'producao', tipo: 'Expansão', nome: 'Chão de fábrica: MES, APS e manutenção', need: 'producao', seg: ['manufatura'], sols: ['mes', 'aps', 'manutencao'], requiresBase: ['protheus', 'datasul_erp', 'rm_erp'], natureza: ['PADRÃO', 'INTEGRAÇÃO', 'PROCESSO'], impacto: 3, urgencia: 0,
   problema: 'Visibilidade de produção, programação e manutenção.',
   deps: ['Compatibilidade do MES com Protheus (material de origem Datasul)', 'Maturidade de apontamento e cadastros de PCP', 'Possível necessidade de coleta/IoT'],
   perg: ['Como é feito o apontamento e a programação hoje?', 'Quais paradas/perdas mais impactam o resultado e como são medidas?', 'Há plano de manutenção preventiva registrado em sistema?'],
   acao: 'Visita ao chão de fábrica para levantar apontamento, indicadores e gargalo; só então avaliar MES/APS.' },
 { id: 'analytics', tipo: 'Cross-sell', nome: 'Indicadores e gestão comercial (BI/CRM)', need: 'analytics', sols: ['bi', 'crm'], requiresBase: [], natureza: ['PADRÃO', 'INTEGRAÇÃO'], impacto: 2, urgencia: 0,
   problema: 'Relatórios/indicadores dependentes de planilhas ou ferramenta paralela.',
   deps: ['Qualidade dos dados no ERP', 'Definição de indicadores prioritários'],
   perg: ['Quais indicadores a diretoria acompanha e de onde vêm os dados?', 'Quanto tempo se gasta consolidando relatórios?', 'Como é gerido o funil de vendas?'],
   acao: 'Levantar 5 indicadores críticos e a fonte de cada um; avaliar BI/CRM aderente.' },
 { id: 'logistica', tipo: 'Expansão', nome: 'Logística: WMS, roteirização e agendamento', need: 'logistica', seg: ['distribuicao', 'logistica_seg', 'agro'], sols: ['logistica', 'rotas'], requiresBase: [], natureza: ['PADRÃO', 'INTEGRAÇÃO'], impacto: 3, urgencia: 0,
   problema: 'Eficiência de armazenagem, rotas e entregas.',
   deps: ['Confirmar escopo do portfólio de logística vigente', 'Integração com o ERP', 'Coletores/dispositivos quando aplicável'],
   perg: ['Como são definidas rotas e janelas de entrega?', 'Há controle de estoque por endereço (WMS)?', 'Qual o índice de reentrega/devolução e o custo de frete por entrega?'],
   acao: 'Levantar o fluxo expedição → entrega com a operação e medir custo por entrega antes de propor.' },
 { id: 'sustentacao', tipo: 'Otimização', nome: 'Sustentação, atualização e nuvem', need: 'sustentacao', sols: ['cloud', 'scc'], requiresBase: [], natureza: ['PROCESSO', 'PARAMETRIZAÇÃO'], impacto: 2, urgencia: 0,
   problema: 'Demanda recorrente de chamados, atualização de release ou infraestrutura.',
   deps: ['Histórico de chamados/horas (não incluso neste arquivo)', 'Validação comercial do serviço (possibilidade de serviço)'],
   perg: ['Quantos chamados/horas por mês e quais os temas mais recorrentes?', 'Em que release está o ambiente e há plano de atualização?', 'Quem hospeda e faz backup/monitoramento hoje?'],
   acao: 'Extrair histórico de chamados/horas e propor revisão de modelo de atendimento (sujeito a validação de escopo).' },
 { id: 'treinamento', tipo: 'Serviços', nome: 'Treinamento, revisão de parametrizações e adoção', need: 'treinamento', sols: ['scc'], requiresBase: [], natureza: ['PARAMETRIZAÇÃO', 'PROCESSO', 'GAP'], impacto: 2, urgencia: 0,
   problema: 'Subuso ou parametrização inadequada do sistema.',
   deps: ['Diagnóstico de uso (não deduzir de cobrança)', 'Validação comercial do serviço'],
   perg: ['Quais rotinas o cliente sente que não usa ou usa mal?', 'Há GAPs documentados ou customizações que poderiam ser padrão?', 'Quem são os usuários-chave?'],
   acao: 'Realizar diagnóstico de adoção e separar PADRÃO/PARAMETRIZAÇÃO de GAP antes de qualquer proposta.' },
 { id: 'nfse', tipo: 'Otimização', nome: 'Adequação à NFS-e padrão nacional', need: 'nfse', trans: 'nfse', seg: ['servicos'], sols: ['protheus', 'transmite'], requiresBase: ['protheus'], natureza: ['PARAMETRIZAÇÃO', 'PROCESSO'], impacto: 2, urgencia: 2,
   problema: 'Emissão de NFS-e conforme padrão nacional.',
   deps: ['Regime tributário e município do cliente', 'Versão do módulo fiscal/atualizações'],
   perg: ['Como a NFS-e é emitida hoje e o município já adotou o padrão nacional?', 'Qual o regime tributário?'],
   acao: 'Confirmar regime/município e o canal de emissão atual.' },
 { id: 'servicos_terceirizacao', tipo: 'Expansão', nome: 'Digitalização da terceirização de mão de obra', need: 'terceirizacao', seg: ['servicos'], sols: ['prestadores_terceirizacao'], requiresBase: ['protheus', 'rm_erp'], natureza: ['PADRÃO', 'GAP', 'INTEGRAÇÃO'], impacto: 3, urgencia: 0,
   problema: 'Gestão de contratos com clientes e alocação de mão de obra terceirizada feita manualmente (planilha/controle fora do ERP), mesmo com ERP de backoffice/pessoal já implantado.',
   deps: ['Caso Grupo Liderança mostra que o ERP de backoffice sozinho não resolveu isso — confirmar se o cliente já tem módulo específico de terceirização', 'Mapear volume de contratos/postos ativos'],
   perg: ['Como são geridos os contratos com clientes hoje (sistema, planilha, manual)?', 'Quantos postos/contratos de terceirização estão ativos?', 'O faturamento por posto/contrato já é automático?'],
   acao: 'Levantar o processo atual de gestão de contratos de terceirização antes de propor o módulo dedicado.' },
 { id: 'servicos_field_service', tipo: 'Expansão', nome: 'Gestão de ordens de serviço em campo (Field Service)', need: 'osfcampo', seg: ['servicos'], sols: ['fsm_campo'], requiresBase: ['protheus', 'rm_erp'], natureza: ['PADRÃO', 'GAP', 'INTEGRAÇÃO'], impacto: 3, urgencia: 0,
   problema: 'Ordens de serviço em campo (agendamento, execução e rastreamento de equipes externas) sem sistema dedicado.',
   deps: ['Nome comercial do produto não fechado nas fontes — tratar como capacidade a confirmar com o representante TOTVS', 'Mapear tipos de ordem de serviço (preventiva/corretiva/preditiva) em uso'],
   perg: ['Como as ordens de serviço em campo são agendadas e rastreadas hoje?', 'Quantas equipes/técnicos externos a empresa tem?', 'Há controle de custo de manutenção por ordem de serviço?'],
   acao: 'Levantar o processo atual de ordens de serviço em campo antes de propor a solução dedicada.' },
 { id: 'obras', tipo: 'Expansão', nome: 'Gestão de obras e custos por obra', need: 'obras', seg: ['construcao'], sols: ['obras', 'protheus', 'fluig'], requiresBase: ['protheus', 'rm_erp'], natureza: ['PADRÃO', 'GAP', 'INTEGRAÇÃO'], impacto: 3, urgencia: 0,
   problema: 'Controle de custo, contratos e medições por obra.',
   deps: ['Obras e Projetos é linha RM: validar convivência com Protheus', 'Módulos de contratos/serviços do Protheus como alternativa'],
   perg: ['Como é acompanhado o custo por obra e as medições?', 'Há ferramenta paralela de orçamento/planejamento?', 'Como são aprovados contratos e aditivos?'],
   acao: 'Entender fluxo orçamento → contrato → medição e avaliar aderência (Protheus x RM) com especialista do segmento.' },
 { id: 'construcao_posvenda_imobiliario', tipo: 'Expansão', nome: 'Pós-venda imobiliário (incorporadoras)', need: 'posvendaimob', seg: ['construcao'], sols: ['tcgi'], requiresBase: ['rm_erp'], natureza: ['PADRÃO', 'GAP', 'INTEGRAÇÃO'], impacto: 3, urgencia: 0,
   problema: 'Pós-venda imobiliário (cobrança, distrato, renegociação de contrato, vistoria/entrega da unidade) sem automação de relacionamento com o cliente.',
   deps: ['Confirmar se o cliente é incorporadora/imobiliária/administradora de shopping center', 'Caso Habitasul usa TCGI junto com RM Backoffice — validar mesmo padrão'],
   perg: ['A empresa é incorporadora, imobiliária ou administra shopping centers?', 'Como é feito hoje o pós-venda (cobrança, distrato, renegociação)?', 'Há automação de relacionamento por marco da jornada (assinatura, obra, vistoria, entrega)?'],
   acao: 'Confirmar o perfil de incorporadora/imobiliária e levantar o processo atual de pós-venda antes de propor o TCGI.' },
 { id: 'manufatura_qualidade', tipo: 'Expansão', nome: 'Qualidade no chão de fábrica', need: 'qualidade', seg: ['manufatura'], sols: ['mes'], requiresBase: [], natureza: ['PADRÃO', 'PROCESSO', 'INTEGRAÇÃO'], impacto: 2, urgencia: 0,
   problema: 'Não conformidades, refugo e inspeções controlados fora do sistema, sem rastreabilidade nem indicador.',
   deps: ['Escopo de qualidade do MES by PPI-Multitask e compatibilidade com o ERP do cliente a validar', 'Maturidade de apontamento de produção', 'Cadastro de planos de inspeção'],
   perg: ['Onde são registradas hoje as não conformidades e o refugo?', 'Há rastreabilidade de lote do insumo ao produto acabado?', 'Quem analisa a causa e com que indicador?'],
   acao: 'Levantar o processo de inspeção e registro de não conformidades antes de apresentar qualquer solução.' },
 { id: 'distribuicao_vendas_b2b', tipo: 'Expansão', nome: 'Digitalização do pedido e vendas B2B', need: 'vendasb2b', seg: ['distribuicao'], sols: ['b2b_isthmus'], requiresBase: ['winthor_erp'], natureza: ['PADRÃO', 'INTEGRAÇÃO', 'GAP'], impacto: 3, urgencia: 0,
   problema: 'Pedidos de clientes atacadistas ainda dependem de telefone, catálogo impresso ou representante digitando manualmente, sem portal de autoatendimento B2B.',
   deps: ['Integração documentada é com a Linha Winthor; aderência ao Protheus NÃO verificada nesta pesquisa', 'Mapear a vertical do cliente (autopeças, alimentos, material de construção, farma, cosméticos ou generalista)'],
   perg: ['Como o cliente capta o pedido hoje (telefone, WhatsApp, catálogo, representante, portal)?', 'Que fração das vendas já é digital/autoatendimento?', 'Quantos representantes digitam pedido manualmente e com que frequência há erro?'],
   acao: 'Levantar o processo de captação de pedido hoje e o percentual de vendas já digitais antes de propor o portal B2B.' },
 { id: 'varejo_pdv', tipo: 'Expansão', nome: 'Frente de loja, PDV e omnichannel', need: 'pdv', trans: 'nfce_pdv', seg: ['varejo'], sols: ['linx', 'totvs_omni', 'systock'], requiresBase: [], natureza: ['PADRÃO', 'INTEGRAÇÃO', 'GAP'], impacto: 3, urgencia: 2,
   problema: 'Frente de loja/PDV sem integração nativa com estoque, fiscal e canais; risco de travamento de caixa no novo leiaute fiscal.',
   deps: ['Linx é unidade recém-incorporada: convivência com Protheus/RM/Datasul em evolução (roteiro por subsegmento)', 'Confirmar subsegmento (material de construção, autopeças, eletroeletrônicos, generalista)', 'Levantar canais ativos e se o PDV já emite no novo leiaute fiscal'],
   perg: ['Qual sistema de frente de loja/PDV é usado hoje e ele já está integrado ao estoque e ao ERP?', 'Quantos canais de venda ativos e como é a visão de estoque entre eles?', 'O PDV já foi adaptado ao novo leiaute fiscal da Reforma Tributária?'],
   acao: 'Mapear canais ativos e o PDV atual; confirmar se já está pronto para o novo leiaute fiscal antes de qualquer outra conversa.' },
 { id: 'varejo_pagamentos', tipo: 'Cross-sell', nome: 'Conciliação e meios de pagamento no ERP', need: 'financeiro', seg: ['varejo'], sols: ['equals', 'totvs_pay', 'antecipa'], requiresBase: ['protheus'], natureza: ['PADRÃO', 'INTEGRAÇÃO'], impacto: 2, urgencia: 0,
   problema: 'Conciliação manual de Pix/cartão/boleto por canal consome tempo e aumenta risco de erro.',
   deps: ['TOTVS Pay e Equals são lançamentos recentes: confirmar ERPs/releases elegíveis', 'Volume de meios de pagamento ativos'],
   perg: ['Como é feita hoje a conciliação de Pix, cartão e boleto — manual ou automatizada?', 'Quanto tempo a equipe financeira gasta nessa checagem por dia?'],
   acao: 'Levantar o processo de conciliação atual e confirmar elegibilidade antes de apresentar TOTVS Pay/Equals.' },
 { id: 'retencao', tipo: 'Retenção', nome: 'Plano de retenção / relacionamento', need: 'retencao', sols: [], requiresBase: [], natureza: ['PROCESSO'], impacto: 3, urgencia: 3,
   problema: 'Sinal de risco de perda do cliente.', deps: ['Histórico de relacionamento e chamados', 'Patrocinador executivo'],
   perg: ['Qual o motivo do baixo NPS/risco e quem é o decisor?', 'Há reclamações abertas ou oportunidade de resolução rápida?', 'Existe concorrente envolvido?'],
   acao: 'Reunião de relacionamento com decisor para entender causa e definir plano de recuperação.' }
];
const NPS_LOW = 6;
function retentionSignals(c) {
  const s = [];
  const ch = norm(c.churn || ''); if (ch && !/^(0|nao|n|no|false|baixo|-|nenhum)$/.test(ch)) s.push({ cls: 'FATO', text: `Planilha: campo churn/risco = "${c.churn}"`, src: `Planilha • linha ${c.src?.row || '?'}` });
  const n = parseNum(c.nps); if (n != null && n <= 10 && n <= NPS_LOW) s.push({ cls: 'FATO', text: `Planilha: NPS = ${n} (≤ ${NPS_LOW} na escala 0–10 presumida — NECESSITA VALIDAÇÃO da escala)`, src: `Planilha • linha ${c.src?.row || '?'}` });
  return s;
}
function dataQuality(c) {
  const f = fichasOk(c);
  let q = 0; if (f.length) q++; if (c.segInfo?.mode === 'planilha' || c.segInfo?.mode === 'manual') q++; if (c.productsIdent?.length) q++;
  return Math.min(3, q);
}
function scoreOpp(o, w) {
  const tot = Object.values(w).reduce((a, b) => a + b, 0) || 1;
  const v = Object.keys(DEF_WEIGHTS).reduce((a, k) => a + w[k] * (o.crit[k] / 3), 0) / tot * 100;
  return Math.round(v);
}
function confLevel(o) { const { evidencia: e, dados: d } = o.crit; return e >= 3 && d >= 2 ? 'alto' : (e >= 2 || (e >= 1 && d >= 2)) ? 'médio' : 'baixo'; }
function prioLabel(s) { return s >= CFG.prio.alta ? 'Alta' : s >= CFG.prio.media ? 'Média' : 'Baixa'; }

function buildOpps(c, w) {
  const out = []; const prods = c.productsIdent; const has = id => prods.some(p => p.id === id);
  const seg = c.segInfo?.id; const segObj = KB.segments.find(s => s.id === seg);
  const dq = dataQuality(c);
  for (const r of RULES) {
    const evInd = []; let hits = [];
    if (r.id === 'retencao') { retentionSignals(c).forEach(x => evInd.push(x)); if (!evInd.length) { hits = needHits(c, 'retencao'); } }
    else hits = needHits(c, r.need);
    hits.forEach(h => evInd.push({ cls: 'FATO', text: `Termo "${h.term}" em: …${h.snip}…`, src: h.src }));
    const baseOK = r.requiresBase.length === 0 || r.requiresBase.some(has);
    const segMatch = !r.seg || r.seg.includes(seg);
    const segTr = segObj ? segObj.tendencias.filter(t => t.needs.includes(r.need)) : [];
    const trans = r.trans ? KB.transversal.find(t => t.id === r.trans) : null;
    const setorial = [...segTr.map(t => ({ cls: 'FATO', text: t.t, fonte: t.fonte, tag: 'SETORIAL' })), ...(trans ? trans.fatos.map(f => ({ cls: 'FATO', text: f.t, fonte: f.fonte, tag: 'REGULATÓRIA' })) : [])];
    let mode = null;
    if (evInd.length && (segMatch || r.id === 'retencao' || !r.seg)) mode = 'evidencia';
    else if (evInd.length) mode = 'evidencia'; // evidência individual vale mesmo fora do segmento esperado
    else if (setorial.length && baseOK && r.requiresBase.length && segMatch) mode = 'investigacao'; // exige base identificada
    if (!mode) continue;
    if (r.id === 'retencao' && !evInd.length) continue;
    const sols = r.sols.map(solById).filter(Boolean);
    const extra = baseSolsFor(r, seg).filter(x => !r.sols.includes(x.id));
    const solText = [...sols, ...extra];
    const jaIdent = solText.filter(s => has(s.id)).map(s => s.nome);
    const crit = {
      evidencia: mode === 'evidencia' ? (evInd.some(e => e.src?.startsWith('Planilha') && r.id === 'retencao') ? 3 : Math.min(3, (new Set(evInd.map(e => e.src))).size >= 2 || evInd.length >= 3 ? 3 : evInd.length >= 1 ? 2 : 1)) : 1,
      aderencia: !sols.length ? 2 : sols.every(s => s.integraProtheus === true) ? (baseOK && r.requiresBase.length ? 3 : 2) : sols.some(s => s.integraProtheus === true) ? 2 : 1,
      impacto: r.impacto,
      urgencia: r.id === 'retencao' ? (evInd.length ? 3 : 0) : trans ? r.urgencia : 0,
      viabilidade: Math.min(3, (baseOK ? 2 : 0) + (sols.some(s => s.integraProtheus === true) ? 1 : 0)),
      dados: dq
    };
    const o = { id: `${c.key}::${r.id}`, ruleId: r.id, key: c.key, cliente: c.name, tipo: r.tipo, tipoBase: r.tipo, nome: r.nome, modo: mode,
      problema: mode === 'evidencia' ? `HIPÓTESE DE NECESSIDADE com indício individual: ${r.problema}` : `INVESTIGAÇÃO RECOMENDADA (sem indício individual): ${r.problema}`,
      impacto: `HIPÓTESE: ${r.problema.replace(/\.$/, '')} — impacto não quantificado (sem estimativa de receita; preços não inventados).`,
      evInd, setorial, sols: solText, extraBase: extra.map(x => x.id), jaIdent, natureza: r.natureza, deps: r.deps, perg: r.perg, acao: r.acao, contratacao: prods.map(p => p.nome), crit, validar: trans?.validar || null, baseOK };
    o.score = scoreOpp(o, w); o.conf = confLevel(o); o.prio = prioLabel(o.score);
    out.push(o);
  }
  // limitar investigações a 3 por cliente
  const inv = out.filter(o => o.modo === 'investigacao').sort((a, b) => b.score - a.score).slice(CFG.maxInvest).map(o => o.id);
  return out.filter(o => !inv.includes(o.id)).sort((a, b) => b.score - a.score);
}
/* Soluções da base fora das regras fixas: sugeridas quando a necessidade tem indício individual */
function baseSolsFor(r, seg) { return activeSols().filter(x => (x.necessidades || []).includes(r.need) && (!(x.segmentos || []).length || x.segmentos.includes(seg))).map(solLegacy); }

/* ---------- Conflitos / lacunas ---------- */
const usableF = f => f.state !== 'sugerido' && f.state !== 'divergente';
const fichasOk = c => (c.fichas || []).filter(usableF);
const ficha$ = fichasOk;
function recurringByComp(c) {
  const m = {}; const seen = new Set();
  ficha$(c).forEach(f => (f.items || []).forEach(it => {
    const cp = it.comp || f.comp;
    if (it.kind !== 'recorrente' || !cp || it.dup) return;
    const v = it.vals[it.vi]; if (v == null) return; m[cp] = (m[cp] || 0) + v;
  })); return m;
}
function markDuplicates(c) { // não duplica itens repetidos entre arquivos diferentes na mesma competência
  const seen = new Map();
  (c.fichas || []).forEach(f => (f.items || []).forEach(it => {
    it.dup = false; const k = `${it.comp || f.comp}|${norm(it.desc)}|${it.vals[it.vi]}`;
    if (seen.has(k) && seen.get(k) !== f.id) it.dup = true; else seen.set(k, f.id);
  }));
}
function conflicts(c) {
  const out = [];
  ficha$(c).forEach(f => { (f.cnpjs || []).forEach(cn => { if (c.cnpj && cn !== c.cnpj && !(f.cnpjsOther || []).includes(cn)) out.push({ tipo: 'CNPJ', text: `Ficha "${f.file}" cita CNPJ ${fmtCnpj(cn)}; planilha informa ${fmtCnpj(c.cnpj)}.`, a: `Planilha: ${fmtCnpj(c.cnpj)}`, b: `Ficha ${f.file}: ${fmtCnpj(cn)}` }); }); });
  const rec = recurringByComp(c); const comps = Object.keys(rec).sort();
  if (c.mrr != null && comps.length) { const last = comps[comps.length - 1]; const v = rec[last]; if (v > 0 && Math.abs(v - c.mrr) / c.mrr > 0.1) out.push({ tipo: 'MRR', text: `MRR da planilha ${fmtBRL(c.mrr)} × recorrente identificado na ficha (${last}) ${fmtBRL(v)}. Competências podem diferir — NECESSITA VALIDAÇÃO.`, a: `Planilha: ${fmtBRL(c.mrr)}`, b: `Ficha ${last}: ${fmtBRL(v)}` }); }
  return out;
}
function docStatus(c) {
  const all = c.fichas || []; const conf = all.filter(usableF);
  if (!all.length) return { k: 'nao_anexada', l: 'Ficha não anexada' };
  if (!conf.length) return { k: 'sugerida', l: 'Aguardando confirmação' };
  if (c.conflicts?.length) return { k: 'conflitante', l: 'Informação conflitante' };
  return { k: 'confirmada', l: 'Informação confirmada' };
}
/* ---------- Status da ficha, competência de referência e mudanças ---------- */
const curComp = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
const defaultRef = () => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return curComp(d); };
const refCompOf = st => st.meta.refComp || defaultRef();
const FSTAT = { nao_carregada: 'Não carregada', processando: 'Em processamento', erro: 'Com erro', disponivel: 'Disponível', revisao: 'Revisão necessária', desatualizada: 'Desatualizada' };
const MSG_SEM_FICHA = 'A ficha de faturamento deste cliente ainda não foi carregada. Anexe o documento para complementar a análise de contratação e oportunidades.';
const fichaComps = f => [...new Set([f.comp, ...(f.items || []).map(i => i.comp)].filter(Boolean))].sort();
function fichaStatus(c, ref) {
  const fs = c.fichas || [], errs = c.fichaErr || [], ok = fichasOk(c), why = [];
  if ((c.proc || 0) > 0) return { k: 'processando', l: FSTAT.processando, why: ['Arquivo em leitura/extração.'], last: null };
  errs.forEach(e => why.push(`Erro ao processar "${e.file}": ${e.msg}`));
  fs.filter(f => f.state === 'divergente').forEach(f => why.push(`"${f.file}": ${f.divergencia?.msg || 'identificação diverge do cliente selecionado'} — revisão pendente.`));
  fs.filter(f => f.state === 'sugerido').forEach(f => why.push(`"${f.file}": vínculo com o cliente apenas sugerido (${f.by}) — confirmar.`));
  ok.forEach(f => { if (!fichaComps(f).length) why.push(`"${f.file}": competência não identificada — informe manualmente.`); if (!(f.items || []).length) why.push(`"${f.file}": nenhum item de cobrança extraído (extração incompleta).`); else if (f.itemsTrunc) why.push(`"${f.file}": ${f.itemsTrunc} itens, apenas 150 lidos (extração incompleta).`); });
  const comps = [...new Set(ok.flatMap(fichaComps))].sort(), last = comps[comps.length - 1] || null;
  if (!fs.length && !errs.length) return { k: 'nao_carregada', l: FSTAT.nao_carregada, why: [MSG_SEM_FICHA], last: null, comps };
  if (errs.length) return { k: 'erro', l: FSTAT.erro, why, last, comps };
  if (why.length) return { k: 'revisao', l: FSTAT.revisao, why, last, comps };
  if (last && last < ref) return { k: 'desatualizada', l: FSTAT.desatualizada, why: [`Última competência ${last}; referência ${ref}.`], last, comps };
  return { k: 'disponivel', l: FSTAT.disponivel, why: [], last, comps };
}
const partial = c => !fichasOk(c).length;
function snapOf(c) {
  return { prods: (c.productsIdent || []).map(p => ({ id: p.id, nome: p.nome })), comps: c.an?.comps || [], fstat: c.an?.fk || null,
    opps: (c.opps || []).map(o => ({ id: o.ruleId, nome: o.nome, score: o.score, modo: o.modo, conf: o.conf, prio: o.prio, ja: (o.jaIdent || []).join(', '), n: (o.evInd || []).length })) };
}
function diffSnap(a, b) {
  const out = []; const A = new Map(a.prods.map(p => [p.id, p])), B = new Map(b.prods.map(p => [p.id, p]));
  B.forEach((p, id) => { if (!A.has(id)) out.push({ k: 'contratacao', t: `Contratação identificada: ${p.nome}` }); }); A.forEach((p, id) => { if (!B.has(id)) out.push({ k: 'contratacao', t: `Deixou de ser identificado: ${p.nome}` }); });
  b.comps.filter(x => !a.comps.includes(x)).forEach(x => out.push({ k: 'competencia', t: `Competência com recorrente identificado: ${x}` }));
  if (a.fstat && b.fstat && a.fstat !== b.fstat) out.push({ k: 'ficha', t: `Status da ficha: ${FSTAT[a.fstat]} → ${FSTAT[b.fstat]}` });
  const OA = new Map(a.opps.map(o => [o.id, o])), OB = new Map(b.opps.map(o => [o.id, o]));
  OB.forEach((o, id) => { const x = OA.get(id); if (!x) out.push({ k: 'hipotese', t: `Nova hipótese: ${o.nome} (${o.prio}, score ${o.score})`, reav: true });
    else { const m = []; if (x.modo !== o.modo) m.push(`modo ${x.modo} → ${o.modo}`); if (x.score !== o.score) m.push(`score ${x.score} → ${o.score}`); if (x.conf !== o.conf) m.push(`confiança ${x.conf} → ${o.conf}`); if (x.ja !== o.ja && o.ja) m.push(`solução já identificada na contratação (${o.ja})`);
      if (m.length) out.push({ k: 'hipotese', t: `Hipótese revisada: ${o.nome} — ${m.join('; ')}`, reav: true }); } });
  OA.forEach((o, id) => { if (!OB.has(id)) out.push({ k: 'hipotese', t: `Hipótese deixou de ser gerada: ${o.nome} (análise anterior preservada neste histórico)` }); });
  return out;
}
function analyzeClient(c, st) {
  c.segInfo = classifySeg(c, st.meta.segOv);
  /* rodadas 31/32: natureza do item pela identidade do produto (fnat.js); escolha manual nunca é alterada */
  fnApply(c);
  markDuplicates(c);
  c.productsIdent = identifiedProducts(c);
  consInit(c); cadInit(c); migrateDecl(c); relSync(c); fisSync(c);
  c.conflicts = conflicts(c);
  c.doc = docStatus(c);
  c.opps = buildOpps(c, st.meta.weights);
  { const base = [...c.opps, ...consOpps(c), ...solContentOpps(c), ...adocaoOpps(c), ...semOpps(c), ...fsOpps(c), ...cmpOpps(c), ...relOpps(c)]; const dOp = dorOpps(c, base), tOp = dtOpps(c, base); c.opps = unifyOpps(c, [...base, ...dOp, ...tOp]); } sgPost(c); semPost(c); c.opps.forEach(o => { o.origemTipo = oppOrigemTipos(o); });
  c.topScore = c.opps[0]?.score ?? null;
  c.topConf = c.opps[0]?.conf ?? null;
  c.fstat = fichaStatus(c, refCompOf(st));
  c.an = { fk: c.fstat.k, comps: Object.keys(recurringByComp(c)).sort() };
  c.analyzedAt = new Date().toISOString();
}
