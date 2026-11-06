/* ===== MODO HOSPEDADO (uso interno TOTVS) =====
   Ativo só quando a página é servida pelo Worker (window.__HOSTED__). No artefato do claude.ai nada disto roda.
   Identidade: e-mail @totvs.com.br verificado pelo Cloudflare Access (o app não tem tela de login própria).
   Dados: mesmas coleções do app, gravadas pelo Worker em D1 (/api/db). Carteira = privada por usuário; catálogo = compartilhado.
   Chave de IA: cada executivo usa a sua; fica só no localStorage DESTE navegador e segue em cabeçalho a cada chamada (o servidor não a grava). */
const HOST = !!window.__HOSTED__;
const HK_LS = 'carteira_chaves_ia_v1';
const hkLer = () => { try { const o = JSON.parse(localStorage.getItem(HK_LS) || '{}'); return o && typeof o === 'object' ? o : {}; } catch { return {}; } };
const hkSalvarTudo = o => { try { localStorage.setItem(HK_LS, JSON.stringify(o)); return true; } catch { return false; } };
const hkChave = p => String(hkLer()[p] || '');
const hkFim = k => k ? '…' + k.slice(-4) : '';
function hkHeaders(prov) { const k = prov && prov !== 'pagina' ? hkChave(prov) : ''; return k ? { 'x-provider': prov, 'x-provider-key': k } : {}; }
const hkNomeEmail = e => String(e || '').split('@')[0].split(/[._\-+]+/).filter(Boolean).map(x => x[0].toUpperCase() + x.slice(1)).join(' ');

if (HOST && !window.claude) {
  const segEnc = s => String(s).replace(/[^A-Za-z0-9_.@+:\-]/g, ch => [...new TextEncoder().encode(ch)].map(b => '~' + b.toString(16).padStart(2, '0')).join(''));
  const segDec = s => { try { const b = []; for (let i = 0; i < s.length; i++) { if (s[i] === '~' && /^[0-9a-f]{2}$/i.test(s.slice(i + 1, i + 3))) { b.push(parseInt(s.slice(i + 1, i + 3), 16)); i += 2; } else b.push(...new TextEncoder().encode(s[i])); } return new TextDecoder().decode(new Uint8Array(b)); } catch { return s; } };
  /* Item 12: tempo limite por requisição (leitura 30 s, escrita 60 s) e 1 nova tentativa só para LEITURA (get/list/me) em falha de rede ou tempo esgotado; escrita nunca é repetida aqui (a fila do flush recoloca o item). Valores sobrescrevíveis só por window.__apiTo (testes). */
  const apiUma = async (rota, corpo, leitura) => {
    const to = window.__apiTo || { r: 30000, w: 60000 }, ac = new AbortController(); let estourou = false;
    const tm = setTimeout(() => { estourou = true; ac.abort(); }, leitura ? to.r : to.w);
    try {
    let r; try { r = await fetch(rota, { method: corpo ? 'POST' : 'GET', headers: corpo ? { 'content-type': 'application/json' } : {}, body: corpo ? JSON.stringify(corpo) : undefined, credentials: 'same-origin', redirect: 'manual', signal: ac.signal }); }
    catch { throw estourou ? Object.assign(new Error('O servidor demorou a responder.'), { code: 'tempo_esgotado' }) : Object.assign(new Error('Sem conexão com o servidor.'), { code: 'rede' }); }
    if (r.type === 'opaqueredirect' || r.status === 302) throw Object.assign(new Error('Sessão do Cloudflare Access expirada: recarregue a página para entrar de novo.'), { code: 'sessao_expirada' });
    let j; try { j = await r.json(); } catch { if (r.status === 401 || r.status === 403) throw Object.assign(new Error('Sessão do Cloudflare Access expirada: recarregue a página para entrar de novo.'), { code: 'sessao_expirada' }); throw Object.assign(new Error('Resposta inválida do servidor (HTTP ' + r.status + ').'), { code: 'http_' + r.status }); }
    if (!j.ok) throw Object.assign(new Error(j.erro?.mensagem || 'Erro no servidor.'), { code: j.erro?.codigo || 'erro', atual: j.atual });
    return j;
    } finally { clearTimeout(tm); }
  };
  const api = async (rota, corpo) => {
    const leitura = !corpo || corpo.op === 'get' || corpo.op === 'list';
    for (let t = 0; ; t++) {
      try { return await apiUma(rota, corpo, leitura); }
      catch (e) { if (!(leitura && t < 1 && (e.code === 'rede' || e.code === 'tempo_esgotado'))) throw e; await new Promise(r => setTimeout(r, 500)); }
    }
  };
  let _me = null; const eu = async () => (_me ||= api('/api/me').then(j => { if (!j.id) throw Object.assign(new Error('Entre pelo Cloudflare Access com seu e-mail corporativo.'), { code: 'sem_identidade' }); try { admPainelOn(j.painel === true); telWire(); telAvisoUmaVez(); } catch { /* painel e telemetria são opcionais */ } return j; }).catch(e => { _me = null; throw e; }));
  const lastGet = {};
  const col = path => ({
    path,
    doc: id => doc(path + '/' + segEnc(id)),
    get: async () => {
      const docs = []; let after = '', agora = ''; for (let i = 0; i < 400; i++) { const j = await api('/api/db', { op: 'list', path, after, limit: 200 }); agora = j.agora; docs.push(...j.docs.map(d => ({ id: segDec(d.id), data: () => d.data }))); if (!j.mais) break; after = j.depois; }
      lastGet[path] = agora; return { docs };
    },
    onSnapshot: cb => {
      let parar = false, ocupado = false, since = lastGet[path] ? new Date(Date.parse(lastGet[path]) - 3000).toISOString() : new Date(Date.now() - 3000).toISOString();
      const tick = async () => {
        if (parar || ocupado || document.hidden) return; ocupado = true;
        try { let after = '', novos = [], agora = ''; for (let i = 0; i < 50; i++) { const j = await api('/api/db', { op: 'list', path, after, since, limit: 200 }); agora = j.agora; novos.push(...j.docs.map(d => ({ id: segDec(d.id), data: () => d.data }))); if (!j.mais) break; after = j.depois; } since = new Date(Date.parse(agora) - 3000).toISOString(); if (novos.length) cb({ docs: novos }); } catch { /* tenta no próximo ciclo */ }
        ocupado = false;
      };
      const iv = setInterval(tick, 45000), vis = () => { if (!document.hidden) tick(); }; document.addEventListener('visibilitychange', vis);
      return () => { parar = true; clearInterval(iv); document.removeEventListener('visibilitychange', vis); };
    },
  });
  const doc = path => ({
    path,
    get: async () => { const j = await api('/api/db', { op: 'get', path }); return { exists: !!j.exists, data: () => j.data }; },
    set: async d => { await api('/api/db', { op: 'set', path, data: d }); },
    delete: async () => { await api('/api/db', { op: 'delete', path }); },
    collection: n => col(path + '/' + n),
  });
  const norm = p => String(p).split('/').map(segEnc).join('/');
  window.claude = {
    use: async n => {
      if (n === 'db') return { doc: p => doc(norm(p)), collection: p => col(norm(p)) };
      if (n === 'user') return { id: async () => (await eu()).id, profiles: async ids => Object.fromEntries((ids || []).map(i => [i, { name: hkNomeEmail(i) }])) };
      if (n === 'downloads') return { save: async ({ filename, data }) => { const b = data instanceof Blob ? data : new Blob([data]); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); } };
      return null; /* 'sample' (Claude da página) não existe fora do artefato */
    },
  };
}
if (HOST) { delete AI_PROV.pagina; const i = AI_PROV_IDS.indexOf('pagina'); if (i >= 0) AI_PROV_IDS.splice(i, 1); }

