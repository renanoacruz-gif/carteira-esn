# t95 — rodada 41: aprofunda o segmento Saúde (correção datasul_gps, novo
# saude_gestor_tiss, NEEDs/regras saude_regulatorio e saude_hospitalar
# ativando o rm_saude órfão, segmento saude estudado)
import sys, time; sys.path.insert(0, '/home/claude/test')
from t40_lib import *
em = 'qa.t95.%d@totvs.com.br' % time.time()
A, errs = open_h(em)
A.wait_for_timeout(500)

tot = ev(A, "KB.solutions.length")
ck('catálogo ganhou 1 solução nova (rodada 41; >= 72)', tot >= 72, tot)

dg = ev(A, "KB.sol('datasul_gps')")
ck('datasul_gps corrigido: nome TOTVS Saúde Planos, integraProtheus=true', 'TOTVS Saúde Planos' in dg['nome'] and dg['integraProtheus'] is True, dg)

tiss = ev(A, "KB.sol('saude_gestor_tiss')")
ck('saude_gestor_tiss cadastrado com fonte e kw', tiss is not None and tiss['kw'] and tiss['fonte']['u'], tiss)

seg = ev(A, "KB.segments.find(s=>s.id=='saude')")
ck('segmento saude: estudo=true', seg['estudo'] is True, seg['estudo'])
ck('segmento saude: >=6 tendências sourced', len(seg['tendencias']) >= 6, len(seg['tendencias']))
ck('segmento saude: aplicacoes aponta para rm_saude, datasul_gps, saude_gestor_tiss',
   {'rm_saude', 'datasul_gps', 'saude_gestor_tiss'}.issubset(set(a['sol'] for a in seg['aplicacoes'])), seg['aplicacoes'])

needs = ev(A, "Object.keys(KB.NEEDS)")
ck('NEEDS ganhou saude_regulatorio', 'saude_regulatorio' in needs, needs)
ck('NEEDS ganhou saude_hospitalar', 'saude_hospitalar' in needs, needs)
ck('regex saude_regulatorio casa "TISS"', ev(A, "KB.NEEDS.saude_regulatorio.test('o envio do TISS está atrasado')"))
ck('regex saude_regulatorio casa "IDSS"', ev(A, "KB.NEEDS.saude_regulatorio.test('precisamos simular o IDSS deste ano')"))
ck('regex saude_regulatorio não casa texto não relacionado', not ev(A, "KB.NEEDS.saude_regulatorio.test('vamos revisar o plano de contas')"))
ck('regex saude_hospitalar casa "prontuário eletrônico"', ev(A, "KB.NEEDS.saude_hospitalar.test('o prontuário eletrônico ainda é em papel')"))
ck('regex saude_hospitalar casa "faturamento hospitalar"', ev(A, "KB.NEEDS.saude_hospitalar.test('o faturamento hospitalar está com glosa alta')"))
ck('regex saude_hospitalar não casa texto não relacionado', not ev(A, "KB.NEEDS.saude_hospitalar.test('vamos revisar o plano de contas')"))

rules = ev(A, "RULES.map(r=>r.id)")
ck('RULES ganhou saude_regulatorio', 'saude_regulatorio' in rules, rules)
ck('RULES ganhou saude_hospitalar', 'saude_hospitalar' in rules, rules)
rr = ev(A, "RULES.find(r=>r.id=='saude_regulatorio')")
ck('saude_regulatorio: seg=[saude], sols=[saude_gestor_tiss], requiresBase=[protheus,datasul_erp]',
   rr['seg'] == ['saude'] and rr['sols'] == ['saude_gestor_tiss'] and rr['requiresBase'] == ['protheus', 'datasul_erp'], rr)
rh = ev(A, "RULES.find(r=>r.id=='saude_hospitalar')")
ck('saude_hospitalar: seg=[saude], sols=[rm_saude], requiresBase=[rm_erp]',
   rh['seg'] == ['saude'] and rh['sols'] == ['rm_saude'] and rh['requiresBase'] == ['rm_erp'], rh)

