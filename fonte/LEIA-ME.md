# Fonte do app
Módulos JS/CSS concatenados por `build.py` (ajuste `d=` para esta pasta e o destino do pacote) em `public/index.html` + `src/worker.js`.
Fluxo: alterar aqui → rodar build → commitar `public/` e `src/` → o Cloudflare publica sozinho (Workers Builds).

## Segurança (rodada 16)
- Testes: `t48a.py` (API: IDOR, catálogo, SSRF, OCR, cabeçalhos, CSP) e `t48b.py` (navegador: XSS por mutação, CSV, backup malicioso, arquivos inválidos). Requerem `wrangler dev --local` com `ALLOW_TEST_USER=1`.
- Variante hospedada: bibliotecas em `public/vendor` (versões/SHA-256 em `fonte/vendor/VENDOR.md`) e cabeçalhos em `public/_headers`. A CSP completa está em *Report-Only*; violações aparecem no painel Administrador.
- Pendências: atualizar xlsx (≥ 0.20.2) e pdf.js (≥ 4.2.67); ver dossiê da rodada 16.
