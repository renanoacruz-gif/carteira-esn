# Fonte do app
Módulos JS/CSS concatenados por `build.py` (ajuste `d=` para esta pasta e o destino do pacote) em `public/index.html` + `src/worker.js`.
Fluxo: alterar aqui → rodar build → commitar `public/` e `src/` → o Cloudflare publica sozinho (Workers Builds).

## Segurança (rodada 16)
- Testes: `t48a.py` (API: IDOR, catálogo, SSRF, OCR, cabeçalhos, CSP) e `t48b.py` (navegador: XSS por mutação, CSV, backup malicioso, arquivos inválidos). Requerem `wrangler dev --local` com `ALLOW_TEST_USER=1`.
- Variante hospedada: bibliotecas em `public/vendor` (versões/SHA-256 em `fonte/vendor/VENDOR.md`) e cabeçalhos em `public/_headers`. A CSP completa está em *Report-Only*; violações aparecem no painel Administrador.
- Pendências: atualizar xlsx (≥ 0.20.2) e pdf.js (≥ 4.2.67); ver dossiê da rodada 16.

## Briefing pré-reunião (rodada 17)
- `brief.js`: gera localmente (sem IA) o briefing em PDF a partir da ficha de faturamento; o prompt fica embutido (`BRIEF_PROMPT`) e visível na aba "Briefing pré-reunião". Sem ficha, a aba exige anexá-la.
- `store.js` guarda o instantâneo tabular da ficha XLSX/CSV (`ficha.tab`, ≤300 linhas × 24 colunas/aba). Fichas enviadas antes desta rodada ou em PDF/TXT não têm colunas: remover e reenviar em XLSX/CSV.
- Testes: `t49.py` (ficha XLSX sintética, totais, PDF) e `t49b.py` (ficha só texto). Detecção de colunas validada só com ficha sintética.

## Planilha do Google (rodada 17b)
- `sheet.js` + rota `POST /api/planilha` (worker.src.js): baixa o CSV de `docs.google.com` (link "qualquer pessoa com o link → leitor"); só esse host (redirects só para googleusercontent), limite 6 MB, 20/min.
- Cartão em Clientes e em Importar e fichas. Sincroniza ao abrir, a cada N min (padrão 15) e por botão. Mapeamento salvo por nome de coluna; se as colunas mudarem, abre o assistente. Linhas ambíguas são ignoradas na sincronização automática.
- Cliente que sai da planilha é MANTIDO e marcado `foraPlanilha` (some se voltar). Se >50% da carteira ficaria fora, a marcação não é aplicada (provável aba/link errado).
- Teste: `t50.py` (Google simulado; a leitura real do Google só pode ser validada em produção).

