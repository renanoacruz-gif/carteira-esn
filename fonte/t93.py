# t93 — rodada 39: aprofunda o segmento Agronegócio/Agroindústria (agro_comercializacao,
# agro_bioenergia informativo, NEED/regra agrocomercial, correção do requiresBase da regra
# compartilhada 'logistica' — distribuicao/logistica_seg/agro)
import sys, time; sys.path.insert(0, '/home/claude/test')
from t40_lib import *
em = 'qa.t93.%d@totvs.com.br' % time.time()
A, errs = open_h(em)
A.wait_for_timeout(500)

tot = ev(A, "KB.solutions.length")
ck('catálogo ganhou 2 soluções (rodada 39; >= 69)', tot >= 69, tot)

agrocom = ev(A, "KB.sol('agro_comercializacao')")
ck('agro_comercializacao cadastrado com fonte e kw', agrocom is not None and agrocom['kw'] and agrocom['fonte']['u'], agrocom)
agrobio = ev(A, "KB.sol('agro_bioenergia')")
ck('agro_bioenergia cadastrado com fonte e kw', agrobio is not None and agrobio['kw'] and agrobio['fonte']['u'], agrobio)

seg = ev(A, "KB.segments.find(s=>s.id=='agro')")
ck('segmento agro: estudo=true, >=6 tendências sourced', seg['estudo'] == True and len(seg['tendencias']) >= 6, len(seg['tendencias']))
ck('segmento agro: aplicacoes aponta para agro_comercializacao e agro_bioenergia', {'agro_comercializacao', 'agro_bioenergia'}.issubset(set(a['sol'] for a in seg['aplicacoes'])), seg['aplicacoes'])

needs = ev(A, "Object.keys(KB.NEEDS)")
ck('NEEDS ganhou agrocomercial', 'agrocomercial' in needs, needs)
ck('regex agrocomercial casa "comercialização de grãos manual"', ev(A, "KB.NEEDS.agrocomercial.test('fazemos a comercialização de grãos manual ainda')"))
ck('regex agrocomercial casa "armazenagem de grãos"', ev(A, "KB.NEEDS.agrocomercial.test('a armazenagem de grãos é controlada à parte')"))
ck('regex agrocomercial não casa texto não relacionado', not ev(A, "KB.NEEDS.agrocomercial.test('vamos revisar o plano de contas')"))

rules = ev(A, "RULES.map(r=>r.id)")
ck('RULES ganhou agro_comercializacao', 'agro_comercializacao' in rules, rules)
rac = ev(A, "RULES.find(r=>r.id=='agro_comercializacao')")
ck('agro_comercializacao: seg=[agro], sols=[agro_comercializacao], requiresBase=[protheus,rm_erp,datasul_erp]',
   rac['seg'] == ['agro'] and rac['sols'] == ['agro_comercializacao'] and set(rac['requiresBase']) == {'protheus', 'rm_erp', 'datasul_erp'}, rac)

rlog = ev(A, "RULES.find(r=>r.id=='logistica')")
ck('regra logistica corrigida: requiresBase agora é [protheus,rm_erp,datasul_erp,winthor_erp] (antes era vazio)',
   set(rlog['requiresBase']) == {'protheus', 'rm_erp', 'datasul_erp', 'winthor_erp'}, rlog['requiresBase'])

# fim-a-fim 1: cliente Agro com base Datasul + evidência de comercialização manual de grãos -> EVIDÊNCIA
ev(A, """(()=>{
  const c = { key:'c_agro_t93a', id:'c_agro_t93a', name:'Cooperativa Teste LTDA', segInfo:{id:'agro', mode:'manual'}, productsIdent:[{id:'datasul_erp'}], docs:[{name:'ata.txt', text:'Ainda fazemos a comercializacao de graos manual em planilha, sem controle de qualidade na recepcao.'}] };
  S.clients['c_agro_t93a'] = c; 0
})()""")
A.wait_for_timeout(200)
ops_a = ev(A, "(()=>{const c=S.clients['c_agro_t93a']; return buildOpps(c, DEF_WEIGHTS)})()")
ids_a = [o['ruleId'] for o in ops_a]
ck('cliente Datasul com evidência de comercialização manual gera agro_comercializacao', 'agro_comercializacao' in ids_a, ids_a)
op_a = next(o for o in ops_a if o['ruleId'] == 'agro_comercializacao')
ck('oportunidade gerada por EVIDÊNCIA (não investigação)', op_a['modo'] == 'evidencia', op_a['modo'])

# fim-a-fim 2: cliente Agro com base RM identificada mas SEM evidência individual -> INVESTIGAÇÃO
# (agro só tem 2 regras elegíveis para investigação -- agro_comercializacao e logistica --
#  bem abaixo do teto de 3 investigações por cliente, então nenhuma compete pelo teto aqui)
ev(A, """(()=>{
  const c = { key:'c_agro_t93b', id:'c_agro_t93b', name:'Agroindustria Teste Sem Evidencia', segInfo:{id:'agro', mode:'manual'}, productsIdent:[{id:'rm_erp'}], docs:[] };
  S.clients['c_agro_t93b'] = c; 0
})()""")
A.wait_for_timeout(200)
ops_b = ev(A, "(()=>{const c=S.clients['c_agro_t93b']; return buildOpps(c, DEF_WEIGHTS).map(o=>({id:o.ruleId, modo:o.modo}))})()")
op_b_ac = next((o for o in ops_b if o['id'] == 'agro_comercializacao'), None)
op_b_log = next((o for o in ops_b if o['id'] == 'logistica'), None)
ck('base RM + tendência setorial, sem evidência -> agro_comercializacao em INVESTIGAÇÃO', op_b_ac is not None and op_b_ac['modo'] == 'investigacao', ops_b)
ck('base RM + tendência setorial, sem evidência -> logistica em INVESTIGAÇÃO (correção do requiresBase)', op_b_log is not None and op_b_log['modo'] == 'investigacao', ops_b)

# fim-a-fim 3: cliente Agro SEM base (protheus/rm/datasul) e SEM evidência -> nenhuma das duas regras gera
ev(A, """(()=>{
  const c = { key:'c_agro_t93c', id:'c_agro_t93c', name:'Fazenda Teste Sem Base Sem Evidencia', segInfo:{id:'agro', mode:'manual'}, productsIdent:[], docs:[] };
  S.clients['c_agro_t93c'] = c; 0
})()""")
A.wait_for_timeout(200)
ops_c = ev(A, "(()=>{const c=S.clients['c_agro_t93c']; return buildOpps(c, DEF_WEIGHTS).map(o=>o.ruleId)})()")
ck('sem base e sem evidência, não gera agro_comercializacao', 'agro_comercializacao' not in ops_c, ops_c)
ck('sem base e sem evidência, não gera logistica', 'logistica' not in ops_c, ops_c)

# regressão: segmentos não mudam de quantidade (agro já existia); RULES só cresce
nseg = ev(A, "KB.segments.length"); nrul = ev(A, "RULES.length")
ck('12 segmentos (nenhum criado/removido)', nseg == 12, nseg)
ck('20 RULES (rodada 39; >= 20)', nrul >= 20, nrul)

ck('sem erros de página', not errs, errs)
print('FAILS', F)
p.stop()
