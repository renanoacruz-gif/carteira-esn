/* ===== FILTROS DA CARTEIRA — operam só sobre S.clients (carteira da conta autenticada) ===== */
const EST_SIT = SIT_L; /* estágio = situação comercial da oportunidade */
const ULT_L = { nunca: 'Sem contato registrado', r30: 'Até 30 dias', r90: '31 a 90 dias', old: 'Mais de 90 dias' };
const PROX_L = { vencida: 'Prazo vencido', d30: 'Prazo nos próximos 30 dias', sem: 'Sem ação com prazo' };
function relOfC(c) { const m = String(c.release || '').match(/12\.1\.(\d+)|^(\d{2,4})$/); if (m) return '12.1.' + (m[1] || m[2]); return (c.rel || []).find(e => e.st === 'confirmado')?.v || ''; }
function facets(c) {
  const ativas = (c.opps || []).filter(o => oppAtiva(c, o)), decs = ativas.map(o => decGet(c, o.ruleId)), t0 = new Date(today() + 'T00:00:00');
  const last = c.mgmt?.last ? new Date(c.mgmt.last + 'T00:00:00') : null, dias = last && !isNaN(last) ? Math.floor((t0 - last) / 864e5) : null;
  const pz = decs.filter(d => d.sit !== 'contratada' && d.prazo).map(d => d.prazo).sort()[0];
  const dp = pz ? Math.floor((new Date(pz + 'T00:00:00') - t0) / 864e5) : null;
  return {
    sol: new Set((c.productsIdent || []).map(p => p.id)), hosp: c.cad?.hosp?.v || 'nao_informado', rel: relOfC(c), est: new Set(decs.map(d => d.sit)),
    ult: dias == null ? 'nunca' : dias <= 30 ? 'r30' : dias <= 90 ? 'r90' : 'old', prox: dp == null ? 'sem' : dp < 0 ? 'vencida' : dp <= 30 ? 'd30' : ''
  };
}
function facetTest(c, f) {
  if (!(f.sol || f.hosp || f.rel || f.est || f.ult || f.prox)) return true; const x = facets(c);
  return (!f.sol || x.sol.has(f.sol)) && (!f.hosp || x.hosp === f.hosp) && (!f.rel || x.rel === f.rel) && (!f.est || x.est.has(f.est)) && (!f.ult || x.ult === f.ult) && (!f.prox || x.prox === f.prox);
}
function facetOpts() { /* só valores que existem na carteira */
  const sols = new Map(), rels = new Set(); clients().forEach(c => { (c.productsIdent || []).forEach(p => sols.set(p.id, p.nome)); const r = relOfC(c); if (r) rels.add(r); });
  return { sols: [...sols].sort((a, b) => a[1].localeCompare(b[1])), rels: [...rels].sort((a, b) => (relKey(b) || 0) - (relKey(a) || 0)) };
}
function facetBar(f) {
  const o = facetOpts(), opt = (v, l, cur) => `<option value="${esc(v)}" ${cur === v ? 'selected' : ''}>${esc(l)}</option>`;
  return `<select data-c="fsol" aria-label="Solução identificada">${opt('', 'Qualquer solução identificada', f.sol)}${o.sols.map(([id, n]) => opt(id, n, f.sol)).join('')}</select>
  <select data-c="fest" aria-label="Estágio da oportunidade">${opt('', 'Qualquer estágio de oportunidade', f.est)}${Object.entries(EST_SIT).map(([k, l]) => opt(k, 'Estágio: ' + l, f.est)).join('')}</select>
  <select data-c="fhosp" aria-label="Ambiente de hospedagem">${opt('', 'Qualquer hospedagem', f.hosp)}${Object.entries(HOSP).map(([k, l]) => opt(k, l, f.hosp)).join('')}</select>
  <select data-c="frel" aria-label="Release">${opt('', 'Qualquer release', f.rel)}${o.rels.map(r => opt(r, r, f.rel)).join('')}</select>
  <select data-c="fult" aria-label="Último contato">${opt('', 'Qualquer último contato', f.ult)}${Object.entries(ULT_L).map(([k, l]) => opt(k, 'Contato: ' + l, f.ult)).join('')}</select>
  <select data-c="fprox" aria-label="Próximas ações">${opt('', 'Qualquer próxima ação', f.prox)}${Object.entries(PROX_L).map(([k, l]) => opt(k, 'Ação: ' + l, f.prox)).join('')}</select>`;
}
