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
