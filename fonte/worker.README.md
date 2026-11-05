# Backend Gemini — Gestão de Carteira TOTVS ESN

Guarda a chave do Gemini como **segredo** e executa os pedidos gerados pelo aplicativo. O aplicativo (artefato) não consegue guardar segredos nem chamar outros hosts; por isso este backend existe.

## Instalar (Cloudflare Workers)
1. `npm i -g wrangler` e `wrangler login`
2. Na pasta deste pacote: `wrangler deploy`
3. `wrangler secret put GEMINI_API_KEY` (chave do Google AI Studio — nunca em arquivo, chat ou código)
4. `wrangler secret put APP_TOKEN` (senha longa inventada por você; protege o backend)

## Usar
1. No aplicativo: Configurações de IA → *Testar conexão* (ou um comando de pesquisa: cliente, segmento, produto, marcos de release ou atualizações regulatórias) → baixa um arquivo de pedido `.json`.
2. Abra a URL do Worker, informe o `APP_TOKEN`, escolha o arquivo e clique *Enviar pedido*; baixe a resposta.
3. No aplicativo: importe a resposta. Pesquisas passam por revisão antes de entrar na Base de Soluções.

Alternativa por linha de comando: `curl -X POST https://SEU-WORKER/api/pesquisar -H "authorization: Bearer $APP_TOKEN" -d @pedido.json`

## Chave
- Substituir: `wrangler secret put GEMINI_API_KEY` de novo. Remover: `wrangler secret delete GEMINI_API_KEY`.
- A resposta traz só a identificação mascarada (`AIza…` + 4 últimos caracteres).
- O código não registra corpo de pedido/resposta nem a chave. Não habilite logs de requisição com corpo no painel da Cloudflare.

## Regras embutidas
- Só aceita os modelos listados em `MODELS` (conferir a documentação vigente antes de alterar).
- Recusa pedidos com CNPJ ou valores em R$ (HTTP 400, `dados_sensiveis`).
- Busca web via `tools:[{"type":"google_search"}]` (Interactions API). A resposta informa `usouBuscaWeb`, consultas e fontes citadas.
- Cada afirmação sai como `validar:false` só se tiver URL de evidência que apareça nas citações da busca; senão `validar:true` (NECESSITA VALIDAÇÃO). Nada sai como oferta oficial automaticamente.
- Prioriza Portal TOTVS, TDN e Central de Atendimento (prompt) e marca `oficial` pelo domínio.

## Pesquisas de referência
- `tipo: "marcos"`: datas de expiração de releases (prioriza Central de Atendimento e TDN). `tipo: "regulatorio"`: eventos com publicação, vigência, testes e prazo (prioriza legislação, Receita, CGIBS, SPED, eSocial).
- Cada item sai com `validar` = true quando a data não tem URL citada pela busca. No aplicativo, tudo entra como **pendente de revisão** em *Releases e regulatório*.

## Erros mapeados
`chave_invalida`, `sem_permissao`, `limite_de_uso`, `indisponivel`, `tempo_esgotado`, `modelo_indisponivel`, `sem_creditos`, `dados_sensiveis`, `nao_autorizado`, `chave_ausente`, `resposta_invalida`; busca sem resultados vira `semResultados:true`.

## Tentativas, cache e fallback (configuração central em `CFG`, no topo de `worker.src.js`)
- Erros transitórios (429, 408, 5xx, rede) são repetidos até 3 tentativas no total, com espera exponencial + jitter. Se o provedor informar a espera (cabeçalho `Retry-After` ou `retryDelay` no corpo), ela é respeitada; se pedir mais de 10 s, o backend não espera: devolve `aguardarSegundos`. 429 sem orientação do provedor tem no máximo 1 repetição. Erros permanentes (400/401/403/404) não são repetidos. Nunca há troca automática de modelo.
- Fallback sem busca: somente se o provedor rejeitar a ferramenta de busca (400), uma única vez; a resposta vem com `fallbackSemBusca:true`, `usouBuscaWeb:false` e aviso explícito — o conteúdo é conhecimento do modelo, não pesquisa externa, e todas as afirmações ficam "validar". Desligue com `"fallbackSemBusca": false` no pedido.
- Cache de pedidos idênticos (mesmo tipo, modelo, busca e dados; 6 h) e limite de pedidos (por minuto, padrão 12, `LIMITE_POR_MIN`; por dia UTC, padrão 300, `LIMITE_POR_DIA`). **Sem o binding KV `LIMITES`** ficam na memória do isolate (melhor esforço; não persistem entre instâncias/reinícios). Respostas de cache trazem `daCache:true`.
- **Persistência opcional (Workers KV)**: crie o namespace (`wrangler kv namespace create LIMITES`) e ative o bloco `[[kv_namespaces]]` do `wrangler.toml`. Com o binding, contadores por minuto/dia e o cache passam a persistir (chaves com TTL; o cache nunca contém a chave de API). Limite diário excedido → erro `limite_diario` (sem repetição imediata). `GET /api/limites` (com o APP_TOKEN) mostra se há persistência e o uso atual.
- **Limites da persistência**: KV não é atômico (ler+gravar) e é eventualmente consistente — pedidos simultâneos ou em regiões diferentes podem ultrapassar o limite em poucas unidades. Contagem exata exigiria Durable Object (não implementado). Se o KV ficar indisponível, o backend segue só com a memória (melhor esforço).

