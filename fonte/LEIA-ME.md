# Fonte do app
Módulos JS/CSS concatenados por `build.py` (ajuste `d=` para esta pasta e o destino do pacote) em `public/index.html` + `src/worker.js`.
Fluxo: alterar aqui → rodar build → commitar `public/` e `src/` → o Cloudflare publica sozinho (Workers Builds).

## Mapa de features — Onda 1 (branch `feat/mapa-ondas`)
- Lembrete: lote >40 aparelhos com continuação (crons `10,20 12,17`; alvo = aparelhos sem linha em `push_enviados`), agrupamento de escritas no D1 (limite por invocação), feriados nacionais + Carnaval/Sexta Santa/Corpus Christi (`pushFeriado`; estadual/municipal → usar Pausar), pausa por pessoa (`push_pausa`, até 90 dias), turnos 9h/14h por pessoa (`push_pref`), vigia `40 12,17` (`pushVigia`: avisa só o admin, sem repetir no dia).
- Notificação: toque abre/foca o app e leva a "Onde vale aprofundar hoje" (`?lembrete=1` / postMessage). Texto do admin quando há alerta.
- Onboarding "Primeiros passos" (`onb.js`), convite pronto no painel admin, textos de chaves de IA ("Configurações → IA e provedores → Minhas chaves de IA"), Integrações sem itens do Claude da página no modo hospedado.
- Privacidade: /sobre v1.4 (pausa e turnos). Testes: `t69.py` (54), `t68_sw.mjs`, `t65.py`.
- Fora do escopo desta onda: G4, I4, I6, D3 e testes em aparelhos reais (Q5).

## Mapa de features — Onda 2 (branch `feat/mapa-ondas`)
- R1 Retornos: tarefas livres do cliente em `c.act['ret:…']` (`{texto, prazo, resp, status, origem}`), aba **Reunião e retornos** (`onda2.js`). Vencidos/hoje entram em Pendências e no aviso: `push_retornos(email, r, em)` (tabela separada, sem ALTER) e `POST /api/push/resumo {n, r?}`; SW diz "N clientes … e R retornos vencendo".
- P2 Pós-reunião: ata → máscara no navegador (CNPJ, CPF, valores, e-mail, telefone) → `/api/ia` (tarefa `estruturado`, chave pessoal) → revisão com caixas → só o marcado é salvo (passos viram retornos; compromissos/objeções viram anotação datada em `c.mgmt.notes`). P3: rascunho de follow-up, só copia.
- I2 Renovações 180 dias (`rnvCard`, só datas confirmadas) e I1 Carteira em risco (`riscoCard`, sinais documentados; não é previsão). D2 CSV para CRM/Mesa de Forecast (layout genérico: `CRM_HEAD`; ajustar quando houver o layout do destino). P1: briefing PDF ganhou "Combinados em aberto e datas confirmadas".
- G5 Sugerir melhoria: `POST /api/sug` (5/dia, sem CNPJ/valores), tabela `sugestoes` (180 dias), painel admin "Sugestões do time" (`/api/adm/sugestoes`).
- /sobre v1.5. Testes: `t70.py` (73), `t68_sw.mjs` (26).
- **Não feito (Q2)**: xlsx ≥0.19.3 só em cdn.sheetjs.com (403 neste ambiente; baixe o `.tgz` e substitua `vendor/xlsx.full.min.js`); jspdf 2.5.1→4.x e pdfjs 3→6 são saltos de versão maior que exigem regressão visual dos PDFs.

## Mapa de features — Onda 3 (branch `feat/mapa-ondas`)
- R5 Resumo da semana (`semanaCard`, calculado dos registros atuais; sem histórico próprio; copiar como texto). P4 Roteiro de descoberta (aba Reunião; perguntas das oportunidades ativas e do cadastro, marcadas como hipóteses). Q8 Busca global (`buscaGlobal`, só no navegador: clientes, retornos, anotações, documentos, Base de Soluções, Mercado).
- R6 Ditado (Web Speech, `dictOk`): só aparece se o navegador tem a API e no modo hospedado; pede confirmação na 1ª vez (o áudio vai ao serviço de voz do fabricante). **Não verificado em iPhone/Android reais** (teste com a API simulada).
- Não feito: I5 (aplicar ajustes do motor) — `util.js` define que sugestões não alteram pesos/regras/resultados; mudar isso é decisão de produto, não técnica. I3 (radar agendado) fica fora: exigiria cron com busca na web e chave de IA no servidor (decisão I4).
- Testes: `t71.py` (29).

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

