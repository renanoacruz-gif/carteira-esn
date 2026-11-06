/* ===== Rodada 18 §5: origem de cada indicação (explicável) =====
   Dor explícita | Histórico | Comparação de portfólio | Sinal de faturamento | Complemento de solução | Mercado | Ciclo de vida
   Calculada a partir do que a oportunidade realmente cita (evidências, regra de origem, tendências setoriais); geradores novos declaram a sua em o.origemTipo. */
const ORIG_TIPOS = ['Dor explícita', 'Histórico', 'Comparação de portfólio', 'Sinal de faturamento', 'Complemento de solução', 'Mercado', 'Ciclo de vida', 'Hipótese do executivo'];
const ORIG_TIP = { 'Hipótese do executivo': 'Registrada por você na busca dor → solução; não é evidência do cliente.', 'Dor explícita': 'Termo ou paráfrase no texto do cliente (observação, documento, ata).', 'Histórico': 'Registro prévio do cliente: cadastro estratégico, risco/NPS, contrato.', 'Comparação de portfólio': 'Clientes comparáveis da sua carteira têm a solução; não é benchmark de mercado.', 'Sinal de faturamento': 'Padrão na ficha de faturamento (excedente, cancelamento, variação, desconto).', 'Complemento de solução': 'Relação núcleo → complemento curada no catálogo.', 'Mercado': 'Tendência setorial ou pesquisa de mercado salva (não é evidência do cliente).', 'Ciclo de vida': 'Data ou marco: release, prazo regulatório, vigência.' };
function oppOrigemTipos(o) {
  const s = new Set(o.origemTipo || []), ev = o.evInd || [], id = String(o.ruleId || '');
  if (/^release_|^regulatorio$/.test(id)) s.add('Ciclo de vida');
  if (id === 'retencao' || ev.some(e => /Cadastro estratégico/.test(e.src || ''))) s.add('Histórico');
  if (/^adocao_/.test(id)) s.add('Sinal de faturamento');
  if (ev.some(e => /^Termos?\s+["“”']/.test(String(e.text)) || /^Trecho do cliente/.test(String(e.text)) || /Observa|Planilha •|\bata\b|proposta|e-?mail|Análise semântica/i.test(e.src || '') && !/Cadastro estratégico/.test(e.src || '')) && id !== 'retencao') s.add('Dor explícita');
  if ((o.setorial || []).length) s.add('Mercado');
  return ORIG_TIPOS.filter(t => s.has(t));
}
const origChips = o => { const l = o.origemTipo || []; return l.length ? `<div class="sm" style="margin:4px 0">Origem: ${l.map(t => `<span class="pill p-info" title="${esc(ORIG_TIP[t] || '')}">${esc(t)}</span>`).join(' ')}</div>` : ''; };
