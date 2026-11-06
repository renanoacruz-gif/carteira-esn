/* ===== BRIEFING PRÉ-REUNIÃO: gerado localmente (sem IA) a partir da ficha de faturamento ===== */
/* Especificação embutida: prompt "Especialista em Inteligência Comercial e Arquitetura de Soluções TOTVS". Exibida na aba; os cálculos abaixo a implementam. */
const BRIEF_PROMPT = `PAPEL
Atue como Especialista em Inteligência Comercial e Arquitetura de Soluções TOTVS. Analise os dados brutos da ficha de faturamento / cadastro de licenciamento e gere um relatório técnico-comercial em PDF com a estrutura executiva e a profundidade de um Briefing Pré-Reunião.

DIRETRIZES DE ANÁLISE
1. Metadados: Código do Cliente, Nome da Empresa, Número do Contrato, Propostas Vigentes, Condições de Pagamento.
2. Consolidação financeira: total bruto (VAL_TOTAL) e líquido (VAL_LIQD) da competência; itens de maior representatividade (ticket médio / recorrência); cobranças avulsas e pontuais (consultoria, suporte avulso).
3. Mapeamento por departamento/módulo: RH & Pessoas; Financeiro, Fiscal & Contábil; Compras & Estoque; Logística & Distribuição; Manufatura & Ativos; Agroindústria; Cloud & Plataformas; Serviços & Suporte.
4. Status e licenciamento: produtos ativos, soluções por subscrição/cloud, excedentes, pacotes de consumo, cancelados/legados.

ESTRUTURA
Cabeçalho executivo (cliente, contrato, proposta, segmento, tags de status).
01 Perfil do Cliente & Grupo Econômico (impacto no modelo de precificação por ROL; faturamento consolidado da competência).
02 Proposta Vigente & Portfólio (soluções contratadas, focos operacionais, situação da conta).
03 Análise de Licenciamento & Excedentes (contratado × utilizado; barras de progresso / indicativo de excedente).
04 Faturamento Detalhado (Produto, Qtd, Valor Unitário, Valor Total).
05 Perfil da Conta & Governança (ticket médio, gestão de consumo, serviços especializados).
06 Mapeamento Técnico por Departamento (Plataforma/Core + status Ativo/Cancelado/Excedente).
07 Roteiro e Agenda da Reunião.

VISUAL
Fundo off-white #FAFAF7; azul-marinho #0E1F30 (títulos e banners); verde-petróleo #0E6E62 (destaques/OK); terracota #B5502A (alertas/excedentes). Tabelas limpas com cabeçalho destacado; valores em R$ alinhados à direita. Rodapé executivo com fontes dos dados e assinatura profissional.

REGRA DA FERRAMENTA
O briefing só é gerado a partir da ficha de faturamento anexada ao cliente. Sem ficha, a ferramenta lembra o usuário de anexá-la.`;

const BR_C = { bg: [250, 250, 247], navy: [14, 31, 48], teal: [14, 110, 98], terra: [181, 80, 42], txt: [33, 37, 41], mut: [100, 110, 120], line: [214, 216, 208], alt: [242, 243, 238], tealBg: [222, 239, 235], terraBg: [247, 227, 219], neuBg: [231, 234, 238] };
const BR_DEPTS = [
  ['rh', 'RH & Pessoas', /folha|\brh\b|\bponto|recursos humanos|pessoas|admiss|esocial|beneficio|recrut|talent|payroll|seguranca do trabalho|medicina|\bsst\b|labore|colaborador|banco de horas|treinamento corporativo/],
  ['fin', 'Financeiro, Fiscal & Contábil', /financ|fiscal|contab|tribut|\bfatur|\bnf-?e\b|sped|tesouraria|contas a (pagar|receber)|concilia|bancari|cobranca|imposto|livros fiscais|reinf|\becf\b|\becd\b|ativo fixo|imobilizado|patrimonio|techfin|\bpix\b|boleto|cartao|credito|cambio|fluxo de caixa|orcament|controladoria|gestao de contratos/],
  ['cmp', 'Compras & Estoque', /compra|estoque|suprimento|almoxarif|cotac|requisic|fornecedor|procurement|inventario|recebimento/],
  ['log', 'Logística & Distribuição', /logistic|distribui|transport|\btms\b|\bwms\b|\bgfe\b|frete|expedic|roteir|entrega|embarque|mdf-?e|ct-?e|armazenagem|frota|cross.?dock|despacho/],
  ['man', 'Manufatura & Ativos', /manufatur|producao|\bpcp\b|\bmes\b|\bmrp\b|industri|chao de fabrica|\bmnt\b|\bativos?\b|\bplm\b|qualidade|\bqmt\b|\bqie\b|\bppi\b|engenharia|custos|apontamento|fabrica|oficina|\bsfc\b|\beam\b|\bepi\b|metrologia|manutencao de ativos/],
  ['agr', 'Agroindústria', /agro|agricol|pecuar|safra|fazenda|rural|\bcana\b|usina|graos|\bagr\b|sementes|frigorific|laticin|cooperativ|originacao|cafe\b|agronegocio/],
  ['cld', 'Cloud & Plataformas', /cloud|nuvem|iaas|paas|saas|hospedagem|hosting|fluig|carol|analytics|plataforma|\bapi\b|\bbi\b|\bia\b|inteligencia artificial|integra[cç]|\brpa\b|low.?code|workflow|dbaccess|appserver|license server|identity/],
  ['srv', 'Serviços & Suporte', /suporte|consultoria|hora tecnica|horas? (tecnica|de consultor)|treinamento|implanta|customer success|sustenta|servico (avulso|especializado|tecnico|profissional|gerenciado)|visita tecnica|projeto|migracao|diagnostico|atendimento|\bsla\b/],
  ['com', 'Comercial & Vendas', /\bvendas?\b|gestao comercial|\bcrm\b|\bcpq\b|varejo|\bpdv\b|e-?commerce|marketplace|televendas|\bsfa\b|loja|food service|restaurante/],
  ['out', 'Outros / a classificar', /$^/]
];
/* precedência de classificação (Cloud e Serviços antes, Agro antes dos demais) */
const BR_PREC = ['cld', 'srv', 'agr', 'rh', 'fin', 'cmp', 'log', 'man', 'com'];
const BR_PLAT = [['Protheus', /protheus|\bsiga[a-z]{2,4}\b/], ['RM', /\brm\b|totvs rm|rm (labore|folha|saldus|classis|nucleus|fluxus|bonum)/], ['Datasul', /datasul|\bems\b|\bhcm datasul/], ['Logix', /logix/], ['Fluig', /fluig/], ['Techfin', /techfin/], ['Carol / IA', /carol|inteligencia artificial/], ['TOTVS Cloud', /totvs cloud|\bcloud\b|nuvem/], ['Winthor', /winthor/], ['TOTVS BI', /\bbi\b|analytics/]];
const BR_NAT = { recorrente: 'Recorrente', avulso: 'Avulso', excedente: 'Excedente', desconto: 'Desconto', outro: 'Não classificado' };
const brN = v => (v == null || isNaN(v)) ? null : v;
const brBRL = v => v == null ? 'não consta' : fmtBRL(v).replace(/ /g, ' ');
const brPct = (a, b) => b ? Math.round(1000 * a / b) / 10 : 0;
const brPctTxt = p => String(p).replace('.', ',') + '%';
const brNum = v => v == null ? 'não consta' : (+v).toLocaleString('pt-BR', { maximumFractionDigits: 3 });

