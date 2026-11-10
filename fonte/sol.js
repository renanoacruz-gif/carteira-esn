/* ===== BASE DE SOLUÇÕES: modelo, carga inicial, duplicidade, extração, mesclagem ===== */
const TIPOS = { produto: 'Produto', modulo: 'Módulo', plataforma: 'Plataforma', complementar: 'Solução complementar', servico: 'Serviço' };
const REF_ST = { confirmada: 'Confirmada', corrigida: 'Corrigida (com fonte)', ambigua: 'Ambígua', nao_localizada: 'Não localizada', pendente: 'Validação pendente' };
const REF_STK = { confirmada: 'ok', corrigida: 'info', ambigua: 'warn', nao_localizada: 'bad', pendente: 'off' };
const STATUS_SOL = ['Validado', 'Em revisão', 'NECESSITA VALIDAÇÃO'];
const NEED_LABEL = { fiscal: 'Fiscal/tributário', sst: 'SST/RH', financeiro: 'Financeiro/Techfin', processos: 'Processos/Documentos', producao: 'Produção/Manutenção', analytics: 'Indicadores/CRM', logistica: 'Logística', sustentacao: 'Sustentação/Nuvem', treinamento: 'Treinamento/Adoção', nfse: 'NFS-e', obras: 'Obras', pdv: 'Varejo/Frente de loja', qualidade: 'Qualidade industrial', vendasb2b: 'Vendas B2B/distribuição', terceirizacao: 'Terceirização de serviços', osfcampo: 'Ordens de serviço em campo', posvendaimob: 'Pós-venda imobiliário' };
const OFFICIAL_HOST = /(^|\.)(totvs\.com|totvs\.com\.br|tdn\.totvs\.com|tdn\.totvs\.com\.br|centraldeatendimento\.totvs\.com|espacolegislacao\.totvs\.com|carol\.ai)$/i;
const escRe = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const hostOf = u => { try { return new URL(u).hostname; } catch { return ''; } };
const isOfficialUrl = u => OFFICIAL_HOST.test(hostOf(u));
const today = () => new Date().toISOString().slice(0, 10);
const TIPO_SEED = { protheus: 'produto', cfgtrib: 'modulo', transmite: 'complementar', rh: 'modulo', ponto: 'modulo', sst: 'modulo', scc: 'servico', cloud: 'servico',
  rm_erp: 'produto', winthor_erp: 'produto', winthor_wms: 'modulo', rm_labore: 'modulo', rm_smartview: 'modulo', rm_portal: 'modulo', datasul_suprimentos: 'modulo', totvs_performance: 'servico', totvs_rental: 'produto',
  totvs_juridico: 'produto', totvs_hospitalidade: 'produto', totvs_educacional: 'produto', rm_saude: 'produto', datasul_gps: 'produto', linx: 'produto', rdstation: 'produto', varejonline: 'produto',
  corten: 'plataforma', lynn: 'plataforma', carol: 'plataforma', intera: 'plataforma', equals: 'servico', totvs_pay: 'servico', datasul_erp: 'produto', b2b_isthmus: 'plataforma',
  prestadores_terceirizacao: 'produto', fsm_campo: 'complementar', obras: 'produto', tcgi: 'produto' };

