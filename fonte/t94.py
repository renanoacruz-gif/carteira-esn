# t94 — rodada 40: aprofunda o segmento Logística/Transportes (tms, gfe,
# NEED/regra tms_frete, ampliação do regex de NEEDS.fiscal para ct-e/mdf-e/ciot)
import sys, time; sys.path.insert(0, '/home/claude/test')
from t40_lib import *
em = 'qa.t94.%d@totvs.com.br' % time.time()
A, errs = open_h(em)
A.wait_for_timeout(500)

tot = ev(A, "KB.solutions.length")
ck('catálogo ganhou 2 soluções (rodada 40; >= 71)', tot >= 71, tot)

tms = ev(A, "KB.sol('tms')")
ck('tms cadastrado com fonte e kw', tms is not None and tms['kw'] and tms['fonte']['u'], tms)
gfe = ev(A, "KB.sol('gfe')")
ck('gfe cadastrado com fonte e kw', gfe is not None and gfe['kw'] and gfe['fonte']['u'], gfe)

seg = ev(A, "KB.segments.find(s=>s.id=='logistica_seg')")
ck('segmento logistica_seg: >=6 tendências sourced', len(seg['tendencias']) >= 6, len(seg['tendencias']))
ck('segmento logistica_seg: aplicacoes aponta para tms e gfe', {'tms', 'gfe'}.issubset(set(a['sol'] for a in seg['aplicacoes'])), seg['aplicacoes'])

needs = ev(A, "Object.keys(KB.NEEDS)")
ck('NEEDS ganhou tms_frete', 'tms_frete' in needs, needs)
ck('regex tms_frete casa "cotação de frete"', ev(A, "KB.NEEDS.tms_frete.test('precisamos agilizar a cotação de frete')"))
ck('regex tms_frete casa "frete embarcador"', ev(A, "KB.NEEDS.tms_frete.test('hoje não temos frete embarcador organizado')"))
ck('regex tms_frete não casa texto não relacionado', not ev(A, "KB.NEEDS.tms_frete.test('vamos revisar o plano de contas')"))

ck('regex fiscal ampliado casa "ct-e"', ev(A, "KB.NEEDS.fiscal.test('o CT-e está sendo rejeitado')"))
ck('regex fiscal ampliado casa "mdf-e"', ev(A, "KB.NEEDS.fiscal.test('precisamos adequar o MDF-e')"))
ck('regex fiscal ampliado casa "ciot"', ev(A, "KB.NEEDS.fiscal.test('o CIOT ficou obrigatório no MDF-e')"))

rules = ev(A, "RULES.map(r=>r.id)")
ck('RULES ganhou logistica_tms_frete', 'logistica_tms_frete' in rules, rules)
rtf = ev(A, "RULES.find(r=>r.id=='logistica_tms_frete')")
ck('logistica_tms_frete: seg=[logistica_seg], sols=[tms,gfe], requiresBase=[protheus]',
   rtf['seg'] == ['logistica_seg'] and rtf['sols'] == ['tms', 'gfe'] and rtf['requiresBase'] == ['protheus'], rtf)

# fim-a-fim 1: cliente Logística com base Protheus + evidência de cotação de frete -> EVIDÊNCIA
ev(A, """(()=>{
  const c = { key:'c_log_t94a', id:'c_log_t94a', name:'Transportadora Teste LTDA', segInfo:{id:'logistica_seg', mode:'manual'}, productsIdent:[{id:'protheus'}], docs:[{name:'ata.txt', text:'Ainda fazemos a cotacao de frete por telefone e planilha, sem torre de controle.'}] };
  S.clients['c_log_t94a'] = c; 0
})()""")
A.wait_for_timeout(200)
ops_a = ev(A, "(()=>{const c=S.clients['c_log_t94a']; return buildOpps(c, DEF_WEIGHTS)})()")
ids_a = [o['ruleId'] for o in ops_a]
ck('cliente Protheus com evidência de cotação de frete gera logistica_tms_frete', 'logistica_tms_frete' in ids_a, ids_a)
op_a = next(o for o in ops_a if o['ruleId'] == 'logistica_tms_frete')
ck('oportunidade gerada por EVIDÊNCIA (não investigação)', op_a['modo'] == 'evidencia', op_a['modo'])

# fim-a-fim 2: cliente Logística com base Protheus identificada mas SEM evidência individual -> INVESTIGAÇÃO
ev(A, """(()=>{
  const c = { key:'c_log_t94b', id:'c_log_t94b', name:'Operador Logistico Teste Sem Evidencia', segInfo:{id:'logistica_seg', mode:'manual'}, productsIdent:[{id:'protheus'}], docs:[] };
  S.clients['c_log_t94b'] = c; 0
})()""")
A.wait_for_timeout(200)
ops_b = ev(A, "(()=>{const c=S.clients['c_log_t94b']; return buildOpps(c, DEF_WEIGHTS).map(o=>({id:o.ruleId, modo:o.modo}))})()")
op_b_tf = next((o for o in ops_b if o['id'] == 'logistica_tms_frete'), None)
ck('base Protheus + tendência setorial, sem evidência -> logistica_tms_frete em INVESTIGAÇÃO', op_b_tf is not None and op_b_tf['modo'] == 'investigacao', ops_b)

# fim-a-fim 3: cliente Logística SEM base Protheus e SEM evidência -> não gera
ev(A, """(()=>{
  const c = { key:'c_log_t94c', id:'c_log_t94c', name:'Transportadora Teste Sem Base Sem Evidencia', segInfo:{id:'logistica_seg', mode:'manual'}, productsIdent:[], docs:[] };
  S.clients['c_log_t94c'] = c; 0
})()""")
A.wait_for_timeout(200)
ops_c = ev(A, "(()=>{const c=S.clients['c_log_t94c']; return buildOpps(c, DEF_WEIGHTS).map(o=>o.ruleId)})()")
ck('sem base Protheus e sem evidência, não gera logistica_tms_frete', 'logistica_tms_frete' not in ops_c, ops_c)

# regressão: segmentos não mudam de quantidade; RULES só cresce
nseg = ev(A, "KB.segments.length"); nrul = ev(A, "RULES.length")
ck('12 segmentos (nenhum criado/removido)', nseg == 12, nseg)
ck('21 RULES (rodada 40; >= 21)', nrul >= 21, nrul)

ck('sem erros de página', not errs, errs)
print('FAILS', F)
p.stop()
