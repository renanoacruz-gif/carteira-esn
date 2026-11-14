# Bibliotecas de terceiros embarcadas (variante hospedada)

Servidas de `/vendor/*` pelo próprio Worker (sem CDN em tempo de execução). Origem: pacotes npm; versões e SHA-256 abaixo.

| Arquivo | Pacote@versão | SHA-256 |
|---|---|---|
| xlsx.full.min.js | xlsx@0.18.5 | c9506197caf809a075b6dee1da0d36fb19da7158ffe8a88e7b0c96c5d8623c99 |
| jszip.min.js | jszip@3.10.2 | 7f839b2d4688b845c105ebf5d2f9803075f91ea0fe72bdaac176c3a04dd3d2c1 |
| jspdf.umd.min.js | jspdf@2.5.1 | 98ccf17aa10c20bb1301762618fcc9b6ab3a4e7f26b6071d64d0b41154df3875 |
| pdf.min.js | pdfjs-dist@3.11.174 | 5b5799e6f8c680663207ac5b42ee14eed2a406fa7af48f50c154f0c0b1566946 |
| pdf.worker.min.js | pdfjs-dist@3.11.174 | feabdf309770ed24bba31a5467836cdc8cf639c705af27d52b585b041bb8527b |

Pendência conhecida: xlsx 0.18.5 tem CVE-2023-30533 (poluição de protótipo) e CVE-2024-22363 (ReDoS), corrigidos em ≥0.19.3/0.20.2, distribuídos apenas por cdn.sheetjs.com. Mitigação aplicada em core.js (guarda de protótipo após XLSX.read) — atualizar o arquivo quando possível.

## OCR local (carregado só quando o executivo escolhe "Ler neste aparelho")

Arquivos mantidos só em `public/vendor/tess/` (não passam pelo build; não há cópia em `fonte/`). Origem: pacotes npm `tesseract.js`, `tesseract.js-core` e `@tesseract.js-data/por`.

| Arquivo | Pacote@versão | SHA-256 (início) |
|---|---|---|
| public/vendor/tess/tesseract.min.js | tesseract.js@5.1.1 | a8e29918d098b2b0 |
| public/vendor/tess/worker.min.js | tesseract.js@5.1.1 | aca1229639fc9907 |
| public/vendor/tess/tesseract-core-simd-lstm.wasm.js | tesseract.js-core@5.1.1 | ce20eda9533cbed1 |
| public/vendor/tess/tesseract-core-lstm.wasm.js | tesseract.js-core@5.1.1 | 8f04aa0cc81e7bde |
| public/vendor/tess/lang/por.traineddata.gz | @tesseract.js-data/por (4.0.0_best_int) | dacebc1386ddaaf8 |

Licença Apache-2.0. Roda inteiro no navegador (WebAssembly): a imagem não sai do aparelho. Exige `'wasm-unsafe-eval'` na CSP (só compilação de WebAssembly; `eval` de JavaScript continua bloqueado).