# fim-a-fim 1: operadora de saúde com base Protheus + evidência TISS/IDSS -> EVIDÊNCIA
ev(A, """(()=>{
  const c = { key:'c_sau_t95a', id:'c_sau_t95a', name:'Operadora Saude Teste LTDA', segInfo:{id:'saude', mode:'manual'}, productsIdent:[{id:'protheus'}], docs:[{name:'ata.txt', text:'O envio do TISS atrasa todo mes e ainda nao conseguimos simular o IDSS deste ano sem apoio do sistema.'}] };
  S.clients['c_sau_t95a'] = c; 0
})()""")
A.wait_for_timeout(200)
ops_a = ev(A, "(()=>{const c=S.clients['c_sau_t95a']; return buildOpps(c, DEF_WEIGHTS)})()")
ids_a = [o['ruleId'] for o in ops_a]
ck('operadora Protheus com evidência TISS/IDSS gera saude_regulatorio', 'saude_regulatorio' in ids_a, ids_a)
op_a = next(o for o in ops_a if o['ruleId'] == 'saude_regulatorio')
ck('oportunidade saude_regulatorio gerada por EVIDÊNCIA', op_a['modo'] == 'evidencia', op_a['modo'])

# fim-a-fim 2: operadora com base Protheus identificada mas SEM evidência -> INVESTIGAÇÃO
ev(A, """(()=>{
  const c = { key:'c_sau_t95b', id:'c_sau_t95b', name:'Operadora Saude Teste Sem Evidencia', segInfo:{id:'saude', mode:'manual'}, productsIdent:[{id:'protheus'}], docs:[] };
  S.clients['c_sau_t95b'] = c; 0
})()""")
A.wait_for_timeout(200)
ops_b = ev(A, "(()=>{const c=S.clients['c_sau_t95b']; return buildOpps(c, DEF_WEIGHTS).map(o=>({id:o.ruleId, modo:o.modo}))})()")
op_b_rt = next((o for o in ops_b if o['id'] == 'saude_regulatorio'), None)
ck('base Protheus + tendência setorial, sem evidência -> saude_regulatorio em INVESTIGAÇÃO', op_b_rt is not None and op_b_rt['modo'] == 'investigacao', ops_b)

# fim-a-fim 3: hospital com base RM + evidência de prontuário/faturamento -> EVIDÊNCIA (saude_hospitalar)
ev(A, """(()=>{
  const c = { key:'c_sau_t95c', id:'c_sau_t95c', name:'Hospital Teste LTDA', segInfo:{id:'saude', mode:'manual'}, productsIdent:[{id:'rm_erp'}], docs:[{name:'ata.txt', text:'O prontuario eletronico ainda eh em papel e o faturamento hospitalar tem muita glosa.'}] };
  S.clients['c_sau_t95c'] = c; 0
})()""")
A.wait_for_timeout(200)
ops_c = ev(A, "(()=>{const c=S.clients['c_sau_t95c']; return buildOpps(c, DEF_WEIGHTS)})()")
ids_c = [o['ruleId'] for o in ops_c]
ck('hospital RM com evidência de prontuário/faturamento gera saude_hospitalar', 'saude_hospitalar' in ids_c, ids_c)
op_c = next(o for o in ops_c if o['ruleId'] == 'saude_hospitalar')
ck('oportunidade saude_hospitalar gerada por EVIDÊNCIA', op_c['modo'] == 'evidencia', op_c['modo'])

# fim-a-fim 4: cliente Saúde SEM base compatível e SEM evidência -> não gera nenhuma das 2 regras novas
ev(A, """(()=>{
  const c = { key:'c_sau_t95d', id:'c_sau_t95d', name:'Clinica Teste Sem Base Sem Evidencia', segInfo:{id:'saude', mode:'manual'}, productsIdent:[], docs:[] };
  S.clients['c_sau_t95d'] = c; 0
})()""")
A.wait_for_timeout(200)
ops_d = ev(A, "(()=>{const c=S.clients['c_sau_t95d']; return buildOpps(c, DEF_WEIGHTS).map(o=>o.ruleId)})()")
ck('sem base e sem evidência, não gera saude_regulatorio', 'saude_regulatorio' not in ops_d, ops_d)
ck('sem base e sem evidência, não gera saude_hospitalar', 'saude_hospitalar' not in ops_d, ops_d)

# regressão: segmentos não mudam de quantidade; RULES só cresce
nseg = ev(A, "KB.segments.length"); nrul = ev(A, "RULES.length")
ck('12 segmentos (nenhum criado/removido)', nseg == 12, nseg)
ck('23 RULES (rodada 41; >= 23)', nrul >= 23, nrul)

ck('sem erros de página', not errs, errs)
print('FAILS', F)
p.stop()