function newSol(o = {}) {
  return { id: 's_' + uid(), nome: '', tipo: 'produto', categoria: '', linha: '', segmentos: [], necessidades: [], dores: [], funcionalidades: [], prerequisitos: [], integracoes: [], fontes: [], termos: [], termosRe: '', fornecedor: 'TOTVS', disponibilidade: '', limites: '', obs: '', status: 'NECESSITA VALIDAÇÃO', oficial: false, arquivado: false, origem: 'manual', atualizadoEm: today(), rev: 1, pend: [], hist: [], sigla: '', refId: '', codOferta: '', grupo: '', refStatus: '', refNota: '', finalidade: '', processos: [], lacunas: [], notasInt: [], ...o };
}
function seedSolutions() {
  return KB.solutions.map(s => {
    const src = { t: s.fonte.t, u: s.fonte.u || '', d: s.fonte.d || null, origem: 'base inicial (pesquisa em ' + s.consulta + ')' };
    const it = t => ({ t, o: 'base inicial', f: s.fonte.t, loc: '' });
    const linha = /protheus/i.test(s.nome) ? 'Protheus' : /\brm\b/i.test(s.nome) ? 'RM' : /techfin|antecipa|prazo|conta\+/i.test(s.nome) ? 'Techfin' : /fluig/i.test(s.nome) ? 'Fluig' : s.cat;
    const needs = [...new Set(RULES.filter(r => r.sols.includes(s.id) && r.need !== 'retencao').map(r => r.need))];
    const segs = KB.segments.filter(g => g.aplicacoes.some(a => a.sol === s.id)).map(g => g.id);
    const flag = /secund|n[ãa]o verificad|validar|imprensa|inferid|sem oferta oficial|n[ãa]o h[áa] fonte oficial/i.test(s.limites + ' ' + s.nome + ' ' + (s.fonte.t || ''));
    const tp = TIPO_SEED[s.id] || 'complementar';
    const fornec = s.fornecedor ? { fornecedor: s.fornecedor, disponibilidade: s.disponibilidade || 'Parceria TOTVS — ver programa de parceiros' } : tp === 'servico' ? { fornecedor: 'TOTVS (a confirmar)', disponibilidade: 'A validar com o portfólio de serviços TOTVS' } : {};
    return newSol({ id: s.id, nome: s.nome, tipo: tp, ...fornec, categoria: s.cat, linha, segmentos: segs, necessidades: needs, funcionalidades: [it(s.finalidade)], limites: s.limites, fontes: [src],
      integracoes: s.integraProtheus === true ? [{ sistema: 'Protheus', estado: 'confirmada', t: 'Integração/compatibilidade com Protheus documentada na fonte', o: 'base inicial', f: s.fonte.t, loc: '' }] : s.integraProtheus === false ? [{ sistema: 'Protheus', estado: 'nao_integra', t: 'Não integra com Protheus segundo a fonte', o: 'base inicial', f: s.fonte.t, loc: '' }] : [{ sistema: 'Protheus', estado: 'nao_verificada', t: 'Compatibilidade com Protheus não verificada', o: 'base inicial', f: s.fonte.t, loc: '' }],
      termosRe: s.kw?.source || '', status: flag ? 'NECESSITA VALIDAÇÃO' : 'Em revisão', oficial: !flag && !!s.fonte.u && isOfficialUrl(s.fonte.u), origem: 'base inicial', atualizadoEm: s.consulta, publicoTxt: s.publico,
      hist: [{ at: new Date().toISOString(), rev: 1, acao: 'carga inicial', resumo: 'Registro criado a partir da pesquisa feita em ' + s.consulta + '. Tipo e linha atribuídos por inferência — revisar.' }] });
  });
}
const activeSols = () => S.solutions.filter(s => !s.arquivado);
function solLegacy(r) {
  const pr = (r.integracoes || []).filter(i => /protheus/i.test(i.sistema)); const est = new Set(pr.map(i => i.estado));
  const ip = est.has('nao_integra') && est.has('confirmada') ? null : est.has('confirmada') ? true : est.has('nao_integra') ? false : null; const fo = r.fontes?.[0] || { t: '(sem fonte registrada)', u: '', d: null };
  return { id: r.id, nome: r.nome, cat: r.categoria || TIPOS[r.tipo], finalidade: r.finalidade || (r.funcionalidades || []).map(x => x.t).join(' • ') || '—', publico: r.publicoTxt || (r.segmentos || []).map(id => KB.segments.find(s => s.id === id)?.nome || id).join(', ') || '—', integraProtheus: ip, fonte: { t: fo.t, u: fo.u, d: fo.d }, consulta: r.atualizadoEm, rev: r.rev, status: r.status, tipo: r.tipo, oficial: r.oficial, fornecedor: r.fornecedor, disponibilidade: r.disponibilidade, linha: r.linha,
    limites: [r.limites, (r.prerequisitos || []).length ? 'Pré-requisitos: ' + r.prerequisitos.map(p => p.t).join('; ') : ''].filter(Boolean).join(' ') || '—' };
}
const solById = id => { const r = S.solutions.find(s => s.id === id && !s.arquivado); return r ? solLegacy(r) : undefined; };
let _pp = null, _ppSig = '';
const WB_L = '(?<![A-Za-zÀ-ÿ0-9])', WB_R = '(?![A-Za-zÀ-ÿ0-9])';
const termRe = t => WB_L + String(t).trim().split(/\s+/).map(escRe).join('\\s+') + WB_R;
function prodPatterns() {
  const sig = S.solutions.map(s => s.id + ':' + s.rev + (s.arquivado ? 'x' : '')).join(',') + JSON.stringify(S.meta.prodReg || {});
  if (_pp && _ppSig === sig) return _pp;
  const own = activeSols().map(s => { const parts = []; if (s.termosRe) parts.push(WB_L + '(?:' + s.termosRe + ')' + WB_R); (s.termos || []).forEach(t => t.trim() && parts.push(termRe(t))); if (!parts.length && s.nome) parts.push(termRe(s.nome.replace(/^TOTVS\s+/i, ''))); let re; try { re = new RegExp(parts.join('|'), 'i'); } catch { re = new RegExp(termRe(s.nome), 'i'); } return { id: s.id, nome: s.nome.split(' (')[0].split(' —')[0], re }; });
  const extra = KB.productPatterns.filter(p => !KB.solutions.some(s => s.id === p.id));
  _ppSig = sig; return _pp = [...own, ...extra].map(p => { const e = typeof prodRegOf === 'function' ? prodRegOf(p.id) : {}; let ex = null; if (e.excl?.length) { try { ex = new RegExp(e.excl.map(termRe).join('|'), 'i'); } catch { } } return { ...p, semTexto: !!e.semTexto, excl: ex }; });
}
const hist = (r, acao, resumo, f) => { r.hist = [{ at: new Date().toISOString(), rev: r.rev, acao, resumo, f: f || '', por: (typeof ME !== 'undefined' && ME.id) || '' }, ...(r.hist || [])].slice(0, 30); };

/* ---------- Duplicidade ---------- */
const STOPW = new Set(['totvs', 'linha', 'solucao', 'modulo', 'sistema', 'de', 'do', 'da', 'dos', 'das', 'e', 'para', 'com']);
const toks = s => normName(s).split(' ').filter(w => w.length > 1 && !STOPW.has(w));
function nameSim(a, b) { const A = new Set(toks(a)), B = new Set(toks(b)); if (!A.size || !B.size) return 0; const i = [...A].filter(x => B.has(x)).length; const jac = i / (A.size + B.size - i); const mn = Math.min(A.size, B.size); return Math.max(jac, normName(a) === normName(b) ? 1 : i === mn ? (mn >= 2 ? .85 : .7) : 0); }
const normUrl = u => { try { const x = new URL(u); const pid = x.searchParams.get('pageId'); return (x.hostname + x.pathname + (pid ? '?pageId=' + pid : '')).toLowerCase().replace(/\/$/, ''); } catch { return ''; } };
function findDups(c, ignoreId) {
  const urls = new Set((c.fontes || []).map(f => normUrl(f.u)).filter(Boolean)); const terms = new Set((c.termos || []).map(t => norm(t)).filter(t => t.length >= 4)); const out = [];
  S.solutions.forEach(r => { if (r.id === ignoreId) return; const why = []; let sc = 0;
    const ns = nameSim(c.nome, r.nome); if (ns >= .6) { why.push(`nome semelhante (${Math.round(ns * 100)}%)`); sc = Math.max(sc, ns); }
    if ((r.fontes || []).some(f => urls.has(normUrl(f.u)))) { why.push('mesma URL de fonte'); sc = Math.max(sc, .9); }
    if ((r.termos || []).some(t => terms.has(norm(t)))) { why.push('mesmo termo de identificação'); sc = Math.max(sc, .7); }
    const sg = norm(c.sigla || ''), ri = norm(c.refId || ''); if ((sg && norm(r.sigla || '') === sg) || (ri && norm(r.refId || '') === ri)) { why.push('mesma sigla/identificador'); sc = 1; }
    if (why.length) out.push({ rec: r, score: sc, why }); });
  return out.sort((a, b) => b.score - a.score);
}