## OCR de material escaneado — `POST /api/ocr` (opcional; usa IA)
Para **material de produto** escaneado (ex.: enxoval em PDF sem camada de texto). Não é usado para fichas ou documentos de cliente (contêm CNPJ/valores): o aplicativo recusa essas fichas sem OCR.
- Uso: na página do backend, seção “OCR de material escaneado”: escolha o arquivo (PDF, PNG, JPG ou WEBP, até 5 MB), marque a confirmação de que não há dados de cliente, transcreva e baixe a resposta; no aplicativo use *Importar resposta do backend*. O texto entra na prévia da Base de Soluções com aviso “OCR por IA — conferir” e a fonte fica marcada.
- Envio ao Gemini no formato documentado (`input` com `{type:"document"|"image", data, mime_type}`), sem busca web. O backend recusa o pedido sem `confirmaEnvioProvedor:true`, alerta se o texto parecer ter CNPJ ou valores em R$ e devolve apenas o texto (nada é resumido ou inferido). Exige `GEMINI_API_KEY`; consome cota como qualquer pedido.
- Limitação: o OCR por IA pode errar a leitura de tabelas e números; por isso o conteúdo nunca entra na base sem a prévia.


## Importação por link (TDN / enxoval de vendas) — `POST /api/importar`
Não usa IA nem a chave Gemini (funciona mesmo sem `GEMINI_API_KEY`). Lê as páginas e devolve o **conteúdo bruto**; a extração por seções (nome, finalidade, funcionalidades, dores, segmentos, requisitos, integrações) é feita no aplicativo, que mostra a prévia antes de gravar.
- Uso: no aplicativo, *Base de Soluções → Importar por link* gera `pedido-importar-link-….json` (só os links). Na página do backend escolha o arquivo **ou cole os links** (até 3), baixe a resposta e importe-a no aplicativo.
- Só aceita `https` em `totvs.com` e `totvs.com.br` (e subdomínios, ex.: `tdn.totvs.com`, `midias-sites.totvs.com`). Redirecionamentos (links curtos `tdn.totvs.com/x/…`) são seguidos manualmente e cada salto é revalidado; saltos para fora da lista são bloqueados.
- Lê a página + até 6 páginas TOTVS vinculadas no corpo do conteúdo + até 4 anexos (PDF, DOCX, PPTX, XLSX, XLS, CSV, TXT, MD; 4 MB cada, 9 MB no total). Links de login/edição/rótulos/usuários e domínios fora da lista aparecem como *não lidos*, com o motivo. Um nível de profundidade; no máximo 40 acessos por pedido.
- **Páginas restritas do TDN:** `wrangler secret put TDN_COOKIE` (valor do cabeçalho Cookie de uma sessão autorizada, ex.: `JSESSIONID=…`) e/ou `wrangler secret put TDN_AUTH_HEADER` (valor do cabeçalho Authorization, ex.: `Basic …`). Enviados **apenas** a hosts `tdn.*totvs.com[.br]`, nunca devolvidos, nunca registrados. Sem eles, páginas com login retornam `autenticacao_necessaria` (o aplicativo informa e permite anexar o material). Cookie de sessão expira: renove o segredo quando isso acontecer.
- Erros: `autenticacao_necessaria`, `dominio_nao_permitido`, `nao_encontrado`, `conteudo_nao_legivel` (página vazia/montada por JavaScript), `muito_grande`, `tempo_esgotado_pagina`, `indisponivel`, `limite_local`.
- Limitação: páginas renderizadas só por JavaScript não têm texto no HTML e não são lidas. Não testado contra o TDN real pelo autor (sem acesso no ambiente de construção): testado com páginas sintéticas no formato Confluence/TDN e `fetch` simulado.