## Motor de oportunidades (rodada 18)
Regra central: **"não identificado nos documentos" ≠ "cliente não possui"**. Lacuna de portfólio gera investigação fundamentada, nunca afirmação de ausência ou necessidade. Tudo que o motor gera sem dor explícita entra como *Investigar* (nunca *Prioridade*), com origem declarada (`orig.js`): Dor explícita | Histórico | Comparação de portfólio | Sinal de faturamento | Complemento de solução | Mercado | Ciclo de vida | Hipótese do executivo.
- **A** `sem.js`/`kb.js`: termos de necessidade ancorados (sem falso positivo por substring); `semHist`/estado `generica` (termo genérico sem dificuldade na frase não vira dor). Teste: `node hyg_run.mjs <pasta fonte>` (41 casos sintéticos, harness em /home/claude/test).
- **B** `fsin.js`: sinais da ficha (excedente repetido em 2+ competências, cancelamento, variação, desconto com validade). Reusa `briefRaw`/`brClassRow`. Uma ficha só nunca conclui recorrência. Pendências em `fsPendencias`. Teste: `t51.py`.
- **C** `cmp.js`: comparação de portfólio com clientes comparáveis da própria carteira (CNAE/porte/ERP). Exige dados do alvo e de pares; mostra denominador e amostra; "ficha parcial" é sinalizada. Teste: `t52.py`.
- **§2** `rel.js`: relações núcleo → complemento (campo `complementos[]` na Base). O catálogo nasce vazio; só relação **validada** pelo executivo gera indicação; sugestões de IA/radar ficam pendentes. Teste: `t53.py`.
- **D** `tk.js`: ticket de referência por solução (privado, `S.meta.tickets`; nunca vai ao catálogo compartilhado). Preço confirmado × referência interna; origem, data, moeda, natureza. Sem previsão/ROI/probabilidade; sem valor ⇒ "Não estimado". Só desempata score igual (apenas BRL recorrente). Teste: `t54.py`.
- **E** `util.js`: painel "Utilidade do motor" em Oportunidades, calculado dos registros existentes (decisão, avaliação, não-identificadas). Taxas só sobre avaliadas; mostra denominador, período, amostra; propostas de ajuste (≥4 avaliadas, ≥2 clientes, ≥50% negativas) só para revisão humana em `S.meta.motorSug`; nada altera pesos/regras. Teste: `t55.py`.
- **F** `radar.js`: radar de portfólio oficial (Base de Soluções). Fontes (totvs.com/.br) por finalidade: catálogo, lançamentos, documentação. 1ª leitura = linha de base; depois diff → fila de revisão; documentação só gera "documentação atualizada"; queda abrupta/página vazia não é aplicada; deduplicação por chave/Base/fila; rascunho **só por clique**, privado (`_priv`), "NECESSITA VALIDAÇÃO". Reusa `/api/importar` (sem páginas vinculadas/anexos). Verificação manual + semanal **ao abrir o app** (sem execução com o app fechado). Teste: `t56.py` (backend simulado; leitura real de totvs.com não validada aqui).
- **G** `dor.js`: busca "dor → solução" (painel na Base de Soluções) sobre `semIdx` (≥2 termos em comum com um trecho; sem resultado forçado). Cartão: trecho que sustenta, explicação, requisitos, pergunta de confirmação. Hipótese salva em `c.dorHip`: vira oportunidade de investigação só se nenhuma outra já cobre a solução; senão é anexada como evidência (sem duplicar, sem mudar score). Lexical (TF-IDF por termos), não embeddings. Teste: `t57.py`.
- **H** `dt.js`: gatilhos de data (vigência, renovação, fim de desconto) em fichas e documentos. Data **encontrada** (trecho) ≠ **interpretada** (ISO) ≠ **confirmada** (você). Só confirmada e dentro da janela (`renovDays`) gera oportunidade; competência/vencimento de fatura são ignorados; desconto confirmado anexa evidência à oportunidade de desconto (B) em vez de duplicar. Lembretes contratuais e alertas de sustentação/regulatório inalterados. Teste: `t58.py`.
- Regressão rodada: t40, t44, t47a/b/c, t48a/b, t49, t49b, t50–t58 (ver /tmp/reg.log da sessão). Validação com dados reais de clientes **não** foi feita: os testes usam dados sintéticos.

## Desempenho — Lote 1: carga inicial (branch `perf/lote-1-carga-inicial`)
- Linha de base e plano: dossiê "Desempenho — diagnóstico e plano" (Projeto). Ambiente de medição: Worker+D1 locais, Chromium headless, celular = Slow 4G (1,6 Mbps, 150 ms) + CPU 4×, dados fictícios; mediana de n=3–5.
- `vend.js` (novo): `vend('xlsx'|'jszip'|'jspdf'|'pdfjs')` carrega a biblioteca sob demanda (promessa compartilhada; falha não fica em cache; aviso "Carregando recurso…" após 700 ms). Os 4 `<script>` bloqueantes saíram do `<head>` (`index.tpl.html`). Pontos de uso: `core.js` (readTable, readPdf), `sol.js` (readDocx, readPptx), `cad.js` (downloadTemplate), `store.js` (exportXLSX), `brief.js`/`pdfx.js` (exportadores de PDF), `ai.js` (aiPack). Quem usa a biblioteca **diretamente** (testes, código novo) deve chamar `await vend('...')` antes.
- `initStore` pré-busca o XLSX (link `rel=prefetch`, só baixa) 3 s depois da abertura; as demais bibliotecas só no 1º uso.
- `build.py`: `vend.js` entra primeiro; no build hospedado `WORKER_SRC/README/TOML` viram strings vazias (pacote do backend só existe no artefato; o botão já é escondido no hospedado).
- Correção à parte (Rodada 18): `safeUrl` em links de `dor.js`, `radar.js` e `rel.js` (o teste de XSS t48b acusou `javascript:` sem filtro).
- Teste novo: `t59.py` (29 checks: abertura sem libs, carregamento compartilhado, falha+retry, leitores PDF/DOCX/PPTX, importar/exportar XLSX, PDF executivo, aviso de rede lenta, prefetch). `t48b.py` ajustado (`await vend('jszip')` antes de usar `JSZip` direto).
- Reverter: descartar a branch (ou reverter vend.js, index.tpl.html, build.py e os 8 pontos de uso).