## Auditoria de segurança — rodada 19 (branch `sec/auditoria-rodada-19`)
- Guarda anti-CSRF em `handle()`: escrita em `/api/*` com `Sec-Fetch-Site` cross-site/same-site ou `Origin` de outro host → 403 `origem_invalida`. Sem esses cabeçalhos (clientes não-navegador) segue permitido.
- `x-test-user` só vale com host localhost/127.0.0.1 (mesmo com `ALLOW_TEST_USER=1`); aparelho de push em `127.0.0.1` idem.
- Rotas push: 60 pedidos/min e 3 testes/min por usuário.
- `t66.py` (56 checagens de segurança). Rodar com o servidor de teste em :8790; opcionalmente `/tmp/vapid_prod.txt` para conferir que a chave privada não está no repo.
- Relatório: `rodada19_auditoria_seguranca.html`.

## Lembretes 9h e 14h (branches `feat/lembrete-diario`, `feat/lembrete-duas-vezes`)
- Web Push **sem conteúdo**: crons `0 12 * * MON-FRI` (09:00 de Brasília, UTC-3) e `0 17 * * MON-FRI` (14:00) → Worker envia push vazio a cada aparelho inscrito → `public/sw.js` mostra texto fixo. Turno da manhã pula quem abriu o sistema desde 00:00 BRT; turno da tarde pula quem abriu desde 12:00 BRT (`usuarios.ultimo_acesso`). O texto da notificação é escolhido pelo SW pela hora local do aparelho (< 12h = manhã). Feriados não tratados.
- Arquivos: `worker.push.js` (rotas `/api/push/*`, VAPID ES256, cron), `sw.js`, `lembrete.js` (banner no painel + cartão em Conta), `gerar_vapid.mjs`, `t65.py`.
- Tabela `push_subs(endpoint, email, criado_em, ultimo_ok, falhas)`, criada em execução. Máx. 5 aparelhos por conta; 404/410 removem; 5 falhas seguidas removem; no máx. 40 envios por execução (limite de 50 subrequests do plano Free); trava por turno em `adm_cfg.push_dia_manha` e `push_dia_tarde`; resumo em `adm_cfg.push_ultimo`.
- SSRF: endpoint só de FCM, Mozilla, Apple e WNS, https, sem porta/credenciais. `127.0.0.1` só com `ALLOW_TEST_USER=1`.
- **Ativar em produção:** `node fonte/gerar_vapid.mjs` → cadastrar `VAPID_PUBLIC` e `VAPID_PRIVATE` como *Secret* no Worker (Settings → Variables and Secrets). Sem eles o recurso fica desligado (rotas 503, cron não faz nada). Opcional: `VAPID_SUBJECT` (`mailto:`), padrão = 1º de `ADMIN_EMAILS`.
- iPhone: só funciona com o app adicionado à Tela de Início (iOS 16.4+). Entrega é best-effort dos serviços de push.
- Teste local: `wrangler dev --test-scheduled --var ALLOW_TEST_USER:1 --var VAPID_PUBLIC:… --var VAPID_PRIVATE:…` e `/cdn-cgi/handler/scheduled?cron=…&time=<ms>`.

