# Fontes self-hosted (build hospedado)
- Space Grotesk, subconjunto `latin` (cobre português), pesos 500/600/700, woff2.
- Origem: pacote npm `@fontsource/space-grotesk@5.3.0` (usado só como fonte dos arquivos; NÃO é dependência do projeto). Licença: SIL OFL 1.1 (`OFL-LICENSE.txt`).
- `build.py` (hospedado): copia para `public/fonts/`, declara `@font-face` inline com URL versionada por hash (`?v=`), remove os links (sem `preload`: medido em Slow 4G, atrasa o 1º conteúdo ≈125 ms) do Google Fonts do shell. O artefato (não hospedado) continua usando o Google Fonts.
- Documentos exportados (`htmlDoc` em ui.js) seguem com o link do Google Fonts: são arquivos avulsos.