/* ---------- Conflitos ---------- */
function solConflicts(r) {
  const g = {}; (r.integracoes || []).forEach(i => { const k = norm(i.sistema); (g[k] ||= []).push(i); });
  const out = []; Object.values(g).forEach(a => { const st = new Set(a.map(x => x.estado).filter(x => x !== 'nao_verificada')); if (st.size > 1) out.push({ campo: 'Integração: ' + a[0].sistema, itens: a.filter(x => x.estado !== 'nao_verificada').map(x => ({ v: x.estado === 'confirmada' ? 'integra/compatível' : 'NÃO integra', f: x.f || x.o, loc: x.loc })) }); });
  (r.pend || []).filter(p => !p.resolvido).forEach(p => out.push({ campo: p.campo, itens: p.itens ? [{ v: String(p.novo).slice(0, 220), f: p.f }] : [{ v: String(p.atual).slice(0, 220) + ' (adotado)', f: 'registro atual' }, { v: String(p.novo).slice(0, 220), f: p.f }], pend: true }));
  return out;
}

/* ---------- Extração a partir de materiais ---------- */
const SYS_RE = /\b(Protheus|Datasul|RMs?|Winthor|Logix|Fluig|Techfin|SAP|Salesforce|Totvs [A-Z][\w]+|Microsiga|Bimer|Linx|Senior|Sankhya)\b/;
const sysFrom = t => (t.match(SYS_RE) || [])[1] || '';
const splitMulti = v => String(v ?? '').split(/[;\n|]+/).map(x => x.trim()).filter(Boolean);
const normTipo = v => { const n = norm(v); return /m[oó]dulo|modulo/.test(n) ? 'modulo' : /plataforma/.test(n) ? 'plataforma' : /complement/.test(n) ? 'complementar' : /servi/.test(n) ? 'servico' : /produto|sistema|erp|plataforma/.test(n) ? 'produto' : ''; };
const normStatusSol = v => { const n = norm(v); return /^valid/.test(n) ? 'Validado' : /revis/.test(n) ? 'Em revisão' : 'NECESSITA VALIDAÇÃO'; };
function candBase(file) { return { nome: '', tipo: 'produto', categoria: '', linha: '', segmentos: [], necessidades: [], dores: [], funcionalidades: [], prerequisitos: [], integracoes: [], fontes: [{ t: file, u: '', d: today(), origem: 'upload' }], termos: [], fornecedor: '', disponibilidade: '', limites: '', finalidade: '', processos: [], naoClass: [], status: 'NECESSITA VALIDAÇÃO', oficial: false, extra: [] }; }
function enrichFromText(c, text, file) {
  c.segmentos = [...new Set([...c.segmentos, ...KB.segments.filter(s => s.re.test(text)).map(s => s.id)])];
  c.necessidades = [...new Set([...c.necessidades, ...Object.keys(KB.NEEDS).filter(n => n !== 'retencao' && new RegExp(KB.NEEDS[n].source, 'i').test(text))])];
  (text.match(/https?:\/\/[^\s)>\]"']+/g) || []).slice(0, 8).forEach(u => { if (!c.fontes.some(f => f.u === u)) c.fontes.push({ t: hostOf(u) || u, u, d: today(), origem: 'link citado em ' + file }); });
  if (!c.linha) { const m = text.match(/\b(Protheus|Datasul|Winthor|Logix|Fluig|Techfin|RM)\b/); if (m) c.linha = m[1]; }
}
function extractText(lines, file) {
  const c = candBase(file); const raw = lines.map(l => ({ ...l, t: l.text.replace(/^[\s•●\-–*]+|^\d+[.)]\s+/, '').trim() })).filter(l => l.t.length > 2);
  const title = raw.find(l => l.t.length <= 90 && l.t.split(' ').length <= 12 && !/^(p[aá]gina|\d+$|https?:)/i.test(l.t));
  c.nome = (title?.t || file.replace(/\.[^.]+$/, '')).slice(0, 90); const full = raw.map(l => l.t).join('\n');
  for (const l of raw) { if (l === title) continue; const it = { t: l.t.slice(0, 300), o: 'extraído', f: file, loc: l.loc || '' };
    if (/pr[eé]-?requisit|\brequisitos?\b|necess[aá]ri[oa]|vers[aã]o m[ií]nima|\brelease\b|bin[aá]rio|compat[ií]vel com/i.test(l.t)) c.prerequisitos.push(it);
    else if (/n[aã]o\s+(integra|[ée]\s+compat[ií]vel)|sem integra[cç][aã]o/i.test(l.t)) c.integracoes.push({ sistema: sysFrom(l.t) || '(sistema não identificado)', estado: 'nao_integra', ...it });
    else if (/\bintegra(r|[cç][aã]o|[cç][oõ]es|do|da|m|ndo|se)?\b/i.test(l.t) && sysFrom(l.t)) c.integracoes.push({ sistema: sysFrom(l.t), estado: 'confirmada', ...it });
    else if (/\b(dores?|desafios?|problemas?|dificuldades?)\b/i.test(l.t)) c.dores.push(it);
    else if (l.t.split(' ').length >= 4 && c.funcionalidades.length < 25) c.funcionalidades.push(it); }
  if (/servi[cç]o|consultoria|implanta[cç][aã]o|sustenta[cç][aã]o/i.test(c.nome)) c.tipo = 'servico'; else if (/m[oó]dulo/i.test(c.nome)) c.tipo = 'modulo';
  c.termos = [c.nome.replace(/^TOTVS\s+/i, '')]; enrichFromText(c, full, file); return [c];
}
const HMAP = { nome: /^(nome|produto|solu[cç][aã]o|servi[cç]o)/, tipo: /^tipo/, categoria: /categoria/, linha: /linha/, segmentos: /segmento|setor/, dores: /\bdor|problema/, funcionalidades: /funcionalidade|recurso|descri/, prerequisitos: /pr[eé]-?req|requisito/, integracoes: /integra/, fonte: /fonte|link|url/, data: /\bdata|atualiza|consulta/, fornecedor: /fornecedor/, disponibilidade: /disponibilidade|comercial/, status: /status|valida/ };
function extractTable(sh, file) {
  const h = detectHeader(sh.rows), hd = (sh.rows[h] || []).map(x => norm(x)), col = {}; for (const [k, re] of Object.entries(HMAP)) { const i = hd.findIndex(x => re.test(x)); if (i >= 0) col[k] = i; }
  if (col.nome == null) return null; const out = [];
  sh.rows.slice(h + 1).forEach((r, i) => { const g = k => col[k] == null ? '' : r[col[k]]; const nome = String(g('nome')).trim(); if (!nome) return; const loc = `aba ${sh.name} • linha ${h + i + 2}`; const c = candBase(file); const it = t => ({ t, o: 'extraído', f: file, loc });
    c.nome = nome; c.tipo = normTipo(g('tipo')) || 'produto'; c.categoria = String(g('categoria')).trim(); c.linha = String(g('linha')).trim(); c.segmentos = splitMulti(g('segmentos')).map(s => KB.segments.find(x => x.re.test(norm(s)))?.id).filter(Boolean);
    c.dores = splitMulti(g('dores')).map(it); c.funcionalidades = splitMulti(g('funcionalidades')).map(it); c.prerequisitos = splitMulti(g('prerequisitos')).map(it);
    c.integracoes = splitMulti(g('integracoes')).map(t => ({ sistema: sysFrom(t) || t.replace(/^(n[aã]o\s+)?integra\w*\s*(com)?\s*/i, '').slice(0, 40) || t, estado: /n[aã]o\s+integra|incompat/i.test(t) ? 'nao_integra' : 'confirmada', ...it(t) }));
    const u = String(g('fonte')).trim(); c.fontes = [{ t: /^https?:/.test(u) ? hostOf(u) : (u || file), u: /^https?:/.test(u) ? u : '', d: String(g('data')).slice(0, 10) || today(), origem: 'upload ' + file + ' • ' + loc }];
    if (g('fornecedor')) c.fornecedor = String(g('fornecedor')).trim(); if (g('disponibilidade')) c.disponibilidade = String(g('disponibilidade')).trim(); c.status = col.status != null ? normStatusSol(g('status')) : 'NECESSITA VALIDAÇÃO'; c.termos = [nome.replace(/^TOTVS\s+/i, '')];
    enrichFromText(c, [nome, ...c.funcionalidades.map(x => x.t), ...c.dores.map(x => x.t)].join('\n'), file); out.push(c); });
  return out;
}
/* DOCX: percorre o corpo em ordem. Parágrafo = uma linha; lista = "• "; tabela = uma linha por linha da tabela, colunas separadas por 2 espaços
   (como as colunas de PDF); tab/quebra viram espaço; texto de "Fallback" (duplicado) e exclusões rastreadas são ignorados; cabeçalho/rodapé não são lidos. */
