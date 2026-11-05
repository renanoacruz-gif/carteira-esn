/* ===== CONTA, CATÁLOGO COMPARTILHADO E CARTEIRA PRIVADA =====
   Identidade: conta da plataforma (user.id). Carteira: data/users/<id>/ — privada por regra da plataforma.
   Catálogo: coleção "catalogo" (leitura/escrita para quem tem acesso de colaborador ao artefato).
   O app nunca monta caminho a partir de dado digitado: o único identificador de conta vem de user.id(). */
const NM = {}; /* cache id -> nome (só em memória; o banco guarda apenas ids) */
const SOLBASE = new Map(); /* última versão conhecida do catálogo, base da mescla de 3 vias */
const SYS_AUTHOR = 'base inicial';
async function meLoad(user) {
  try { const ps = await wto(user.profiles([ME.id]), 8000); ME.nome = ps?.[ME.id]?.name || ''; } catch { ME.nome = ''; }
  NM[ME.id] = ME.nome;
}
const who = id => !id ? '—' : id === SYS_AUTHOR ? 'Base inicial' : id === ME.id ? (ME.nome ? ME.nome + ' (você)' : 'Você') : (NM[id] || 'Executivo ' + String(id).slice(-4));
async function namesResolve(ids) {
  const miss = [...new Set(ids)].filter(i => i && i !== SYS_AUTHOR && NM[i] === undefined); if (!miss.length || !window.claude) return;
  try { const user = await wto(claude.use('user'), 5000), ps = await wto(user.profiles(miss), 8000); miss.forEach(i => NM[i] = ps?.[i]?.name || ''); render(); } catch { /* nomes indisponíveis: mostra o fim do id */ }
}
const solAuthors = r => [r.criadoPor, r.alteradoPor, ...(r.hist || []).map(h => h.por)].filter(Boolean);