function brDept(r) {
  const test = t => { t = norm(t || ''); if (!t) return null; for (const id of BR_PREC) { const d = BR_DEPTS.find(x => x[0] === id); if (d[2].test(t)) return id; } return null; };
  return test(r.deptRaw) || test(r.desc) || 'out';
}
const brPlat = t => { t = norm(t); return BR_PLAT.filter(([, re]) => re.test(t)).map(x => x[0]); };
function brCompNorm(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') { if (v > 30000 && v < 80000) return new Date(Math.round((v - 25569) * 864e5)).toISOString().slice(0, 7); if (/^20\d{4}$/.test(String(v))) return `${String(v).slice(0, 4)}-${String(v).slice(4)}`; return null; }
  const s = String(v).trim(); let m;
  if ((m = s.match(/^(20\d{2})-(0[1-9]|1[0-2])/))) return `${m[1]}-${m[2]}`;
  if ((m = s.match(/^(20\d{2})(0[1-9]|1[0-2])$/))) return `${m[1]}-${m[2]}`;
  if ((m = s.match(/^(0?[1-9]|1[0-2])\s*[\/\-.]\s*(20\d{2})$/))) return `${m[2]}-${m[1].padStart(2, '0')}`;
  if ((m = s.match(/^\d{1,2}\/(0?[1-9]|1[0-2])\/(20\d{2})$/))) return `${m[2]}-${m[1].padStart(2, '0')}`;
  const n = norm(s), mi = MESES.findIndex(x => n.startsWith(x.slice(0, 3))); m = n.match(/(20\d{2}|\d{2})$/);
  if (mi >= 0 && m) return `${m[1].length === 2 ? '20' + m[1] : m[1]}-${String(mi + 1).padStart(2, '0')}`;
  return null;
}

