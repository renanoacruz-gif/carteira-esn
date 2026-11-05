/* ===== CONSULTA DE CNPJ (dados cadastrais públicos) =====
   Provedores TERCEIROS que republicam a base pública do CNPJ — NÃO são APIs oficiais da Receita Federal. A consulta passa pelo backend (Worker).
   Nada de faturamento, número de colaboradores, capacidade financeira ou segmento comercial é deduzido destes dados. O CNPJ consultado é enviado ao provedor escolhido.
   Busca por nome/localização: NÃO implementada (nenhum dos provedores suportados oferece busca pública confiável). */
const CN_PROVS = { brasilapi: 'BrasilAPI', cnpjws: 'CNPJ.ws (API pública)', receitaws: 'ReceitaWS' };
const CN_CACHE_H = 6;
const cnCfg = () => (S.meta.cnpjCfg ||= { prov: 'brasilapi', fallback: false, auto: false });
UI.cn ||= { q: '', sel: null, err: null, busy: false, vinc: null };
const cnFmtD = v => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v || ''); return m ? `${m[3]}/${m[2]}/${m[1]}` : v || '—'; };
const cnRec = c => S.cnpj.find(r => r.id === c);
const cnClienteDe = c => Object.values(S.clients).find(x => x.cnpj === c);
const cnMesmaRaiz = c => Object.values(S.clients).filter(x => x.cnpj && x.cnpj !== c && x.cnpj.slice(0, 8) === c.slice(0, 8));
function cnSan(d) {
  const e = d.endereco || {}, cn = x => x && x.codigo ? { codigo: s4(x.codigo, 8), formatado: s4(x.formatado, 14), descricao: s4(x.descricao, 200) } : null;
  return { cnpj: s4(d.cnpj, 14), razaoSocial: s4(d.razaoSocial, 200), nomeFantasia: s4(d.nomeFantasia, 200), situacao: s4(d.situacao, 40), dataSituacao: s4(d.dataSituacao, 10) || null, abertura: s4(d.abertura, 10) || null, tipo: s4(d.tipo, 20), naturezaJuridica: s4(d.naturezaJuridica, 120), porte: s4(d.porte, 60), capitalSocial: typeof d.capitalSocial === 'number' ? d.capitalSocial : null, cnaePrincipal: cn(d.cnaePrincipal), cnaesSecundarios: cap(d.cnaesSecundarios, 60).map(cn).filter(Boolean), simples: typeof d.simples === 'boolean' ? d.simples : null,
    endereco: { logradouro: s4(e.logradouro, 160), numero: s4(e.numero, 20), complemento: s4(e.complemento, 80), bairro: s4(e.bairro, 80), municipio: s4(e.municipio, 80), uf: s4(e.uf, 2), cep: s4(e.cep, 10) } };
}
/* Importa a resposta do backend (direta ou arquivo). Nunca grava dado de resposta com falha como se fosse cadastral. */
async function cnpjResposta(j) {
  const c = digits(j.cnpj);
  if (!j.ok) {
    const er = { codigo: s4(j.erro?.codigo, 40), mensagem: s4(j.erro?.mensagem, 300), aguardarSegundos: +j.erro?.aguardarSegundos || null };
    UI.cn.err = { cnpj: c, ...er, at: new Date().toISOString() }; UI.cn.busy = false;
    intLog({ sistema: 'cnpj', op: 'consulta', estado: 'erro', msg: er.codigo + ': ' + er.mensagem }); intSet('cnpj', { at: UI.cn.err.at, ok: false, msg: er.mensagem });
    log(`Consulta de CNPJ falhou: ${er.mensagem}`, 'bad'); render(); return;
  }
  if (!validCnpj(c) || !j.dados?.razaoSocial) { UI.cn.err = { cnpj: c, codigo: 'resposta_invalida', mensagem: 'Resposta sem CNPJ válido ou razão social.', at: new Date().toISOString() }; render(); return; }
  const prev = cnRec(c), d = cnSan({ ...j.dados, cnpj: c });
  const rec = { id: c, cnpj: c, at: new Date().toISOString(), consultadoEm: s4(j.consultadoEm, 40) || new Date().toISOString(), provedor: s4(j.provedor, 20), provedorNome: s4(j.provedorNome, 60), oficial: false, daCache: !!j.daCache, aviso: s4(j.aviso, 300), fallbackUsado: !!j.fallbackUsado, tentativas: cap(j.tentativas, 5).map(t => ({ provedor: s4(t.provedor, 20), ok: !!t.ok, codigo: s4(t.codigo, 30) })), via: BK.direto === true && !UI.cn.manual ? 'direto' : 'arquivo', dados: d, por: ME.id || '',
    hist: [prev ? { consultadoEm: prev.consultadoEm, provedor: prev.provedorNome, situacao: prev.dados.situacao, razaoSocial: prev.dados.razaoSocial } : null, ...(prev?.hist || [])].filter(Boolean).slice(0, 10) };
  if (prev) S.cnpj.splice(S.cnpj.indexOf(prev), 1); S.cnpj.unshift(rec); while (S.cnpj.length > 300) { const x = S.cnpj.pop(); dropG('cnpj', x.id); } touchG('cnpj', rec.id);
  UI.cn.sel = c; UI.cn.err = null; UI.cn.busy = false; UI.cn.manual = false;
  intLog({ sistema: 'cnpj', op: 'consulta', estado: 'ok', msg: `${rec.provedorNome}${rec.daCache ? ' (cache do backend)' : ''}`, n: 1 }); intSet('cnpj', { at: rec.at, ok: true, msg: rec.provedorNome });
  const cl = cnClienteDe(c); if (cl && UI.cn.enrich === cl.key) { cnAplicarSnapshot(cl, rec, {}, true); UI.cn.enrich = null; }
  log(`CNPJ ${fmtCnpj(c)} consultado em ${rec.provedorNome}.`, 'ok'); render();
}
async function cnpjConsultar(raw, atualizar) {
  const c = digits(raw); if (!validCnpj(c)) { UI.cn.err = { cnpj: c, codigo: 'cnpj_invalido', mensagem: 'CNPJ inválido (14 dígitos com dígitos verificadores corretos).', at: new Date().toISOString() }; return render(); }
  const loc = cnRec(c); if (loc && !atualizar && Date.now() - new Date(loc.at).getTime() < CN_CACHE_H * 3600e3) { UI.cn.sel = c; UI.cn.err = null; return render(); }
  const cfg = cnCfg(); UI.cn.busy = true; UI.cn.err = null; render();
  const pedido = { versao: 1, pedidoId: 'c_' + uid(), tipo: 'cnpj', cnpj: c, provedor: cfg.prov, fallback: !!cfg.fallback, atualizar: !!atualizar };
  try {
    const r = await bkChamar('cnpj', pedido, `pedido-cnpj-${c}.json`);
    if (r.via === 'direto') { UI.cn.manual = false; await cnpjResposta(r.resp); return; }
    UI.cn.manual = true; UI.cn.busy = false; UI.cn.pendente = c; toast(`Pedido de consulta gerado. ${r.motivo ? r.motivo + ' ' : ''}Envie o arquivo na página do backend e importe a resposta.`);
  } catch (e) { UI.cn.busy = false; UI.cn.err = { cnpj: c, codigo: e.codigo || 'erro', mensagem: e.message, at: new Date().toISOString() }; intLog({ sistema: 'cnpj', op: 'consulta', estado: 'erro', msg: e.message }); intSet('cnpj', { at: UI.cn.err.at, ok: false, msg: e.message }); }
  render();
}
/* Campos comparáveis entre o cadastro público e a ficha do cliente. Só vazio→preenchido é automático; diferente vira revisão. */
function cnDiff(c, rec) {
  const d = rec.dados, e = d.endereco, out = [];
  const add = (k, l, cur, ext, cmp) => { cur = String(cur ?? '').trim(); ext = String(ext ?? '').trim(); if (!ext) return; out.push({ k, l, cur, ext, eq: !!cur && (cmp ? cmp(cur, ext) : norm(cur) === norm(ext)), vazio: !cur }); };
  add('name', 'Razão social', c.name, d.razaoSocial, (a, b) => normName(a) === normName(b));
  add('uf', 'UF', c.uf, e.uf); add('city', 'Município', c.city, e.municipio);
  return out;
}
function cnAplicarSnapshot(c, rec, dec, soSnap) {
  const d = rec.dados, o = `Consulta de CNPJ • ${rec.provedorNome} • ${dtBR(rec.consultadoEm)}`; cadInit(c);
  c.cnpjCad = { consultadoEm: rec.consultadoEm, provedor: rec.provedorNome, razaoSocial: d.razaoSocial, nomeFantasia: d.nomeFantasia, situacao: d.situacao, dataSituacao: d.dataSituacao, abertura: d.abertura, tipo: d.tipo, naturezaJuridica: d.naturezaJuridica, porte: d.porte, capitalSocial: d.capitalSocial, cnaePrincipal: d.cnaePrincipal, cnaesSecundarios: d.cnaesSecundarios.slice(0, 20), simples: d.simples, municipio: d.endereco.municipio, uf: d.endereco.uf, oficial: false };
  if (!soSnap) cnDiff(c, rec).forEach(x => {
    if (x.vazio) { if (x.k === 'name') c.name = x.ext; else if (x.k === 'uf') c.uf = x.ext.toUpperCase(); else c.city = x.ext; return; }
    if (x.eq) return;
    if (dec[x.k] === 'usar') { if (x.k === 'name') c.name = x.ext; else if (x.k === 'uf') c.uf = x.ext.toUpperCase(); else c.city = x.ext; c.cadConf = [{ id: 'cf_' + uid(), campo: x.l, de: x.cur, para: x.ext, fonte: o, at: nowISO(), res: 'substituído pelo usuário na vinculação' }, ...(c.cadConf || [])].slice(0, 30); }
    else c.cadConf = [{ id: 'cf_' + uid(), campo: x.l, de: x.cur, para: x.ext, fonte: o, at: nowISO(), res: null }, ...(c.cadConf || [])].slice(0, 30);
  });
  touchC(c.key);
}
function cnAdd(cnpj) {
  const rec = cnRec(cnpj); if (!rec) return; if (cnClienteDe(cnpj)) return toast('Já existe cliente com este CNPJ. Use "Atualizar cliente existente".');
  const used = new Set(Object.keys(S.clients)); let key = safeKey('j_' + cnpj); if (used.has(key)) { let n = 2; while (used.has(key + '_' + n)) n++; key += '_' + n; }
  const d = rec.dados, c = S.clients[key] = { key, code: '', name: d.razaoSocial, cnpj: cnpj, cnpjRaw: '', seg: '', city: d.endereco.municipio, size: '', mrr: null, productsRaw: '', churn: '', nps: '', notes: '', uf: d.endereco.uf.toUpperCase(), regime: '', release: '', fichas: [], docs: [], mgmt: {}, act: {}, src: { file: 'Consulta de CNPJ', sheet: '', row: 0 } };
  cnAplicarSnapshot(c, rec, {}, true); ensureIids(); reanalyze([key], 'Cliente criado pela Consulta de CNPJ'); log(`Cliente "${c.name}" adicionado à carteira a partir da Consulta de CNPJ (sem código TOTVS, segmento ou MRR — preencha na importação/cadastro).`, 'ok'); UI.cn.vinc = null; render();
}
function cnVincular(cnpj, key, dec) {
  const rec = cnRec(cnpj), c = S.clients[key]; if (!rec || !c) return;
  if (c.cnpj && c.cnpj !== cnpj) return toast('O cliente tem outro CNPJ. Não é possível vincular sem corrigir o cadastro.');
  if (!c.cnpj) { c.cnpj = cnpj; c.cnpjRaw = ''; }
  cnAplicarSnapshot(c, rec, dec || {}); reanalyze([key], 'Cadastro atualizado pela Consulta de CNPJ'); log(`Cliente "${c.name}" atualizado com a consulta de CNPJ (divergências ficaram em Conflitos de cadastro).`, 'ok'); UI.cn.vinc = null; render();
}
const CN_ACT = {
  cnConsultar: () => cnpjConsultar(UI.cn.q, false),
  cnAtualizar: t => cnpjConsultar(t.dataset.c14 || UI.cn.sel, true),
  cnAbrir: t => { UI.cn.sel = t.dataset.c14; UI.cn.err = null; UI.cn.vinc = null; render(); },
  cnAdd: t => cnAdd(t.dataset.c14),
  cnVincAbrir: t => { UI.cn.vinc = { c14: t.dataset.c14, key: t.dataset.k, dec: {} }; UI.cn.sel = t.dataset.c14; UI.view = 'cnpj'; render(); window.scrollTo(0, 0); },
  cnVincOk: () => { const v = UI.cn.vinc; if (v) cnVincular(v.c14, v.key, v.dec); },
  cnVincCancel: () => { UI.cn.vinc = null; render(); },
  cnDel: t => { const r = cnRec(t.dataset.c14); if (!r) return; S.cnpj.splice(S.cnpj.indexOf(r), 1); dropG('cnpj', r.id); if (UI.cn.sel === r.id) UI.cn.sel = null; render(); },
  cnLimpar: () => { S.cnpj.forEach(r => dropG('cnpj', r.id)); S.cnpj = []; UI.cn.sel = null; render(); },
  cnAtualizarCli: t => { const c = S.clients[t.dataset.k]; if (!c?.cnpj) return; UI.cn.enrich = c.key; cnpjConsultar(c.cnpj, true); },
  cnDec: t => { if (UI.cn.vinc) { UI.cn.vinc.dec[t.dataset.f] = t.value; } }
};
function cnChange(t, c, v) {
  if (c === 'cnprov') { cnCfg().prov = CN_PROVS[v] ? v : 'brasilapi'; touchMeta(); render(); return true; }
  if (c === 'cnfb') { cnCfg().fallback = t.checked; touchMeta(); render(); return true; }
  if (c === 'cnauto') { cnCfg().auto = t.checked; touchMeta(); render(); return true; }
  if (c === 'cndec') { CN_ACT.cnDec(t); return true; }
  return false;
}
/* Enriquecimento ao abrir um cliente: só com chamada direta disponível, habilitado, sem consulta recente. Nunca bloqueia a tela nem sobrescreve dados. */
function cnAutoAoAbrir(key) {
  const c = S.clients[key], cfg = cnCfg(); if (!c?.cnpj || !cfg.auto || BK.direto !== true || UI.cn.busy) return;
  const rec = cnRec(c.cnpj); if (rec && Date.now() - new Date(rec.at).getTime() < 7 * 86400e3) return;
  UI.cn.enrich = key; cnpjConsultar(c.cnpj, false);
}
function cnDados(rec) {
  const d = rec.dados, e = d.endereco, sit = norm(d.situacao), ok = sit === 'ativa';
  const row = (l, v) => v ? `<tr><th scope="row">${l}</th><td>${esc(v)}</td></tr>` : '';
  return `<div class="alert ${ok ? 'i' : 'b'}"><b>Situação cadastral:</b> ${esc(d.situacao || 'não informada')}${d.dataSituacao ? ' desde ' + cnFmtD(d.dataSituacao) : ''}${ok ? '' : ' — atenção antes de qualquer abordagem comercial.'}</div>
  <table class="sm"><tbody>${row('Razão social', d.razaoSocial)}${row('Nome fantasia', d.nomeFantasia)}${row('CNPJ', fmtCnpj(rec.cnpj) + (d.tipo ? ' • ' + d.tipo : ''))}${row('Abertura', d.abertura ? cnFmtD(d.abertura) : '')}${row('Natureza jurídica', d.naturezaJuridica)}${row('Porte (Receita)', d.porte)}${row('Capital social', d.capitalSocial != null ? 'R$ ' + d.capitalSocial.toLocaleString('pt-BR') + ' (não é faturamento)' : '')}${row('Optante pelo Simples', d.simples == null ? '' : d.simples ? 'Sim' : 'Não')}
  ${row('CNAE principal', d.cnaePrincipal ? `${d.cnaePrincipal.formatado} — ${d.cnaePrincipal.descricao}` : '')}${row('Endereço', [e.logradouro, e.numero, e.complemento, e.bairro, e.municipio && e.uf ? e.municipio + '/' + e.uf : e.municipio || e.uf, e.cep].filter(Boolean).join(', '))}</tbody></table>
  ${d.cnaesSecundarios.length ? `<details><summary class="sm">CNAEs secundários (${d.cnaesSecundarios.length})</summary><ul class="sm">${d.cnaesSecundarios.map(x => `<li>${esc(x.formatado)} — ${esc(x.descricao)}</li>`).join('')}</ul></details>` : ''}`;
}
function cnVincPanel() {
  const v = UI.cn.vinc; if (!v) return ''; const rec = cnRec(v.c14), c = S.clients[v.key]; if (!rec || !c) return '';
  const df = cnDiff(c, rec), rows = df.map(x => `<tr><td><b>${esc(x.l)}</b></td><td>${esc(x.cur) || '<span class="muted">vazio</span>'}</td><td>${esc(x.ext)}</td><td class="sm">${x.vazio ? 'será preenchido' : x.eq ? 'igual' : `<select data-c="cndec" data-f="${x.k}"><option value="manter">Manter o da carteira</option><option value="usar">Usar o do CNPJ</option></select>`}</td></tr>`).join('');
  return `<div class="card" style="border-left:4px solid var(--azul)"><h4>Atualizar “${esc(c.name)}” com o cadastro público</h4>${!c.cnpj ? '<div class="alert b">O cliente não tem CNPJ: ao confirmar, este CNPJ passa a ser o dele (ação sua, explícita).</div>' : ''}
  <div class="tw"><table><thead><tr><th>Campo</th><th>Na carteira</th><th>No CNPJ</th><th>Ação</th></tr></thead><tbody>${rows}</tbody></table></div><p class="sm muted">Nada é sobrescrito sem sua escolha; divergências mantidas ficam registradas em “Conflitos de cadastro” do cliente. Segmento, MRR, código TOTVS, faturamento e colaboradores não são alterados.</p>
  <div class="row"><button class="btn pri" data-a="cnVincOk">Confirmar</button><button class="btn ghost" data-a="cnVincCancel">Cancelar</button></div></div>`;
}
function vCnpj() {
  const cfg = cnCfg(), s = UI.cn, rec = s.sel ? cnRec(s.sel) : null, modo = bkModo();
  let h = `<div class="card"><h3>Consulta de CNPJ</h3><p class="sm">Dados cadastrais <b>públicos</b> republicados por provedores terceiros (${Object.values(CN_PROVS).join(', ')}). <b>Não são APIs oficiais da Receita Federal</b> e podem estar defasados. O CNPJ digitado é enviado ao provedor escolhido (via backend). Não deduz faturamento, número de colaboradores, segmento comercial nem capacidade financeira.</p>
  <div class="row"><input type="text" id="cnq" data-i="cnq" inputmode="numeric" placeholder="00.000.000/0000-00" value="${esc(s.q)}" style="max-width:260px" aria-label="CNPJ"><button class="btn pri" data-a="cnConsultar" ${s.busy ? 'disabled' : ''}>Consultar</button>
  <label class="sm">Provedor <select data-c="cnprov">${Object.entries(CN_PROVS).map(([k, l]) => optS(k, l, cfg.prov)).join('')}</select></label>
  <label class="sm"><input type="checkbox" data-c="cnfb" ${cfg.fallback ? 'checked' : ''}> tentar os outros se falhar</label></div>
  <p class="sm muted">Transporte: <b>${esc(BK_TXT[modo])}</b>. Busca por nome/localização: <b>indisponível</b> — nenhum provedor suportado oferece busca pública confiável; informe o CNPJ. ${bkPronto() ? '' : 'Configure a URL do backend em Configurações de IA.'}</p>
  <label class="sm"><input type="checkbox" data-c="cnauto" ${cfg.auto ? 'checked' : ''}> Atualizar o cadastro em segundo plano ao abrir um cliente (somente com chamada direta ao backend; no artefato fica inativo)</label></div>`;
  if (s.manual && s.pendente) h += `<div class="alert i"><b>Pedido gerado para ${esc(fmtCnpj(s.pendente))}.</b> Envie o arquivo <code>pedido-cnpj-${esc(s.pendente)}.json</code> na página do backend e importe a resposta: <label class="btn ghost sm" style="cursor:pointer">Importar resposta<input type="file" id="f-ai2" accept=".json" hidden></label></div>`;
  if (s.err) h += `<div class="alert b" role="alert"><b>${esc(s.err.codigo)}</b>: ${esc(s.err.mensagem)}${s.err.aguardarSegundos ? ` Aguarde ~${s.err.aguardarSegundos}s.` : ''}</div>`;
  if (s.busy) h += `<div class="alert i" role="status">Consultando…</div>`;
  if (rec) {
    const cl = cnClienteDe(rec.cnpj), raiz = cnMesmaRaiz(rec.cnpj);
    h += `<div class="card"><h3>${esc(rec.dados.razaoSocial)}</h3><p class="sm muted">Fonte: <b>${esc(rec.provedorNome)}</b> (terceiro, não oficial) • consultado em ${esc(dtBR(rec.consultadoEm))} • ${rec.daCache ? 'cache do backend' : 'consulta nova'} • via ${esc(rec.via)}${rec.fallbackUsado ? ' • provedor alternativo usado' : ''}</p>
    ${cnDados(rec)}
    <div class="row" style="margin-top:8px">${cl ? `<span class="pill p-ok">Cliente na carteira: ${esc(cl.name)}</span><button class="btn ghost sm" data-a="cnVincAbrir" data-c14="${rec.cnpj}" data-k="${esc(cl.key)}">Atualizar cliente existente</button><button class="btn ghost sm" data-a="open" data-k="${esc(cl.key)}">Abrir cliente</button>` : `<button class="btn pri sm" data-a="cnAdd" data-c14="${rec.cnpj}">Adicionar à carteira</button>`}<button class="btn ghost sm" data-a="cnAtualizar" data-c14="${rec.cnpj}">Consultar novamente</button><button class="btn ghost sm" data-a="cnDel" data-c14="${rec.cnpj}">Remover do histórico</button></div>
    ${!cl && raiz.length ? `<div class="alert i sm">Há ${raiz.length} cliente(s) com a mesma raiz de CNPJ (matriz/filial): ${raiz.map(x => esc(x.name)).join('; ')}. Não são vinculados automaticamente. Para vincular a um deles, abra o cliente e use “Atualizar cadastro”.</div>` : ''}
    ${!cl ? `<p class="sm muted">Ao adicionar, o cliente nasce sem código TOTVS, segmento, MRR ou porte comercial — nada disso é deduzido do CNPJ. Preencha por importação ou cadastro, com fonte.</p>` : ''}
    ${(rec.hist || []).length ? `<details><summary class="sm">Consultas anteriores deste CNPJ (${rec.hist.length})</summary><ul class="sm">${rec.hist.map(x => `<li>${esc(dtBR(x.consultadoEm))} • ${esc(x.provedor)} • ${esc(x.situacao)}</li>`).join('')}</ul></details>` : ''}</div>`;
    h += cnVincPanel();
  }
  h += `<div class="card"><h3>Histórico e cache local (${S.cnpj.length})</h3>${S.cnpj.length ? `<div class="tw"><table><thead><tr><th>CNPJ</th><th>Razão social</th><th>Situação</th><th>Fonte</th><th>Consulta</th><th>Cliente</th><th></th></tr></thead><tbody>${S.cnpj.slice(0, 50).map(r => { const cl = cnClienteDe(r.cnpj); return `<tr><td>${esc(fmtCnpj(r.cnpj))}</td><td>${esc(r.dados.razaoSocial)}</td><td>${esc(r.dados.situacao)}</td><td class="sm">${esc(r.provedorNome)}</td><td class="sm">${esc(dtBR(r.consultadoEm))}</td><td class="sm">${cl ? esc(cl.name) : '—'}</td><td><button class="btn ghost sm" data-a="cnAbrir" data-c14="${r.cnpj}">Ver</button></td></tr>`; }).join('')}</tbody></table></div><div class="row"><button class="btn ghost sm" data-a="cnLimpar">Limpar histórico de CNPJ</button></div>` : '<p class="sm muted">Nenhuma consulta ainda. As consultas ficam na sua conta (privadas) e são reaproveitadas por até ' + CN_CACHE_H + ' h.</p>'}</div>`;
  return h;
}
/* bloco na página do cliente */
function cnpjBlock(c) {
  const k = c.cnpjCad;
  if (!c.cnpj) return '';
  const body = k ? `<table class="sm"><tbody><tr><th scope="row">Situação</th><td>${esc(k.situacao || '—')}${k.dataSituacao ? ' desde ' + cnFmtD(k.dataSituacao) : ''}</td></tr><tr><th scope="row">CNAE principal</th><td>${k.cnaePrincipal ? esc(k.cnaePrincipal.formatado + ' — ' + k.cnaePrincipal.descricao) : '—'}</td></tr><tr><th scope="row">Natureza / porte (Receita)</th><td>${esc(k.naturezaJuridica || '—')} / ${esc(k.porte || '—')}</td></tr><tr><th scope="row">Abertura</th><td>${k.abertura ? cnFmtD(k.abertura) : '—'}</td></tr></tbody></table><p class="sm muted">Fonte: ${esc(k.provedor)} (terceiro, não oficial) • ${esc(dtBR(k.consultadoEm))}. Não indica faturamento, colaboradores nem capacidade financeira.</p>` : '<p class="sm muted">Cadastro público ainda não consultado.</p>';
  return `<div class="card"><h3>Dados cadastrais públicos (CNPJ)</h3>${body}<div class="row"><button class="btn ghost sm" data-a="cnAtualizarCli" data-k="${esc(c.key)}">${k ? 'Atualizar cadastro' : 'Consultar CNPJ'}</button>${cnRec(c.cnpj) ? `<button class="btn ghost sm" data-a="cnVincAbrir" data-c14="${c.cnpj}" data-k="${esc(c.key)}">Revisar divergências</button>` : ''}</div></div>`;
}
