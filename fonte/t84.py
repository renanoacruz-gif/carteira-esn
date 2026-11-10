# t84 — rodada 27: segmento Varejo ligado às RULES (frente de loja/PDV + conciliação/pagamentos)
import sys, time; sys.path.insert(0, '/home/claude/test')
from t40_lib import *
em = 'qa.t84.%d@totvs.com.br' % time.time()
A, errs = open_h(em)
A.wait_for_timeout(500)

tot = ev(A, "KB.solutions.length")
ck('base inicial (kb.js) >= 61 soluções (rodada 27; rodadas seguintes só crescem)', tot >= 61, tot)

seg = ev(A, "KB.segments.find(s=>s.id=='varejo')")
ck('segmento varejo: estudo=true', seg['estudo'] == True)
ck('segmento varejo: tendencias sourced (>=5)', len(seg['tendencias']) >= 5, len(seg['tendencias']))
ck('segmento varejo: aplicacoes aponta para linx/totvs_omni/systock/equals/totvs_pay/varejonline', set(a['sol'] for a in seg['aplicacoes']) == {'linx','totvs_omni','systock','equals','totvs_pay','varejonline'}, seg['aplicacoes'])
ck('segmento varejo: perguntas de descoberta presentes', len(seg['perguntas']) >= 3)

needs = ev(A, "Object.keys(KB.NEEDS)")
ck('NEEDS ganhou a categoria pdv', 'pdv' in needs, needs)
ck('regex pdv casa "frente de loja"', ev(A, "KB.NEEDS.pdv.test('nossa frente de loja ainda e manual')"))
ck('regex pdv casa "omnichannel"', ev(A, "KB.NEEDS.pdv.test('queremos virar omnichannel')"))

trans = ev(A, "KB.transversal.find(t=>t.id=='nfce_pdv')")
ck('transversal nfce_pdv existe com 2 fatos sourced', trans is not None and len(trans['fatos']) == 2, trans)

rules = ev(A, "RULES.map(r=>r.id)")
ck('RULES ganhou varejo_pdv e varejo_pagamentos', 'varejo_pdv' in rules and 'varejo_pagamentos' in rules, rules)
r1 = ev(A, "RULES.find(r=>r.id=='varejo_pdv')")
ck('varejo_pdv: seg=[varejo], trans=nfce_pdv, sols corretos', r1['seg']==['varejo'] and r1['trans']=='nfce_pdv' and set(r1['sols'])=={'linx','totvs_omni','systock'}, r1)
r2 = ev(A, "RULES.find(r=>r.id=='varejo_pagamentos')")
ck('varejo_pagamentos: seg=[varejo], sols corretos, requiresBase=[protheus]', r2['seg']==['varejo'] and set(r2['sols'])=={'equals','totvs_pay','antecipa'} and r2['requiresBase']==['protheus'], r2)

# fim-a-fim: cliente sintético em Varejo, com texto de ficha batendo nas 2 regras, gera as 2 oportunidades estruturadas
ev(A, """(()=>{
  const c = { key:'c_varejo_t84', id:'c_varejo_t84', name:'Loja Teste Varejo', segInfo:{id:'varejo', mode:'manual'}, productsIdent:[{id:'protheus'}],
    docs:[{name:'ata.txt', text:'Nossa frente de loja e PDV ainda sao manuais, sem integracao com o estoque. A conciliacao de pix e cartao hoje e manual, gasta muito tempo da equipe financeira.'}] };
  S.clients['c_varejo_t84'] = c; window.__c = c; 0
})()""")
A.wait_for_timeout(200)
ops = ev(A, "(()=>{const c=S.clients['c_varejo_t84']; return buildOpps(c, DEF_WEIGHTS).map(o=>o.ruleId)})()")
print('oportunidades geradas:', ops)
ck('cliente Varejo com evidência gera oportunidade varejo_pdv', 'varejo_pdv' in ops, ops)
ck('cliente Varejo com evidência gera oportunidade varejo_pagamentos', 'varejo_pagamentos' in ops, ops)

# regressão: segmentos/regras pré-existentes não mudaram de contagem
nseg = ev(A, "KB.segments.length"); nrul = ev(A, "RULES.length")
ck('12 segmentos (nenhum criado/removido)', nseg == 12, nseg)
ck('>= 14 RULES (rodada 27; rodadas seguintes só crescem)', nrul >= 14, nrul)

ck('sem erros de página', not errs, errs)
print('FAILS', F)
p.stop()
