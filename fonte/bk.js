/* ===== TRANSPORTE PARA O BACKEND (Worker) =====
   Duas vias, sempre transparentes:
   1) DIRETA: fetch ao backend com Bearer APP_TOKEN. Só funciona quando o ambiente permite (aplicativo hospedado fora do artefato + ALLOWED_ORIGINS no Worker).
   2) MANUAL: o ambiente bloqueia chamadas a outros hosts (CSP do artefato): o app gera o arquivo de pedido, o usuário o envia na página do backend e importa a resposta.
   O APP_TOKEN fica apenas na memória da sessão: nunca vai ao banco, backup, exportação ou log. As chaves dos provedores NUNCA passam por aqui. */
const BK = { token: '', direto: null, ultimoErro: '' };
const BK_ROTA = { cnpj: '/api/cnpj', ia: '/api/ia', ia_teste: '/api/ia/teste', status: '/api/status', importar: '/api/importar', ocr: '/api/ocr' };
const bkUrl = () => window.__HOSTED__ ? location.origin : String(aiCfg().backendUrl || '').trim().replace(/\/+$/, '');
const bkErr = (codigo, mensagem) => Object.assign(new Error(mensagem), { bk: 1, codigo });
const bkPronto = () => /^https?:\/\//i.test(bkUrl());
async function bkDireto(tipo, pedido, timeout = tipo === 'importar' ? 170000 : tipo === 'ocr' ? 120000 : 70000) {
  if (!bkPronto()) throw bkErr('sem_url', 'URL do backend não configurada (Configurações de IA).');
  if (!BK.token && !window.__HOSTED__) throw bkErr('sem_token', 'Informe o APP_TOKEN do backend (mantido só na memória desta sessão).');
  let csp = false; const h = () => { csp = true; }; document.addEventListener('securitypolicyviolation', h);
  try {
    const rota = BK_ROTA[tipo]; const r = await fetch(bkUrl() + rota, { method: tipo === 'status' ? 'GET' : 'POST', headers: { ...(BK.token ? { authorization: 'Bearer ' + BK.token } : {}), ...(window.__HOSTED__ ? hkHeaders(tipo === 'ocr' ? 'gemini' : (tipo === 'ia' || tipo === 'ia_teste') ? pedido?.provedor : '') : {}), ...(tipo === 'status' ? {} : { 'content-type': 'application/json' }) }, body: tipo === 'status' ? undefined : JSON.stringify(pedido), signal: AbortSignal.timeout(timeout) });
    const txt = await r.text(); let j; try { j = JSON.parse(txt); } catch { throw bkErr('resposta_invalida', `O backend respondeu HTTP ${r.status} sem JSON.`); }
    if (r.status === 401) throw bkErr('nao_autorizado', 'APP_TOKEN recusado pelo backend.');
    BK.direto = true; return j;
  } catch (e) {
    if (e.bk) throw e; await new Promise(r => setTimeout(r, 40)); BK.direto = false;
    throw bkErr(csp ? 'bloqueado_ambiente' : 'rede', csp ? 'Este ambiente bloqueia chamadas diretas ao backend (política de segurança do artefato). Use a transferência manual por arquivo.' : 'Sem resposta do backend (URL, CORS/ALLOWED_ORIGINS, rede ou tempo esgotado).');
  } finally { document.removeEventListener('securitypolicyviolation', h); }
}
/* Envia um pedido. Retorna {via:'direto', resp} ou {via:'manual'} (arquivo oferecido para download). Nunca finge sucesso. */
async function bkChamar(tipo, pedido, arquivo) {
  if (pedido?.provedor === 'pagina') { if (tipo === 'ocr') return { via: 'direto', resp: await pgOcr(pedido) }; if (tipo === 'ia' || tipo === 'ia_teste') return { via: 'direto', resp: await pgIA(tipo, pedido) }; }
  if (window.__HOSTED__ && (tipo === 'ia' || tipo === 'ia_teste' || tipo === 'ocr')) { const pv = tipo === 'ocr' ? 'gemini' : pedido?.provedor; if (!hkChave(pv)) throw bkErr('sem_chave', `Cadastre sua chave de ${AI_PROV[pv]?.nome || pv} em Configurações → IA e provedores → Minhas chaves de IA.`); }
  if (window.__HOSTED__ || (BK.direto !== false && bkPronto() && BK.token)) {
    try { return { via: 'direto', resp: await bkDireto(tipo, pedido) }; }
    catch (e) { BK.ultimoErro = e.message; if (window.__HOSTED__ || !['bloqueado_ambiente', 'rede'].includes(e.codigo)) throw e; }
  }
  offer(arquivo, JSON.stringify(pedido, null, 1)); return { via: 'manual', motivo: BK.ultimoErro };
}
const bkModo = () => (window.__HOSTED__ ? 'direto' : BK.direto === true ? 'direto' : BK.direto === false ? 'manual' : bkPronto() && BK.token ? 'a testar' : 'manual');
const BK_TXT = { direto: 'Chamada direta ao backend', manual: 'Transferência manual por arquivo (este ambiente não chama o backend)', 'a testar': 'Chamada direta será tentada; se bloqueada, cai para arquivo' };
/* Respostas das novas rotas (CNPJ, status, IA multiprovedor): aiImportFile delega aqui antes da checagem de versão 1 */
async function bkResposta(j) {
  if (j.tipo === 'cnpj') return cnpjResposta(j);
  if (j.tipo === 'status') return intStatusResposta(j);
  if (j.versao === 2 && j.pedidoId && (S.meta.mkPend || {})[j.pedidoId]) return mercadoResposta(j);
  if (j.versao === 2 && j.pedidoId && (S.meta.emPend || {})[j.pedidoId]) return empresaResposta(j);
  if (j.versao === 2 && j.pedidoId && (S.meta.semPend || {})[j.pedidoId]) return semResposta(j);
  if (j.versao === 2 && j.tarefa === 'teste') return iaTesteResposta(j);
  if (j.versao === 2 && j.pedidoId) throw new Error('Resposta de IA sem pedido correspondente neste navegador (de outra sessão ou já importada).');
  return false;
}
