# t90 — rodada 36: aprofunda o segmento Distribuição/Atacado (ERP Winthor, B2B by Isthmus, NEED vendasb2b)
import sys, time; sys.path.insert(0, '/home/claude/test')
from t40_lib import *
em = 'qa.t90.%d@totvs.com.br' % time.time()
A, errs = open_h(em)
A.wait_for_timeout(500)

tot = ev(A, "KB.solutions.length")
ck('catálogo ganhou 2 soluções (rodada 36; >= 64)', tot >= 64, tot)

w = ev(A, "KB.sol('winthor_erp')")
ck('winthor_erp cadastrado com fonte e kw', w is not None and w['kw'] and w['fonte']['u'], w)
b = ev(A, "KB.sol('b2b_isthmus')")
ck('b2b_isthmus cadastrado com fonte e kw', b is not None and b['kw'] and b['fonte']['u'], b)

seg = ev(A, "KB.segments.find(s=>s.id=='distribuicao')")
ck('segmento distribuição: estudo=true, >=5 tendências sourced', seg['estudo'] == True and len(seg['tendencias']) >= 5, len(seg['tendencias']))
ck('segmento distribuição: aplicacoes aponta para winthor_erp e b2b_isthmus', {'winthor_erp', 'b2b_isthmus'}.issubset(set(a['sol'] for a in seg['aplicacoes'])), seg['aplicacoes'])
ck('segmento distribuição: resumo não fala só de bebidas', 'bebidas' not in seg['resumo'].lower(), seg['resumo'])

needs = ev(A, "Object.keys(KB.NEEDS)")
ck('NEEDS ganhou a categoria vendasb2b', 'vendasb2b' in needs, needs)
ck('regex vendasb2b casa "pedido por telefone"', ev(A, "KB.NEEDS.vendasb2b.test('o cliente faz o pedido por telefone')"))
ck('regex vendasb2b casa "catálogo impresso"', ev(A, "KB.NEEDS.vendasb2b.test('ainda usamos catalogo impresso')"))
ck('regex vendasb2b casa "sem portal b2b"', ev(A, "KB.NEEDS.vendasb2b.test('nao temos portal b2b hoje')"))
ck('regex vendasb2b não casa texto não relacionado', not ev(A, "KB.NEEDS.vendasb2b.test('vamos revisar o plano de contas')"))

rules = ev(A, "RULES.map(r=>r.id)")
ck('RULES ganhou distribuicao_vendas_b2b', 'distribuicao_vendas_b2b' in rules, rules)
r = ev(A, "RULES.find(r=>r.id=='distribuicao_vendas_b2b')")
ck('distribuicao_vendas_b2b: seg=[distribuicao], sols=[b2b_isthmus], requiresBase=[winthor_erp]', r['seg'] == ['distribuicao'] and r['sols'] == ['b2b_isthmus'] and r['requiresBase'] == ['winthor_erp'], r)

# fim-a-fim 1: cliente Distribuição com base Winthor + evidência de pedido manual -> oportunidade por EVIDÊNCIA
ev(A, """(()=>{
  const c = { key:'c_dist_t90a', id:'c_dist_t90a', name:'Atacadista Teste LTDA', segInfo:{id:'distribuicao', mode:'manual'}, productsIdent:[{id:'winthor_erp'}], docs:[{name:'ata.txt', text:'Hoje o pedido do cliente e feito por telefone ou catalogo impresso; o representante ainda digita tudo manualmente no sistema.'}] };
  S.clients['c_dist_t90a'] = c; 0
})()""")
A.wait_for_timeout(200)
ops_a = ev(A, "(()=>{const c=S.clients['c_dist_t90a']; return buildOpps(c, DEF_WEIGHTS)})()")
ids_a = [o['ruleId'] for o in ops_a]
ck('cliente com base Winthor + evidência de pedido manual gera distribuicao_vendas_b2b', 'distribuicao_vendas_b2b' in ids_a, ids_a)
op_a = next(o for o in ops_a if o['ruleId'] == 'distribuicao_vendas_b2b')
ck('oportunidade gerada por EVIDÊNCIA (não investigação)', op_a['modo'] == 'evidencia', op_a['modo'])

# fim-a-fim 2: cliente Distribuição SEM base Winthor identificada, mesma evidência -> NÃO deve exigir base p/ modo evidência (evidência vale mesmo sem base)
ev(A, """(()=>{
  const c = { key:'c_dist_t90b', id:'c_dist_t90b', name:'Distribuidora Teste Sem Base', segInfo:{id:'distribuicao', mode:'manual'}, productsIdent:[], docs:[{name:'ata.txt', text:'O pedido ainda e feito por telefone, sem portal b2b.'}] };
  S.clients['c_dist_t90b'] = c; 0
})()""")
A.wait_for_timeout(200)
ops_b = ev(A, "(()=>{const c=S.clients['c_dist_t90b']; return buildOpps(c, DEF_WEIGHTS).map(o=>({id:o.ruleId, modo:o.modo}))})()")
ck('evidência individual gera oportunidade mesmo sem base Winthor identificada', any(o['id'] == 'distribuicao_vendas_b2b' for o in ops_b), ops_b)

# fim-a-fim 3: cliente Distribuição com base Winthor identificada mas SEM evidência individual -> INVESTIGAÇÃO (tendência setorial + base identificada)
ev(A, """(()=>{
  const c = { key:'c_dist_t90c', id:'c_dist_t90c', name:'Distribuidora Teste Sem Evidencia', segInfo:{id:'distribuicao', mode:'manual'}, productsIdent:[{id:'winthor_erp'}], docs:[] };
  S.clients['c_dist_t90c'] = c; 0
})()""")
A.wait_for_timeout(200)
ops_c = ev(A, "(()=>{const c=S.clients['c_dist_t90c']; return buildOpps(c, DEF_WEIGHTS).map(o=>({id:o.ruleId, modo:o.modo}))})()")
op_c = next((o for o in ops_c if o['id'] == 'distribuicao_vendas_b2b'), None)
ck('base Winthor identificada + tendência setorial, sem evidência individual -> INVESTIGAÇÃO', op_c is not None and op_c['modo'] == 'investigacao', ops_c)

# fim-a-fim 4: cliente Distribuição SEM base Winthor e SEM evidência individual -> não gera (investigação exige base)
ev(A, """(()=>{
  const c = { key:'c_dist_t90d', id:'c_dist_t90d', name:'Distribuidora Teste Sem Base Sem Evidencia', segInfo:{id:'distribuicao', mode:'manual'}, productsIdent:[], docs:[] };
  S.clients['c_dist_t90d'] = c; 0
})()""")
A.wait_for_timeout(200)
ops_d = ev(A, "(()=>{const c=S.clients['c_dist_t90d']; return buildOpps(c, DEF_WEIGHTS).map(o=>o.ruleId)})()")
ck('sem base Winthor e sem evidência individual, não gera distribuicao_vendas_b2b', 'distribuicao_vendas_b2b' not in ops_d, ops_d)

# regressão: contagens só crescem
nseg = ev(A, "KB.segments.length"); nrul = ev(A, "RULES.length")
ck('12 segmentos (nenhum criado/removido)', nseg == 12, nseg)
ck('16 RULES (rodada 36; >= 16)', nrul >= 16, nrul)

ck('sem erros de página', not errs, errs)
print('FAILS', F)
p.stop()
