# t96 — rodada 42: aprofunda o segmento Educacional (ativa órfãos
# totvs_educacional/rubeus/gestao_estagio, novos school_guardian/doc_xpress/
# meu_educonnect/sponte, NEEDs/regras educacional_academico, educacional_
# documentos e educacional_evasao)
import sys, time; sys.path.insert(0, '/home/claude/test')
from t40_lib import *
em = 'qa.t96.%d@totvs.com.br' % time.time()
A, errs = open_h(em)
A.wait_for_timeout(500)

tot = ev(A, "KB.solutions.length")
ck('catálogo ganhou 4 soluções novas (rodada 42; >= 76)', tot >= 76, tot)

for sid in ['school_guardian', 'doc_xpress', 'meu_educonnect', 'sponte']:
    s = ev(A, "KB.sol(%r)" % sid)
    ck('%s cadastrado com fonte e kw' % sid, s is not None and s['kw'] and s['fonte']['u'], s)

seg = ev(A, "KB.segments.find(s=>s.id=='educacional')")
ck('segmento educacional: estudo=true', seg['estudo'] is True, seg['estudo'])
ck('segmento educacional: >=6 tendências sourced', len(seg['tendencias']) >= 6, len(seg['tendencias']))
ck('segmento educacional: aplicacoes aponta para os 4 produtos novos + órfãos',
   {'totvs_educacional', 'rubeus', 'doc_xpress', 'school_guardian', 'meu_educonnect', 'sponte'}.issubset(set(a['sol'] for a in seg['aplicacoes'])), seg['aplicacoes'])

needs = ev(A, "Object.keys(KB.NEEDS)")
for nid in ['educacional_academico', 'educacional_documentos', 'educacional_evasao']:
    ck('NEEDS ganhou %s' % nid, nid in needs, needs)
ck('regex educacional_academico casa "processo seletivo"', ev(A, "KB.NEEDS.educacional_academico.test('o processo seletivo ainda e manual')"))
ck('regex educacional_academico casa "captação de alunos"', ev(A, "KB.NEEDS.educacional_academico.test('a captacao de alunos esta fraca este semestre')"))
ck('regex educacional_academico não casa texto não relacionado', not ev(A, "KB.NEEDS.educacional_academico.test('vamos revisar o plano de contas')"))
ck('regex educacional_documentos casa "diploma digital"', ev(A, "KB.NEEDS.educacional_documentos.test('ainda nao emitimos o diploma digital')"))
ck('regex educacional_documentos casa "saída inteligente"', ev(A, "KB.NEEDS.educacional_documentos.test('precisamos de saida inteligente para os alunos')"))
ck('regex educacional_documentos não casa texto não relacionado', not ev(A, "KB.NEEDS.educacional_documentos.test('vamos revisar o plano de contas')"))
ck('regex educacional_evasao casa "evasão escolar"', ev(A, "KB.NEEDS.educacional_evasao.test('a evasao escolar aumentou esse ano')"))
ck('regex educacional_evasao não casa texto não relacionado', not ev(A, "KB.NEEDS.educacional_evasao.test('vamos revisar o plano de contas')"))

rules = ev(A, "RULES.map(r=>r.id)")
for rid in ['educacional_academico_core', 'educacional_jornada_digital', 'educacional_evasao_sponte']:
    ck('RULES ganhou %s' % rid, rid in rules, rules)
rA = ev(A, "RULES.find(r=>r.id=='educacional_academico_core')")
ck('educacional_academico_core: seg=[educacional], sols=[totvs_educacional,rubeus], requiresBase=[rm_erp]',
   rA['seg'] == ['educacional'] and rA['sols'] == ['totvs_educacional', 'rubeus'] and rA['requiresBase'] == ['rm_erp'], rA)
rB = ev(A, "RULES.find(r=>r.id=='educacional_jornada_digital')")
ck('educacional_jornada_digital: sols=[doc_xpress,school_guardian,meu_educonnect], requiresBase=[rm_erp]',
   rB['sols'] == ['doc_xpress', 'school_guardian', 'meu_educonnect'] and rB['requiresBase'] == ['rm_erp'], rB)
rC = ev(A, "RULES.find(r=>r.id=='educacional_evasao_sponte')")
ck('educacional_evasao_sponte: sols=[sponte], requiresBase=[rm_erp]',
   rC['sols'] == ['sponte'] and rC['requiresBase'] == ['rm_erp'], rC)