## Desempenho — Lote 2: dados (branch `perf/lote-2-dados`)
- `store.js` → `poolRun(fns, conc=5)`: concorrência limitada; após o 1º erro não inicia novas tarefas, aguarda as em voo e propaga o 1º erro (sem rejeição solta).
- `initStore`: as 16 leituras (carteira, clientes, inbox, catálogo, soluções privadas, solnotas, pesquisas, 8 coleções, ocrimg) rodam em paralelo (máx. 5 em voo); **nada é aplicado ao estado até todas concluírem**, e então na ordem original. Falha em qualquer uma = modo memória como antes (sem estado parcial); `solnotas` continua opcional. `ocrimg` fica no fim da fila (não foi adiado: sem dado real para medir o ganho; ver Pendências).
- `acct.js`: `catalogBuild(cat, priv, notas)` extraído de `catalogLoad` (que continua existindo para "Reler catálogo").
- `flush()`: gravações/exclusões de clientes e de coleções genéricas (`GCOL`) em pool de 5. Falha recoloca o item na fila (antes, nas coleções genéricas o item se perdia). Inbox, soluções (versão `cv`/409), pesquisas e a carteira continuam sequenciais.
- Status: `salvando N…` quando há mais de 5 itens (item 14). Atenção: o texto não começa com `salvo`.
- Item 03 (gravar a carteira a cada abertura): **não ocorre** — aberturas com dados existentes não gravam nada (t60). A gravação só acontece na 1ª abertura de cada conta (migração/semente do catálogo).
- Teste novo `t60.py` (37 checks): paginação >200, concorrência ≤5 em leitura e gravação, sem duplicata, falha de uma leitura (nada aplicado, nada gravado), solnotas opcional, queda no meio da gravação (retentativa sem perda/duplicata), edição durante a gravação, exclusão paralela, ocrimg remontado, isolamento entre usuários, conflito de catálogo (cv).
- `t41.py` está desatualizado desde antes (espera o texto antigo "Nenhuma chave de IA conectada"; 5 falhas preexistentes, sem relação com este lote).
- Reverter: restaurar `store.js` e `acct.js` da branch `perf/lote-1-carga-inicial` (nenhum outro arquivo de produção mudou).

## Desempenho — Lote 5: observabilidade e produção (branch `perf/lote-5-observabilidade`)
- Item 30 · RUM first-party **no canal existente** (`/api/ev` → tabela `eventos`; sem schema, sem serviço externo, sem config): novo recurso `desempenho_abertura` (`worker.adm.js` → `ADM_FUNCS`, `ADM_NUM` + `fcp_ms`, `lcp_ms`, `pronto_ms`, `cls_m`). `adm.js` → `telAbertura(t0)`, chamado em `main.js` ao fim de `initStore()`: 1 evento por abertura, `dur` = fase de dados, meta = FCP, LCP, "pronto" (ms desde a navegação), CLS×1000 e nº de clientes. Sem URL, nome, CNPJ ou conteúdo (o servidor descarta texto, negativos e chaves desconhecidas). Falha de coleta nunca bloqueia (t63). `util:0`: não conta como uso nem deixa usuário "ativo". Aparece no painel Administrador como "Desempenho da abertura"; o texto de aviso ao usuário já cobre "tempo de processamento". Custo: +1 POST pequeno (≈1,2 s após a abertura). Reverter: `adm.js` (bloco TEL_PERF/telAbertura), `worker.adm.js` (1 entrada + 4 chaves) e `main.js` (linha do `initStore`).
- Item 26 · CPU da abertura (celular 4×, 300 clientes): maior long task ≈830 ms = `reanalyzeAll` ≈360 ms + render ≈250 ms. Testei 2 microajustes sem mudar a saída (formatador `Intl` único em `fmtDate`; regex global em cache em `semHits`; hash das análises idêntico): **sem ganho medido** (A/B n=6: long tasks celular 1089 → 1024 ms, variação 869–1256; desktop sem ganho) → **revertidos**. Ganho real exigiria mudança estrutural (analisar em blocos com `yield`, ou adiar análise de clientes fora da tela): maior risco, não feito.
- Item 17 · `EXPLAIN QUERY PLAN` local: leitura/listagem usam `docs_parent` e a PK; só o painel admin faz `SCAN docs` (`parent LIKE 'data/users/%'`, volume atual pequeno). Nenhum índice criado (exigiria aprovação).
- Itens 09 (compressão), 18, 19 (região D1) e produção: **não verificados** (exigem acesso à produção/Cloudflare, fora do escopo sem aprovação).
- Teste novo `t63.py` (15 checks). `t50.py` é instável em servidor de teste reutilizado (falha a partir da ~3ª execução seguida; reproduzido também no build do Lote 4) — não relacionado.