## Lembretes: adoção no painel admin e aviso com número (branch `feat/lembrete-adocao-conteudo`)
- **Painel admin:** card "Lembretes (push)" (`adm.js` → `GET /api/adm/lembrete`, mesma guarda de `/api/adm/*`). Mostra aparelhos ativos, executivos com lembrete, enviados/dispensados ("já tinham aberto")/falhas em 7 dias, resumo recente e histórico por turno. Só contagens: sem e-mail nem endereço de aparelho. Alertas: `vapid_ausente` (há aparelhos e faltam chaves), `turno_nao_executou` (dia útil, passou das 09:30/14:30 BRT sem registro do turno), `config_invalida` (último turno recusado pelo serviço de push), `falhas_altas` (≥50% nos 3 últimos turnos, mín. 3 tentativas). O alerta é calculado ao abrir o painel (não há envio de e-mail).
- Tabela `push_envios(dia, turno, aparelhos, enviados, pulados_uso, removidos, falhas, adiados, config_invalida, ts)`, uma linha por turno gravada ao fim de `pushAgendado`; retenção de ~90 dias. Se o cron falha antes de gravar (ex.: secret ausente), não há linha — é isso que dispara `turno_nao_executou`.
- **Aviso com número:** o navegador (com lembrete ativo neste aparelho e carteira carregada) conta `hojeItens().length` (a mesma regra do card "Onde vale aprofundar hoje") e envia **só um inteiro** a `POST /api/push/resumo {n}` (0–999; no máx. 1 envio a cada 3 h para o mesmo valor). O servidor **não lê a carteira**. Tabela `push_resumo(email, n, em)`; apagada ao desativar o último aparelho e limpa de órfãos a cada turno.
- `sw.js`: ao receber o push busca `GET /api/push/resumo` (mesma origem, `redirect:'manual'`, 4 s) e mostra "N clientes com motivo para aprofundar hoje" (se calculado hoje) ou "…na sua última visita (dd/mm)". Zero, vencido (>5 dias), sem resposta ou sessão expirada → texto geral de antes. O número reflete a última vez que o app foi aberto, não o instante do envio.
- Privacidade: `legal_content.py` 1.3 (número inteiro, retenção de 90 dias das contagens).
- Testes: `t68.py` (64 checks: resumo, turno, retenção, painel, alertas, UI) e `t68_sw.mjs` (16 checks do texto do SW em sandbox). Regressão: t65, t66, t67, t47a, t48a, t48b e higiene.

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

## Desempenho — Lote 6: imagens sob demanda e verificações (branch `perf/lote-6-cpu-ocr`)
- Item 24 · `ocrimg` sob demanda: `initStore` **não lê mais** a coleção `ocrimg` (imagens do OCR/prints, em partes de 120 KB). `store.js` → `ocrimgOk(rec)`, `ocrimgEnsure(rec)` (lê só as partes `${rec.id}_${i}` de **uma** imagem, por documento, até 5 em paralelo; leituras simultâneas compartilham a promessa; falha fica em `OCI.falha` e permite nova tentativa; descartada se a carteira for limpa durante a leitura — `DM.epoch`) e `ocrimgDrop(rec)` (exclui por id determinístico, sem precisar carregar). Usos: `ocr.js` (`ocVer` + placeholder "Carregando imagem original…", `ocrEnviar` aguarda a imagem, `ocrExcluir`), `prints.js` (`prBig` carrega e reabre, exclusão). Imagens recém-enviadas já estão em memória (não leem nada). O backup não inclui `ocrimg` (inalterado).
- Medição (dado **sintético**: 300 clientes + 20 imagens × 6 partes ≈ 14 MB de base64; n=5; mesmo dia/máquina; baseline = Lote 5): dados prontos celular (Slow 4G + 4× CPU) 23.354 → 4.446 ms; desktop 1.406 → 613 ms; chamadas de API na abertura 19–22 → 18; shell inalterado. Quem não tem imagens não muda. Tamanho real das imagens dos usuários não medido: o ganho cresce com o volume guardado.
- Item 26 · CPU estrutural: **não implementado, por decisão com evidência**. Render por tela no celular 4× com 300 clientes: geral 113–135 ms, clientes 117–155, importar 164–188 (com 20 registros OCR), demais ≤82 ms — nenhuma passa de ≈190 ms; o long task de ≈830 ms é na abertura, atrás da tela de carregamento. Quebrar em blocos aumentaria o tempo até "pronto" sem ganho visível; pular a reanálise na abertura é inseguro (regras dependem da data). Reavaliar só se o RUM (`desempenho_abertura`) mostrar abertura lenta em uso real.
- Produção (só leitura): D1 em **ENAM**, réplicas de leitura desativadas. O D1 não tem região na América do Sul (hints: wnam, enam, weur, eeur, apac, oc), então ENAM é a mais próxima disponível → item 19 sem ação. Item 09 (compressão) e 18 (observabilidade do Worker) não verificáveis daqui (atrás do Access; a API não devolve a configuração). Checagem manual: DevTools → Network → documento → `Content-Encoding` (br/gzip); `Workers & Pages → carteira-esn → Observability`.
- Testes: `t64.py` novo (17 checks: sem leitura na abertura, só as partes do registro, ordem, cache, simultâneas, exclusão sem órfãs, pedido ao OCR com imagem inteira, falha e nova tentativa). Ajustados ao novo comportamento: `t46.py`, `t46h.py`, `t60.py`.
- Reverter: restaurar `store.js`, `ocr.js`, `prints.js` (e os 3 testes) da branch do Lote 5.

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