/* Proteção contra "zip bomb": limita nº de entradas e o tamanho descompactado de cada entrada lida. */
function zipGuard(z) { if (Object.keys(z.files).length > 20000) throw new Error('Arquivo compactado com entradas demais (possível arquivo malicioso); não foi lido.'); }
async function zipTxt(f) { const n = f && f._data && f._data.uncompressedSize; if (n > 60e6) throw new Error('Conteúdo descompactado acima de 60 MB (possível arquivo malicioso); não foi lido.'); return f.async('string'); }
async function readDocx(buf) {
  if (!(await vend('jszip'))) throw new Error('Biblioteca DOCX (JSZip) indisponível neste ambiente.');
  const z = await JSZip.loadAsync(buf); zipGuard(z); const f = z.file('word/document.xml'); if (!f) throw new Error('DOCX inválido: word/document.xml ausente.');
  const doc = new DOMParser().parseFromString(await zipTxt(f), 'application/xml'); if (doc.querySelector('parsererror')) throw new Error('DOCX inválido: XML do documento ilegível.');
  const body = [...doc.getElementsByTagName('*')].find(n => n.localName === 'body'); if (!body) throw new Error('DOCX inválido: corpo ausente.');
  const kids = (n, ln) => [...n.children].filter(c => c.localName === ln);
  const txt = n => { let t = ''; const walk = x => { for (const c of x.children) { const l = c.localName; if (l === 't') t += c.textContent; else if (l === 'tab') t += '  '; else if (l === 'br' || l === 'cr') t += ' '; else if (l === 'noBreakHyphen') t += '-'; else if (['pPr', 'rPr', 'instrText', 'del', 'Fallback', 'tblPr', 'trPr', 'tcPr'].includes(l)) continue; else walk(c); } }; walk(n); return t.replace(/[ \t]+$/g, '').replace(/^\s+/, ''); };
  const out = []; let ti = 0, pi = 0;
  const para = p => { const t = txt(p).trim(); if (!t) return ''; const ppr = kids(p, 'pPr')[0]; const stl = ppr ? [...(kids(ppr, 'pStyle')[0]?.attributes || [])].find(a => a.localName === 'val')?.value || '' : ''; return ppr && (kids(ppr, 'numPr').length || /^(list|lista|bullet|marcador)/i.test(stl)) ? '• ' + t : t; };
  const cellText = tc => kids(tc, 'p').map(para).concat(kids(tc, 'tbl').map(tb => kids(tb, 'tr').map(rowText).join(' / '))).filter(Boolean).join(' ');
  const rowText = tr => kids(tr, 'tc').map(cellText).filter(Boolean).join('  ');
  const walkBody = node => { for (const c of node.children) {
    if (c.localName === 'p') { const t = para(c); if (t) out.push({ text: t, loc: 'parágrafo ' + (++pi) }); }
    else if (c.localName === 'tbl') { ti++; kids(c, 'tr').forEach((tr, r) => { const t = rowText(tr).trim(); if (t) out.push({ text: t, loc: `tabela ${ti} linha ${r + 1}` }); }); }
    else if (c.localName === 'sdt' || c.localName === 'sdtContent' || c.localName === 'customXml') walkBody(c); } };
  walkBody(body); return out;
}