/* ---- o que pode ir ao catálogo: somente dados de produto e fontes ---- */
const SOL_PRIV_KEYS = ['notasInt', 'materiais', '_priv', 'reviewFlags']; /* materiais livres e notas: privados da conta, nunca vão ao catálogo compartilhado */
function solPublic(r) { const o = clone(r); SOL_PRIV_KEYS.forEach(k => delete o[k]); return o; }
function solLeak(r) { /* barreira contra dado de cliente no catálogo: CNPJ, código ou nome de cliente da carteira */
  const t = JSON.stringify(solPublic(r)), tn = norm(t);
  if (CNPJ_RE.test(t) && (t.match(CNPJ_RE) || []).some(x => validCnpj(digits(x)))) return 'contém CNPJ';
  for (const c of Object.values(S.clients)) {
    const nm = norm(c.name || '').trim(); if (nm.length >= 6 && tn.includes(nm)) return `cita o cliente "${c.name}"`;
    const cd = String(c.code || '').trim(); if (cd.length >= 5 && new RegExp('(?<![A-Za-z0-9])' + escRe(cd) + '(?![A-Za-z0-9])').test(t)) return `cita o código de cliente ${cd}`;
  }
  return '';
}
/* mescla de 3 vias: base (última lida) × minha versão × versão atual do catálogo. Nada é sobrescrito em silêncio. */
const SOL_NOMERGE = new Set(['cv', 'hist', 'pend', 'alteradoEm', 'alteradoPor', 'criadoPor', 'rev', 'importacoes', 'id']);
function solMerge3(base, mine, theirs) {
  const out = clone(theirs), pend = [], b0 = base || {}, J = JSON.stringify;
  for (const k of new Set([...Object.keys(mine), ...Object.keys(theirs)])) {
    if (SOL_NOMERGE.has(k) || SOL_PRIV_KEYS.includes(k)) continue;
    const m = J(mine[k]), t = J(theirs[k]), b = J(b0[k]);
    if (m === t || m === b) continue;
    if (t === b) { if (mine[k] === undefined) delete out[k]; else out[k] = clone(mine[k]); continue; }
    if (Array.isArray(mine[k]) && Array.isArray(theirs[k])) { const seen = new Set(theirs[k].map(J)); out[k] = [...theirs[k], ...mine[k].filter(x => !seen.has(J(x)))]; continue; }
    pend.push({ campo: k, atual: theirs[k], novo: mine[k], f: 'edição simultânea de ' + who(ME.id), at: new Date().toISOString(), resolvido: false });
  }
  const un = (a, bb, key) => { const seen = new Set((a || []).map(key)); return [...(a || []), ...(bb || []).filter(x => !seen.has(key(x)))]; };
  out.pend = un(theirs.pend, [...(mine.pend || []), ...pend], x => J([x.campo, x.novo, x.at]));
  out.hist = un(theirs.hist, mine.hist, x => x.at + '|' + x.acao).sort((x, y) => String(y.at).localeCompare(String(x.at))).slice(0, 40);
  out.importacoes = un(theirs.importacoes, mine.importacoes, x => x.at).slice(0, 10);
  out.rev = Math.max(mine.rev || 1, theirs.rev || 1) + 1;
  return { out, conflitos: pend.length };
}
async function pushSol(r, retry = 1) {
  if (!SOL) return; /* sem db: tudo fica em memória */
  if (r._priv) { await SOL.doc(r.id).set(clone(r)); return; }
  if (r.notasInt?.length || r.materiais?.length || SNOTE) { const tem = !!(r.notasInt?.length || r.materiais?.length); try { if (tem) await SNOTE.doc(r.id).set({ id: r.id, notasInt: clone(r.notasInt || []), materiais: clone(r.materiais || []) }); else if (r._notasSalvas) await SNOTE.doc(r.id).delete(); r._notasSalvas = tem; } catch (e) { throw e; } }
  const leak = solLeak(r);
  if (leak) { UI.persist = 'catálogo: gravação bloqueada'; toast(`"${r.nome}" não foi enviada ao catálogo compartilhado: ${leak}. Remova o dado do cliente do registro.`); return; }
  const ref = SOLC.doc(r.id), rem = await ref.get(), mine = solPublic(r), base = SOLBASE.get(r.id);
  let out = mine, info = null;
  if (rem.exists) {
    const rd = clone(rem.data());
    if ((rd.cv || 0) !== (base?.cv || 0) && JSON.stringify(rd) !== JSON.stringify(base)) { const m = solMerge3(base, mine, rd); out = m.out; info = m; }
    else out = { ...mine, importacoes: mine.importacoes };
    out.cv = (rd.cv || 0) + 1; out.criadoPor = rd.criadoPor || (rd.origem === 'base inicial' ? SYS_AUTHOR : '');
  } else { out.cv = 1; out.criadoPor = r.origem === 'base inicial' ? SYS_AUTHOR : ME.id; }
  out.alteradoPor = (r.origem === 'base inicial' && !rem.exists) ? SYS_AUTHOR : ME.id; out.alteradoEm = new Date().toISOString();
  try { await ref.set(out); } catch (e) { if (e.code === 'conflito' && retry > 0) return pushSol(r, retry - 1); /* outro executivo gravou entre a leitura e a escrita: relê e mescla */ throw e; }
  SOLBASE.set(r.id, clone(out));
  const keepNotes = r.notasInt, keepMat = r.materiais, keepFlag = r._notasSalvas; Object.keys(r).forEach(k => delete r[k]); Object.assign(r, clone(out)); if (keepNotes) r.notasInt = keepNotes; if (keepMat) r.materiais = keepMat; if (keepFlag) r._notasSalvas = keepFlag;
  if (info) { toast(`"${r.nome}" foi alterada por outro executivo: versões mescladas${info.conflitos ? `; ${info.conflitos} divergência(s) ficaram pendentes de decisão` : ''}.`); }
  namesResolve(solAuthors(r));
}
async function catalogLoad() {
  const cat = (await wto(SOLC.get(), 10000)).docs.map(d => clone(d.data())), priv = (await wto(SOL.get(), 10000)).docs.map(d => clone(d.data()));
  const notes = {}; try { (await wto(SNOTE.get(), 10000)).docs.forEach(d => { const x = d.data(); notes[x.id] = { n: clone(x.notasInt || []), m: clone(x.materiais || []) }; }); } catch { /* sem notas */ }
  const cid = new Set(cat.map(r => r.id)); cat.forEach(r => { SOLBASE.set(r.id, clone(r)); if (notes[r.id]) { if (notes[r.id].n.length) r.notasInt = notes[r.id].n; if (notes[r.id].m.length) r.materiais = notes[r.id].m; r._notasSalvas = true; } });
  S.privDup = priv.filter(r => cid.has(r.id)).length; /* cópias privadas antigas já presentes no catálogo (o catálogo prevalece) */
  const legacy = priv.filter(r => !cid.has(r.id)).map(r => ({ ...r, _priv: true }));
  namesResolve(cat.flatMap(solAuthors));
  return [...cat, ...legacy];
}
let _cwT = null;
function catalogWatch() { /* alterações feitas por outros executivos aparecem sem recarregar; registros com edição local pendente não são tocados */
  try { SOLC.onSnapshot?.(snap => {
    let chg = 0; (snap?.docs || []).forEach(d => {
      const rd = clone(d.data()), loc = S.solutions.find(x => x.id === rd.id), bs = SOLBASE.get(rd.id);
      if (!loc) { S.solutions.push(rd); SOLBASE.set(rd.id, clone(rd)); chg++; return; }
      if (loc._priv || dirtyS.has(rd.id) || (bs?.cv || 0) >= (rd.cv || 0)) return;
      const notes = loc.notasInt, mats = loc.materiais; Object.keys(loc).forEach(k => delete loc[k]); Object.assign(loc, rd); if (notes) loc.notasInt = notes; if (mats) loc.materiais = mats; SOLBASE.set(rd.id, clone(rd)); chg++;
    });
    if (chg) { clearTimeout(_cwT); _cwT = setTimeout(() => { namesResolve(S.solutions.flatMap(solAuthors)); reanalyzeAll(false); render(); toast('Catálogo de soluções atualizado por outro executivo.', 'info'); }, 600); }
  }); } catch { /* sem tempo real: o catálogo é relido ao abrir o app */ }
}
/* restaurar backup nunca apaga o catálogo: registros novos entram como privados até serem publicados */
function backupSols(list) {
  const have = new Set(S.solutions.map(r => r.id)); let n = 0;
  list.forEach(r => { if (!have.has(r.id)) { S.solutions.push({ ...r, _priv: true }); touchSol(r.id); n++; } else if (r.materiais?.length) { const loc = S.solutions.find(x => x.id === r.id), hs = new Set((loc.materiais || []).map(m => m.h)), add = r.materiais.filter(m => !hs.has(m.h)); if (add.length) { loc.materiais = [...(loc.materiais || []), ...add]; touchSol(loc.id); } } });
  log(`Backup: ${n} registro(s) de solução entraram como privados (o catálogo compartilhado não foi alterado). Publique-os em Conta → Migração, se desejar.`, 'ok');
}
function backupAskOwner(j, file) {
  const o = j.proprietario?.id; if (o && o === ME.id) return false;
  UI.bkpFile = file; UI.bkpInfo = o ? 'pertence a outra conta' : 'não identifica a conta proprietária (backup antigo)'; UI.confirm = 'bkpown'; render(); return true;
}
Object.assign(MODALS, { bkpown: { t: 'Associar este backup à sua conta?', b: 'Este backup <span id="bkpi"></span>. Restaurar substitui a carteira atual <b>desta conta</b> pelos clientes do arquivo. Faça isso somente se os dados forem seus. O catálogo compartilhado não é alterado.', ok: ['bkpOk', 'Associar e restaurar', 'pri'], cancel: 'bkpNo' } });