## Design refresh (branch feat/design-refresh)
Somente apresentação; nenhuma lógica, id, classe ou data-* existente foi alterado.
- **Fase 1 (style.css):** tokens novos (`--fs-*`, `--r-md/--r-pill`, `--t-md/--t-slow`, `--z-*`, tons suaves `--c-soft*`, `--ok-*`, `--warn-*`, `--bad-*`, alfas `--wa*/--pa*/--ca*`), cores soltas → tokens (exceto o documento Briefing, paleta própria), foco 3px, `tabular-nums`, alvos de toque ≥40px (≤900px ou ponteiro grosso), toast compacto e sem capturar clique, tabelas com zebra, breakpoints 1040/900/680 (JS só usa 900), correção de overflow em Releases.
- **Fase 2 (style.css, CSS puro):** ícones por máscara SVG (`--i-*`) em pills de status, alertas e KPIs; estado vazio com ícone; elevação de cartões.
- **Fase 3 (`refresh.js`, aditivo):** paleta Ctrl/⌘+K (reusa `data-a="nav"` e `gsOpen`), atalhos `?`, glossário, navegação interna com scroll-spy (≥1200px, telas longas), botão de topo com anel de progresso, CSS de impressão. Teste: `t72.py`.
- Não feito (exigiria mexer em lógica): count-up nos KPIs, View Transitions (render é síncrono), destaque de linha vencida (falta classe no markup), tema escuro, WebGL/3D.

## Camada 3D (branch feat/3d-layer) — `refresh3d.js`
WebGL escrito à mão (sem biblioteca, sem rede, sem dados de exemplo). Só adiciona um cartão antes dos KPIs da Visão da Carteira (fora de `vGeral`, então exportações não mudam) e inclinação 3D nos KPIs.
- **Orbe:** um ponto por cliente; cor = prioridade da principal oportunidade (Alta rosa, Média laranja, Baixa ciano, sem oportunidade cinza), tamanho = MRR da planilha, faixas de latitude = segmentos. Hover mostra o cliente; clique abre a ficha (reusa `data-a="gsOpen"`).
- **Barras de MRR por segmento:** caixas com iluminação, rótulos HTML projetados; clique filtra Clientes pelo segmento (`data-a="segGo"`).
- **Segurança de uso:** oculto em ≤900px; botão "3D ligado/desligado" (preferência `rf.fx3d`) troca para reserva 2D; `prefers-reduced-motion` = quadro estático; pausa fora da tela/aba oculta; perda de contexto cai para 2D.
- Teste: `t73.py` (28 checagens).

## Polimento leve (branch feat/polish-leve)
Só CSS (bloco final de `style.css`, escopo `#app`/chrome; exportações não mudam): sombras em camadas e bordas suaves, cor dos KPIs/segmentos como traço curto (sem faixa), avisos sem listra lateral, pílulas e cabeçalhos de tabela em caixa normal, filtros em grade ordenada (≥901px), medida de texto 84ch, toc/botão de topo mais discretos, feedback tátil nos botões. Sem mudança de HTML/JS.

## Calibração do motor (frente A)
`calib.py` roda o motor real (`analyzeClient` + `rxClass`) sobre um conjunto-ouro e compara com o esperado (mundo fechado: o que não está em `esperado` e é emitido conta como ruído). Não escreve em `S` nem no banco.
- Servidor local em :8790 (`/tmp/restart.sh`), depois: `PYTHONPATH=<dir do t40_lib> python3 calib.py [gold.json] --html rel.html --json rel.json`
- `calib_gold.sample.json` é SINTÉTICO: valida o harness e trava regressões do motor; não mede acerto real. Para medir de verdade: copie para `calib_gold.real.json` (ignorado pelo git), troque por clientes reais anonimizados e preencha `esperado` com o que você sabe estar correto.
- Percentuais só com n ≥ 8 por regra. O motor só emite regra com produto-base; reforma é baseline de Protheus.
- Divergências são achados para decisão humana; o harness não altera regras. Teste: `t74.py`.