## Limitações
Não validado contra o Gemini real pelo autor do aplicativo (sem acesso à API no ambiente de construção): testado com respostas simuladas conforme a documentação. Rode *Testar conexão* antes de usar. Proteja o Worker com limites de taxa (Cloudflare → Security → WAF) se o expor publicamente.

## Rodada 10 — Groq e OCR de documentos de cliente
- Segredos de IA (todos opcionais, só no Worker): `GEMINI_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, **`GROQ_API_KEY`** (`wrangler secret put GROQ_API_KEY`).
- Groq: `POST https://api.groq.com/openai/v1/chat/completions`; busca web = `browser_search` apenas em `openai/gpt-oss-20b|120b|safeguard-20b` (modelo sem busca + busca ligada → erro `busca_indisponivel`, nada enviado). Documentos/imagens/OCR: não usados na Groq.
- `/api/ocr` aceita `finalidade:"cliente"` somente com `autorizacaoUsuario:true` e `confirmaEnvioProvedor:true` (o app só envia após o diálogo de autorização). O backend não registra o conteúdo.

## Rodada 11
Sem mudança no Worker: o Raio-X, as visões de Inteligência Comercial e o material livre usam as rotas existentes (`/api/ia`, `/api/ocr`, `/api/cnpj`, `/api/importar`). Notícias e pesquisa do cliente exigem provedor de IA testado; sem ele a tela explica o que falta e aceita fatos cadastrados manualmente.

## Rodada 12
Sem alteração no Worker. A pesquisa da empresa usa a mesma rota `/api/ia` (tarefa `pesquisa`, formato JSON, campo `prompt`) já usada pela Inteligência Comercial. O pedido leva só razão social, local, site, atividade e segmento (sem CNPJ, valores ou documentos).

## Implantação e verificação (Rodada 13)
Ordem recomendada. Nada abaixo exige colocar chave em arquivo, chat ou código.
1. `npm i -g wrangler` → `wrangler login` → na pasta do pacote (`worker.src.js` renomeado para `worker.js`, com `worker.wrangler.toml` como `wrangler.toml`): `wrangler deploy`.
2. Segredos (um comando por segredo; o valor é digitado no terminal): `APP_TOKEN` (obrigatório) e ao menos um provedor — `GEMINI_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` ou `GROQ_API_KEY`. Opcionais: `TDN_COOKIE` / `TDN_AUTH_HEADER` (páginas restritas do TDN).
3. `ALLOWED_ORIGINS` (variável, não segredo): só necessária se um aplicativo hospedado em outro domínio for chamar o Worker direto pelo navegador. O artefato do claude.ai não acessa outros hosts: nele a chamada é por arquivo (transferência manual).
4. Opcional: `wrangler kv namespace create LIMITES` e ativar o bloco `[[kv_namespaces]]` para limites persistentes.
5. No aplicativo: *Integrações → Verificar backend* (importa quais segredos existem, sem valores) e, para cada capacidade, o teste correspondente na matriz *Capacidades por tarefa*. Cada capacidade (texto/JSON, busca web, OCR, CNPJ, TDN, pesquisa da empresa) é testada e registrada separadamente.

### Verificação já feita neste pacote (runtime local real, sem chaves reais)
Executado com `wrangler dev --local` (workerd) e chaves falsas, via HTTP: `/api/status` recusa sem token (401) e com token informa só presença de segredos; `/api/ia` recusa sem token, recusa corpo acima do limite, recusa modelo fora da lista, devolve `chave_ausente` para provedor sem segredo e `indisponivel` (rede) quando o provedor não é alcançável; `/api/cnpj` recusa CNPJ inválido sem consultar e devolve `indisponivel` quando o provedor público não responde; `/api/importar` recusa domínio fora de `totvs.com`/`totvs.com.br`; CORS só responde para a origem listada; o log do runtime não contém corpo de pedido, prompt, token nem chave. **Não verificado**: chamada bem-sucedida a qualquer provedor de IA ou de CNPJ (exige chave real e rede liberada), busca web e OCR do backend.