## Desempenho — Lote 4: fontes locais (branch `perf/lote-4-fontes`)
- Itens 29/21 · Space Grotesk 500/600/700 (subconjunto latin, ~13 KB cada) servida de `/fonts/*` **só no build hospedado**; `@font-face` inline com `font-display:swap` e `?v=<sha1>`. O link ao Google Fonts (preconnect + CSS) sai do `<head>` hospedado. Arquivos em `fonte/fonts/` (licença OFL em `OFL-LICENSE.txt`, origem em `FONTS.md`; o pacote npm `@fontsource/space-grotesk` foi usado só como origem dos arquivos, não é dependência do projeto).
- `_headers`: `font-src 'self' https://fonts.gstatic.com` (gstatic mantido para os exports HTML) e `/fonts/*` com `max-age=31536000, immutable`. `bld.sh` copia `fonte/fonts/*`.
- **Sem `<link rel=preload>`**: testado com preload de 600/700 e piorou o celular (Slow 4G + CPU 4×) em ≈125 ms (FCP 2580→2700), pois disputa banda com o HTML de 1,3 MB. Removido.
- Artefato (claude.ai) continua com Google Fonts; exports HTML (`htmlDoc`) mantêm o link por serem arquivos autônomos.
- Teste novo `t62.py` (13 checks): head sem Google, 3 `@font-face` versionados, swap, sem preload, `/fonts` 200 + woff2 válido + imutável, CSP, exports intactos, nenhuma requisição de terceiros ao abrir, faces carregadas, sem erro de página, artefato inalterado.
- Limitação da medição: o ambiente não alcança o Google Fonts real; a latência de terceiros foi modelada por servidor local com TLS. O ganho desktop é, portanto, uma estimativa do custo de 2 origens extras, não um valor de produção.
- Reverter: descartar a branch (ou restaurar `build.py`, `_headers`, `bld.sh`; apagar `fonte/fonts/` e `t62.py`).

## Desempenho — Lote 3: interação (branch `perf/lote-3-interacao`)
- Item 04 · debounce: `main.js` → `deb(k, fn, ms=140)` / `deb.flush(k)` / `reRender(sel)`. Busca de clientes (`fq`), `tdq`, `prodq`, `solq`, `pq` atualizam o estado a cada tecla e adiam só o render; o cursor e o foco são restaurados (só se o campo ainda tem foco). Busca global (`gq`, `shell.js`): 90 ms; Enter e ↓ executam o pendente na hora.
- Item 12 · `hosted.js`: `api()` ganhou tempo limite por requisição (leitura 30 s, escrita 60 s; `window.__apiTo` só para testes) e **1 nova tentativa só para leitura** (get/list/`/api/me`) em falha de rede ou tempo esgotado. Escrita nunca é repetida aí: o item volta à fila do `flush`. Antes, uma requisição pendurada deixava `saving=true` para sempre e a fila congelava. Status mostra "ERRO ao salvar: O servidor demorou a responder." (`store.js`).
- Item 15 · `prints.js` (miniaturas) e `ocr.js` (imagem original): `loading="lazy" decoding="async"`. Logos ficam eager.
- Item 27 · `build.py`: URLs de `/vendor` (inclui o worker do pdf.js) levam `?v=<sha1 do arquivo>`; `_headers`: `/vendor/*` com `max-age=31536000, immutable`. `bld.sh` passou a copiar `_headers` (antes a mudança de header não chegava ao build).
- Teste novo `t61.py` (30 checks): debounce (estado imediato, ≤2 renders, cursor/foco, Enter imediato), retentativa só em leitura, escrita não repetida, requisição pendurada (escrita e leitura) com tempo limite, imagens lazy, `/vendor` versionado e imutável.
- Reverter: restaurar `hosted.js`, `main.js`, `shell.js`, `prints.js`, `ocr.js`, `build.py`, `_headers` (e a linha de status em `store.js`) da branch do Lote 2.
