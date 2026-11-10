# t91 — rodada 37: aprofunda o segmento Serviços/Prestadores de Serviço (Terceirização, Field Service, TOTVS Rental)
import sys, time; sys.path.insert(0, '/home/claude/test')
from t40_lib import *
em = 'qa.t91.%d@totvs.com.br' % time.time()
A, errs = open_h(em)
A.wait_for_timeout(500)

tot = ev(A, "KB.solutions.length")
ck('catálogo ganhou 2 soluções (rodada 37; >= 66)', tot >= 66, tot)

pt = ev(A, "KB.sol('prestadores_terceirizacao')")
ck('prestadores_terceirizacao cadastrado com fonte e kw', pt is not None and pt['kw'] and pt['fonte']['u'], pt)
fsm = ev(A, "KB.sol('fsm_campo')")
ck('fsm_campo cadastrado com fonte e kw', fsm is not None and fsm['kw'] and fsm['fonte']['u'], fsm)
rental = ev(A, "KB.sol('totvs_rental')")
ck('totvs_rental enriquecido mantém fonte única (objeto, não array)', rental is not None and not isinstance(rental['fonte'], list) and rental['fonte']['u'], rental)

seg = ev(A, "KB.segments.find(s=>s.id=='servicos')")
ck('segmento serviços: estudo=true, >=5 tendências sourced', seg['estudo'] == True and len(seg['tendencias']) >= 5, len(seg['tendencias']))
ck('segmento serviços: aplicacoes aponta para prestadores_terceirizacao, fsm_campo e totvs_rental',
   {'prestadores_terceirizacao', 'fsm_campo', 'totvs_rental'}.issubset(set(a['sol'] for a in seg['aplicacoes'])), seg['aplicacoes'])
ck('segmento serviços: resumo não fala só de NFS-e', 'nfs-e de padrão nacional e a reforma tributária mudam a rotina fiscal' != seg['resumo'].lower(), seg['resumo'])

needs = ev(A, "Object.keys(KB.NEEDS)")
ck('NEEDS ganhou terceirizacao e osfcampo', {'terceirizacao', 'osfcampo'}.issubset(set(needs)), needs)
ck('regex terceirizacao casa "terceirização de mão de obra"', ev(A, "KB.NEEDS.terceirizacao.test('fazemos a terceirizacao de mao de obra para varios clientes')"))
ck('regex terceirizacao casa "gestão de contratos com clientes"', ev(A, "KB.NEEDS.terceirizacao.test('a gestao de contratos com clientes ainda e manual')"))
ck('regex terceirizacao não casa texto não relacionado', not ev(A, "KB.NEEDS.terceirizacao.test('vamos revisar o plano de contas')"))
ck('regex osfcampo casa "ordem de serviço em campo"', ev(A, "KB.NEEDS.osfcampo.test('abrimos uma ordem de servico em campo para o tecnico')"))
ck('regex osfcampo casa "técnico em campo"', ev(A, "KB.NEEDS.osfcampo.test('o tecnico em campo registra a visita')"))
ck('regex osfcampo não casa texto não relacionado', not ev(A, "KB.NEEDS.osfcampo.test('vamos revisar o plano de contas')"))

rules = ev(A, "RULES.map(r=>r.id)")
ck('RULES ganhou servicos_terceirizacao e servicos_field_service', {'servicos_terceirizacao', 'servicos_field_service'}.issubset(set(rules)), rules)
r1 = ev(A, "RULES.find(r=>r.id=='servicos_terceirizacao')")
ck('servicos_terceirizacao: seg=[servicos], sols=[prestadores_terceirizacao], requiresBase=[protheus,rm_erp]',
   r1['seg'] == ['servicos'] and r1['sols'] == ['prestadores_terceirizacao'] and set(r1['requiresBase']) == {'protheus', 'rm_erp'}, r1)
r2 = ev(A, "RULES.find(r=>r.id=='servicos_field_service')")
ck('servicos_field_service: seg=[servicos], sols=[fsm_campo], requiresBase=[protheus,rm_erp]',
   r2['seg'] == ['servicos'] and r2['sols'] == ['fsm_campo'] and set(r2['requiresBase']) == {'protheus', 'rm_erp'}, r2)

