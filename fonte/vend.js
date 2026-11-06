/* Bibliotecas pesadas carregadas sob demanda (fora do caminho crítico da 1ª pintura).
   URLs do artefato (cdnjs); o build hospedado troca por /vendor/ (build.py). Usadas só em ações do usuário: importar/exportar planilha, PDF, DOCX/PPTX. */
const VEND = {
  xlsx: { u: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js', ok: () => !!window.XLSX },
  jszip: { u: 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js', ok: () => !!window.JSZip },
  jspdf: { u: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', ok: () => !!window.jspdf?.jsPDF },
  pdfjs: { u: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js', ok: () => !!window.pdfjsLib },
};
const _vp = {};
/* Resolve true quando a biblioteca está pronta; false se não carregou (rede/bloqueio). Chamadas simultâneas compartilham o mesmo carregamento; falha não fica em cache. */
function vend(k) {
  const v = VEND[k]; if (!v) return Promise.resolve(false);
  if (v.ok()) return Promise.resolve(true);
  return _vp[k] ||= new Promise(res => {
    const s = document.createElement('script'); s.src = v.u; s.async = true;
    const tm = setTimeout(() => { try { toast('Carregando recurso necessário…', 'info'); } catch { /* sem toast */ } }, 700); /* rede lenta: dá retorno ao clique */
    const fim = ok => { clearTimeout(tm); if (!ok) { delete _vp[k]; s.remove(); } res(ok); };
    s.onload = () => fim(v.ok()); s.onerror = () => fim(false);
    document.head.appendChild(s);
  });
}
/* Pré-busca em baixa prioridade (só baixa para o cache; não executa). Chamada depois que os dados da abertura chegaram. */
function vendPrefetch(...ks) {
  ks.forEach(k => { const v = VEND[k]; if (!v || v.ok() || _vp[k] || document.querySelector(`link[rel=prefetch][href="${v.u}"]`)) return; const l = document.createElement('link'); l.rel = 'prefetch'; l.as = 'script'; l.href = v.u; document.head.appendChild(l); });
}
