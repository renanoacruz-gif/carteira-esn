# t92 — rodada 38: aprofunda o segmento Construção/Engenharia (TCGI, correção de nome do 'obras',
# correção do requiresBase da regra 'obras', NEED/regra posvendaimob)
import sys, time; sys.path.insert(0, '/home/claude/test')
from t40_lib import *
em = 'qa.t92.%d@totvs.com.br' % time.time()
A, errs = open_h(em)
A.wait_for_timeout(500)

tot = ev(A, "KB.solutions.length")
ck('catálogo ganhou 1 solução (rodada 38; >= 67)', tot >= 67, tot)

obras = ev(A, "KB.sol('obras')")
ck('obras: nome oficial corrigido (TOTVS Construção Obras e Projetos)', 'Construção Obras e Projetos' in obras['nome'], obras['nome'])
tcgi = ev(A, "KB.sol('tcgi')")
ck('tcgi cadastrado com fonte e kw', tcgi is not None and tcgi['kw'] and tcgi['fonte']['u'], tcgi)

seg = ev(A, "KB.segments.find(s=>s.id=='construcao')")
ck('segmento construção: estudo=true, >=6 tendências sourced', seg['estudo'] == True and len(seg['tendencias']) >= 6, len(seg['tendencias']))
ck('segmento construção: aplicacoes aponta para tcgi', 'tcgi' in set(a['sol'] for a in seg['aplicacoes']), seg['aplicacoes'])

needs = ev(A, "Object.keys(KB.NEEDS)")
ck('NEEDS ganhou posvendaimob', 'posvendaimob' in needs, needs)
ck('regex posvendaimob casa "distrato"', ev(A, "KB.NEEDS.posvendaimob.test('o cliente pediu o distrato do contrato')"))
ck('regex posvendaimob casa "segunda via de boleto"', ev(A, "KB.NEEDS.posvendaimob.test('precisamos emitir a segunda via de boleto')"))
ck('regex posvendaimob não casa texto não relacionado', not ev(A, "KB.NEEDS.posvendaimob.test('vamos revisar o plano de contas')"))

rules = ev(A, "RULES.map(r=>r.id)")
ck('RULES ganhou construcao_posvenda_imobiliario', 'construcao_posvenda_imobiliario' in rules, rules)
rpv = ev(A, "RULES.find(r=>r.id=='construcao_posvenda_imobiliario')")
ck('construcao_posvenda_imobiliario: seg=[construcao], sols=[tcgi], requiresBase=[rm_erp]',
   rpv['seg'] == ['construcao'] and rpv['sols'] == ['tcgi'] and rpv['requiresBase'] == ['rm_erp'], rpv)

robras = ev(A, "RULES.find(r=>r.id=='obras')")
ck('regra obras corrigida: requiresBase agora é [protheus, rm_erp] (antes era vazio)', set(robras['requiresBase']) == {'protheus', 'rm_erp'}, robras['requiresBase'])

# fim-a-fim 1: cliente Construção com base RM + evidência de pós-venda imobiliário -> EVIDÊNCIA
ev(A, """(()=>{
  const c = { key:'c_constr_t92a', id:'c_constr_t92a', name:'Incorporadora Teste LTDA', segInfo:{id:'construcao', mode:'manual'}, productsIdent:[{id:'rm_erp'}], docs:[{name:'ata.txt', text:'Tivemos um pedido de distrato esta semana e ainda emitimos a segunda via de boleto manualmente.'}] };
  S.clients['c_constr_t92a'] = c; 0
})()""")
A.wait_for_timeout(200)
ops_a = ev(A, "(()=>{const c=S.clients['c_constr_t92a']; return buildOpps(c, DEF_WEIGHTS)})()")
ids_a = [o['ruleId'] for o in ops_a]
ck('cliente RM com evidência de pós-venda imobiliário gera construcao_posvenda_imobiliario', 'construcao_posvenda_imobiliario' in ids_a, ids_a)
op_a = next(o for o in ops_a if o['ruleId'] == 'construcao_posvenda_imobiliario')
ck('oportunidade gerada por EVIDÊNCIA (não investigação)', op_a['modo'] == 'evidencia', op_a['modo'])

# fim-a-fim 2: cliente Construção com base RM identificada mas SEM evidência -> INVESTIGAÇÃO (tendência setorial + base)
# (base = rm_erp, não protheus, para não competir com o teto de investigações com outras regras que só aceitam protheus)
ev(A, """(()=>{
  const c = { key:'c_constr_t92b', id:'c_constr_t92b', name:'Construtora Teste Sem Evidencia', segInfo:{id:'construcao', mode:'manual'}, productsIdent:[{id:'rm_erp'}], docs:[] };
  S.clients['c_constr_t92b'] = c; 0
})()""")
A.wait_for_timeout(200)
ops_b = ev(A, "(()=>{const c=S.clients['c_constr_t92b']; return buildOpps(c, DEF_WEIGHTS).map(o=>({id:o.ruleId, modo:o.modo}))})()")
op_b_obras = next((o for o in ops_b if o['id'] == 'obras'), None)
op_b_pv = next((o for o in ops_b if o['id'] == 'construcao_posvenda_imobiliario'), None)
ck('base RM + tendência setorial, sem evidência -> regra obras em INVESTIGAÇÃO (correção do requiresBase)', op_b_obras is not None and op_b_obras['modo'] == 'investigacao', ops_b)
ck('base RM + tendência setorial, sem evidência -> construcao_posvenda_imobiliario em INVESTIGAÇÃO', op_b_pv is not None and op_b_pv['modo'] == 'investigacao', ops_b)

# fim-a-fim 3: cliente Construção SEM base (protheus/rm) e SEM evidência -> nenhuma das duas regras gera
ev(A, """(()=>{
  const c = { key:'c_constr_t92c', id:'c_constr_t92c', name:'Construtora Teste Sem Base Sem Evidencia', segInfo:{id:'construcao', mode:'manual'}, productsIdent:[], docs:[] };
  S.clients['c_constr_t92c'] = c; 0
})()""")
A.wait_for_timeout(200)
ops_c = ev(A, "(()=>{const c=S.clients['c_constr_t92c']; return buildOpps(c, DEF_WEIGHTS).map(o=>o.ruleId)})()")
ck('sem base e sem evidência, não gera obras', 'obras' not in ops_c, ops_c)
ck('sem base e sem evidência, não gera construcao_posvenda_imobiliario', 'construcao_posvenda_imobiliario' not in ops_c, ops_c)

# regressão: contagens só crescem
nseg = ev(A, "KB.segments.length"); nrul = ev(A, "RULES.length")
ck('12 segmentos (nenhum criado/removido)', nseg == 12, nseg)
ck('19 RULES (rodada 38; >= 19)', nrul >= 19, nrul)

ck('sem erros de página', not errs, errs)
print('FAILS', F)
p.stop()