# fim-a-fim 1: cliente Serviços com base Protheus + evidência de terceirização -> EVIDÊNCIA
ev(A, """(()=>{
  const c = { key:'c_serv_t91a', id:'c_serv_t91a', name:'Terceirizadora Teste LTDA', segInfo:{id:'servicos', mode:'manual'}, productsIdent:[{id:'protheus'}], docs:[{name:'ata.txt', text:'Hoje a gestao de contratos com clientes ainda e manual; fazemos a terceirizacao de mao de obra para varios postos.'}] };
  S.clients['c_serv_t91a'] = c; 0
})()""")
A.wait_for_timeout(200)
ops_a = ev(A, "(()=>{const c=S.clients['c_serv_t91a']; return buildOpps(c, DEF_WEIGHTS)})()")
ids_a = [o['ruleId'] for o in ops_a]
ck('cliente Protheus com evidência de terceirização gera servicos_terceirizacao', 'servicos_terceirizacao' in ids_a, ids_a)
op_a = next(o for o in ops_a if o['ruleId'] == 'servicos_terceirizacao')
ck('oportunidade gerada por EVIDÊNCIA (não investigação)', op_a['modo'] == 'evidencia', op_a['modo'])

# fim-a-fim 2: cliente Serviços com base RM + evidência de field service -> EVIDÊNCIA (RM também serve de base)
ev(A, """(()=>{
  const c = { key:'c_serv_t91b', id:'c_serv_t91b', name:'Field Service Teste LTDA', segInfo:{id:'servicos', mode:'manual'}, productsIdent:[{id:'rm_erp'}], docs:[{name:'ata.txt', text:'O tecnico em campo abre uma ordem de servico em campo para cada visita tecnica.'}] };
  S.clients['c_serv_t91b'] = c; 0
})()""")
A.wait_for_timeout(200)
ops_b = ev(A, "(()=>{const c=S.clients['c_serv_t91b']; return buildOpps(c, DEF_WEIGHTS).map(o=>({id:o.ruleId, modo:o.modo}))})()")
ck('cliente RM com evidência de field service gera servicos_field_service por EVIDÊNCIA',
   any(o['id'] == 'servicos_field_service' and o['modo'] == 'evidencia' for o in ops_b), ops_b)

# fim-a-fim 3: cliente Serviços com base RM identificada mas SEM evidência individual -> INVESTIGAÇÃO (tendência setorial + base)
# base = rm_erp (não protheus) de propósito: 'reforma' e 'nfse' só aceitam requiresBase=[protheus], então não competem
# pelo teto de 3 investigações/cliente, isolando o teste das 2 regras novas (que aceitam protheus OU rm_erp).
ev(A, """(()=>{
  const c = { key:'c_serv_t91c', id:'c_serv_t91c', name:'Serviços Teste Sem Evidencia', segInfo:{id:'servicos', mode:'manual'}, productsIdent:[{id:'rm_erp'}], docs:[] };
  S.clients['c_serv_t91c'] = c; 0
})()""")
A.wait_for_timeout(200)
ops_c = ev(A, "(()=>{const c=S.clients['c_serv_t91c']; return buildOpps(c, DEF_WEIGHTS).map(o=>({id:o.ruleId, modo:o.modo}))})()")
op_c1 = next((o for o in ops_c if o['id'] == 'servicos_terceirizacao'), None)
op_c2 = next((o for o in ops_c if o['id'] == 'servicos_field_service'), None)
ck('base RM + tendência setorial, sem evidência -> servicos_terceirizacao em INVESTIGAÇÃO', op_c1 is not None and op_c1['modo'] == 'investigacao', ops_c)
ck('base RM + tendência setorial, sem evidência -> servicos_field_service em INVESTIGAÇÃO', op_c2 is not None and op_c2['modo'] == 'investigacao', ops_c)

# fim-a-fim 4: cliente Serviços SEM base (Protheus/RM) e SEM evidência -> não gera nenhuma das duas (investigação exige base)
ev(A, """(()=>{
  const c = { key:'c_serv_t91d', id:'c_serv_t91d', name:'Serviços Teste Sem Base Sem Evidencia', segInfo:{id:'servicos', mode:'manual'}, productsIdent:[], docs:[] };
  S.clients['c_serv_t91d'] = c; 0
})()""")
A.wait_for_timeout(200)
ops_d = ev(A, "(()=>{const c=S.clients['c_serv_t91d']; return buildOpps(c, DEF_WEIGHTS).map(o=>o.ruleId)})()")
ck('sem base e sem evidência, não gera servicos_terceirizacao', 'servicos_terceirizacao' not in ops_d, ops_d)
ck('sem base e sem evidência, não gera servicos_field_service', 'servicos_field_service' not in ops_d, ops_d)

# regressão: contagens só crescem
nseg = ev(A, "KB.segments.length"); nrul = ev(A, "RULES.length")
ck('12 segmentos (nenhum criado/removido)', nseg == 12, nseg)
ck('18 RULES (rodada 37; >= 18)', nrul >= 18, nrul)

ck('sem erros de página', not errs, errs)
print('FAILS', F)
p.stop()