async function readPptx(buf) {
  if (!(await vend('jszip'))) throw new Error('Biblioteca (JSZip) indisponível neste ambiente.');
  const z = await JSZip.loadAsync(buf); zipGuard(z); const names = Object.keys(z.files).filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => +a.match(/(\d+)\.xml/)[1] - +b.match(/(\d+)\.xml/)[1]); const out = [];
  for (const n of names) { const xml = await zipTxt(z.file(n)); const sl = +n.match(/(\d+)\.xml/)[1];
    xml.split(/<\/a:p>/).forEach(p => { const t = (p.match(/<a:t[^>]*>[^<]*<\/a:t>/g) || []).map(x => x.replace(/<[^>]+>/g, '')).join('').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").trim(); if (t) out.push({ text: t, loc: 'slide ' + sl }); }); }
  return out;
}
/* ---------- HTML (TDN / enxoval de vendas): extração por seções ---------- */
const HSEC = [['dores', /\bdores?\b|desafio|problema|cenario|por que|dificuldade|situacao atual|necessidades? do cliente/], ['prerequisitos', /pre-?requisit|\brequisitos?\b|versao minima|compatibilidade|dependenc|licenciamento|pre-?condic/], ['limites', /limitac|restric|observac|atencao|importante/], ['integracoes', /integrac/], ['segmentos', /segmento|setor|publico|para quem|perfil/], ['processos', /\bprocessos?\b|fluxo|etapas/], ['finalidade', /introdu|visao geral|^sobre|descricao|objetivo|finalidade|o que e\b|apresentacao|resumo|contexto/], ['funcionalidades', /funcionalidad|recurso|caracteristic|beneficio|vantagen|como funciona|principais|configurac|parametr|operac|diferencia|o que (faz|oferece)|escopo|casos? de uso/]];
const HMETA = [['produto', /^produtos?$/], ['versoes', /^vers(ao|oes)(\s*\/\s*release)?$/], ['funcionalidade', /^(funcionalidade|ocorrencia|funcao|rotina|programa)$/], ['assunto', /^assunto$/], ['modulo', /^modulos?$/], ['linha', /^linha de produtos?$/], ['segmento', /^segmentos?$/], ['sigla', /^sigla$/], ['pais', /^pais(es)?$/]];
const hSecOf = h => { const n = norm(h).replace(/^\d{1,2}\s*[.)-]\s*/, ''); const r = HSEC.find(([, re]) => re.test(n)); return r ? r[0] : null; };
const hMetaOf = t => { const n = norm(t).replace(/[:：]\s*$/, '').trim(); const r = HMETA.find(([, re]) => re.test(n)); return r ? r[0] : null; };
const H_CHROME = /^(remove read confirmation|read confirmation|page history|page information|resolved comments|view in hierarchy|view source|export to word|at ?tachments? \(\d+\)|workflow|languages|browse pages|child pages|save for later|watch|share)$/i, H_SKIPSEC = /^(child pages|attachments?|anexos|comments?|coment[aá]rios|labels|etiquetas|p[aá]ginas relacionadas|related pages|browse pages)$/i;
const hClean = t => String(t ?? '').replace(/[​-‏﻿ ]/g, ' ').replace(/\s+/g, ' ').trim();
function extractHtmlSections(html, ctx = {}) {
  const doc = new DOMParser().parseFromString(String(html), 'text/html');
  doc.querySelectorAll('script,style,noscript,nav,footer,aside,form,button,iframe,svg,.aui-nav,.page-metadata,#comments-section,.comment-container,.confluence-information-macro-icon,.expand-control-icon').forEach(n => n.remove());
  const root = doc.querySelector('#main-content,.wiki-content,main,article') || doc.body, h1 = doc.querySelector('#title-text,#title-heading h1,h1.pagetitle') || root.querySelector('h1');
  const title = hClean(ctx.titulo) || hClean(h1?.textContent) || hClean(doc.title).replace(/\s[-–|]\s[^-–|]+\s[-–|]\s*TDN\s*$/i, '').replace(/\s[-–|]\s*TDN\s*$/i, '') || '';
  const c = candBase(ctx.file || ''); const origem = ctx.origem || 'importação por link', ftxt = ctx.titulo || title || ctx.file || '';
  const meta = {}, fin = [], limites = [], seg = [], nc = new Map(); let finLen = 0, omit = 0, semNome = false;
  let cur = { key: 'finalidade', h: '(introdução)', pre: true };
  const mkIt = t => ({ t: t.slice(0, 300), o: origem, f: ftxt, loc: `seção "${cur.h}"`, at: today() });
  const classify = t => /pr[eé]-?requisit|\brequisitos?\b|vers[aã]o m[ií]nima|\brelease\b|bin[aá]rio|compat[ií]vel com/i.test(t) ? 'prerequisitos' : /n[aã]o\s+(integra|[ée]\s+compat[ií]vel)|sem integra[cç][aã]o/i.test(t) || (/\bintegra(r|[cç][aã]o|[cç][oõ]es|do|da|m|ndo|se)?\b/i.test(t) && sysFrom(t)) ? 'integracoes' : /\b(dores?|desafios?|problemas?|dificuldades?)\b/i.test(t) ? 'dores' : null;
  const addUnique = (arr, it, cap) => { if (arr.length < cap && !arr.some(y => keyT(y.t) === keyT(it.t) && (y.sistema || '') === (it.sistema || ''))) arr.push(it); };
  const intOf = (t, key) => { const sistema = sysFrom(t) || sysFrom(cur.h); if (!sistema) return null; return { sistema, estado: /n[aã]o\s+(integra|[ée]\s+compat[ií]vel)|sem integra[cç][aã]o|incompat/i.test(t) ? 'nao_integra' : 'confirmada', ...mkIt(t) }; };
  const put = (t, tag) => {
    t = hClean(t).replace(/^[·•]\s*/, ''); if (t.length < 3 || H_CHROME.test(t) || /serverDuration|requestCorrelationId/.test(t)) return; if (SECRET_RE.test(t)) { omit++; return; }
    if (cur.key === '__skip') return;
    if (cur.pre) { const mm = t.match(/^([A-Za-zÀ-ÿ\/ ]{3,24}?)\s*[:：]\s*[·•]?\s*(.+)$/); const mk = mm && hMetaOf(mm[1]); if (mk) { if (!meta[mk]) meta[mk] = mm[2].slice(0, 200); return; } }
    let k = cur.key; if (cur.pre && tag !== 'p') k = null;
    if (k === 'finalidade') { if (finLen < 700) { fin.push(t); finLen += t.length; } return; }
    if (k === 'segmentos') { seg.push(t); return; }
    if (k === 'limites') { if (limites.length < 6) limites.push(t.slice(0, 200)); return; }
    if (k && !(t.length >= 8 && t.split(' ').length >= 2)) return;
    if (k === 'funcionalidades') return addUnique(c.funcionalidades, mkIt(t), 40);
    if (k === 'dores') return addUnique(c.dores, mkIt(t), 20);
    if (k === 'processos') return addUnique(c.processos, mkIt(t), 20);
    if (k === 'prerequisitos') return addUnique(c.prerequisitos, { ...mkIt(t), ...(/obrigat|exige|requer|m[ií]nim/i.test(t) ? { nivel: 'obrigatorio' } : /recomend|sugerid/i.test(t) ? { nivel: 'recomendado' } : {}) }, 20);
    if (k === 'integracoes') { const i = intOf(t); if (i) return addUnique(c.integracoes, i, 15); }
    if (!k || k === 'integracoes') { const cl = k === 'integracoes' ? null : classify(t); if (cl === 'integracoes') { const i = intOf(t); if (i) return addUnique(c.integracoes, i, 15); } else if (cl === 'prerequisitos') return addUnique(c.prerequisitos, mkIt(t), 20); else if (cl === 'dores') return addUnique(c.dores, mkIt(t), 20); }
    if (t.length < 8 || t.split(' ').length < 3) return;
    const h = cur.h; if (!nc.has(h)) { if (nc.size >= 8) return; nc.set(h, []); } const a = nc.get(h); if (a.length < 12 && !a.includes(t.slice(0, 300))) a.push(t.slice(0, 300));
  };
  const own = el => { const x = el.cloneNode(true); x.querySelectorAll('ul,ol,table').forEach(n => n.remove()); return hClean(x.textContent); };
  for (const el of root.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,dt,dd,table,pre')) {
    const tag = el.tagName.toLowerCase(), tb = el.closest('table');
    if (tag !== 'table' && tb && tb !== el) continue;
    if (/^h[1-6]$/.test(tag)) { const t = hClean(el.textContent); if (!t || el === h1 || (tag === 'h1' && norm(t) === norm(title))) continue; cur = { key: H_SKIPSEC.test(t.replace(/^\d{1,2}\s*[.)-]\s*/, '')) ? '__skip' : hSecOf(t), h: t.slice(0, 120) }; continue; }
    if (tag === 'table') {
      const rows = [...el.querySelectorAll('tr')].map(tr => ({ th: !!tr.querySelector('th'), cells: [...tr.children].filter(x => /^t[dh]$/i.test(x.tagName)).map(x => hClean(x.textContent)) })).filter(r => r.cells.some(Boolean));
      const kv = rows.filter(r => r.cells.length >= 2 && hMetaOf(r.cells[0]));
      if (kv.length && kv.length >= Math.ceil(rows.length / 2)) { kv.forEach(r => { const k = hMetaOf(r.cells[0]); if (!meta[k]) meta[k] = r.cells.slice(1).filter(Boolean).join(' ').replace(/^[·•]\s*/, '').slice(0, 200); }); continue; }
      rows.forEach(r => { if (r.th) return; const cs = r.cells.filter(Boolean); if (!cs.length) return; put(cs.length === 2 ? `${cs[0]}: ${cs[1]}` : cs.join(' | '), 'tr'); });
      continue;
    }
    put(tag === 'li' || tag === 'dd' || tag === 'dt' ? own(el) : hClean(el.textContent), tag);
  }
  c.nome = title.slice(0, 90); if (!c.nome) { c.nome = (ctx.url ? decodeURIComponent((ctx.url.split(/[?#]/)[0].split('/').filter(Boolean).pop() || '').replace(/\+/g, ' ')) : '').slice(0, 90) || (ctx.file || '').replace(/\.[^.]+$/, ''); semNome = true; }
  if (!fin.length && meta.assunto) fin.push(meta.assunto);
  c.finalidade = fin.join(' ').slice(0, 700); c.limites = limites.join('; ');
  const SYSL = (meta.linha || meta.produto || '').replace(/[®™]/g, '').trim(), lm = SYSL.match(/\b(Protheus|Datasul|Winthor|Logix|Fluig|Techfin|RM)\b/); if (lm) c.linha = lm[1]; else if (SYSL) c.linha = SYSL.slice(0, 60);
  if (meta.modulo) c.categoria = meta.modulo.slice(0, 80);
  if (meta.sigla && /^[A-Z0-9_-]{2,14}$/.test(meta.sigla)) c.sigla = meta.sigla;
  if (meta.funcionalidade) addUnique(c.funcionalidades, { t: 'Funcionalidade (cabeçalho da página): ' + meta.funcionalidade, o: origem, f: ftxt, loc: 'cabeçalho da página', at: today() }, 41);
  if (meta.versoes) addUnique(c.prerequisitos, { t: 'Versões (cabeçalho da página): ' + meta.versoes, o: origem, f: ftxt, loc: 'cabeçalho da página', at: today() }, 21);
  const segTxt = [meta.segmento, ...seg].filter(Boolean).join(' '); c.segmentos = KB.segments.filter(g => g.re.test(segTxt) || g.re.test(norm(segTxt))).map(g => g.id);
  c.tipo = /servi[cç]o|consultoria|implanta[cç][aã]o/i.test(c.nome) ? 'servico' : /\b(app|aplicativo|conector|plugin|add-?on)\b/i.test(c.nome) ? 'complementar' : meta.modulo ? 'modulo' : 'produto';
  c.termos = [c.nome.replace(/^TOTVS\s+/i, '')];
  enrichFromText(c, [c.nome, c.finalidade, ...c.funcionalidades.map(x => x.t), ...c.dores.map(x => x.t), ...c.processos.map(x => x.t)].join('\n'), ctx.file || 'página');
  c.fontes = []; c.naoClass = [...nc].map(([h, itens]) => ({ h, itens })); c.imp = { omitidosCredencial: omit, semNome, tipoInferido: !meta.modulo, meta };
  const pgi = tdExtract(html, { url: ctx.url, titulo: title, maxChars: ctx.maxChars }); c.extras = tdExtras(pgi); c.conteudoNovo = { paginas: [pgi] };
  return c;
}
/* Retorna {cands:[...], aviso} a partir de arquivo (PDF, XLSX, XLS, CSV, DOCX, TXT, MD) */
async function extractSolutionsFile(file) {
  const buf = await readBuf(file), ext = extOf(file.name);
  if (['xlsx', 'xls', 'csv'].includes(ext)) { const t = await readTable(file, buf); let cands = []; for (const sh of t.sheets) { const r = extractTable(sh, file.name); if (r) cands.push(...r); }
    if (cands.length) return { cands, aviso: `Tabela lida: ${cands.length} linha(s) com coluna de nome.` };
    const units = t.sheets.flatMap(tableUnits); return { cands: extractText(units.flatMap(u => u.lines), file.name), aviso: 'Nenhuma coluna "nome/produto" encontrada: planilha tratada como texto corrido (extração aproximada).' }; }
  if (ext === 'docx') return { cands: extractText(await readDocx(buf), file.name), aviso: 'DOCX lido como texto (tabelas viram texto corrido; extração aproximada).' };
  if (ext === 'pdf') { const { lines } = await readPdf(buf); if (!lines.length) throw new Error('PDF sem camada de texto (provável escaneado). Se for material de produto, use “OCR de material escaneado” na página do backend e importe a resposta em Importar resposta do backend.'); return { cands: extractText(lines.map(l => ({ text: l.text, loc: 'p. ' + l.p })), file.name), aviso: 'PDF lido como texto (extração aproximada).' }; }
  if (['html', 'htm'].includes(ext)) { const c = extractHtmlSections(decodeText(buf), { origem: 'upload ' + file.name, file: file.name }); c.fontes = [{ t: c.nome || file.name, u: '', d: today(), origem: 'upload ' + file.name }]; return { cands: [c], aviso: 'HTML lido por seções (títulos → finalidade, funcionalidades, dores, requisitos…). Trechos sem seção reconhecida ficam pendentes de revisão.' }; }
  if (ext === 'pptx') return { cands: extractText(await readPptx(buf), file.name), aviso: 'PPTX lido como texto dos slides (extração aproximada).' };
  if (['txt', 'md'].includes(ext)) return { cands: extractText(decodeText(buf).split(/\r?\n/).map((t, i) => ({ text: t, loc: 'linha ' + (i + 1) })), file.name), aviso: 'Texto lido (extração aproximada).' };
  throw new Error('Formato não suportado (PDF, XLSX, XLS, CSV, DOCX, PPTX, HTML, TXT, MD).');
}

/* ---------- Aplicar candidato (novo ou mesclagem) ---------- */
const keyT = t => norm(t).replace(/[^a-z0-9 ]/g, '').slice(0, 120);
const pendNC = c => g => ({ campo: 'seção sem classificação: ' + g.h, atual: '', novo: g.itens.join(' • ').slice(0, 900), itens: g.itens.map(t => ({ t, o: 'importação por link', f: c.fontes?.[0]?.t || '', loc: `seção "${g.h}" (classificação pendente)`, at: today() })), f: c.fontes?.[0]?.t || '', at: new Date().toISOString(), resolvido: false });
const impRec = c => ({ at: new Date().toISOString(), url: c.lkRep.urlOriginal, final: c.lkRep.urlFinal, paginas: c.lkRep.paginas.map(p => ({ u: p.u, t: p.titulo })), anexos: c.lkRep.anexos.map(a => ({ u: a.u, t: a.nome, erro: a.erro || '' })), naoLidos: c.lkRep.naoLidos.slice(0, 20), autenticado: !!c.lkRep.autenticado });
function addItems(dst, src, stats) { src.forEach(x => { if (!dst.some(y => keyT(y.t) === keyT(x.t) && (y.sistema || '') === (x.sistema || '') && (y.estado || '') === (x.estado || ''))) { dst.push(x); stats.n++; } }); }
function createFromCand(c, extra = {}) {
  const r = newSol({ ...c, ...extra, termosRe: '', pend: [], hist: [] }); r.origem = extra.origem || (c.fontes[0]?.origem || 'upload'); if (!r.fornecedor && r.tipo !== 'servico') r.fornecedor = 'TOTVS';
  r.oficial = false; // nunca oficial automaticamente: exige confirmação manual com fonte em domínio oficial
  r.fontes = (c.fontes || []).map(f => ({ ...f })); r.pend = (c.naoClass || []).map(pendNC(c)); delete r.naoClass; delete r.imp; delete r.lkRep; delete r.conteudoNovo; if (c.lkRep) r.importacoes = [impRec(c)]; hist(r, 'criado', 'Criado via ' + r.origem, c.fontes?.[0]?.t); return r;
}
/* choices: {campo: 'manter'|'substituir'|'depois'} para tipo, categoria, linha */
function mergeCand(r, c, choices = {}, info = {}) {
  const st = { n: 0 }, notes = [];
  for (const k of ['tipo', 'categoria', 'linha']) { const novo = c[k]; if (novo && novo !== r[k]) { const ch = r[k] ? (choices[k] || 'depois') : 'substituir'; if (ch === 'substituir') { notes.push(`${k}: "${r[k] || '—'}" → "${novo}"`); r[k] = novo; } else if (ch === 'depois') { r.pend = [...(r.pend || []), { campo: k, atual: r[k], novo, f: c.fontes?.[0]?.t || info.f || '', at: new Date().toISOString(), resolvido: false }]; notes.push(`${k}: conflito pendente ("${r[k]}" × "${novo}")`); } else notes.push(`${k}: mantido "${r[k]}" (novo "${novo}" descartado)`); } }
  ['dores', 'funcionalidades', 'prerequisitos'].forEach(k => addItems(r[k], c[k] || [], st)); addItems(r.integracoes, c.integracoes || [], st); r.processos ||= []; addItems(r.processos, c.processos || [], st);
  if (c.finalidade) { if (!r.finalidade) { r.finalidade = c.finalidade; st.n++; notes.push('finalidade preenchida'); } else if (norm(r.finalidade) !== norm(c.finalidade) && !(r.pend || []).some(p => p.campo === 'finalidade' && !p.resolvido && p.novo === c.finalidade)) { r.pend = [...(r.pend || []), { campo: 'finalidade', atual: r.finalidade, novo: c.finalidade, f: c.fontes?.[0]?.t || info.f || '', at: new Date().toISOString(), resolvido: false }]; notes.push('finalidade: texto novo diferente — pendente'); } }
  if (c.limites) { if (!r.limites) { r.limites = c.limites; st.n++; } else if (!norm(r.limites).includes(norm(c.limites).slice(0, 60))) { r.pend = [...(r.pend || []), { campo: 'limites', atual: r.limites, novo: c.limites, f: c.fontes?.[0]?.t || info.f || '', at: new Date().toISOString(), resolvido: false }]; notes.push('limitações: texto novo diferente — pendente'); } }
  if (c.sigla && !r.sigla) r.sigla = c.sigla;
  if (c.extras) Object.entries(c.extras).forEach(([k, a]) => { if (a?.length) { r.extras ||= {}; r.extras[k] ||= []; addItems(r.extras[k], a, st); } });
  (c.naoClass || []).map(pendNC(c)).forEach(p => { if (!(r.pend || []).some(q => q.campo === p.campo && q.novo === p.novo)) { r.pend = [...(r.pend || []), p]; notes.push('trecho sem classificação pendente'); } });
  if (c.lkRep) r.importacoes = [impRec(c), ...(r.importacoes || [])].slice(0, 10);
  (c.fontes || []).forEach(f => { if (!r.fontes.some(x => (x.u && x.u === f.u) || (!x.u && x.t === f.t && x.d === f.d))) { r.fontes.push({ ...f }); st.n++; } });
  r.segmentos = [...new Set([...r.segmentos, ...(c.segmentos || [])])]; r.necessidades = [...new Set([...r.necessidades, ...(c.necessidades || [])])]; r.termos = [...new Set([...(r.termos || []), ...(c.termos || [])])];
  if (c.fornecedor && !r.fornecedor) r.fornecedor = c.fornecedor; if (c.disponibilidade && !r.disponibilidade) r.disponibilidade = c.disponibilidade;
  if (r.status === 'Validado' && st.n) r.status = 'Em revisão'; r.atualizadoEm = today(); r.rev++; hist(r, 'mesclado', `${st.n} item(ns) novo(s) de ${c.fontes?.[0]?.t || info.f || 'material'}${notes.length ? '; ' + notes.join('; ') : ''}`, c.fontes?.[0]?.t); return { added: st.n, notes };
}
const lines2items = (txt, old = [], o = 'manual', f = '') => String(txt || '').split(/\n+/).map(x => x.trim()).filter(Boolean).map(t => old.find(y => y.t === t) || { t, o, f, loc: '', at: today() });
const MODOS = ['nativa', 'conector', 'api', 'desenvolvimento', 'nao_documentada'];
const intFromLines = (txt, old = []) => String(txt || '').split(/\n+/).map(x => x.trim()).filter(Boolean).map(l => { const m = l.match(/^(.+?)\s*=\s*(confirmada|n[aã]o integra|n[aã]o verificada)\s*(?:\|\s*([a-z_ ]+))?\s*$/i); const sis = (m ? m[1] : l).trim(); const e = m ? (/n[aã]o integra/i.test(m[2]) ? 'nao_integra' : /verificada/i.test(m[2]) ? 'nao_verificada' : 'confirmada') : 'confirmada'; const md = m?.[3] ? (MODOS.find(x => norm(m[3]).replace(/ /g, '_').startsWith(x.slice(0, 4))) || 'nao_documentada') : undefined; const ex = old.find(y => y.sistema === sis && y.estado === e); return ex ? { ...ex, modo: md || ex.modo } : { sistema: sis, estado: e, modo: md || 'nao_documentada', t: l, o: 'manual', f: '', loc: '', at: today() }; });
const intToLines = a => (a || []).map(i => `${i.sistema} = ${i.estado === 'nao_integra' ? 'não integra' : i.estado === 'nao_verificada' ? 'não verificada' : 'confirmada'}${i.modo ? ' | ' + i.modo : ''}`).join('\n');
const preToLines = a => (a || []).map(p => p.t + (p.nivel ? ` [${p.nivel}]` : '') + (p.escopo ? ` {${p.escopo}}` : '')).join('\n');
const preFromLines = (txt, old = []) => String(txt || '').split(/\n+/).map(x => x.trim()).filter(Boolean).map(l0 => { const me = l0.match(/\s*\{([^}]+)\}\s*$/), escopo = me ? me[1].trim() : undefined, l = me ? l0.slice(0, me.index).trim() : l0; const m = l.match(/^(.*?)\s*\[(obrigatorio|obrigatório|recomendado|indefinido)\]\s*$/i); const t = (m ? m[1] : l).trim(), nivel = m ? norm(m[2]).replace('obrigatorio', 'obrigatorio') : undefined; const ex = old.find(y => y.t === t); return ex ? { ...ex, nivel: nivel || ex.nivel, ...(escopo !== undefined ? { escopo } : {}) } : { t, o: 'manual', f: '', loc: '', at: today(), ...(nivel ? { nivel } : {}), ...(escopo ? { escopo } : {}) }; });
const fontesFromLines = (txt, old = []) => String(txt || '').split(/\n+/).map(x => x.trim()).filter(Boolean).map(l => { const p = l.split('|').map(x => x.trim()); const ex = old.find(y => (y.u || '') === (p[1] || '') && y.t === p[0]); return ex ? { ...ex, d: p[2] || ex.d } : { t: p[0], u: /^https?:/.test(p[1] || '') ? p[1] : '', d: p[2] || today(), origem: 'manual' }; });
const fontesToLines = a => (a || []).map(f => `${f.t} | ${f.u || ''} | ${f.d || ''}`).join('\n');