/* Colunas da ficha tabular, por cabeçalho (tolerante a VAL_TOTAL, "Valor Total", etc.) */
function brCols(hdr) {
  const h = hdr.map(x => norm(String(x ?? '')).replace(/[_\-.]+/g, ' ').trim()), used = new Set(), col = {};
  const pick = (k, ...res) => { for (const re of res) { const i = h.findIndex((x, j) => !used.has(j) && x && re.test(x)); if (i >= 0) { used.add(i); col[k] = i; return; } } };
  pick('liq', /liq/); pick('total', /^(val|valor|vlr|vl) ?(total|bruto)|total bruto|^total( geral)?$|^bruto/, /total/, /^(val|valor|vlr|vl)( mensal)?$/);
  pick('qtd', /^(qtd|qtde|quant)/); pick('unit', /unit|(val|vlr|vl|valor) ?un|preco/);
  pick('contr', /contratad|licen.*contr|qtd.*contr|franquia|limite/); pick('util', /utiliz|consum|usad|apurad|realizad|medid/);
  pick('contrato', /contrato/); pick('proposta', /propost/); pick('cond', /cond.*pag|pagto|pagamento/);
  pick('comp', /compet|periodo|^mes\b|referencia|^ref\b/); pick('status', /status|situac/);
  pick('dept', /depart|^grupo|linha|^area\b|familia/); pick('cod', /cod.*cli|cli.*cod/); pick('cli', /razao|nome.*(cli|empresa)|^cliente$|^empresa$|nome fantasia/);
  pick('desc', /^descri/, /produto/, /servic/, /^item/, /modulo/, /solucao/, /nome/);
  return col;
}
const BR_RE = { contrato: /contrato\s*(?:n[º°o.]*\s*)?[:#\-]?\s*((?=[\w\/.\-]*\d)[A-Za-z0-9][\w\/.\-]{2,})/i, proposta: /propostas?\s*(?:n[º°o.]*\s*)?[:#\-]?\s*((?=[\w\/.\-]*\d)[A-Za-z0-9][\w\/.\-]{2,})/i };
const brGrab = (txt, re) => { const m = String(txt || '').match(re); return m ? m[1].trim().slice(0, 80) : null; };
const brMode = a => { const m = new Map(); a.filter(Boolean).forEach(x => m.set(x, (m.get(x) || 0) + 1)); const l = [...m.entries()].sort((x, y) => y[1] - x[1]).map(x => x[0]); return l.filter(x => !l.some(y => y !== x && y.length > x.length && y.toLowerCase().endsWith(x.toLowerCase()))); };

function briefFichas(c) { return fichasOk(c).filter(f => f.tab || (f.items || []).length); }
function briefRaw(c) {
  const rows = [], docTot = [], meta = { cod: [], cli: [], contrato: [], proposta: [], cond: [] }, files = [], seen = new Map(); let tabular = false, hasCol = {};
  briefFichas(c).forEach(f => {
    files.push(f.file);
    const push = (r, tot) => {
      const k = `${r.comp || ''}|${norm(r.desc)}|${r.total}|${r.liq}|${r.qtd}`; if (seen.has(k) && seen.get(k) !== f.id) return; seen.set(k, f.id);
      if (tot) docTot.push(r); else rows.push(r);
    };
    const mt = f.matchText || '';
    meta.contrato.push(brGrab(mt, BR_RE.contrato)); meta.proposta.push(brGrab(mt, BR_RE.proposta)); meta.cond.push(brGrab(mt, /condi[cç][aã]o de pagamento\s*[:\-]?\s*([^\n]{3,80})/i));
    if (f.tab) {
      tabular = true;
      f.tab.sheets.forEach(sh => {
        const hr = sh.rows.find(r => r.n === sh.h + 1); if (!hr) return; const col = brCols(hr.c); if (col.desc == null || (col.total == null && col.liq == null && col.unit == null)) return;
        Object.keys(col).forEach(k => hasCol[k] = true);
        sh.rows.filter(r => r.n <= sh.h).forEach(r => { const t = r.c.filter(x => x !== '').join(' ; '); meta.contrato.push(brGrab(t, /contrato\s*[:;]\s*([^;]{2,60})/i)); meta.proposta.push(brGrab(t, /propostas?\s*[:;]\s*([^;]{2,60})/i)); meta.cond.push(brGrab(t, /condi[cç][aã]o de pagamento\s*[:;]\s*([^;]{2,80})/i)); meta.cli.push(brGrab(t, /(?:cliente|empresa|raz[aã]o social)\s*[:;]\s*([^;]{2,80})/i)); meta.cod.push(brGrab(t, /c[oó]digo do cliente\s*[:;]\s*([^;]{1,30})/i)); });
        sh.rows.filter(r => r.n > sh.h + 1).forEach(r => {
          const g = k => col[k] == null ? null : r.c[col[k]], s = k => { const v = g(k); return v == null || v === '' ? null : String(v).trim(); };
          const desc = s('desc'); if (!desc) return;
          const total = brN(parseNum(g('total'))), liq = brN(parseNum(g('liq'))), qtd = brN(parseNum(g('qtd'))), unit = brN(parseNum(g('unit')));
          if (total == null && liq == null && qtd == null && unit == null) return;
          meta.cod.push(s('cod')); meta.cli.push(s('cli')); meta.contrato.push(s('contrato')); meta.proposta.push(s('proposta')); meta.cond.push(s('cond'));
          const kind = classifyItem(desc);
          const row = { desc, qtd, unit, total, liq, comp: brCompNorm(g('comp')) || brCompNorm(f.comp) || null, kind, statusRaw: s('status') || '', deptRaw: s('dept') || '', contr: brN(parseNum(g('contr'))), util: brN(parseNum(g('util'))), file: f.file, loc: `aba ${sh.name} • linha ${r.n}` };
          push(row, kind === 'total');
        });
      });
    }
    if (!f.tab || !rows.some(r => r.file === f.file) && !docTot.some(r => r.file === f.file)) {
      (f.items || []).filter(it => !it.dup).forEach(it => { const v = it.vals[it.vi]; push({ desc: it.desc, qtd: null, unit: null, total: v, liq: null, comp: brCompNorm(it.comp) || brCompNorm(f.comp) || null, kind: it.kind, statusRaw: '', deptRaw: '', contr: null, util: null, file: f.file, loc: it.loc, textOnly: true }, it.kind === 'total'); });
    }
  });
  return { rows, docTot, meta, files: [...new Set(files)], tabular, hasCol };
}

/* Classificação de uma linha de ficha (compartilhada pelo Briefing e pelo motor de oportunidades — sem extratores paralelos).
   st: Ativo | Cancelado | Excedente; nat: recorrente | avulso | excedente | desconto | outro. */
function brClassRow(r) {
  const nd = norm(r.desc + ' ' + r.statusRaw), neg = r.total != null && r.total < 0;
  const cancel = /cancel|descontinu|legado|baixad|encerrad|desativ|inativ|rescind|obsolet/.test(nd);
  const exc = r.kind === 'excedente' || /excedent|acima do contrat|overage|uso adicional|consumo adicional/.test(nd) || (r.contr != null && r.util != null && r.util > r.contr);
  const sub = /subscri|assinatura|saas|cloud|nuvem|mensalidade/.test(nd), nat = neg || r.kind === 'desconto' ? 'desconto' : exc ? 'excedente' : (r.kind === 'outro' && sub ? 'recorrente' : r.kind);
  return { ...r, nat, dept: brDept(r), plat: brPlat(r.desc), st: cancel ? 'Cancelado' : exc ? 'Excedente' : 'Ativo', sub, pac: /pacote|consumo|franquia|bolsa|\bpool\b|credito|volumetria|transac|tokens/.test(nd) };
}

function briefModel(c, compSel) {
  consInit(c); const raw = briefRaw(c);
  const comps = [...new Set(raw.rows.map(r => r.comp).filter(Boolean))].sort(), comp = comps.includes(compSel) ? compSel : (comps[comps.length - 1] || null);
  const inComp = r => !comps.length || !r.comp || r.comp === comp;
  const all = raw.rows.filter(inComp), docTot = raw.docTot.filter(inComp);
  const imp = all.filter(r => r.kind === 'imposto'), rows = all.filter(r => r.kind !== 'imposto').map(brClassRow);
  const sum = (a, k) => a.reduce((s, r) => s + (r[k] || 0), 0), cnt = (a, k) => a.filter(r => r[k] != null).length;
  const bruto = cnt(rows, 'total') ? sum(rows, 'total') : null, liq = cnt(rows, 'liq') ? sum(rows, 'liq') : null;
  const pos = rows.filter(r => (r.total || 0) > 0), posSum = sum(pos, 'total');
  const byNat = {}; Object.keys(BR_NAT).forEach(k => byNat[k] = { n: 0, v: 0 }); rows.forEach(r => { const b = byNat[r.nat] || byNat.outro; b.n++; b.v += r.total || 0; });
  const sorted = rows.slice().sort((a, b) => (b.total || 0) - (a.total || 0));
  const dep = BR_DEPTS.map(([id, nome]) => { const rs = sorted.filter(r => r.dept === id); return { id, nome, rows: rs, v: sum(rs, 'total'), plat: [...new Set(rs.flatMap(r => r.plat))] }; });
  const dtot = docTot.slice().sort((a, b) => (b.total || 0) - (a.total || 0))[0] || null;
  const mv = k => brMode(raw.meta[k])[0] || null;
  const m = { cod: mv('cod') || c.code || null, cli: mv('cli') || c.name, contrato: brMode(raw.meta.contrato).slice(0, 4), proposta: brMode(raw.meta.proposta).slice(0, 4), cond: brMode(raw.meta.cond).slice(0, 3) };
  const util = rows.filter(r => r.contr != null && r.util != null);
  const fs = briefFichas(c), root = c.cnpj ? c.cnpj.slice(0, 8) : null;
  const grupo = root ? Object.values(S.clients).filter(x => x.key !== c.key && x.cnpj && x.cnpj.slice(0, 8) === root) : [];
  return { c, comp, comps, rows, sorted, imp, docTot: dtot, bruto, liq, posSum, n: rows.length, ticket: pos.length ? posSum / pos.length : null, byNat, dep, meta: m, util, files: raw.files, tabular: raw.tabular, hasCol: raw.hasCol, textOnly: rows.length > 0 && rows.every(r => r.textOnly), grupo, fs, tags: { canc: rows.filter(r => r.st === 'Cancelado'), exc: rows.filter(r => r.st === 'Excedente'), sub: rows.filter(r => r.sub), pac: rows.filter(r => r.pac), desc: rows.filter(r => r.nat === 'desconto') } };
}

/* ---------- Blocos neutros (renderizados em HTML e PDF) ---------- */
const brChip = (t, tone) => ({ t, chip: true, tone });
function briefBlocks(M) {
  const c = M.c, B = [], P = (t, tone) => B.push({ k: 'p', t, tone }), sec = (n, t) => B.push({ k: 'sec', n, t }), H = t => B.push({ k: 'h', t });
  const E = S.meta.exec || {}, seg = c.segInfo ? segName(c.segInfo.id) : '', V = x => x == null ? 'não consta na ficha' : x;
  const stTone = s => s === 'Cancelado' ? 'alert' : s === 'Excedente' ? 'alert' : 'ok';
  const share = v => M.posSum ? brPctTxt(brPct(v, M.posSum)) : '—';
  const hosp = c.cad?.hosp?.v && c.cad.hosp.v !== 'nao_informado' ? HOSP[c.cad.hosp.v] : null, fat = c.cad?.fat?.v != null ? fatTxt(c.cad.fat.v) : null;
  /* 01 */
  sec('01', 'Perfil do Cliente & Grupo Econômico');
  B.push({ k: 'kv', rows: [['Cliente', V(M.meta.cli)], ['Código do cliente', V(M.meta.cod)], ['CNPJ (cadastro)', c.cnpj ? fmtCnpj(c.cnpj) : 'não informado'], ['Segmento', seg || 'não definido'],
    ['Grupo econômico', c.cnpj ? `Raiz do CNPJ ${c.cnpj.slice(0, 8)}${M.grupo.length ? `: ${M.grupo.length} outra(s) conta(s) na carteira (${M.grupo.slice(0, 4).map(x => x.name).join('; ')}${M.grupo.length > 4 ? '; ...' : ''})` : ': nenhuma outra conta na carteira'}` : 'CNPJ não informado: grupo não avaliado'],
    ['Hospedagem', hosp || 'não informada'], ['Faturamento anual declarado', fat ? `${fat} (indicador de porte; não é receita TOTVS)` : 'não informado']] });
  B.push({ k: 'note', tone: 'alert', t: 'Impacto no modelo de precificação (ROL): a ficha de faturamento não informa a Receita Operacional Líquida do cliente/grupo. Qualquer enquadramento por faixa de ROL NECESSITA VALIDAÇÃO com dado do cliente; o faturamento anual declarado serve apenas como indicador de porte.' });
  B.push({ k: 'kpis', items: [{ l: `Total bruto (VAL_TOTAL)${M.comp ? ' · ' + M.comp.split('-').reverse().join('/') : ''}`, v: brBRL(M.bruto) }, { l: 'Total líquido (VAL_LIQD)', v: M.liq == null ? 'não consta' : brBRL(M.liq), tone: M.liq == null ? 'alert' : null }, { l: 'Itens faturados', v: String(M.n) }, { l: 'Ticket médio por item', v: brBRL(M.ticket) }] });
  if (M.docTot) { const okB = M.bruto != null && M.docTot.total != null && Math.abs(M.docTot.total - M.bruto) <= Math.max(1, Math.abs(M.bruto) * 0.005); P(`Conferência: linha de total da ficha = ${brBRL(M.docTot.total)} · soma dos itens = ${brBRL(M.bruto)} → ${okB ? 'confere' : 'DIFERE; validar itens excluídos, descontos ou linhas não lidas'}.`, okB ? 'ok' : 'alert'); }
  /* 02 */
  sec('02', 'Proposta Vigente & Portfólio');
  B.push({ k: 'kv', rows: [['Contrato(s)', M.meta.contrato.length ? M.meta.contrato.join(' · ') : (c.contratos || []).map(x => x.ident).filter(x => x && x !== 'principal').join(' · ') || 'não consta na ficha'], ['Proposta(s) vigente(s)', M.meta.proposta.length ? M.meta.proposta.join(' · ') : 'não consta na ficha'], ['Condição de pagamento', M.meta.cond.length ? M.meta.cond.join(' · ') : 'não consta na ficha']] });
  const top = M.sorted.slice(0, 10), rest = M.sorted.slice(10);
  H('Soluções contratadas (maiores valores)');
  B.push({ k: 'table', cols: [{ h: 'Solução', w: .34 }, { h: 'Plataforma', w: .12 }, { h: 'Departamento', w: .2 }, { h: 'Natureza', w: .12 }, { h: 'Situação', w: .1 }, { h: 'Valor total', w: .12, a: 'r' }],
    rows: top.map(r => [r.desc, r.plat.join(', ') || '—', BR_DEPTS.find(d => d[0] === r.dept)[1], BR_NAT[r.nat], brChip(r.st, stTone(r.st)), { t: brBRL(r.total), b: true }]),
    foot: rest.length ? [`+ ${rest.length} item(ns) adicional(is) na Seção 04`, '', '', '', '', brBRL(rest.reduce((s, r) => s + (r.total || 0), 0))] : null });
  H('Focos operacionais (participação no valor positivo)');
  const foc = M.dep.filter(d => d.rows.length).sort((a, b) => b.v - a.v);
  B.push({ k: 'table', cols: [{ h: 'Departamento', w: .42 }, { h: 'Itens', w: .1, a: 'r' }, { h: 'Participação', w: .14, a: 'r' }, { h: 'Valor', w: .18, a: 'r' }, { h: 'Plataforma/Core', w: .16 }], rows: foc.map(d => [d.nome, String(d.rows.length), share(d.v), brBRL(d.v), d.plat.join(', ') || '—']) });
  const T = M.tags; B.push({ k: 'note', tone: T.exc.length || T.canc.length ? 'alert' : 'ok', t: `Situação da conta: ${M.n - T.canc.length - T.exc.length} item(ns) ativo(s) · ${T.exc.length} em excedente · ${T.canc.length} cancelado(s)/legado(s) · ${T.sub.length} por subscrição/cloud · ${T.pac.length} pacote(s) de consumo.` });
  /* 03 */
  sec('03', 'Análise de Licenciamento & Excedentes');
  if (M.util.length) { H('Contratado × utilizado'); B.push({ k: 'bars', rows: M.util.slice(0, 14).map(r => ({ l: r.desc, a: r.util, b: r.contr })) }); }
  else B.push({ k: 'note', tone: 'alert', t: 'A ficha não traz colunas de quantidade contratada × utilizada: barras de consumo não geradas. Os excedentes abaixo derivam apenas de rótulos/valores da ficha. NECESSITA VALIDAÇÃO do consumo real.' });
  H('Excedentes identificados');
  if (T.exc.length) B.push({ k: 'table', cols: [{ h: 'Item', w: .5 }, { h: 'Qtd', w: .12, a: 'r' }, { h: 'Valor unit.', w: .16, a: 'r' }, { h: 'Valor total', w: .22, a: 'r' }], rows: T.exc.map(r => [r.desc, brNum(r.qtd), brBRL(r.unit), { t: brBRL(r.total), tone: 'alert', b: true }]), foot: ['Total de excedentes', '', '', brBRL(T.exc.reduce((s, r) => s + (r.total || 0), 0))] });
  else P('Nenhum item classificado como excedente na competência.', 'ok');
  if (T.pac.length) { H('Pacotes de consumo'); B.push({ k: 'table', cols: [{ h: 'Pacote', w: .6 }, { h: 'Qtd', w: .14, a: 'r' }, { h: 'Valor total', w: .26, a: 'r' }], rows: T.pac.map(r => [r.desc, brNum(r.qtd), brBRL(r.total)]) }); }
  if (T.canc.length) { H('Cancelados / legados'); B.push({ k: 'table', cols: [{ h: 'Item', w: .74 }, { h: 'Valor total', w: .26, a: 'r' }], rows: T.canc.map(r => [r.desc, brBRL(r.total)]) }); }
  const lic = LIC_F.map(([k, l]) => [l, evOk(c.lic.f[k]).map(e => e.v).join('; ')]).filter(x => x[1]);
  H('Licenciamento confirmado no cadastro'); if (lic.length) B.push({ k: 'kv', rows: lic }); else P('Modelo, métrica, vigência e renovação ainda não confirmados na aba Contratação e licenciamento.', 'mut');
  /* 04 */
  sec('04', 'Faturamento Detalhado');
  const withLiq = M.liq != null, LIM = 70, vis = M.sorted.slice(0, LIM), hid = M.sorted.slice(LIM);
  B.push({ k: 'table', cols: withLiq ? [{ h: 'Produto', w: .38 }, { h: 'Qtd', w: .08, a: 'r' }, { h: 'Valor unitário', w: .16, a: 'r' }, { h: 'Valor total', w: .19, a: 'r' }, { h: 'Valor líquido', w: .19, a: 'r' }] : [{ h: 'Produto', w: .46 }, { h: 'Qtd', w: .1, a: 'r' }, { h: 'Valor unitário', w: .2, a: 'r' }, { h: 'Valor total', w: .24, a: 'r' }],
    rows: vis.map(r => { const a = [r.desc, brNum(r.qtd), brBRL(r.unit), { t: brBRL(r.total), b: true, tone: (r.total || 0) < 0 ? 'alert' : null }]; if (withLiq) a.push(brBRL(r.liq)); return a; }),
    foot: [(hid.length ? `+ ${hid.length} linha(s) não exibidas · ` : '') + 'TOTAL', '', '', brBRL(M.bruto)].concat(withLiq ? [brBRL(M.liq)] : []) });
  if (M.textOnly) P('Ficha lida como texto (sem colunas): quantidade, valor unitário e valor líquido não identificáveis. Envie XLSX/CSV com VAL_TOTAL, VAL_LIQD, quantidade e valor unitário para o detalhamento completo.', 'alert');
  else if (!withLiq) P('A ficha não possui coluna de valor líquido (VAL_LIQD) identificável.', 'alert');
  /* 05 */
  sec('05', 'Perfil da Conta & Governança');
  const it = [], N = M.byNat, top1 = M.sorted[0], top3 = M.sorted.slice(0, 3).reduce((s, r) => s + Math.max(0, r.total || 0), 0);
  it.push(['Fato', `Ticket médio por item: ${brBRL(M.ticket)} (${M.n} itens; ${brBRL(M.posSum)} em valores positivos).`]);
  if (top1) it.push(['Fato', `Maior item: ${top1.desc} (${share(Math.max(0, top1.total || 0))}); os 3 maiores concentram ${share(top3)} do valor.`]);
  it.push(['Fato', `Composição por natureza: recorrente ${share(N.recorrente.v)} · avulso ${share(N.avulso.v)} · excedente ${share(N.excedente.v)} · não classificado ${share(N.outro.v)} · descontos ${brBRL(N.desconto.v)}.`]);
  if (N.outro.v > 0 && M.posSum && N.outro.v / M.posSum > .3) it.push(['Hipótese', `${share(N.outro.v)} do valor sem natureza identificável pela descrição: validar com o executivo o que é recorrente.`]);
  if (N.avulso.n) it.push(['Fato', `Cobranças avulsas/pontuais: ${N.avulso.n} item(ns), ${brBRL(N.avulso.v)} (${M.rows.filter(r => r.nat === 'avulso').slice(0, 3).map(r => r.desc).join('; ')}).`]);
  const sv = M.dep.find(d => d.id === 'srv'); if (sv.rows.length) it.push(['Fato', `Serviços & Suporte: ${sv.rows.length} item(ns), ${share(sv.v)} do valor.`]);
  if (T.exc.length) it.push(['Hipótese', `${T.exc.length} excedente(s) (${brBRL(T.exc.reduce((s, r) => s + (r.total || 0), 0))}): indício de consumo acima do contratado; avaliar enquadramento/pacote com o cliente.`]);
  if (T.pac.length) it.push(['Fato', `${T.pac.length} pacote(s) de consumo na competência: acompanhar saldo e renovação.`]);
  if (M.bruto != null && M.liq != null && M.bruto) it.push(['Fato', `Bruto × líquido: diferença de ${brBRL(M.bruto - M.liq)} (${brPctTxt(brPct(M.bruto - M.liq, M.bruto))}).`], ['Hipótese', 'A diferença bruto × líquido pode refletir descontos negociados ou tributos: confirmar a origem antes de usar em negociação.']);
  if (T.canc.length) it.push(['Fato', `${T.canc.length} item(ns) cancelado(s)/legado(s): ${brBRL(T.canc.reduce((s, r) => s + (r.total || 0), 0))}; avaliar migração/substituição.`]);
  B.push({ k: 'table', cols: [{ h: 'Tipo', w: .13 }, { h: 'Leitura', w: .87 }], rows: it.map(([t, x]) => [brChip(t, t === 'Fato' ? 'ok' : 'alert'), x]) });
  /* 06 */
  sec('06', 'Mapeamento Técnico por Departamento');
  M.dep.forEach(d => {
    if (!d.rows.length) return;
    B.push({ k: 'dept', t: d.nome, s: `Plataforma/Core: ${d.plat.join(', ') || 'não identificada'} · ${d.rows.length} item(ns) · ${brBRL(d.v)}` });
    const sh = d.rows.slice(0, 12);
    B.push({ k: 'table', cols: [{ h: 'Módulo / Produto', w: .52 }, { h: 'Plataforma', w: .16 }, { h: 'Status', w: .14 }, { h: 'Valor', w: .18, a: 'r' }], rows: sh.map(r => [r.desc, r.plat.join(', ') || '—', brChip(r.st, stTone(r.st)), brBRL(r.total)]), foot: d.rows.length > 12 ? [`+ ${d.rows.length - 12} item(ns) na Seção 04`, '', '', ''] : null });
  });
  const vz = M.dep.filter(d => !d.rows.length).map(d => d.nome).filter(n => n !== 'Outros / a classificar'); if (vz.length) P(`Sem itens nesta competência: ${vz.join('; ')}. Pode indicar espaço de portfólio a investigar, não necessidade comprovada.`, 'mut');
  /* 07 */
  sec('07', 'Roteiro e Agenda da Reunião');
  let rules = { Q: [] }; try { rules = cadRules(c); } catch { }
  const ops = (c.opps || []).filter(o => o.modo === 'evidencia' && oppAtiva(c, o)).sort((a, b) => b.score - a.score).slice(0, 3), Qs = (rules.Q || []).slice(0, 4);
  const val = [M.meta.contrato.length ? '' : 'número do contrato', M.meta.proposta.length ? '' : 'proposta vigente', M.meta.cond.length ? '' : 'condição de pagamento', M.liq == null ? 'valor líquido' : '', 'ROL / porte para precificação'].filter(Boolean);
  B.push({ k: 'table', cols: [{ h: 'Tempo', w: .11 }, { h: 'Pauta', w: .27 }, { h: 'Objetivo / perguntas-guia', w: .62 }], rows: [
    ['0-5 min', 'Abertura e contexto', 'Alinhar participantes, objetivo da reunião e o que o cliente espera.'],
    ['5-15 min', 'Validação da ficha', `Confirmar com o cliente: ${val.join('; ')}${T.canc.length ? '; itens cancelados/legados' : ''}.`],
    ['15-30 min', 'Consumo e excedentes', T.exc.length ? `Tratar ${T.exc.length} excedente(s) e ${T.pac.length} pacote(s): origem do consumo, previsão e enquadramento.` : `Sem excedentes na ficha: confirmar consumo real versus contratado${T.pac.length ? ' e saldo dos pacotes' : ''}.`],
    ['30-45 min', 'Portfólio e oportunidades', ops.length ? ops.map(o => `${o.nome}${o.perg ? ': ' + cut(o.perg, 140) : ''}`).join(' | ') : 'Sem oportunidade sustentada por evidência no cadastro: usar as perguntas de descoberta abaixo.'],
    ['45-55 min', 'Serviços e governança', `Rever serviços avulsos/suporte (${brBRL(N.avulso.v + (sv.rows.length ? sv.v : 0))}), responsáveis pela conta e rito de acompanhamento do consumo.`],
    ['55-60 min', 'Encerramento', 'Registrar decisões, responsáveis, prazos e data do próximo contato.']] });
  if (Qs.length) { H('Perguntas de descoberta (do cadastro do cliente)'); B.push({ k: 'list', items: Qs }); }
  const pend = []; if (c.fstat?.why) pend.push(...[].concat(c.fstat.why).map(String).slice(0, 3)); if (M.textOnly) pend.push('Ficha sem colunas: reenviar em XLSX/CSV.');
  if (pend.length) { H('Pendências de dados'); B.push({ k: 'list', items: pend }); }
  B.push({ k: 'foot', t: `Fontes: ficha(s) de faturamento ${M.files.join('; ') || '—'}${M.comp ? ' · competência ' + M.comp.split('-').reverse().join('/') : ''}; cadastro e contratos da carteira. Gerado localmente em ${new Date().toLocaleDateString('pt-BR')}, sem IA e sem envio de dados. Não constitui proposta comercial.`, sig: [E.nome, E.contato].filter(Boolean).join(' · ') });
  return B;
}
function briefHeader(M) {
  const c = M.c, T = M.tags, h = [];
  h.push(brChip(M.textOnly ? 'Ficha sem colunas' : `Ficha: ${M.n} itens`, M.textOnly ? 'alert' : 'ok'));
  h.push(T.exc.length ? brChip(`${T.exc.length} excedente(s)`, 'alert') : brChip('Sem excedente', 'ok'));
  if (T.canc.length) h.push(brChip(`${T.canc.length} cancelado(s)/legado(s)`, 'alert'));
  if (T.sub.length) h.push(brChip('Subscrição/Cloud', 'ok'));
  if (T.pac.length) h.push(brChip('Pacote de consumo', 'ok'));
  return { title: M.meta.cli, sub: [`Cód. ${M.meta.cod || '—'}`, `Contrato ${M.meta.contrato.join(' / ') || 'não consta'}`, `Proposta ${M.meta.proposta.join(' / ') || 'não consta'}`, c.segInfo ? segName(c.segInfo.id) : ''].filter(Boolean).join(' · '), comp: M.comp, tags: h };
}

/* ---------- Prévia HTML ---------- */
function briefHTML(M) {
  const H = briefHeader(M), tone = t => t === 'alert' ? 'al' : t === 'ok' ? 'ok' : t === 'mut' ? 'mu' : '';
  const cell = (c, col) => { if (c && typeof c === 'object') return c.chip ? `<span class="bfchip ${tone(c.tone)}">${esc(c.t)}</span>` : `<span class="${tone(c.tone)}" ${c.b ? 'style="font-weight:700"' : ''}>${esc(c.t)}</span>`; return esc(c); };
  const h = [`<div class="bf"><div class="bfban"><img src="${LOGO_W}" alt="TOTVS"><div><div class="bft">Briefing Pré-Reunião</div><div class="bfs">${esc(H.title)}${H.comp ? ' · competência ' + esc(H.comp.split('-').reverse().join('/')) : ''}</div><div class="bfs2">${esc(H.sub)}</div></div></div><div class="bftags">${H.tags.map(t => `<span class="bfchip ${tone(t.tone)}">${esc(t.t)}</span>`).join('')}</div>`];
  briefBlocks(M).forEach(b => {
    if (b.k === 'sec') h.push(`<div class="bfsec"><span>${b.n}</span>${esc(b.t)}</div>`);
    else if (b.k === 'h') h.push(`<h5 class="bfh">${esc(b.t)}</h5>`);
    else if (b.k === 'p') h.push(`<p class="bfp ${tone(b.tone)}">${esc(b.t)}</p>`);
    else if (b.k === 'note') h.push(`<div class="bfnote ${tone(b.tone)}">${esc(b.t)}</div>`);
    else if (b.k === 'kv') h.push(`<table class="bfkv">${b.rows.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table>`);
    else if (b.k === 'kpis') h.push(`<div class="bfk">${b.items.map(i => `<div class="${tone(i.tone)}"><small>${esc(i.l)}</small><b>${esc(i.v)}</b></div>`).join('')}</div>`);
    else if (b.k === 'list') h.push(`<ul class="bfl">${b.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>`);
    else if (b.k === 'dept') h.push(`<div class="bfdept"><b>${esc(b.t)}</b><span>${esc(b.s)}</span></div>`);
    else if (b.k === 'bars') h.push(b.rows.map(r => { const p = r.b ? r.a / r.b : 0, ex = r.a > r.b; return `<div class="bfbar"><div><span>${esc(r.l)}</span><span class="${ex ? 'al' : ''}">${esc(brNum(r.a))} / ${esc(brNum(r.b))} (${brPctTxt(Math.round(p * 1000) / 10)})${ex ? ' · EXCEDENTE' : ''}</span></div><i><u class="${ex ? 'al' : ''}" style="width:${Math.min(100, p * 100)}%"></u></i></div>`; }).join(''));
    else if (b.k === 'table') h.push(`<div class="bftw"><table class="bft2"><thead><tr>${b.cols.map(c => `<th class="${c.a === 'r' ? 'r' : ''}">${esc(c.h)}</th>`).join('')}</tr></thead><tbody>${b.rows.map(r => `<tr>${r.map((c, i) => `<td class="${b.cols[i].a === 'r' ? 'r' : ''}">${cell(c)}</td>`).join('')}</tr>`).join('')}${b.foot ? `<tr class="ft">${b.foot.map((c, i) => `<td class="${b.cols[i].a === 'r' ? 'r' : ''}">${esc(c)}</td>`).join('')}</tr>` : ''}</tbody></table></div>`);
    else if (b.k === 'foot') h.push(`<div class="bffoot">${esc(b.t)}${b.sig ? `<br><b>${esc(b.sig)}</b>` : ''}</div>`);
  });
  return h.join('') + '</div>';
}

/* ---------- PDF (jsPDF) ---------- */
function briefPDF(M) {
  if (!window.jspdf?.jsPDF) throw new Error('Biblioteca de PDF (jsPDF) indisponível neste ambiente.');
  const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' }), W = 210, MX = 14, CW = W - 2 * MX, BOT = 297 - 19, PT = 0.3528, C = BR_C, HD = briefHeader(M);
  const T = s => pdfSan(s).replace(/ /g, ' ');
  doc.setProperties({ title: T(`Briefing pre-reuniao - ${M.meta.cli}`), subject: 'Briefing Pré-Reunião', creator: 'Gestão de Carteira TOTVS ESN' });
  let y = 0, FOOT = null;
  const bg = () => { doc.setFillColor(...C.bg); doc.rect(0, 0, W, 297, 'F'); };
  const tc = t => t === 'alert' ? C.terra : t === 'ok' ? C.teal : t === 'mut' ? C.mut : C.txt, bgc = t => t === 'alert' ? C.terraBg : t === 'ok' ? C.tealBg : C.neuBg;
  const page = () => { doc.addPage(); bg(); doc.setFillColor(...C.navy); doc.rect(0, 0, W, 10, 'F'); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.text(T(`Briefing Pré-Reunião · ${HD.title}`).slice(0, 95), MX, 6.4); y = 16; };
  const ensure = h => { if (y + h > BOT) page(); };
  const lines = (t, size, w, bold) => { doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); return doc.splitTextToSize(T(t), w); };
  const chip = (t, x, yy, tone) => { doc.setFont('helvetica', 'bold'); doc.setFontSize(7); const w = doc.getTextWidth(T(t)) + 3.4; doc.setFillColor(...bgc(tone)); doc.roundedRect(x, yy - 3.3, w, 4.6, 1.2, 1.2, 'F'); doc.setTextColor(...(tone ? tc(tone) : C.navy)); doc.text(T(t), x + 1.7, yy); return w; };
  /* cabeçalho executivo */
  bg(); doc.setFillColor(...C.navy); doc.rect(0, 0, W, 38, 'F');
  try { doc.addImage(LOGO_W, 'PNG', MX, 7, 32, 32 * 114 / 396); } catch { }
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.text('Briefing Pré-Reunião', W - MX, 13, { align: 'right' });
  doc.setFontSize(11); doc.text(doc.splitTextToSize(T(HD.title), 120)[0], W - MX, 20, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.text(T(HD.comp ? `Competência ${HD.comp.split('-').reverse().join('/')}` : 'Competência não identificada'), W - MX, 25.5, { align: 'right' });
  doc.splitTextToSize(T(HD.sub), 120).slice(0, 2).forEach((l, i) => doc.text(l, W - MX, 30.5 + i * 4, { align: 'right' }));
  y = 46; let x = MX; HD.tags.forEach(t => { doc.setFont('helvetica', 'bold'); doc.setFontSize(7); const w = doc.getTextWidth(T(t.t)) + 3.4 + 2; if (x + w > W - MX) { x = MX; y += 6; } x += chip(t.t, x, y, t.tone) + 2; }); y += 8;
  const secBar = (n, t) => { ensure(24); doc.setFillColor(...C.navy); doc.rect(MX, y, CW, 7.2, 'F'); doc.setFillColor(...C.teal); doc.rect(MX, y, 9, 7.2, 'F'); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text(n, MX + 4.5, y + 5, { align: 'center' }); doc.setFontSize(9.5); doc.text(T(t).toUpperCase(), MX + 12, y + 5); y += 11; };
  const para = (t, size, tone, bold) => { const ls = lines(t, size, CW - 1, bold), lh = size * PT * 1.4; ensure(ls.length * lh + 2); doc.setTextColor(...tc(tone)); ls.forEach(l => { doc.text(l, MX, y + size * PT); y += lh; }); y += 1.5; };
  const note = (t, tone) => { const ls = lines(t, 8.2, CW - 6), lh = 8.2 * PT * 1.4, h = ls.length * lh + 4; ensure(h + 2); doc.setFillColor(...bgc(tone)); doc.rect(MX, y, CW, h, 'F'); doc.setFillColor(...tc(tone)); doc.rect(MX, y, 1.2, h, 'F'); doc.setTextColor(...C.txt); ls.forEach((l, i) => doc.text(l, MX + 4, y + 2.4 + 8.2 * PT + i * lh)); y += h + 2.5; };
  const kv = rows => { const kw = 46; rows.forEach(([k, v]) => { const ls = lines(String(v), 8.5, CW - kw - 2), lh = 8.5 * PT * 1.35, h = Math.max(ls.length * lh, lh) + 2; ensure(h); doc.setFillColor(...C.alt); doc.rect(MX, y, CW, h, 'F'); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.2); doc.setTextColor(...C.navy); doc.text(T(k), MX + 2, y + 1 + 8.2 * PT); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...C.txt); ls.forEach((l, i) => doc.text(l, MX + kw, y + 1 + 8.5 * PT + i * lh)); doc.setDrawColor(...C.line); doc.setLineWidth(.15); doc.line(MX, y + h, MX + CW, y + h); y += h; }); y += 3; };
  const kpis = items => { const n = items.length, g = 3, w = (CW - g * (n - 1)) / n; ensure(19); items.forEach((it, i) => { const xx = MX + i * (w + g); doc.setFillColor(255, 255, 255); doc.setDrawColor(...C.line); doc.setLineWidth(.2); doc.roundedRect(xx, y, w, 16, 1.5, 1.5, 'FD'); doc.setFillColor(...(it.tone === 'alert' ? C.terra : C.teal)); doc.rect(xx, y + 2, 1, 12, 'F'); doc.setFont('helvetica', 'normal'); doc.setFontSize(6.8); doc.setTextColor(...C.mut); doc.splitTextToSize(T(it.l), w - 5).slice(0, 2).forEach((l, j) => doc.text(l, xx + 3, y + 4.2 + j * 3)); doc.setFont('helvetica', 'bold'); doc.setFontSize(it.v.length > 13 ? 10 : 12); doc.setTextColor(...(it.tone === 'alert' ? C.terra : C.navy)); doc.text(T(it.v), xx + 3, y + 13.2); }); y += 19.5; };
  const sub = t => { ensure(12); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...C.teal); doc.text(T(t), MX, y + 3); doc.setDrawColor(...C.teal); doc.setLineWidth(.25); doc.line(MX, y + 4.4, MX + CW, y + 4.4); y += 7.5; };
  const list = items => items.forEach(t => { const ls = lines(t, 8.5, CW - 6), lh = 8.5 * PT * 1.35; ensure(ls.length * lh + 1); doc.setFillColor(...C.teal); doc.circle(MX + 1.6, y + 2.2, .6, 'F'); doc.setTextColor(...C.txt); ls.forEach(l => { doc.text(l, MX + 4.5, y + 8.5 * PT); y += lh; }); y += .8; });
  const bars = rows => rows.forEach(r => { ensure(12); const p = r.b ? r.a / r.b : 0, ex = r.a > r.b; doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...C.txt); doc.text(doc.splitTextToSize(T(r.l), CW * .55)[0], MX, y + 3); doc.setTextColor(...(ex ? C.terra : C.teal)); doc.setFont('helvetica', 'bold'); doc.text(T(`${brNum(r.a)} / ${brNum(r.b)} (${brPctTxt(Math.round(p * 1000) / 10)})${ex ? ' EXCEDENTE' : ''}`), MX + CW, y + 3, { align: 'right' }); doc.setFillColor(226, 228, 220); doc.rect(MX, y + 4.6, CW, 3, 'F'); doc.setFillColor(...(ex ? C.terra : C.teal)); doc.rect(MX, y + 4.6, CW * Math.min(1, p), 3, 'F'); y += 10.5; });
  const dept = b => { ensure(22); doc.setFillColor(...C.neuBg); doc.rect(MX, y, CW, 6.6, 'F'); doc.setFillColor(...C.teal); doc.rect(MX, y, 1.4, 6.6, 'F'); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...C.navy); doc.text(T(b.t), MX + 4, y + 4.5); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...C.mut); doc.text(doc.splitTextToSize(T(b.s), CW * .62)[0], MX + CW - 2, y + 4.4, { align: 'right' }); y += 8.2; };
  const table = b => {
    const cols = b.cols.map(c => ({ ...c, w: c.w * CW })), pad = 1.6, fs = 7.8, lh = fs * PT * 1.32;
    const head = () => { ensure(14); doc.setFillColor(...C.navy); doc.rect(MX, y, CW, 6.2, 'F'); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.4); doc.setTextColor(255, 255, 255); let xx = MX; cols.forEach(c => { c.a === 'r' ? doc.text(T(c.h), xx + c.w - pad, y + 4.2, { align: 'right' }) : doc.text(T(c.h), xx + pad, y + 4.2); xx += c.w; }); y += 6.2; };
    const row = (r, i, isFoot) => {
      const ls = r.map((c, j) => { const o = c && typeof c === 'object' ? c : { t: c }; return (o.chip ? [String(o.t)] : lines(String(o.t ?? ''), fs, cols[j].w - 2 * pad, o.b || isFoot)).slice(0, 6); });
      const h = Math.max(...ls.map(l => l.length)) * lh + 2.2; if (y + h > BOT) { page(); head(); }
      doc.setFillColor(...(isFoot ? C.tealBg : i % 2 ? C.alt : [255, 255, 255])); doc.rect(MX, y, CW, h, 'F'); let xx = MX;
      r.forEach((c, j) => { const o = c && typeof c === 'object' ? c : { t: c }; doc.setFont('helvetica', o.b || isFoot ? 'bold' : 'normal'); doc.setFontSize(fs); doc.setTextColor(...(o.tone ? tc(o.tone) : isFoot ? C.navy : C.txt));
        if (o.chip) chip(o.t, xx + pad - .4, y + 4, o.tone); else ls[j].forEach((l, k) => { const ty = y + 1.1 + fs * PT + k * lh; cols[j].a === 'r' ? doc.text(l, xx + cols[j].w - pad, ty, { align: 'right' }) : doc.text(l, xx + pad, ty); }); xx += cols[j].w; });
      doc.setDrawColor(...C.line); doc.setLineWidth(.12); doc.line(MX, y + h, MX + CW, y + h); y += h;
    };
    head(); b.rows.forEach((r, i) => row(r, i)); if (b.foot) row(b.foot, 0, true); y += 3.5;
  };
  briefBlocks(M).forEach(b => {
    if (b.k === 'sec') secBar(b.n, b.t); else if (b.k === 'h') sub(b.t); else if (b.k === 'p') para(b.t, 8.5, b.tone); else if (b.k === 'note') note(b.t, b.tone);
    else if (b.k === 'kv') kv(b.rows); else if (b.k === 'kpis') kpis(b.items); else if (b.k === 'list') list(b.items); else if (b.k === 'dept') dept(b); else if (b.k === 'bars') bars(b.rows); else if (b.k === 'table') table(b);
    else if (b.k === 'foot') FOOT = b;
  });
  const n = doc.getNumberOfPages();
  for (let p = 1; p <= n; p++) {
    doc.setPage(p); const last = p === n && FOOT, y0 = last ? 297 - 17.5 : 297 - 12; doc.setDrawColor(...C.line); doc.setLineWidth(.2); doc.line(MX, y0, W - MX, y0); doc.setFont('helvetica', 'normal'); doc.setFontSize(6.8); doc.setTextColor(...C.mut);
    if (last) { doc.splitTextToSize(T(FOOT.t), CW - 14).slice(0, 3).forEach((l, i) => doc.text(l, MX, y0 + 3.4 + i * 2.9)); if (FOOT.sig) { doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...C.navy); doc.text(T(FOOT.sig), MX, 297 - 4.2); } }
    else doc.text(T(`Fonte: ficha de faturamento ${M.files[0] || ''}${M.files.length > 1 ? ' +' + (M.files.length - 1) : ''} · ${M.comp ? M.comp.split('-').reverse().join('/') : 'sem competência'} · gerado localmente · não constitui proposta comercial`).slice(0, 150), MX, 297 - 8);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...C.mut); doc.text(`${p} / ${n}`, W - MX, 297 - 4.2, { align: 'right' });
  }
  return doc.output('blob');
}
async function briefExport(key) {
  const c = S.clients[key]; if (!c) return;
  if (!briefFichas(c).length) { UI.ctab = 'briefing'; render(); return toast('Anexe a ficha de faturamento do cliente para gerar o briefing.'); }
  try { await vend('jspdf'); const M = briefModel(c, UI.briefComp), blob = briefPDF(M); await offer(`briefing-${safeKey(c.code || c.name).slice(0, 40)}-${M.comp || 'sem-competencia'}.pdf`, blob); (c.exec ||= {}).lastBrief = { at: nowISO(), comp: M.comp, itens: M.n }; touchC(key); }
  catch (e) { toast('Falha ao gerar briefing: ' + e.message); }
}