/* ---- migração: publicar registros privados no catálogo (explícito, com backup antes) ---- */
const privSols = () => S.solutions.filter(r => r._priv);
function migDup(r) { const d = findDups(r, r.id).filter(x => !x.rec._priv && x.score >= .6); return d[0] ? d[0].rec : null; }
async function migPublish(ids) {
  if (!SOLC) return toast('Catálogo indisponível (db não conectado).');
  let ok = 0, merged = 0; const bad = [];
  for (const id of ids) {
    const r = S.solutions.find(x => x.id === id && x._priv); if (!r) continue;
    const leak = solLeak(r); if (leak) { bad.push(`${r.nome}: ${leak}`); continue; }
    try {
      const dup = migDup(r);
      if (dup && dup.id !== r.id) { /* mesmo produto sob outro id: complementa o existente (pendências para divergências), não cria duplicata */
        mergeCand(dup, { ...candBase(''), ...solPublic(r), fontes: r.fontes }, { tipo: 'depois', categoria: 'depois', linha: 'depois' }, { f: 'publicação de registro privado' });
        hist(dup, 'mesclado', `Registro privado "${r.nome}" mesclado por ${who(ME.id)}`); touchSol(dup.id);
        S.solutions = S.solutions.filter(x => x !== r); if (SOL) await SOL.doc(id).delete(); merged++; continue;
      }
      const rem = await SOLC.doc(id).get();
      if (rem.exists) { /* mesmo id já no catálogo: complementa o registro de lá, sem substituir */
        const cur = S.solutions.find(x => x.id === id && !x._priv) || null; const tgt = cur || (() => { const t = clone(rem.data()); return t; })();
        mergeCand(tgt, { ...candBase(''), ...solPublic(r), fontes: r.fontes }, { tipo: 'depois', categoria: 'depois', linha: 'depois' }, { f: 'publicação de registro privado' });
        const nv = { ...tgt, cv: (rem.data().cv || 0) + 1, alteradoPor: ME.id, alteradoEm: new Date().toISOString() }; delete nv._priv; await SOLC.doc(id).set(solPublic(nv)); SOLBASE.set(id, solPublic(nv)); merged++;
        S.solutions = S.solutions.filter(x => x !== r); if (!cur) S.solutions.push(solPublic(nv));
      } else {
        const o = solPublic(r); hist(o, 'publicado', 'Registro privado publicado no catálogo compartilhado por ' + who(ME.id)); o.cv = 1; o.criadoPor = r.origem === 'base inicial' ? SYS_AUTHOR : ME.id; o.alteradoPor = ME.id; o.alteradoEm = new Date().toISOString();
        await SOLC.doc(id).set(o); SOLBASE.set(id, clone(o)); const notes = r.notasInt; Object.keys(r).forEach(k => delete r[k]); Object.assign(r, clone(o)); if (notes?.length) { r.notasInt = notes; touchSol(id); } ok++;
      }
      if (SOL) await SOL.doc(id).delete(); /* o backup foi baixado antes; o registro agora vive só no catálogo */
    } catch (e) { bad.push(`${r.nome}: ${e.message || e.code}`); }
  }
  UI.migSel = {}; reanalyzeAll(true, 'Registros publicados no catálogo'); namesResolve([ME.id]);
  toast(`${ok} publicado(s), ${merged} mesclado(s) em registro existente${bad.length ? `, ${bad.length} bloqueado(s)` : ''}.`, bad.length ? 'warn' : 'ok'); if (bad.length) log('Publicação bloqueada: ' + bad.join(' | '), 'bad'); render();
}
const ACCT_ACT = {
  bkpOk: () => { const f = UI.bkpFile; UI.confirm = null; UI.bkpFile = null; render(); f && importBackup(f, true); },
  bkpNo: () => { UI.confirm = null; UI.bkpFile = null; render(); },
  migSel: t => { UI.migSel ||= {}; UI.migSel[t.dataset.id] = t.checked; },
  migAll: () => { UI.migSel = {}; privSols().filter(r => !migDup(r)).forEach(r => UI.migSel[r.id] = true); render(); },
  migPub: () => { const ids = Object.keys(UI.migSel || {}).filter(k => UI.migSel[k]); if (!ids.length) return toast('Marque ao menos um registro.'); if (!UI.bkpAt) return toast('Baixe o backup antes de publicar.'); migPublish(ids); },
  catRefresh: async () => { try { const L = await catalogLoad(); const keep = S.solutions.filter(r => r._priv && !L.some(x => x.id === r.id)); loadSolutions(L); toast('Catálogo relido.', 'ok'); } catch (e) { toast('Falha ao reler o catálogo: ' + (e.message || e.code)); } render(); }
};
function vConta() {
  const nCl = clients().length, sh = S.solutions.filter(r => !r._priv), pv = privSols(), outros = sh.filter(r => r.alteradoPor && r.alteradoPor !== ME.id && r.alteradoPor !== SYS_AUTHOR).length;
  let h = `<div class="card"><h3>Gestão de Carteira TOTVS ESN — sua conta</h3>
  <div class="grid g3"><div class="kpi"><div class="sm muted">Conta ativa</div><b>${esc(ME.ok ? (ME.nome || 'Conta da plataforma') : 'Sem conta (modo memória)')}</b>${ME.ok ? `<div class="sm muted">id …${esc(ME.id.slice(-6))}</div>` : ''}</div>
  <div class="kpi"><div class="sm muted">Perfil</div><b>Executivo de Soluções e Negócios</b><div class="sm muted">perfil único: Executivo Comercial</div></div>
  <div class="kpi"><div class="sm muted">Sua carteira</div><b>${nCl} cliente(s)</b><div class="sm muted">privada: só esta conta lê e grava</div></div></div>
  <ul class="sm" style="margin-top:12px"><li><b>Acesso automático:</b> ao abrir o app autenticado, você cai na própria carteira. Não há seletor de usuário, papel ou carteira de outro executivo.</li>
  <li><b>Isolamento:</b> carteira, fichas, contratos, histórico, notas, diagnósticos, oportunidades, decisões e planos ficam em <code>data/users/&lt;sua conta&gt;/</code>, que a plataforma bloqueia para qualquer outra conta — inclusive o dono do artefato. O app só usa o id da sessão; nenhum identificador digitado ou de URL entra no caminho.</li>
  <li><b>Catálogo compartilhado:</b> Base de Soluções (produtos, documentação, fontes oficiais, links TDN) é uma só para todos os executivos com acesso de colaborador.</li></ul></div>`;
  h += `<div class="card"><h3>Login por e-mail e senha — limite desta plataforma</h3><p class="sm">Este app roda como artefato da plataforma e <b>não pode chamar outro servidor</b> (CSP). Por isso o login, a senha, a sessão e o logout são os da própria conta claude.ai de quem abre o link; <b>o app não implementa cadastro, senha, hash nem confirmação de e-mail</b>, e nenhuma tela simula isso. Para encerrar o acesso, saia da conta na plataforma — sem sessão, o app não carrega a carteira.</p>
  <p class="sm">Para dar acesso a outro executivo: compartilhe o artefato com ele como <b>colaborador</b> (nível que permite gravar no catálogo). Sem esse nível ele lê o catálogo, mas não grava. Cada um passa a ter a própria carteira vazia e privada.</p></div>`;
  const nm = x => who(x);
  h += `<div class="card"><div class="row"><h3>Catálogo compartilhado</h3><span class="sp"></span><button class="btn ghost sm" data-a="catRefresh">Reler catálogo</button></div>
  <div class="sm">${sh.length} registro(s) no catálogo • ${outros} com última alteração de outro executivo • o catálogo <b>nunca é apagado</b> por "Apagar dados" nem por restauração de backup.</div>
  <p class="sm muted">Autoria e histórico de cada solução aparecem no detalhe do registro (Base de Soluções). Antes de gravar, o app bloqueia registros que contenham CNPJ, código ou nome de cliente da sua carteira; notas internas ficam só na sua conta.</p>
  ${S.privDup ? `<p class="sm">${S.privDup} cópia(s) privada(s) antigas têm o mesmo id de registros já no catálogo; o catálogo prevalece e a cópia privada não é usada.</p>` : ''}</div>`;
  h += `<div class="card"><h3>Migração dos dados existentes</h3><p class="sm">Nada é atribuído automaticamente a outra conta. Seus clientes, fichas e decisões continuam exatamente na sua carteira. Registros da Base de Soluções criados antes do catálogo compartilhado continuam <b>privados</b> até você publicá-los, um a um ou em lote.</p>
  <div class="row"><button class="btn ghost" data-a="expJSON" ${nCl || S.solutions.length ? '' : 'disabled'}>1. Baixar backup (JSON)</button><span class="sm ${UI.bkpAt ? '' : 'muted'}">${UI.bkpAt ? '✔ backup baixado nesta sessão (' + esc(fmtDate(UI.bkpAt)) + ')' : 'obrigatório antes de publicar'}</span></div>`;
  if (!pv.length) h += `<p class="sm" style="margin-top:10px">Nenhum registro privado pendente de publicação.</p>`;
  else {
    h += `<div class="tw" style="margin-top:10px"><table><thead><tr><th></th><th>Registro privado</th><th>Tipo</th><th>Verificação</th></tr></thead><tbody>${pv.map(r => { const d = migDup(r), lk = solLeak(r); const msg = lk ? `<span class="pill bad">bloqueado: ${esc(lk)}</span>` : d ? `<span class="pill warn">possível duplicidade com "${esc(d.nome)}" — será mesclado, sem substituir</span>` : '<span class="pill ok">sem duplicidade</span>'; return `<tr><td><input type="checkbox" data-a="migSel" data-id="${esc(r.id)}" ${UI.migSel?.[r.id] ? 'checked' : ''} ${lk ? 'disabled' : ''} aria-label="Selecionar ${esc(r.nome)}"></td><td><b>${esc(r.nome)}</b><div class="sm muted">${esc(r.origem || '')}</div></td><td>${esc(TIPOS[r.tipo] || r.tipo)}</td><td>${msg}</td></tr>`; }).join('')}</tbody></table></div>
    <div class="row" style="margin-top:8px"><button class="btn ghost sm" data-a="migAll">Selecionar os sem duplicidade</button><span class="sp"></span><button class="btn pri" data-a="migPub" ${UI.bkpAt ? '' : 'disabled'}>2. Publicar selecionados no catálogo</button></div>`;
  }
  h += `<p class="sm muted" style="margin-top:10px">Restaurar um backup de outra conta (ou sem proprietário) pede confirmação explícita e só afeta esta conta.</p></div>`;
  return h;
}
