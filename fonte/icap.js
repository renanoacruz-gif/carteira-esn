/* ===== Matriz de capacidades por tarefa (R13 §2) =====
   Sucesso em texto NÃO prova busca web nem OCR: cada capacidade tem seu próprio teste e seu próprio registro.
   "Verificado" = houve execução real bem-sucedida registrada neste app. Código testado em simulação não conta. */
const ICAP_SETUP = {
  backend: 'Implante o Worker (README do backend: wrangler login → wrangler deploy → wrangler secret put APP_TOKEN e a chave do provedor), depois use “Verificar backend” e o teste do provedor. No artefato a chamada é por arquivo (transferência manual) porque ele não acessa outros hosts.',
  pagina: 'Só funciona no artefato publicado, com a permissão do Claude da página aceita. Clique em “Testar” (provedor “Claude desta página”) dentro do artefato.',
  ocrbk: 'Exige o Worker implantado com GEMINI_API_KEY. Envie um print real pela tela de OCR e importe a resposta; o resultado fica registrado aqui.',
  busca: 'Exige provedor com busca web no backend (Gemini, OpenAI ou Anthropic, Groq em modelos compatíveis). Rode o teste do provedor com “busca web” ligada; só conta se a resposta trouxer consultas/citações (usouBusca).',
  cnpj: 'Exige o Worker implantado (a consulta usa provedores públicos de CNPJ; sem chave). Faça uma consulta real na tela “Consulta de CNPJ”.',
  tdn: 'Exige o Worker. Páginas restritas pedem TDN_COOKIE ou TDN_AUTH_HEADER como segredo. Importe um link real em Base de Soluções → Importar por link.',
  empresa: 'Depende de busca web (linha anterior). Rode a pesquisa da empresa num cliente e importe a resposta; só conta com usouBusca verdadeiro.'
};
function icapLinhas() {
  const ia = iaInit(), pg = S.meta.pgTeste || null, E = intEst(), T = ia.testes || {};
  const tOk = p => T[p]?.ok, provOk = Object.keys(T).filter(tOk), busca = Object.entries(T).filter(([, t]) => t.ok && t.usouBusca);
  const ult = t => t ? dtBR(t.at) : '';
  const L = [];
  L.push({ cap: 'Texto e JSON estruturado', via: 'Claude desta página', dest: 'Claude (Anthropic) via claude.ai, sob o consentimento do próprio artefato', ok: pg ? !!(pg.texto?.ok && pg.json?.ok) : null, det: pg ? `texto: ${pg.texto?.ok ? 'OK' : 'falhou'}; JSON: ${pg.json?.ok ? 'OK' : 'falhou'} • ${ult(pg)}${pg.texto?.ok ? '' : ' • ' + (pg.texto?.msg || '')}` : '', pend: ICAP_SETUP.pagina });
  L.push({ cap: 'Texto e JSON estruturado', via: 'Provedor no backend', dest: 'Provedor escolhido (Gemini/OpenAI/Anthropic/Groq) via Worker', ok: provOk.length ? true : Object.keys(T).length ? false : null, det: Object.entries(T).map(([p, t]) => `${AI_PROV[p]?.nome || p}: ${t.ok ? 'OK' : 'falha ' + (t.erro?.codigo || '')} • ${ult(t)}`).join(' | '), pend: ICAP_SETUP.backend });
  L.push({ cap: 'Busca na web com fontes', via: 'Provedor no backend', dest: 'Provedor com busca nativa via Worker (só pergunta; sem dados do cliente)', ok: busca.length ? true : provOk.length ? false : null, det: busca.length ? busca.map(([p, t]) => `${AI_PROV[p]?.nome || p}: busca usada • ${ult(t)}`).join(' | ') : provOk.length ? 'Há provedor com texto OK, mas nenhum teste comprovou busca web (usouBusca).' : '', pend: ICAP_SETUP.busca, nota: 'O Claude desta página NÃO pesquisa na web.' });
  L.push({ cap: 'Leitura de imagem (OCR de prints)', via: 'Claude desta página', dest: 'Claude (Anthropic) via claude.ai; imagem enviada só após sua ação', ok: pg ? !!pg.ocr?.ok : null, det: pg ? `OCR: ${pg.ocr?.ok ? 'OK (token lido)' : 'falhou — ' + (pg.ocr?.msg || '')} • ${ult(pg)}` : '', pend: ICAP_SETUP.pagina, nota: 'PDF escaneado não é lido por este caminho (apenas imagem).' });
  const eo = E.ocr; L.push({ cap: 'Leitura de imagem (OCR de prints)', via: 'Backend (Gemini)', dest: 'Google Gemini via Worker; só com a confirmação de envio', ok: eo ? !!eo.ok : null, det: eo ? `${eo.ok ? 'OK' : 'Falha'} • ${dtBR(eo.at)} • ${eo.msg}` : '', pend: ICAP_SETUP.ocrbk });
  const ec = E.cnpj; L.push({ cap: 'Consulta de CNPJ', via: 'Backend', dest: 'Provedor público de CNPJ via Worker (envia só o CNPJ)', ok: ec ? !!ec.ok : null, det: ec ? `${ec.ok ? 'OK' : 'Falha'} • ${dtBR(ec.at)} • ${ec.msg}` : '', pend: ICAP_SETUP.cnpj });
  const et = E.tdn; L.push({ cap: 'Importação de links (TDN / Portal TOTVS)', via: 'Backend', dest: 'Páginas públicas totvs.com / totvs.com.br via Worker (envia só os links)', ok: et ? !!et.ok : null, det: et ? `${et.ok ? 'OK' : 'Falha'} • ${dtBR(et.at)} • ${et.msg}` : '', pend: ICAP_SETUP.tdn });
  const ee = E.empresa; L.push({ cap: 'Pesquisa da empresa (notícias, expansão)', via: 'Provedor com busca no backend', dest: 'Provedor via Worker; o pedido não leva CNPJ nem valores', ok: ee ? !!ee.ok : null, det: ee ? `${ee.ok ? 'OK' : 'Falha'} • ${dtBR(ee.at)} • ${ee.msg}` : '', pend: ICAP_SETUP.empresa });
  return L;
}
function icapHtml() {
  const L = icapLinhas(), est = o => o === true ? pill('Verificado em execução real', 'ok') : o === false ? pill('Com erro / não comprovado', 'bad') : pill('Não verificado', 'off');
  return `<div class="card"><h3>Capacidades por tarefa</h3><p class="sm">Cada linha é uma capacidade distinta: <b>sucesso em texto não prova busca na web nem leitura de imagem</b>. “Verificado” significa que houve uma execução real bem-sucedida registrada aqui; simulações e testes de código não contam. Credenciais ficam só no backend e nunca são exibidas; o app registra resultado e hora, não o conteúdo enviado.</p>
  <div class="tw"><table class="chain"><thead><tr><th>Capacidade</th><th>Caminho</th><th>Estado</th><th>Última execução</th><th>Para onde os dados vão</th><th>Para ativar</th></tr></thead><tbody>${L.map(x => `<tr><td><b>${esc(x.cap)}</b>${x.nota ? `<div class="muted sm">${esc(x.nota)}</div>` : ''}</td><td>${esc(x.via)}</td><td>${est(x.ok)}</td><td class="sm">${x.det ? esc(x.det) : '<span class="muted">nunca executada</span>'}</td><td class="sm">${esc(x.dest)}</td><td class="sm">${x.ok === true ? '<span class="muted">—</span>' : esc(x.pend)}</td></tr>`).join('')}</tbody></table></div>
  <div class="row"><button class="btn pri sm" data-a="pgTestarBtn">Testar Claude desta página (texto, JSON e imagem)</button><span class="muted sm">${S.meta.pgTeste ? 'Último teste: ' + esc(dtBR(S.meta.pgTeste.at)) : 'Ainda não testado.'}</span></div></div>`;
}
const ICAP_ACT = { pgTestarBtn: async () => { toast('Testando o Claude desta página…'); try { const R = await pgTestar(); toast(R.texto?.ok && R.json?.ok ? 'Teste concluído: texto e JSON OK' + (R.ocr?.ok ? ', imagem OK.' : '; imagem: ' + (R.ocr?.msg || 'falhou')) : 'Teste com falha: ' + (R.texto?.msg || R.json?.msg), R.texto?.ok && R.json?.ok ? 'ok' : 'bad'); } catch (e) { toast('Falha no teste: ' + pgErr(e).mensagem, 'bad'); } render(); } };