/* ---------- Aba ---------- */
function tabBrief(c) {
  const fs = briefFichas(c), spec = `<details class="sm" style="margin-top:8px"><summary>Prompt pré-programado (somente leitura)</summary><pre class="sm" style="white-space:pre-wrap;background:#f6f8f9;padding:10px;border-radius:8px">${esc(BRIEF_PROMPT)}</pre></details>`;
  if (!fs.length) return `<div class="card"><h3>Briefing pré-reunião</h3><div class="alert"><b>Ficha de faturamento obrigatória.</b> O briefing é gerado a partir da ficha de faturamento do cliente (contrato, proposta, condição de pagamento, VAL_TOTAL, VAL_LIQD, produtos e quantidades). Anexe a ficha para continuar.</div>
  <div class="row"><button class="btn pri" data-a="ctab" data-v="fichas">Anexar ficha agora</button><span class="muted sm">Preferencialmente XLSX/CSV com as colunas da ficha.</span></div>${spec}</div>`;
  const M = briefModel(c, UI.briefComp), warn = [];
  if (!M.rows.length) warn.push('Nenhuma linha de produto com valor foi identificada na ficha.');
  else if (M.textOnly) warn.push('A ficha foi lida como texto (PDF ou arquivo enviado antes deste recurso): sem colunas de quantidade, valor unitário e valor líquido. Para o briefing completo, remova a ficha na aba Fichas e envie novamente em XLSX/CSV.');
  else if (M.liq == null) warn.push('Coluna de valor líquido (VAL_LIQD) não identificada na ficha.');
  return `<div class="card"><div class="row"><h3>Briefing pré-reunião</h3><span class="sp"></span>${M.comps.length > 1 ? `<label class="sm">Competência <select data-c="briefComp">${M.comps.map(x => `<option value="${esc(x)}" ${x === M.comp ? 'selected' : ''}>${esc(x.split('-').reverse().join('/'))}</option>`).join('')}</select></label>` : ''}<button class="btn pri" data-a="briefPdf" data-k="${kk(c)}" ${M.rows.length ? '' : 'disabled'}>Gerar briefing (PDF)</button></div>
  <p class="sm muted">Gerado localmente a partir da ficha de faturamento (${esc(M.files.join('; '))}). Nenhum dado é enviado a IA. ${c.exec?.lastBrief ? `Último PDF: ${esc(fmtDate(c.exec.lastBrief.at))}.` : ''}</p>${warn.map(w => `<div class="alert">${esc(w)}</div>`).join('')}${spec}</div>
  ${M.rows.length ? `<div class="a4wrap bfwrap">${briefHTML(M)}</div>` : ''}`;
}