/* aviso permanente enquanto não houver chave utilizável: a ferramenta funciona sem IA, mas lembra de conectar */
function hkBanner() {
  if (UI.view === 'ia') return ''; /* a tela de IA já mostra o estado das chaves */
  const salvas = AI_PROV_IDS.filter(p => hkChave(p)), pad = iaInit().provedor;
  const ir = '<button class="btn sm" data-a="nav" data-v="ia">Configurar IA</button>';
  if (!salvas.length) return `<div class="alert w hkbar" role="status"><span><b>Sem chave de IA.</b> Carteira e diagnóstico funcionam; pesquisa, OCR e análise reforçada precisam da sua chave.</span>${ir}</div>`;
  if (!hkChave(pad)) return `<div class="alert w hkbar" role="status"><span><b>Provedor padrão (${esc(AI_PROV[pad]?.nome || pad)}) sem chave.</b> Há chave de ${esc(salvas.map(p => AI_PROV[p].nome).join(', '))}: defina-o como padrão ou cadastre a faltante.</span>${ir}</div>`;
  return '';
}
/* cartão "Minhas chaves de IA" (substitui a conexão manual com backend) */
function hkCard() {
  const rows = AI_PROV_IDS.map(p => { const k = hkChave(p); return `<tr><td><b>${esc(AI_PROV[p].nome)}</b></td><td>${k ? pill('chave ' + hkFim(k), 'ok') : pill('sem chave', 'off')}</td><td><input type="password" id="hk-${p}" autocomplete="off" placeholder="${k ? 'substituir chave' : 'cole sua chave'}" style="width:100%"></td><td class="nw"><button class="btn sm" data-a="hkSalvar" data-p="${p}">Salvar</button> ${k ? `<button class="btn ghost sm" data-a="hkRemover" data-p="${p}">Remover</button>` : ''}</td></tr>`; }).join('');
  return `<div class="card"><h3>Minhas chaves de IA <span class="pill p-ok">uso interno hospedado</span></h3>
  <p class="sm">Cada executivo usa a <b>própria</b> chave. Ela fica apenas no armazenamento deste navegador e é enviada ao servidor só junto de cada pedido, para repasse ao provedor — o servidor não a grava nem a registra, e ela não entra em backup nem exportação. Em computador compartilhado, remova a chave ao terminar.</p>
  <div class="tbl-wrap"><table class="tbl sm"><thead><tr><th>Provedor</th><th>Situação</th><th>Chave</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
  <p class="sm muted">Usuário: <b>${esc(ME.id || '—')}</b>. Use “Testar” na tabela acima para confirmar cada chave. Pesquisas e leituras só saem para o provedor que você autorizar a cada envio.</p></div>`;
}
const HK_ACT = {
  hkSalvar: t => { const p = t.dataset.p, inp = document.getElementById('hk-' + p), v = (inp?.value || '').trim(); if (!AI_PROV[p]) return; if (v.length < 8 || v.length > 400 || !/^[\x21-\x7e]+$/.test(v)) { toast('Chave inválida (sem espaços, 8–400 caracteres).'); return; } const o = hkLer(); o[p] = v; if (!hkSalvarTudo(o)) { toast('Este navegador não permite guardar a chave (armazenamento bloqueado).'); return; } inp.value = ''; toast('Chave salva neste navegador.'); render(); },
  hkRemover: t => { const o = hkLer(); delete o[t.dataset.p]; hkSalvarTudo(o); toast('Chave removida deste navegador.'); render(); },
};