# fim-a-fim 1: instituição RM com evidência de processo seletivo manual -> EVIDÊNCIA (academico_core)
ev(A, """(()=>{
  const c = { key:'c_edu_t96a', id:'c_edu_t96a', name:'Faculdade Teste LTDA', segInfo:{id:'educacional', mode:'manual'}, productsIdent:[{id:'rm_erp'}], docs:[{name:'ata.txt', text:'O processo seletivo e a matricula ainda sao feitos na mao, sem nenhum funil de captacao de alunos organizado.'}] };
  S.clients['c_edu_t96a'] = c; 0
})()""")
A.wait_for_timeout(200)
ops_a = ev(A, "(()=>{const c=S.clients['c_edu_t96a']; return buildOpps(c, DEF_WEIGHTS)})()")
ids_a = [o['ruleId'] for o in ops_a]
ck('faculdade RM com evidência de processo seletivo gera educacional_academico_core', 'educacional_academico_core' in ids_a, ids_a)
op_a = next(o for o in ops_a if o['ruleId'] == 'educacional_academico_core')
ck('oportunidade educacional_academico_core gerada por EVIDÊNCIA', op_a['modo'] == 'evidencia', op_a['modo'])

# fim-a-fim 2: instituição RM identificada, sem evidência -> INVESTIGAÇÃO (jornada_digital)
ev(A, """(()=>{
  const c = { key:'c_edu_t96b', id:'c_edu_t96b', name:'Escola Teste Sem Evidencia', segInfo:{id:'educacional', mode:'manual'}, productsIdent:[{id:'rm_erp'}], docs:[] };
  S.clients['c_edu_t96b'] = c; 0
})()""")
A.wait_for_timeout(200)
ops_b = ev(A, "(()=>{const c=S.clients['c_edu_t96b']; return buildOpps(c, DEF_WEIGHTS).map(o=>({id:o.ruleId, modo:o.modo}))})()")
op_b_jd = next((o for o in ops_b if o['id'] == 'educacional_jornada_digital'), None)
ck('base RM + tendência setorial, sem evidência -> educacional_jornada_digital em INVESTIGAÇÃO', op_b_jd is not None and op_b_jd['modo'] == 'investigacao', ops_b)

# fim-a-fim 3: instituição RM com evidência de evasão escolar -> EVIDÊNCIA (evasao_sponte)
ev(A, """(()=>{
  const c = { key:'c_edu_t96c', id:'c_edu_t96c', name:'Escola de Idiomas Teste LTDA', segInfo:{id:'educacional', mode:'manual'}, productsIdent:[{id:'rm_erp'}], docs:[{name:'ata.txt', text:'A evasao escolar so aumenta e ainda nao conseguimos prever quais alunos vao sair.'}] };
  S.clients['c_edu_t96c'] = c; 0
})()""")
A.wait_for_timeout(200)
ops_c = ev(A, "(()=>{const c=S.clients['c_edu_t96c']; return buildOpps(c, DEF_WEIGHTS)})()")
ids_c = [o['ruleId'] for o in ops_c]
ck('escola de idiomas RM com evidência de evasão gera educacional_evasao_sponte', 'educacional_evasao_sponte' in ids_c, ids_c)
op_c = next(o for o in ops_c if o['ruleId'] == 'educacional_evasao_sponte')
ck('oportunidade educacional_evasao_sponte gerada por EVIDÊNCIA', op_c['modo'] == 'evidencia', op_c['modo'])

# fim-a-fim 4: cliente Educacional SEM base RM e SEM evidência -> não gera nenhuma das 3 regras novas
ev(A, """(()=>{
  const c = { key:'c_edu_t96d', id:'c_edu_t96d', name:'Colegio Teste Sem Base Sem Evidencia', segInfo:{id:'educacional', mode:'manual'}, productsIdent:[], docs:[] };
  S.clients['c_edu_t96d'] = c; 0
})()""")
A.wait_for_timeout(200)
ops_d = ev(A, "(()=>{const c=S.clients['c_edu_t96d']; return buildOpps(c, DEF_WEIGHTS).map(o=>o.ruleId)})()")
ck('sem base e sem evidência, não gera educacional_academico_core', 'educacional_academico_core' not in ops_d, ops_d)
ck('sem base e sem evidência, não gera educacional_jornada_digital', 'educacional_jornada_digital' not in ops_d, ops_d)
ck('sem base e sem evidência, não gera educacional_evasao_sponte', 'educacional_evasao_sponte' not in ops_d, ops_d)

# regressão: segmentos não mudam de quantidade; RULES só cresce
nseg = ev(A, "KB.segments.length"); nrul = ev(A, "RULES.length")
ck('12 segmentos (nenhum criado/removido)', nseg == 12, nseg)
ck('26 RULES (rodada 42; >= 26)', nrul >= 26, nrul)

ck('sem erros de página', not errs, errs)
print('FAILS', F)
p.stop()
